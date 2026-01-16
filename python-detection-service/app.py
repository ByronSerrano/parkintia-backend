from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import json
import time
from typing import List, Dict
import pandas as pd
import threading

app = Flask(__name__)
CORS(app)

# Cargar modelo YOLO
model = YOLO('yolov8s.pt')

# Cargar clases COCO
try:
    with open("coco.txt", "r") as f:
        class_list = f.read().split("\n")
except:
    class_list = model.names

# Almacenamiento temporal de zonas por cámara
camera_zones = {}

# Estado del video
video_states = {}

# Estado actual de ocupación por cámara (para estadísticas en tiempo real)
camera_current_state = {}

# Zonas de parqueo predeterminadas (del sistema anterior)
DEFAULT_PARKING_ZONES = [
    {"id": "zone-1", "spaceNumber": 1, "coordinates": [{"x": 52, "y": 364}, {"x": 30, "y": 417}, {"x": 73, "y": 412}, {"x": 88, "y": 369}]},
    {"id": "zone-2", "spaceNumber": 2, "coordinates": [{"x": 105, "y": 353}, {"x": 86, "y": 428}, {"x": 137, "y": 427}, {"x": 146, "y": 358}]},
    {"id": "zone-3", "spaceNumber": 3, "coordinates": [{"x": 159, "y": 354}, {"x": 150, "y": 427}, {"x": 204, "y": 425}, {"x": 203, "y": 353}]},
    {"id": "zone-4", "spaceNumber": 4, "coordinates": [{"x": 217, "y": 352}, {"x": 219, "y": 422}, {"x": 273, "y": 418}, {"x": 261, "y": 347}]},
    {"id": "zone-5", "spaceNumber": 5, "coordinates": [{"x": 274, "y": 345}, {"x": 286, "y": 417}, {"x": 338, "y": 415}, {"x": 321, "y": 345}]},
    {"id": "zone-6", "spaceNumber": 6, "coordinates": [{"x": 336, "y": 343}, {"x": 357, "y": 410}, {"x": 409, "y": 408}, {"x": 382, "y": 340}]},
    {"id": "zone-7", "spaceNumber": 7, "coordinates": [{"x": 396, "y": 338}, {"x": 426, "y": 404}, {"x": 479, "y": 399}, {"x": 439, "y": 334}]},
    {"id": "zone-8", "spaceNumber": 8, "coordinates": [{"x": 458, "y": 333}, {"x": 494, "y": 397}, {"x": 543, "y": 390}, {"x": 495, "y": 330}]},
    {"id": "zone-9", "spaceNumber": 9, "coordinates": [{"x": 511, "y": 327}, {"x": 557, "y": 388}, {"x": 603, "y": 383}, {"x": 549, "y": 324}]},
    {"id": "zone-10", "spaceNumber": 10, "coordinates": [{"x": 564, "y": 323}, {"x": 615, "y": 381}, {"x": 654, "y": 372}, {"x": 596, "y": 315}]},
    {"id": "zone-11", "spaceNumber": 11, "coordinates": [{"x": 616, "y": 316}, {"x": 666, "y": 369}, {"x": 703, "y": 363}, {"x": 642, "y": 312}]},
    {"id": "zone-12", "spaceNumber": 12, "coordinates": [{"x": 674, "y": 311}, {"x": 730, "y": 360}, {"x": 764, "y": 355}, {"x": 707, "y": 308}]}
]


def point_in_polygon(point, polygon):
    """Verifica si un punto está dentro de un polígono usando OpenCV"""
    polygon_array = np.array([(p['x'], p['y']) for p in polygon], np.int32)
    result = cv2.pointPolygonTest(polygon_array, (point[0], point[1]), False)
    return result >= 0


def detect_vehicles_in_frame(frame, zones):
    """
    Procesa un frame con YOLO y determina qué zonas están ocupadas
    """
    results = model.predict(frame, verbose=False)
    detections = results[0].boxes.data.cpu().numpy()
    
    vehicles = []
    zone_occupancy = {zone['id']: False for zone in zones}
    zone_detections = {zone['id']: [] for zone in zones}
    
    for detection in detections:
        x1, y1, x2, y2, confidence, class_id = detection
        class_name = model.names[int(class_id)]
        
        # Detectar solo vehículos (car, truck, bus, motorcycle)
        if class_name in ['car', 'truck', 'bus', 'motorcycle']:
            # Calcular centro del vehículo
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            
            vehicle_info = {
                'class': class_name,
                'confidence': float(confidence),
                'bbox': {
                    'x1': int(x1),
                    'y1': int(y1),
                    'x2': int(x2),
                    'y2': int(y2)
                },
                'center': {'x': cx, 'y': cy}
            }
            
            # Verificar en qué zona está el vehículo
            for zone in zones:
                if point_in_polygon((cx, cy), zone['coordinates']):
                    zone_occupancy[zone['id']] = True
                    zone_detections[zone['id']].append(class_name)
                    vehicle_info['spaceNumber'] = zone['spaceNumber']
                    break
            
            vehicles.append(vehicle_info)
    
    return vehicles, zone_occupancy, zone_detections


