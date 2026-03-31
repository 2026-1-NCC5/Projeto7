import os
from ultralytics import YOLO


def load_model(model_path: str) -> YOLO:
    if not model_path:
        raise ValueError("Caminho do modelo não informado.")

    
    candidates = [model_path]

    
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    candidates.append(os.path.join(project_root, "best.pt"))

    
    candidates.append(r"C:\Users\felip\Downloads\best.pt")

    for candidate in candidates:
        candidate_abs = os.path.abspath(candidate)
        if os.path.exists(candidate_abs):
            return YOLO(candidate_abs)

    raise FileNotFoundError(
        "Modelo não encontrado. Tentativas:\n" + "\n".join(candidates)
    )