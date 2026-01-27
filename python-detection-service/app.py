

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
import torch

app = Flask(__name__)
CORS(app)

# ==========================================
# CONFIGURACIÓN DE CÁMARAS
# ==========================================
DEFAULT_CAMERA_IP = os.environ.get("CAMERA_IP", "192.168.209.25")
DEFAULT_USER = os.environ.get("CAMERA_USER", "jdaza")
DEFAULT_PASS = os.environ.get("CAMERA_PASS", "Jdaza2026.")

# Diccionario de cámaras disponibles
# Si MOBILE_CAMERA_URL es un número (ej "0"), se usará como webcam USB/Local
mobile_url = os.environ.get("MOBILE_CAMERA_URL", "http://192.168.100.165:8081/video") 

CAMERAS = {
    "mobile": mobile_url, 
}

# Configuración de cámaras (indica si necesita auth)
CAMERA_CONFIG = {
    "mobile": {"requires_auth": False},
}

# ==========================================
# MODELO Y VARIABLES GLOBALES
# ==========================================
# Fix para PyTorch 2.6+ - Hacer monkey patch de torch.load para permitir carga de modelos YOLO
_original_torch_load = torch.load

def _patched_torch_load(f, map_location=None, *args, **kwargs):
    # Forzar weights_only=False para cargar modelos YOLO de Ultralytics
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_torch_load(f, map_location=map_location, *args, **kwargs)

torch.load = _patched_torch_load

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
# CLASE HELPER PARA MJPEG (FALLBACK)
# ==========================================
class MjpegReader:
    def __init__(self, url, auth=None):
        self.url = url
        self.auth = auth
        self.stream = None
        self.bytes = b''
        self.iterator = None
        
    def connect(self):
        try:
            # Usar auth si existe
            if self.stream:
                self.stream.close()
            
            self.stream = requests.get(self.url, stream=True, timeout=10, auth=self.auth)
            if self.stream.status_code == 200:
                self.iterator = self.stream.iter_content(chunk_size=4096)
                print(f"✅ Conexión HTTP (MJPEG) establecida: {self.url}")
                return True
            else:
                print(f"❌ Error conexión MJPEG: Status {self.stream.status_code}")
        except Exception as e:
            print(f"❌ Error conexión MJPEG: {e}")
        return False

    def read_frame(self):
        if not self.iterator:
            if not self.connect():
                return None
        
        try:
            # Leer hasta encontrar un frame
            max_loops = 100 # Evitar loop infinito si no hay marcadores
            loops = 0
            
            while loops < max_loops:
                loops += 1
                try:
                    # Usar el iterador persistente
                    chunk = next(self.iterator)
                    self.bytes += chunk
                except StopIteration:
                    print("⚠️ Stream finalizado por el servidor")
                    self.iterator = None
                    return None
                except Exception as e:
                    print(f"⚠️ Error leyendo chunk del stream: {e}")
                    self.iterator = None
                    return None
                
                # Buscar inicio de JPEG (FF D8)
                a = self.bytes.find(b'\xff\xd8')
                b = self.bytes.find(b'\xff\xd9')
                
                if a != -1 and b != -1:
                    # Caso: Fin antes que Inicio -> Basura al inicio
                    if b < a:
                        self.bytes = self.bytes[a:]
                        continue # Re-evaluar con el buffer limpio
                        
                    # Caso: Inicio ... Fin -> Frame candidato
                    jpg = self.bytes[a:b+2]
                    self.bytes = self.bytes[b+2:] # Avanzar buffer
                    
                    try:
                        # Decodificar
                        frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None:
                            return frame
                    except:
                        pass # Si falla el decode, seguimos
                        
        except Exception as e:
            print(f"⚠️ Error leyendo stream MJPEG: {e}")
            self.iterator = None # Forzar reconexión
            self.bytes = b'' # Limpiar buffer
            
        return None

