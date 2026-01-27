# Servicio de Detección de Vehículos (Python + YOLOv8)

Este microservicio es el componente de Inteligencia Artificial del Sistema de Gestión de Parking. Se encarga de procesar flujos de video o imágenes estáticas para detectar vehículos y determinar la ocupación de zonas predefinidas.

## 📋 Requisitos Previos

*   **Python 3.8+**
*   **Virtual Environment (Recomendado)**

## 🚀 Instalación y Ejecución

Sigue estos pasos para reproducir el entorno de desarrollo y ejecución.

### 1. Configuración del Entorno

```bash
# Crear entorno virtual
python3 -m venv venv

# Activar entorno (Mac/Linux)
source venv/bin/activate

# Activar entorno (Windows)
venv\Scripts\activate
```

### 2. Instalación de Dependencias

```bash
pip install -r requirements.txt
```

### 3. Ejecución del Servicio

El servicio iniciará un servidor Flask en el puerto 5000.

```bash
python app.py
```

## 📂 Estructura del Proyecto

*   **`app.py`**: Punto de entrada principal. Contiene la API Flask y la lógica de negocio.
*   **`models/`**: Contiene los pesos entrenados de la red neuronal (`yolov8s.pt`).
*   **`zones.json`**: Archivo de configuración que define los polígonos de las zonas de estacionamiento.
*   **`measure_performance.py`**: Script de utilidad para realizar benchmarks de rendimiento del hardware.
*   **`outputs/`**: Directorio donde se guardan capturas de diagnósticos o errores.

## 🧠 Detalles del Modelo

*   **Arquitectura:** YOLOv8 Small (`yolov8s`).
*   **Framework:** Ultralytics.
*   **Resolución de Inferencia:** 640px.
*   **Clases de Interés:** Car, Truck, Bus, Motorcycle.

## 📊 Endpoints Principales

*   `POST /api/detect`: Recibe una imagen/frame y devuelve las detecciones.
*   `GET /video_feed`: Stream MJPEG con las detecciones visualizadas en tiempo real.
