import base64
import uuid
from typing import Dict, Any, List

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.config import TRAINED_MODEL_PATH, CONFIDENCE, FRONTEND_ORIGIN
from core.model_loader import load_model
from core.tracker import ObjectTracker
from inference.predict import predict_frame
from utils.counter import ConveyorCounter

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model(TRAINED_MODEL_PATH)
sessions: Dict[str, Dict[str, Any]] = {}

ALIMENTO_CATALOG: Dict[str, Dict[str, Any]] = {
    "acucar_1kg": {
        "classe_modelo": "acucar_1kg",
        "nome_padronizado": "acucar",
        "nome_exibicao": "Açúcar 1 kg",
        "tipo_alimento": "mantimento",
        "peso_unitario_g": 1000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 5.5,
    },
    "arroz_1kg": {
        "classe_modelo": "arroz_1kg",
        "nome_padronizado": "arroz",
        "nome_exibicao": "Arroz 1 kg",
        "tipo_alimento": "grao",
        "peso_unitario_g": 1000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 4.5,
    },
    "arroz_5kg": {
        "classe_modelo": "arroz_5kg",
        "nome_padronizado": "arroz",
        "nome_exibicao": "Arroz 5 kg",
        "tipo_alimento": "grao",
        "peso_unitario_g": 5000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 17.5,
    },
    "cafe_250g": {
        "classe_modelo": "cafe_250g",
        "nome_padronizado": "cafe",
        "nome_exibicao": "Café 250 g",
        "tipo_alimento": "cafe",
        "peso_unitario_g": 250,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 15.5,
    },
    "cafe_500g": {
        "classe_modelo": "cafe_500g",
        "nome_padronizado": "cafe",
        "nome_exibicao": "Café 500 g",
        "tipo_alimento": "cafe",
        "peso_unitario_g": 500,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 31.0,
    },
    "feijao_1kg": {
        "classe_modelo": "feijao_1kg",
        "nome_padronizado": "feijao",
        "nome_exibicao": "Feijão 1 kg",
        "tipo_alimento": "grao",
        "peso_unitario_g": 1000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 8.5,
    },
    "feijao_500g": {
        "classe_modelo": "feijao_500g",
        "nome_padronizado": "feijao",
        "nome_exibicao": "Feijão 500 g",
        "tipo_alimento": "grao",
        "peso_unitario_g": 500,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 5.0,
    },
    "fuba_1kg": {
        "classe_modelo": "fuba_1kg",
        "nome_padronizado": "fuba",
        "nome_exibicao": "Fubá 1 kg",
        "tipo_alimento": "grao",
        "peso_unitario_g": 1000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 4.5,
    },
    "fuba_500g": {
        "classe_modelo": "fuba_500g",
        "nome_padronizado": "fuba",
        "nome_exibicao": "Fubá 500 g",
        "tipo_alimento": "grao",
        "peso_unitario_g": 500,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 4.5,
    },
    "leite_em_po_1kg": {
        "classe_modelo": "leite_em_po_1kg",
        "nome_padronizado": "leite_em_po",
        "nome_exibicao": "Leite em pó 1 kg",
        "tipo_alimento": "laticinio_seco",
        "peso_unitario_g": 1000,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 42.0,
    },
    "leite_em_po_400g": {
        "classe_modelo": "leite_em_po_400g",
        "nome_padronizado": "leite_em_po",
        "nome_exibicao": "Leite em pó 400 g",
        "tipo_alimento": "laticinio_seco",
        "peso_unitario_g": 400,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 17.0,
    },
    "macarrao_500g": {
        "classe_modelo": "macarrao_500g",
        "nome_padronizado": "macarrao",
        "nome_exibicao": "Macarrão 500 g",
        "tipo_alimento": "massa",
        "peso_unitario_g": 500,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 4.0,
    },
    "molho_de_tomate_240g": {
        "classe_modelo": "molho_de_tomate_240g",
        "nome_padronizado": "molho_de_tomate",
        "nome_exibicao": "Molho de tomate 240 g",
        "tipo_alimento": "molho",
        "peso_unitario_g": 240,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 2.5,
    },
    "oleo_900ml": {
        "classe_modelo": "oleo_900ml",
        "nome_padronizado": "oleo",
        "nome_exibicao": "Óleo 900 ml",
        "tipo_alimento": "oleo",
        "peso_unitario_g": None,
        "volume_unitario_ml": 900,
        "valor_unitario_brl": 7.5,
    },
    "peixe_enlatado_120g": {
        "classe_modelo": "peixe_enlatado_120g",
        "nome_padronizado": "peixe_enlatado",
        "nome_exibicao": "Peixe enlatado 120 g",
        "tipo_alimento": "enlatado",
        "peso_unitario_g": 120,
        "volume_unitario_ml": None,
        "valor_unitario_brl": 7.0,
    },
}


class StartSessionRequest(BaseModel):
    direction: str = "lr"
    min_confidence: float = 0.5 


class FrameRequest(BaseModel):
    image_base64: str
    confidence: float | None = None


