import cv2
import os
import time

# URL de tu cámara (la misma que configuramos en app.py)
RTSP_URL = os.environ.get(
    "CAMERA_URL", 
    "rtsp://jdaza:Jdaza2026.@192.168.0.114:554/Streaming/Channels/802"
)

def take_snapshot():
    print(f"📸 Conectando a {RTSP_URL}...")
    
    # Forzar TCP
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
    
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    
    if not cap.isOpened():
        print("❌ Error: No se pudo abrir la conexión con la cámara.")
        return

    print("⏳ Leyendo frame...")
    # Intentar leer varios frames para limpiar el buffer
    for i in range(10):
        ret, frame = cap.read()
        if ret:
            print(f"   Frame {i+1} leído correctamente.")
            if i == 9: # Guardar el décimo frame
                filename = "prueba_camara.jpg"
                cv2.imwrite(filename, frame)
                print(f"✅ ¡Éxito! Imagen guardada como '{filename}'")
                print(f"   Resolución: {frame.shape[1]}x{frame.shape[0]}")
        else:
            print(f"⚠️ Error leyendo frame {i+1}")
            time.sleep(0.5)

    cap.release()

if __name__ == "__main__":
    take_snapshot()
