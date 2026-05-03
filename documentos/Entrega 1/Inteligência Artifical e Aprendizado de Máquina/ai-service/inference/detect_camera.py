import cv2
from core.config import TRAINED_MODEL_PATH, CAMERA_INDEX, CONFIDENCE
from core.model_loader import load_model
from inference.predict import predict_frame
from utils.drawing import draw_counter


def run_camera_detection():
    model = load_model(TRAINED_MODEL_PATH)

    camera = cv2.VideoCapture(CAMERA_INDEX)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not camera.isOpened():
        raise RuntimeError("Erro ao acessar a câmera!")

    print("Iniciando a câmera... Pressione Q para sair")

    while True:
        sucesso, frame = camera.read()
        if not sucesso:
            print("Erro ao acessar a câmera!")
            break

        frame_anotado, contagem = predict_frame(model, frame, conf=CONFIDENCE)
        frame_anotado = draw_counter(frame_anotado, contagem)

        cv2.imshow("Contador de itens", frame_anotado)
        if (cv2.waitKey(1) & 0xFF) == ord("q"):
            print(model.names)
            break

    camera.release()
    cv2.destroyAllWindows()