import cv2


def draw_counter(frame_anotado, contagem: dict):
    y_pos = 30
    cv2.rectangle(frame_anotado, (10, 10), (350, 150), (0, 0, 0), -1)

    for item, quantidade in contagem.items():
        texto = f"{item}: {quantidade} unidades"
        cv2.putText(
            frame_anotado,
            texto,
            (20, y_pos),
            cv2.FONT_HERSHEY_COMPLEX,
            0.5,
            (255, 255, 255),
            1,
        )
        y_pos += 20

    return frame_anotado