# ==========================================
# CLASE DE CÁMARA HTTP (Virtual)
# ==========================================
class HttpCamera:
    def __init__(self, url, user=None, password=None, requires_auth=True, auth_type='digest'):
        self.url = url
        self.requires_auth = requires_auth
        
        # Detección inteligente de tipo de stream
        # Si es un número (int o string numérico), es una webcam local
        self.is_webcam = isinstance(url, int) or (isinstance(url, str) and url.isdigit())
        
        if self.is_webcam:
            self.url = int(url)
            self.is_stream = True
        else:
            url_lower = url.lower()
            if "mjpegfeed" in url_lower or "/video" in url_lower:
                self.is_stream = True
            elif any(x in url_lower for x in ["/picture", "snapshot", ".jpg", ".jpeg"]):
                self.is_stream = False
            else:
                self.is_stream = any(x in url_lower for x in ["video", "stream", "mjpeg", "live", "rtsp://"])
        
        if requires_auth and user and password and not self.is_webcam:
            if auth_type == 'basic':
                self.auth = (user, password)
            else:
                self.auth = HTTPDigestAuth(user, password)
        else:
            self.auth = None
            
        self.lock = threading.Lock()
        self.last_frame = None
        self.running = True
        self.mjpeg_reader = None
        
        # Solo iniciar hilo si es un stream continuo
        if self.is_stream:
            print(f"🎥 Inicializando hilo de captura para: {self.url}")
            self.thread = threading.Thread(target=self.update_loop, daemon=True)
            self.thread.start()
            
    def update_loop(self):
        """Hilo que lee frames continuamente"""
        cap = None
        use_opencv = True # Intentar OpenCV primero
        
        while self.running:
            frame = None
            
            # 1. Intentar con OpenCV
            if use_opencv:
                if cap is None or not cap.isOpened():
                    cap = cv2.VideoCapture(self.url)
                    if not self.is_webcam:
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                if cap and cap.isOpened():
                    ret, f = cap.read()
                    if ret and f is not None:
                        frame = f
                    else:
                        print(f"⚠️ OpenCV falló leyendo {self.url}, cambiando a MJPEG Reader")
                        use_opencv = False
                        if cap: cap.release()
                else:
                     use_opencv = False
            
            # 2. Fallback MJPEG (Solo si no es webcam local)
            if not use_opencv and not self.is_webcam:
                if self.mjpeg_reader is None:
                    self.mjpeg_reader = MjpegReader(self.url, self.auth)
                
                frame = self.mjpeg_reader.read_frame()
                if frame is None:
                    time.sleep(1) # Esperar antes de reintentar
                    # Opcional: Reintentar OpenCV después de un tiempo?
            
            # Actualizar frame seguro
            if frame is not None:
                with self.lock:
                    self.last_frame = frame
            else:
                time.sleep(0.01) # Evitar consumo excesivo CPU si falla todo

    def read(self):
        """Devuelve el último frame capturado de forma thread-safe"""
        if self.is_stream:
            with self.lock:
                if self.last_frame is not None:
                    return True, self.last_frame.copy()
            return False, None
        
        # MODO SNAPSHOT (Sin hilos, bajo demanda)
        try:
            if self.requires_auth and self.auth:
                response = requests.get(self.url, auth=self.auth, timeout=2)
            else:
                response = requests.get(self.url, timeout=2)
            
            if response.status_code == 200:
                image_array = np.frombuffer(response.content, np.uint8)
                frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                if frame is not None:
                    return True, frame
            return False, None
            
        except Exception as e:
            print(f"❌ Error snapshot: {e}")
            return False, None

    def release(self):
        self.running = False
    
    def isOpened(self):
        return True