def _normalize_direction(direction: str) -> str:
    value = str(direction or "lr").strip().lower()
    if value not in {"lr", "rl"}:
        raise HTTPException(status_code=400, detail="direction deve ser 'lr' ou 'rl'")
    return value


def _decode_base64_image(data_url: str):
    try:
        if "," in data_url:
            data_url = data_url.split(",", 1)[1]
        raw = base64.b64decode(data_url)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Imagem inválida")
        return frame
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao decodificar imagem: {e}")


def _normalize_token(value: str) -> str:
    return str(value or "").strip().lower()


def _get_catalog_entry(raw_class: str) -> Dict[str, Any] | None:
    key = _normalize_token(raw_class)
    if not key:
        return None
    return ALIMENTO_CATALOG.get(key)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/session/start")
def start_session(payload: StartSessionRequest):
    direction = _normalize_direction(payload.direction)
    min_conf = max(0.0, min(1.0, payload.min_confidence))
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "tracker": ObjectTracker(max_distance=50, max_frames_missing=30),
        "counter": ConveyorCounter(
            min_seen_frames=1,
            line_ratio=0.5,
            direction=direction,
            cross_margin=12,
            min_confidence=min_conf,
        ),
        "direction": direction,
    }
    return {"session_id": session_id, "direction": direction}


@app.post("/session/{session_id}/frame")
def process_frame(session_id: str, payload: FrameRequest):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    frame = _decode_base64_image(payload.image_base64)
    conf = payload.confidence if payload.confidence is not None else CONFIDENCE

    session = sessions[session_id]
    tracker: ObjectTracker = session["tracker"]
    counter: ConveyorCounter = session["counter"]

    _, detections = predict_frame(model, frame, conf=conf)
    active_tracks, finished_tracks = tracker.update(detections, frame.shape)

    newly_counted = counter.update_from_active_tracks(active_tracks, frame.shape)
    counter.cleanup_finished_tracks(finished_tracks)

    
    new_events: List[Dict[str, Any]] = []
    for ev in newly_counted:
        meta = _get_catalog_entry(ev.get("class", ""))
        quantidade = float(ev.get("quantidade", 1)) if ev.get("quantidade") is not None else 1.0
        peso_unit = meta.get("peso_unitario_g") if meta else None
        peso_total = None
        if peso_unit is not None:
            try:
                peso_total = float(peso_unit) * quantidade
            except Exception:
                peso_total = None

        new_events.append({
            "track_id": str(ev["id"]),
            "class": ev["class"],
            "quantidade": quantidade,
            "classe_modelo": meta["classe_modelo"] if meta else ev["class"],
            "nome_padronizado": meta["nome_padronizado"] if meta else ev["class"],
            "nome_exibicao": meta["nome_exibicao"] if meta else ev["class"],
            "tipo_alimento": meta["tipo_alimento"] if meta else "desconhecido",
            "confidence": float(ev.get("confidence", 0.0)),
            "peso_unitario_g": peso_unit,
            "peso_total_g": peso_total,
            "volume_unitario_ml": meta.get("volume_unitario_ml") if meta else None,
            "valor_unitario_brl": meta.get("valor_unitario_brl") if meta else None,
            "timestamp": ev["timestamp"],
        })

   
    active_detections = []
    for tr in active_tracks:
        meta = _get_catalog_entry(tr.get("class", ""))
        x1, y1, x2, y2 = tr["bbox"]
        quantidade = float(tr.get("quantity", 1)) if tr.get("quantity") is not None else 1.0
        peso_unit = meta.get("peso_unitario_g") if meta else None
        peso_total = None
        if peso_unit is not None:
            try:
                peso_total = float(peso_unit) * quantidade
            except Exception:
                peso_total = None

        active_detections.append({
            "track_id": str(tr["id"]),
            "class": tr["class"],
            "quantidade": quantidade,
            "classe_modelo": meta["classe_modelo"] if meta else tr["class"],
            "nome_padronizado": meta["nome_padronizado"] if meta else tr["class"],
            "nome_exibicao": meta["nome_exibicao"] if meta else tr["class"],
            "tipo_alimento": meta["tipo_alimento"] if meta else "desconhecido",
            "confidence": float(tr.get("conf", 0.0)),
            "peso_unitario_g": peso_unit,
            "peso_total_g": peso_total,
            "volume_unitario_ml": meta.get("volume_unitario_ml") if meta else None,
            "valor_unitario_brl": meta.get("valor_unitario_brl") if meta else None,
            "bbox": [float(x1), float(y1), float(x2), float(y2)],  # [x1, y1, x2, y2]
        })

    return {
        "new_events": new_events,
        "active_detections": active_detections,  
        "totals": dict(counter.totals),
        "total_items": int(sum(counter.totals.values())),
    }


@app.post("/session/{session_id}/finalize")
def finalize_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    session = sessions[session_id]
    tracker: ObjectTracker = session["tracker"]
    counter: ConveyorCounter = session["counter"]

    remaining = tracker.flush()
    counter.cleanup_finished_tracks(remaining)
    report = counter.get_json_report()

    del sessions[session_id]
    return report