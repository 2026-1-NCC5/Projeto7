import cv2
#IA para detecção de imagens 
from ultralytics import YOLO
#Suporte para contagem
from collections import Counter

#Modelo = Cérebro da IA
modelo = YOLO('best.pt')

#0 = Camera padrao
camera = cv2.VideoCapture(0)

##Resolução da CAM
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)


print("Iniciando a câmera... Pressione Q para sair")



#Código para rodar sem parada
while True:
    sucesso, frame = camera.read()
    if not sucesso:
        print("Erro ao acessar a câmera!")
        break
    #Cada frame que a camera tira será analisado - Stream True para a analise seguir sem paradas
    #Sessao de captura
    resultados = modelo(frame, stream=True)
    itens_frame = []
    frame_anotado = frame
    
    for resultado in resultados:
        #Plotagem = identificar o item na foto
        frame_anotado = resultado.plot()
        #Cada caixinha será anotada se identificada e adicionado na lista
        classes_ids = resultado.boxes.cls.tolist()
        nomes = resultado.names
        for cls_id in classes_ids:
            itens_frame.append(nomes[int(cls_id)])
    contagem = Counter(itens_frame)

    #Ele irá subir 40 pontos para adicionar o nome do item
    y_pos = 30

    #Coordenadas pra fazer um quadro de identificação do item
    cv2.rectangle(frame_anotado, (10,10),(350,150), (0,0,0), -1)

    for item, quantidade in contagem.items():
        texto_contagem = f"{item}: {quantidade} unidades"
        #Comando para fazer a contagem total dos itens
        cv2.putText(frame_anotado, texto_contagem, (20, y_pos), cv2.FONT_HERSHEY_COMPLEX, 0.5, (255, 255, 255), 1)
        y_pos +=20
    cv2.imshow("Contador de itens", frame_anotado)
    #Identificar se alguma tecla foi apertada e parar o processo
    if(cv2.waitKey(1) & 0xFF == ord('q')):
        print(modelo.names)
        break

#Finalizar todos os processos e fechar as cameras abertas
camera.release()
cv2.destroyAllWindows()