def get_video_capture(source, camera_id=None):
    """Factory que devuelve nuestra clase HttpCamera mejorada"""
    # Si es un número o string numérico, es índice de webcam
    if isinstance(source, int) or (isinstance(source, str) and source.isdigit()):
        return HttpCamera(source, requires_auth=False)
        
    # Si es URL
    if str(source).startswith("http") or str(source).startswith("rtsp"):
        # Configuración por defecto (Global)
        user = DEFAULT_USER
        password = DEFAULT_PASS
        requires_auth = True
        auth_type = 'digest' # Default
        
        # Lógica específica para móvil
        if camera_id == 'mobile':
            user = os.environ.get("MOBILE_USER", "admin")
            password = os.environ.get("MOBILE_PASS", "admin")
            requires_auth = True
            auth_type = 'basic' # Forzar Basic Auth
        
        # Lógica para otras cámaras definida en CAMERA_CONFIG
        elif camera_id and camera_id in CAMERA_CONFIG:
            requires_auth = CAMERA_CONFIG[camera_id].get("requires_auth", True)
        
        return HttpCamera(source, user, password, requires_auth=requires_auth, auth_type=auth_type)
    
    # Fallback para archivos locales u otros strings
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
# GESTIÓN DE INSTANCIAS DE CÁMARA (SINGLETON)
# ==========================================
camera_instances = {}

def get_camera_instance(camera_id):
    """Obtiene o crea una instancia de cámara persistente"""
    global camera_instances
    
    # Si ya existe, devolver la activa
    if camera_id in camera_instances:
        return camera_instances[camera_id]
    
    # Si no, crear una nueva
    camera_url = CAMERAS.get(camera_id)
    if not camera_url:
        print(f"⚠️ Cámara no encontrada: {camera_id}")
        return None

    print(f"🔌 Creando nueva conexión para: {camera_id} -> {camera_url}")
    instance = get_video_capture(camera_url, camera_id)
    camera_instances[camera_id] = instance
    return instance

# ==========================================
# ENDPOINTS
# ==========================================
@app.route('/api/video/feed', methods=['GET'])
def video_feed():
    camera_id = request.args.get('cameraId', 'default')
    # Force default to mobile
    if camera_id == 'default':
        camera_id = 'mobile'
        
    raw_mode = request.args.get('raw', 'false').lower() == 'true'
    zones = camera_zones.get(camera_id, []) 
    
    # Usar instancia persistente
    cap = get_camera_instance(camera_id)
    
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.01) # Reintento muy rápido
                continue
            
            # Redimensionar estándar
            try:
                frame = cv2.resize(frame, (1020, 500))
            except:
                pass
            
            if not raw_mode:
                # MODO DETECCIÓN (Normal)
                vehicles, occupancy, _ = detect_vehicles_in_frame(frame, zones)
                
                # Actualizar estado global
                camera_current_state[camera_id] = {
                    'zone_occupancy': occupancy,
                    'occupied_count': sum(occupancy.values()),
                    'last_update': time.time()
                }
                
                annotated = annotate_frame(frame, zones, occupancy, vehicles)
                frame_to_send = annotated
            else:
                # MODO RAW / CONFIGURACIÓN (Sin IA, super rápido)
                frame_to_send = frame

            ret, buffer = cv2.imencode('.jpg', frame_to_send)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Streaming fluido: sleep mínimo
            time.sleep(0.01)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/parking/status', methods=['GET'])
def get_parking_status():
    camera_id = request.args.get('cameraId', 'default')
    # Force default to mobile
    if camera_id == 'default':
        camera_id = 'mobile'

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
    """Retorna una imagen estática actual de la cámara solicitada (usando conexión persistente)"""
    camera_id = request.args.get('cameraId', 'default')
    if camera_id == 'default':
        camera_id = 'mobile'
    
    # Usar instancia persistente
    cap = get_camera_instance(camera_id)
    
    # Intentar leer frame actual
    ret, frame = cap.read()
    
    # Si falla, intentar devolver el último frame conocido (caché)
    if not ret or frame is None:
        frame = cap.last_frame
        
    if frame is not None:
        try:
            frame = cv2.resize(frame, (1020, 500))
            ret, buffer = cv2.imencode('.jpg', frame)
            return Response(buffer.tobytes(), mimetype='image/jpeg')
        except Exception as e:
            print(f"Error procesando snapshot: {e}")
            
    return "Error getting snapshot", 500

@app.route('/api/cameras/add', methods=['POST'])
def add_camera():
    """Añade una nueva cámara dinámicamente (útil para móviles)"""
    data = request.json
    camera_id = data.get('cameraId')
    camera_url = data.get('url')
    requires_auth = data.get('requiresAuth', False)
    
    if not camera_id or camera_url is None: # url puede ser 0
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