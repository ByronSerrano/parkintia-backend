import cv2
from ultralytics import YOLO
import os

def generate_report():
    print("=== GENERANDO REPORTE VISUAL DE DETECCION ===")
    
    # Rutas
    model_path = 'models/yolov8s.pt'
    img_path = 'sample_parking.jpg'
    output_path = 'outputs/detection_analysis.jpg'
    
    # Validar existencia
    if not os.path.exists(img_path):
        print(f"ERROR: No se encuentra la imagen {img_path}")
        return

    # Cargar modelo
    print(f"Cargando modelo desde {model_path}...")
    model = YOLO(model_path)
    
    # Inferencia
    print(f"Procesando imagen {img_path}...")
    results = model(img_path)
    
    # Procesar resultados
    for result in results:
        # Plot dibuja las cajas en la imagen
        im_array = result.plot()  # plot a BGR numpy array of predictions
        
        # Guardar imagen
        print(f"Guardando resultado en {output_path}...")
        cv2.imwrite(output_path, im_array)
        
        # Imprimir detalles para el reporte de texto
        print("\n--- DETALLES DE DETECCIÓN ---")
        for box in result.boxes:
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = model.names[class_id]
            print(f"Objeto: {label} | Confianza: {conf:.4f} | Coords: {box.xyxy.tolist()}")

if __name__ == "__main__":
    generate_report()
