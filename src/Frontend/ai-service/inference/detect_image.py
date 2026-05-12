import os
import cv2
from core.config import TRAINED_MODEL_PATH, CONFIDENCE
from core.model_loader import load_model
from inference.predict import predict_frame
from utils.drawing import draw_counter


def run_image_detection(image_path: str):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Imagem não encontrada: {image_path}")

    frame = cv2.imread(image_path)
    if frame is None:
        raise ValueError(f"Falha ao carregar imagem: {image_path}")

    model = load_model(TRAINED_MODEL_PATH)
    frame_anotado, detections = predict_frame(model, frame, conf=CONFIDENCE)

    contagem = {}
    for det in detections:
        classe = det['class']
        contagem[classe] = contagem.get(classe, 0) + 1

    frame_anotado = draw_counter(frame_anotado, contagem)

    base, ext = os.path.splitext(image_path)
    output_path = f"{base}_detected{ext}"
    cv2.imwrite(output_path, frame_anotado)

    print(f"Detecção concluída: {output_path}")
    print(f"Contagem: {contagem}")
    return output_path, contagem