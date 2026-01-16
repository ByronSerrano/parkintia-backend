# Parking Detection Service - Python

Microservicio Python con Flask y YOLOv8 para detección de vehículos en espacios de parqueadero.

## Instalación

```bash
# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt
```

## Ejecutar

```bash
python app.py
```

El servicio estará disponible en `http://localhost:5000`

## Endpoints

### POST /api/zones/sync
Sincroniza las zonas de parking de una cámara.

```json
{
  "cameraId": "uuid",
  "zones": [
    {
      "id": "zone-uuid",
      "spaceNumber": 1,
      "coordinates": [
        {"x": 100, "y": 200},
        {"x": 150, "y": 200},
        {"x": 150, "y": 250},
        {"x": 100, "y": 250}
      ]
    }
  ]
}
```

### POST /api/detect
Procesa un frame y detecta vehículos.

- Form data: `frame` (imagen)
- Form data: `zones` (JSON string)

### POST /api/stream/start
Inicia un stream de video procesado.

```json
{
  "cameraId": "uuid",
  "videoSource": "path/to/video.mp4"
}
```

### GET /api/health
Health check del servicio.

## Modelo YOLO

El servicio utiliza YOLOv8s. El modelo se descargará automáticamente la primera vez que se ejecute.
