from flask import Flask, request, jsonify, Response, render_template
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import json
import time
import requests
from requests.auth import HTTPDigestAuth
import os
import threading

app = Flask(__name__)
CORS(app)

# ==========================================
# CONFIGURACIÓN DE CÁMARAS
# ==========================================
DEFAULT_CAMERA_IP = os.environ.get("CAMERA_IP", "192.168.0.114")
DEFAULT_USER = os.environ.get("CAMERA_USER", "jdaza")
DEFAULT_PASS = os.environ.get("CAMERA_PASS", "Jdaza2026.")

# Diccionario de cámaras disponibles
CAMERAS = {
    "default": f"http://{DEFAULT_CAMERA_IP}/ISAPI/Streaming/channels/801/picture", # Por defecto Cam 8
    "cam-08": f"http://{DEFAULT_CAMERA_IP}/ISAPI/Streaming/channels/801/picture",
    "cam-01": f"http://{DEFAULT_CAMERA_IP}/ISAPI/Streaming/channels/101/picture", # Nueva Cam 1
}

# Configuración de cámaras (indica si necesita auth)
CAMERA_CONFIG = {
    "default": {"requires_auth": True},
    "cam-08": {"requires_auth": True},
    "cam-01": {"requires_auth": True},
}

# ==========================================
# MODELO Y VARIABLES GLOBALES
# ==========================================
model = YOLO('yolov8s.pt')
try:
    with open("coco.txt", "r") as f:
        class_list = f.read().split("\n")
except:
    class_list = model.names

camera_zones = {}
video_states = {}
camera_current_state = {}

# Archivo de persistencia
ZONES_FILE = "zones.json"

