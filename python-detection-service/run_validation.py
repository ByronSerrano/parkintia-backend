import os
from ultralytics import YOLO

def run_val():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Cargar modelo con ruta absoluta
    model_path = os.path.join(base_dir, 'models/yolov8s.pt')
    model = YOLO(model_path)
    
    # Ruta absoluta al archivo data.yaml
    data_yaml = os.path.join(base_dir, 'datasets/data.yaml')
    
    print(f"Ejecutando validación usando config: {data_yaml}")
    
    # Ejecutar validación
    metrics = model.val(data=data_yaml, project='outputs', name='validation_results')
    
    print("\n=== MÉTRICAS OBTENIDAS ===")
    print(f"Precision (Box): {metrics.box.map:.3f}")
    print(f"Recall (Box): {metrics.box.map50:.3f}")
    print(f"mAP50: {metrics.box.map50:.3f}")
    print(f"mAP50-95: {metrics.box.map75:.3f}")

if __name__ == "__main__":
    run_val()

