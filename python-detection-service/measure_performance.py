import time
import numpy as np
import cv2
from ultralytics import YOLO
import os
import platform
import psutil

def measure():
    print("=== INICIANDO MEDICIÓN DE RENDIMIENTO (TESIS) ===")
    
    # 1. Info del Sistema
    print(f"Sistema Operativo: {platform.system()} {platform.release()}")
    print(f"Procesador: {platform.processor()}")
    print(f"RAM Total: {round(psutil.virtual_memory().total / (1024**3), 2)} GB")
    
    # 2. Cargar Modelo
    start_load = time.time()
    model = YOLO('models/yolov8s.pt')
    end_load = time.time()
    print(f"Tiempo de carga del modelo: {round(end_load - start_load, 2)}s")
    
    # 3. Preparar imagen de prueba (usar la que ya existe o una blanca)
    img_path = 'sample_parking.jpg'
    if os.path.exists(img_path):
        img = cv2.imread(img_path)
    else:
        img = np.zeros((640, 640, 3), dtype=np.uint8)
    
    # Warm-up (descartar la primera inferencia por inicialización de caché)
    model(img, verbose=False)
    
    # 4. Benchmark de Inferencia
    iterations = 50
    latencies = []
    
    print(f"Ejecutando {iterations} inferencias para promedio...")
    
    for i in range(iterations):
        t0 = time.time()
        results = model(img, verbose=False)
        t1 = time.time()
        latencies.append(t1 - t0)
    
    avg_latency = np.mean(latencies)
    std_latency = np.std(latencies)
    fps = 1 / avg_latency
    
    # 5. Resultados finales
    print("\n" + "="*40)
    print("RESULTADOS TÉCNICOS PARA LA TESIS")
    print("="*40)
    print(f"Modelo: YOLOv8s (Small)")
    print(f"Resolución de entrada: 640x640")
    print(f"Latencia promedio: {round(avg_latency * 1000, 2)} ms")
    print(f"Desviación Estándar: {round(std_latency * 1000, 2)} ms")
    print(f"FPS estimados: {round(fps, 2)} FPS")
    print(f"Dispositivo de inferencia: {'GPU (CUDA)' if 'cuda' in str(model.device) else 'CPU'}")
    print("="*40)
    
    # Guardar en archivo para respaldo
    with open("performance_report.txt", "w") as f:
        f.write(f"REPORTE DE RENDIMIENTO - SISTEMA DE PARKING\n")
        f.write(f"Fecha: {time.ctime()}\n")
        f.write(f"Hardware: {platform.processor()}\n")
        f.write(f"RAM: {round(psutil.virtual_memory().total / (1024**3), 2)} GB\n")
        f.write(f"Latencia: {round(avg_latency * 1000, 2)} ms\n")
        f.write(f"FPS: {round(fps, 2)}\n")

if __name__ == "__main__":
    measure()