def load_zones_from_file():
    """Carga las zonas desde el archivo JSON si existe"""
    if os.path.exists(ZONES_FILE):
        try:
            with open(ZONES_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error cargando zonas guardadas: {e}")
    return {}

def save_zones_to_file():
    """Guarda todas las zonas en el archivo JSON"""
    try:
        with open(ZONES_FILE, 'w') as f:
            json.dump(camera_zones, f, indent=2)
        print("💾 Zonas guardadas en disco.")
    except Exception as e:
        print(f"❌ Error guardando zonas: {e}")

# Cargar zonas al inicio
camera_zones = load_zones_from_file()

# Zonas por defecto solo si no hay nada cargado
if not camera_zones:
    DEFAULT_PARKING_ZONES = [
        {"id": "zone-1", "spaceNumber": 1, "coordinates": [{"x": 52, "y": 364}, {"x": 30, "y": 417}, {"x": 73, "y": 412}, {"x": 88, "y": 369}]},
        {"id": "zone-2", "spaceNumber": 2, "coordinates": [{"x": 105, "y": 353}, {"x": 86, "y": 428}, {"x": 137, "y": 427}, {"x": 146, "y": 358}]}
    ]
else:
    DEFAULT_PARKING_ZONES = [] # Ya tenemos zonas reales

# ==========================================
# CLASE DE CÁMARA HTTP (Virtual)
# ==========================================
class HttpCamera:
    def __init__(self, url, user=None, password=None, requires_auth=True):
        self.url = url
        self.requires_auth = requires_auth
        self.is_stream = "video" in url.lower()
        if requires_auth and user and password:
            self.auth = HTTPDigestAuth(user, password)
            self.basic_auth = (user, password)
        else:
            self.auth = None
            self.basic_auth = None
        self.last_frame = None
        self.last_success = 0
        self.stream_response = None
        self.cv_cap = None
        
        # Si es un stream de video (DroidCam), usar OpenCV VideoCapture
        if self.is_stream:
            print(f"🎥 Inicializando stream de video: {url}")
            self.cv_cap = cv2.VideoCapture(url)
            if self.cv_cap.isOpened():
                print(f"✅ Stream conectado")
    
    def read(self):
        """Simula el comportamiento de cap.read() de OpenCV"""
        # Si es un stream de video, usar VideoCapture
        if self.is_stream and self.cv_cap:
            ret, frame = self.cv_cap.read()
            if ret and frame is not None:
                self.last_frame = frame
                self.last_success = time.time()
                return True, frame
            else:
                # Intentar reconectar
                print("⚠️ Reconectando stream...")
                self.cv_cap.release()
                self.cv_cap = cv2.VideoCapture(self.url)
                return False, self.last_frame
        
        # Para imágenes estáticas (snapshot)
        try:
            # Intentar descargar imagen (timeout corto para no bloquear)
            if self.requires_auth and self.auth:
                response = requests.get(self.url, auth=self.auth, timeout=2)
                
                if response.status_code != 200:
                    # Intentar Basic Auth si falla
                    response = requests.get(self.url, auth=self.basic_auth, timeout=2)
            else:
                # Sin autenticación (para iPhone/móviles)
                response = requests.get(self.url, timeout=2)
            
            if response.status_code == 200:
                # Convertir bytes a imagen OpenCV
                image_array = np.frombuffer(response.content, np.uint8)
                frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    self.last_frame = frame
                    self.last_success = time.time()
                    return True, frame
            
            print(f"⚠️ Error HTTP: {response.status_code}")
            return False, self.last_frame
            
        except Exception as e:
            print(f"❌ Error conexión cámara: {e}")
            return False, self.last_frame

    def release(self):
        if self.cv_cap:
            self.cv_cap.release()
    
    def isOpened(self):
        if self.cv_cap:
            return self.cv_cap.isOpened()
        return True

def get_video_capture(source, camera_id=None):
    """Factory que decide si usar OpenCV normal o nuestra cámara HTTP"""
    if str(source).startswith("http"):
        # Verificar si la cámara requiere autenticación
        requires_auth = True
        if camera_id and camera_id in CAMERA_CONFIG:
            requires_auth = CAMERA_CONFIG[camera_id].get("requires_auth", True)
        
        if requires_auth:
            return HttpCamera(source, DEFAULT_USER, DEFAULT_PASS, requires_auth=True)
        else:
            return HttpCamera(source, requires_auth=False)
    else:
        # Usar OpenCV normal (archivos, webcam usb, o rtsp legacy)
        return cv2.VideoCapture(source)

# ==========================================
# LÓGICA DE DETECCIÓN
# ==========================================
def point_in_polygon(point, polygon):
    polygon_array = np.array([(p['x'], p['y']) for p in polygon], np.int32)
    return cv2.pointPolygonTest(polygon_array, (point[0], point[1]), False) >= 0

def detect_vehicles_in_frame(frame, zones):
    # Detectar
    results = model.predict(frame, verbose=False, conf=0.25) # Confianza 0.25
    detections = results[0].boxes.data.cpu().numpy()
    
    vehicles = []
    zone_occupancy = {zone['id']: False for zone in zones}
    zone_detections = {zone['id']: [] for zone in zones}
    
    for detection in detections:
        x1, y1, x2, y2, confidence, class_id = detection
        class_name = model.names[int(class_id)]
        
        if class_name in ['car', 'truck', 'bus', 'motorcycle']:
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            
            vehicle_info = {
                'class': class_name,
                'bbox': {'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2)},
                'center': {'x': cx, 'y': cy}
            }
            
            for zone in zones:
                if point_in_polygon((cx, cy), zone['coordinates']):
                    zone_occupancy[zone['id']] = True
                    zone_detections[zone['id']].append(class_name)
                    break
            
            vehicles.append(vehicle_info)
    
    return vehicles, zone_occupancy, zone_detections

def annotate_frame(frame, zones, zone_occupancy, vehicles):
    annotated = frame.copy()
    
    # Dibujar zonas
    for zone in zones:
        polygon = np.array([(p['x'], p['y']) for p in zone['coordinates']], np.int32)
        color = (0, 0, 255) if zone_occupancy.get(zone['id'], False) else (0, 255, 0)
        cv2.polylines(annotated, [polygon], True, color, 2)
        
        # Etiqueta
        pt = polygon[0]
        cv2.putText(annotated, str(zone['spaceNumber']), (pt[0], pt[1]-5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Dibujar vehículos
    for v in vehicles:
        b = v['bbox']
        cv2.rectangle(annotated, (b['x1'], b['y1']), (b['x2'], b['y2']), (255, 200, 0), 1)
        cv2.circle(annotated, (v['center']['x'], v['center']['y']), 3, (0, 0, 255), -1)

    # Info general
    occupied = sum(zone_occupancy.values())
    total = len(zones)
    cv2.putText(annotated, f"Libres: {total - occupied}/{total}", (20, 40), 
               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    
    return annotated

# ==========================================
# ENDPOINTS
# ==========================================
@app.route('/api/video/feed', methods=['GET'])
def video_feed():
    camera_id = request.args.get('cameraId', 'default')
    zones = camera_zones.get(camera_id, []) # Sin zonas por defecto para nuevas cámaras
    
    # Obtener URL específica o fallback a default
    camera_url = CAMERAS.get(camera_id, CAMERAS['default'])
    
    # Instanciar cámara HTTP con la URL correcta
    cap = get_video_capture(camera_url, camera_id)
    
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.5)
                continue
            
            # Redimensionar estándar
            frame = cv2.resize(frame, (1020, 500))
            
            vehicles, occupancy, _ = detect_vehicles_in_frame(frame, zones)
            
            # Actualizar estado global
            camera_current_state[camera_id] = {
                'zone_occupancy': occupancy,
                'occupied_count': sum(occupancy.values()),
                'last_update': time.time()
            }
            
            annotated = annotate_frame(frame, zones, occupancy, vehicles)
            
            ret, buffer = cv2.imencode('.jpg', annotated)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.5)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/parking/status', methods=['GET'])
def get_parking_status():
    camera_id = request.args.get('cameraId', 'default')
    state = camera_current_state.get(camera_id)
    zones = camera_zones.get(camera_id, DEFAULT_PARKING_ZONES)
    
    if not state:
        return jsonify({'totalSpaces': len(zones), 'occupiedSpaces': 0, 'spaces': []})
        
    spaces = [{
        'id': z['id'], 
        'spaceNumber': z['spaceNumber'], 
        'isOccupied': state['zone_occupancy'].get(z['id'], False)
    } for z in zones]
    
    return jsonify({
        'totalSpaces': len(zones),
        'occupiedSpaces': state['occupied_count'],
        'spaces': spaces
    })

# Endpoint para recibir las zonas configuradas desde el frontend (o manualmente)
@app.route('/api/zones/get', methods=['GET'])
def get_zones():
    """Retorna las zonas configuradas para una cámara"""
    camera_id = request.args.get('cameraId', 'default')
    zones = camera_zones.get(camera_id, [])
    return jsonify({'success': True, 'zones': zones})

@app.route('/api/zones/sync', methods=['POST'])
def sync_zones():
    data = request.json
    camera_id = data.get('cameraId', 'default')
    zones = data.get('zones', [])
    
    camera_zones[camera_id] = zones
    
    # Guardar en disco inmediatamente
    save_zones_to_file()
    
    return jsonify({'success': True, 'count': len(zones)})

@app.route('/config')
def config_page():
    """Página para configurar zonas visualmente"""
    return render_template('configurador.html')

@app.route('/api/snapshot')
def get_snapshot():
    """Retorna una imagen estática actual de la cámara solicitada"""
    camera_id = request.args.get('cameraId', 'default')
    camera_url = CAMERAS.get(camera_id, CAMERAS['default'])
    
    cap = get_video_capture(camera_url, camera_id)
    ret, frame = cap.read()
    if ret and frame is not None:
        frame = cv2.resize(frame, (1020, 500))
        ret, buffer = cv2.imencode('.jpg', frame)
        return Response(buffer.tobytes(), mimetype='image/jpeg')
    return "Error getting snapshot", 500

@app.route('/api/cameras/add', methods=['POST'])
def add_camera():
    """Añade una nueva cámara dinámicamente (útil para móviles)"""
    data = request.json
    camera_id = data.get('cameraId')
    camera_url = data.get('url')
    requires_auth = data.get('requiresAuth', False)
    
    if not camera_id or not camera_url:
        return jsonify({'success': False, 'error': 'cameraId y url son requeridos'}), 400
    
    CAMERAS[camera_id] = camera_url
    CAMERA_CONFIG[camera_id] = {'requires_auth': requires_auth}
    
    return jsonify({
        'success': True, 
        'message': f'Cámara {camera_id} añadida',
        'cameras': list(CAMERAS.keys())
    })

@app.route('/api/cameras/list', methods=['GET'])
def list_cameras():
    """Lista todas las cámaras disponibles"""
    return jsonify({
        'success': True,
        'cameras': [{'id': k, 'url': v, 'config': CAMERA_CONFIG.get(k, {})} 
                   for k, v in CAMERAS.items()]
    })

if __name__ == '__main__':
    print("🚀 Iniciando Sistema de Detección (Modo HTTP Estable)")
    print(f"📡 Cámaras configuradas: {list(CAMERAS.keys())}")
    app.run(host='0.0.0.0', port=5000, threaded=True)