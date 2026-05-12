import cv2
import json
from core.config import TRAINED_MODEL_PATH, CAMERA_INDEX, CONFIDENCE
from core.model_loader import load_model
from core.tracker import ObjectTracker
from inference.predict import predict_frame
from utils.drawing import draw_counter
from utils.counter import ConveyorCounter


def run_camera_detection():
    model = load_model(TRAINED_MODEL_PATH)
    tracker = ObjectTracker(max_distance=50, max_frames_missing=30)
    counter = ConveyorCounter(
        min_seen_frames=3,
        line_ratio=0.5,   
        direction="lr",   
        cross_margin=12,
    )

    camera = cv2.VideoCapture(CAMERA_INDEX)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not camera.isOpened():
        raise RuntimeError("Erro ao acessar a câmera!")

    print("Iniciando a câmera... Pressione Q para sair, S para salvar JSON")

    while True:
        sucesso, frame = camera.read()
        if not sucesso:
            print("Erro ao acessar a câmera!")
            break

        frame_anotado, detections = predict_frame(model, frame, conf=CONFIDENCE)
        active_tracks, finished_tracks = tracker.update(detections, frame.shape)

        
        counter.update_from_active_tracks(active_tracks, frame.shape)
        counter.cleanup_finished_tracks(finished_tracks)

        
        for tr in active_tracks:
            x1, y1, x2, y2 = map(int, tr["bbox"])
            cv2.rectangle(frame_anotado, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                frame_anotado,
                f"ID:{tr['id']} {tr['class']}",
                (x1, max(20, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
            )

        
        h, w = frame.shape[:2]
        line_x = counter.get_line_x(w)
        cv2.line(frame_anotado, (line_x, 0), (line_x, h), (0, 255, 255), 2)
        cv2.putText(
            frame_anotado,
            "LINHA DE CONTAGEM",
            (max(10, line_x - 110), 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 255),
            2,
        )

        frame_anotado = draw_counter(frame_anotado, dict(counter.totals))
        cv2.imshow("Contador de itens (Esteira)", frame_anotado)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            print("\nEncerrando...")
            break
        elif key == ord("s"):
            report = counter.get_json_report()
            with open("contagem_report.json", "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            print("\nJSON salvo: contagem_report.json")

    
    remaining = tracker.flush()
    counter.cleanup_finished_tracks(remaining)

    report = counter.get_json_report()
    with open("contagem_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\nRelatório final:")
    print(json.dumps(report, indent=2, ensure_ascii=False))

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_camera_detection()