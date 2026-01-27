from ultralytics import YOLO
import os

import cv2

def create_dummy_labels():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model = YOLO(os.path.join(base_dir, 'models/yolov8s.pt'))
    img_path = os.path.join(base_dir, 'datasets/data/images/val/test_01.jpg')
    label_path = os.path.join(base_dir, 'datasets/data/labels/val/test_01.txt')
    
    print(f"Buscando imagen en: {img_path}")
    if not os.path.exists(img_path):
        print("ERROR: Archivo no existe en disco.")
        return

    # LEER CON CV2 PRIMERO
    img = cv2.imread(img_path)
    if img is None:
        print("ERROR: cv2 no pudo leer la imagen (posible archivo corrupto).")
        return
        
    # Inferencia pasando el array de numpy
    results = model(img)
    
    # Guardar etiquetas en formato YOLO
    with open(label_path, 'w') as f:
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                # Convertir a formato normalizado xywh
                x, y, w, h = box.xywhn[0].tolist()
                line = f"{cls} {x} {y} {w} {h}\n"
                f.write(line)
    
    print(f"Etiquetas generadas en {label_path}")

if __name__ == "__main__":
    create_dummy_labels()