def annotate_frame(frame, zones, zone_occupancy, vehicles):
    """
    Dibuja las zonas y detecciones en el frame (estilo del sistema anterior)
    """
    annotated = frame.copy()
    
    # Dibujar zonas
    for zone in zones:
        polygon = np.array([(p['x'], p['y']) for p in zone['coordinates']], np.int32)
        is_occupied = zone_occupancy.get(zone['id'], False)
        
        # Color: rojo si ocupado, verde si libre (como el sistema anterior)
        color = (0, 0, 255) if is_occupied else (0, 255, 0)
        
        # Dibujar polígono
        cv2.polylines(annotated, [polygon], True, color, 2)
        
        # Escribir número de espacio en la posición inferior del polígono
        text_pos = polygon[1]  # Segundo punto (esquina inferior izquierda típicamente)
        text_color = (0, 0, 255) if is_occupied else (255, 255, 255)
        cv2.putText(
            annotated,
            str(zone['spaceNumber']),
            (text_pos[0], text_pos[1]),
            cv2.FONT_HERSHEY_COMPLEX,
            0.5,
            text_color,
            1
        )
    
    # Dibujar vehículos detectados
    for vehicle in vehicles:
        bbox = vehicle['bbox']
        cv2.rectangle(
            annotated,
            (bbox['x1'], bbox['y1']),
            (bbox['x2'], bbox['y2']),
            (0, 255, 0),
            2
        )
        
        # Centro del vehículo
        center = vehicle['center']
        cv2.circle(annotated, (center['x'], center['y']), 3, (0, 0, 255), -1)
        
        # Etiqueta del vehículo
        cv2.putText(
            annotated,
            str(vehicle['class']),
            (bbox['x1'], bbox['y1']),
            cv2.FONT_HERSHEY_COMPLEX,
            0.5,
            (255, 255, 255),
            1
        )
    
    # Información general en la esquina superior izquierda
    occupied_count = sum(1 for occupied in zone_occupancy.values() if occupied)
    free_count = len(zones) - occupied_count
    
    # Mostrar espacios libres grande (como en sistema anterior)
    cv2.putText(
        annotated,
        str(free_count),
        (23, 30),
        cv2.FONT_HERSHEY_PLAIN,
        3,
        (255, 255, 255),
        2
    )
    
    # Información adicional
    cv2.putText(
        annotated,
        f"Occupied: {occupied_count}",
        (10, 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )
    cv2.putText(
        annotated,
        f"Free: {free_count}",
        (10, 90),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )
    
    return annotated


@app.route('/api/zones/sync', methods=['POST'])
def sync_zones():
    """Sincroniza las zonas de parking de una cámara"""
    data = request.json
    camera_id = data.get('cameraId')
    zones = data.get('zones', [])
    
    camera_zones[camera_id] = zones
    
    return jsonify({
        'success': True,
        'message': f'Synced {len(zones)} zones for camera {camera_id}',
        'cameraId': camera_id,
        'zonesCount': len(zones)
    })


@app.route('/api/detect', methods=['POST'])
def detect():
    """Procesa un frame y detecta vehículos en las zonas"""
    try:
        # Obtener datos
        file = request.files.get('frame')
        zones_json = request.form.get('zones')
        
        if not file or not zones_json:
            return jsonify({'error': 'Missing frame or zones data'}), 400
        
        zones = json.loads(zones_json)
        
        # Leer imagen
        file_bytes = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        # Redimensionar frame a 1020x500 como en el sistema anterior
        frame = cv2.resize(frame, (1020, 500))
        
        # Detectar vehículos
        vehicles, zone_occupancy, zone_detections = detect_vehicles_in_frame(frame, zones)
        
        # Anotar frame
        annotated_frame = annotate_frame(frame, zones, zone_occupancy, vehicles)
        
        # Convertir frame a base64
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Preparar respuesta
        zones_status = [
            {
                'id': zone['id'],
                'spaceNumber': zone['spaceNumber'],
                'isOccupied': zone_occupancy[zone['id']]
            }
            for zone in zones
        ]
        
        occupied_count = sum(1 for z in zones_status if z['isOccupied'])
        
        return jsonify({
            'success': True,
            'annotatedFrame': frame_base64,
            'zones': zones_status,
            'occupiedSpaces': occupied_count,
            'freeSpaces': len(zones) - occupied_count,
            'vehicles': vehicles
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stream/start', methods=['POST'])
def start_stream():
    """Inicia un stream de video procesado"""
    data = request.json
    camera_id = data.get('cameraId')
    video_source = data.get('videoSource', 'parking1.mp4')  # Default al video parking1.mp4
    use_default_zones = data.get('useDefaultZones', True)
    
    # Usar zonas por defecto si no hay zonas configuradas o si se solicita explícitamente
    if use_default_zones or camera_id not in camera_zones:
        zones = DEFAULT_PARKING_ZONES
        camera_zones[camera_id] = zones
    else:
        zones = camera_zones[camera_id]
    
    # Inicializar estado del video para este stream
    stream_id = f"{camera_id}_{int(time.time())}"
    video_states[stream_id] = {"play": True, "restart": False}
    
    def generate():
        cap = cv2.VideoCapture(video_source)
        
        try:
            while True:
                # Verificar si debe pausar
                if not video_states.get(stream_id, {}).get("play", True):
                    time.sleep(0.1)
                    continue
                
                ret, frame = cap.read()
                
                if not ret:
                    # Reiniciar video si es un archivo
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                
                # Redimensionar frame a 1020x500 como en el sistema anterior
                frame = cv2.resize(frame, (1020, 500))
                
                # Detectar vehículos
                vehicles, zone_occupancy, zone_detections = detect_vehicles_in_frame(frame, zones)
                
                # Anotar frame
                annotated_frame = annotate_frame(frame, zones, zone_occupancy, vehicles)
                
                # Codificar frame
                ret, buffer = cv2.imencode('.jpg', annotated_frame)
                frame_bytes = buffer.tobytes()
                
                # Actualizar estado actual para estadísticas
                occupied_count = sum(1 for occupied in zone_occupancy.values() if occupied)
                camera_current_state[stream_id] = {
                    'zone_occupancy': zone_occupancy,
                    'occupied_count': occupied_count,
                    'total_spaces': len(zones),
                    'last_update': time.time()
                }
                
                # Enviar frame
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                
                time.sleep(0.5)  # ~2 FPS (muy lento para ver todo con detalle)
                
        finally:
            cap.release()
            if stream_id in video_states:
                del video_states[stream_id]
    
    return Response(
        generate(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/api/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'ok',
        'model': 'YOLOv8s',
        'cameras': len(camera_zones)
    })


@app.route('/api/video/feed', methods=['GET'])
def video_feed():
    """Endpoint simplificado para streaming de video (compatible con sistema anterior)"""
    camera_id = request.args.get('cameraId', 'default')
    
    # Usar zonas por defecto
    if camera_id not in camera_zones:
        camera_zones[camera_id] = DEFAULT_PARKING_ZONES
    
    zones = camera_zones[camera_id]
    
    # Estado de video para este feed
    if camera_id not in video_states:
        video_states[camera_id] = {"play": True}
    
    def generate():
        cap = cv2.VideoCapture('parking1.mp4')
        
        try:
            while True:
                if video_states[camera_id].get("play", True):
                    ret, frame = cap.read()
                    
                    if not ret:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    
                    # Redimensionar frame
                    frame = cv2.resize(frame, (1020, 500))
                    
                    # Detectar vehículos
                    vehicles, zone_occupancy, zone_detections = detect_vehicles_in_frame(frame, zones)
                    
                    # Actualizar estado actual
                    occupied_count = sum(1 for occupied in zone_occupancy.values() if occupied)
                    camera_current_state[camera_id] = {
                        'zone_occupancy': zone_occupancy,
                        'occupied_count': occupied_count,
                        'total_spaces': len(zones),
                        'last_update': time.time()
                    }
                    
                    # Anotar frame
                    annotated_frame = annotate_frame(frame, zones, zone_occupancy, vehicles)
                    
                    # Codificar
                    ret, buffer = cv2.imencode('.jpg', annotated_frame)
                    frame_bytes = buffer.tobytes()
                    
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    
                    time.sleep(0.5)  # ~2 FPS (muy lento para ver todo con detalle)
                else:
                    time.sleep(0.1)
        finally:
            cap.release()
    
    return Response(
        generate(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/api/video/control', methods=['POST'])
def control_video():
    """Control del video (play/pause/restart)"""
    data = request.json
    action = data.get('action')
    camera_id = data.get('cameraId', 'default')
    
    if camera_id not in video_states:
        video_states[camera_id] = {"play": True}
    
    if action == "play":
        video_states[camera_id]["play"] = True
    elif action == "pause":
        video_states[camera_id]["play"] = False
    elif action == "restart":
        video_states[camera_id]["play"] = True
        # El reinicio se maneja en el loop del video
    
    return jsonify({
        'status': 'success',
        'state': video_states[camera_id],
        'cameraId': camera_id
    })


@app.route('/api/parking/status', methods=['GET'])
def get_parking_status():
    """Obtiene el estado actual del parqueadero desde el stream en vivo"""
    camera_id = request.args.get('cameraId', 'default')
    
    # Usar zonas por defecto si no existen
    if camera_id not in camera_zones:
        camera_zones[camera_id] = DEFAULT_PARKING_ZONES
    
    zones = camera_zones[camera_id]
    
    # IMPORTANTE: Buscar el estado en cualquier ID de cámara activa
    # Ya que todas las cámaras comparten el mismo video
    state = None
    for cam_id in camera_current_state:
        state = camera_current_state[cam_id]
        break
    
    # Usar estado actual del stream si está disponible
    if state:
        zone_occupancy = state['zone_occupancy']
        occupied_count = state['occupied_count']
        
        spaces = [
            {
                'id': zone['id'],
                'spaceNumber': zone['spaceNumber'],
                'isOccupied': zone_occupancy.get(zone['id'], False),
                'coordinates': zone['coordinates']
            }
            for zone in zones
        ]
        
        return jsonify({
            'cameraId': camera_id,
            'totalSpaces': len(zones),
            'occupiedSpaces': occupied_count,
            'freeSpaces': len(zones) - occupied_count,
            'spaces': spaces,
            'lastUpdate': state['last_update']
        })
    
    # Si no hay stream activo, retornar valores por defecto
    return jsonify({
        'cameraId': camera_id,
        'totalSpaces': len(zones),
        'occupiedSpaces': 0,
        'freeSpaces': len(zones),
        'spaces': [
            {
                'id': zone['id'],
                'spaceNumber': zone['spaceNumber'],
                'isOccupied': False,
                'coordinates': zone['coordinates']
            }
            for zone in zones
        ],
        'lastUpdate': time.time()
    })


@app.route('/api/zones/default', methods=['GET'])
def get_default_zones():
    """Retorna las zonas por defecto"""
    return jsonify({
        'zones': DEFAULT_PARKING_ZONES,
        'totalZones': len(DEFAULT_PARKING_ZONES)
    })


def background_video_processor():
    """Procesa el video continuamente en background para mantener estadísticas actualizadas"""
    camera_id = 'default'
    camera_zones[camera_id] = DEFAULT_PARKING_ZONES
    zones = DEFAULT_PARKING_ZONES
    
    cap = cv2.VideoCapture('parking1.mp4')
    
    print(f"🎥 Background processor started for camera: {camera_id}")
    frame_count = 0
    
    while True:
        try:
            ret, frame = cap.read()
            
            if not ret:
                # Reiniciar video cuando termine
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_count = 0
                print(f"📹 Video restarted, frame count reset")
                continue
            
            frame_count += 1
            
            # Redimensionar frame
            frame = cv2.resize(frame, (1020, 500))
            
            # Detectar vehículos
            vehicles, zone_occupancy, zone_detections = detect_vehicles_in_frame(frame, zones)
            
            # Actualizar estado global
            occupied_count = sum(1 for occupied in zone_occupancy.values() if occupied)
            camera_current_state[camera_id] = {
                'zone_occupancy': zone_occupancy,
                'occupied_count': occupied_count,
                'total_spaces': len(zones),
                'last_update': time.time()
            }
            
            # Log cada 15 frames para debug
            if frame_count % 15 == 0:
                print(f"🚗 Frame {frame_count}: {len(vehicles)} vehicles, {occupied_count}/{len(zones)} spaces occupied")
            
            # Procesar a 3 FPS para sincronizar con streams
            time.sleep(0.33)
            
        except Exception as e:
            print(f"❌ Error in background processor: {e}")
            time.sleep(1)


if __name__ == '__main__':
    print("🚀 Starting Parking Detection Service with YOLOv8")
    print("📹 Video processing synchronized with stream...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
