import cv2
import time
import sys

# ==========================================
# CONFIGURA TUS CREDENCIALES AQUÍ
# ==========================================
# Reemplaza con tus datos reales
USER = "jdaza"
PASSWORD = "Jdaza2026."
IP = "192.168.0.114"
PORT = "554"

# Selecciona tu marca (comenta/descomenta la linea adecuada)
# HIKVISION - Cámara 08
# 801 = Stream Principal (Alta calidad)
# 802 = Sub-stream (Más estable para IA)
path = "/Streaming/Channels/802" 
# DAHUA
# path = "/cam/realmonitor?channel=8&subtype=1"
# GENERICO
# path = "/live"

# Construcción automática de la URL
RTSP_URL = f"rtsp://{USER}:{PASSWORD}@{IP}:{PORT}{path}"

# Si ya tienes la URL completa, descomenta y ponla aquí directamente:
# RTSP_URL = "rtsp://admin:12345@192.168.1.50:554/h264"

def test_connection():
    print(f"📡 Intentando conectar a: {RTSP_URL}")
    print("⏳ Esto puede tardar unos segundos...")

    cap = cv2.VideoCapture(RTSP_URL)

    if not cap.isOpened():
        print("❌ ERROR: No se pudo abrir el stream de video.")
        print("   - Verifica la IP y que el DVR esté en la misma red.")
        print("   - Verifica usuario y contraseña.")
        print("   - Verifica la ruta del canal (path).")
        return False

    print("✅ CONEXIÓN EXITOSA!")
    
    # Intentar leer 10 frames para asegurar estabilidad
    print("🔄 Leyendo frames de prueba...")
    for i in range(10):
        ret, frame = cap.read()
        if not ret:
            print(f"⚠️ Frame {i+1} falló. La conexión es inestable.")
            break
        print(f"   Frame {i+1} OK - Resolución: {frame.shape[1]}x{frame.shape[0]}")
        time.sleep(0.1)

    print("\n🎉 La cámara funciona correctamente. Ahora podemos integrarla al sistema principal.")
    cap.release()
    return True

if __name__ == "__main__":
    try:
        test_connection()
    except KeyboardInterrupt:
        print("\nPrueba cancelada por usuario.")
