from collections import Counter


def predict_frame(model, frame, conf: float = 0.25):
    resultados = model.predict(source=frame, stream=True, conf=conf, verbose=False)

    itens_frame = []
    frame_anotado = frame

    for resultado in resultados:
        frame_anotado = resultado.plot()
        classes_ids = resultado.boxes.cls.tolist() if resultado.boxes is not None else []
        nomes = resultado.names
        for cls_id in classes_ids:
            itens_frame.append(nomes[int(cls_id)])

    contagem = dict(Counter(itens_frame))
    return frame_anotado, contagem