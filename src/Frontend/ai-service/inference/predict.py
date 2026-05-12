from collections import Counter


def predict_frame(model, frame, conf: float = 0.25):
    resultados = model.predict(source=frame, stream=True, conf=conf, verbose=False)

    detections = []
    frame_anotado = frame

    for resultado in resultados:
        frame_anotado = resultado.plot()

        if resultado.boxes is not None:
            boxes = resultado.boxes.xyxy.tolist()
            classes_ids = resultado.boxes.cls.tolist()
            confs = resultado.boxes.conf.tolist()
            nomes = resultado.names

            for bbox, cls_id, c in zip(boxes, classes_ids, confs):
                class_name = nomes[int(cls_id)]
                detections.append({
                    "bbox": bbox,
                    "class": class_name,
                    "conf": float(c),
                })

    return frame_anotado, detections