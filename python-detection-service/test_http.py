import requests
from requests.auth import HTTPDigestAuth
import os

# Configuración
USER = "jdaza"
PASS = "Jdaza2026." # Asegúrate que no tenga espacios al final
IP = "192.168.0.114"

# URL para capturar una foto directa del DVR (Hikvision ISAPI)
# Cámara 8 = 801
HTTP_URL = f"http://{IP}/ISAPI/Streaming/channels/801/picture"

def download_image():
    print(f"📡 Intentando descargar foto desde: {HTTP_URL}")
    try:
        # Los DVRs suelen usar autenticación Digest
        response = requests.get(HTTP_URL, auth=HTTPDigestAuth(USER, PASS), timeout=10)
        
        if response.status_code == 200:
            with open("captura_http.jpg", "wb") as f:
                f.write(response.content)
            print("✅ ¡ÉXITO! Imagen guardada como 'captura_http.jpg'")
            return True
        else:
            print(f"❌ Falló. Código de error: {response.status_code}")
            print("Probando con autenticación básica...")
            response = requests.get(HTTP_URL, auth=(USER, PASS), timeout=10)
            if response.status_code == 200:
                with open("captura_http.jpg", "wb") as f:
                    f.write(response.content)
                print("✅ ¡ÉXITO! Imagen guardada como 'captura_http.jpg' (Básica)")
                return True
            else:
                print(f"❌ También falló. Código: {response.status_code}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
    return False

if __name__ == "__main__":
    download_image()
