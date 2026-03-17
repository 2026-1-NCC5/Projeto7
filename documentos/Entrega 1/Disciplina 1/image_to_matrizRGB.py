import cv2
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 1. Carregar a imagem relacionada ao projeto (ex: arroz.jpg)
img = cv2.imread('imagem_original.jpg')
img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) # Converte para o padrão RGB

# 2. Extrair as dimensões (Altura, Largura, Canais)
h, w, c = img_rgb.shape
print(f"Dimensões da imagem: {h}x{w} com {c} canais de cor.")

# 3. Organizar os dados em formato de lista para a planilha
# Vamos criar uma lista de pixels com suas coordenadas e cores
dados_pixels = []
for y in range(h):
    for x in range(w):
        r, g, b = img_rgb[y, x]
        dados_pixels.append([y, x, r, g, b])

# 4. Exportar para CSV (Planilha Eletrônica)
df = pd.DataFrame(dados_pixels, columns=['Linha_Y', 'Coluna_X', 'Red', 'Green', 'Blue'])
df.to_csv('matriz_imagem_alimento.csv', index=False)
print("Dados exportados para matriz_imagem_alimento.csv com sucesso!")

# 5. Reconstruir a imagem a partir da matriz (Prova de conceito)
img_reconstruida = np.zeros((h, w, 3), dtype=np.uint8)
for index, row in df.iterrows():
    img_reconstruida[int(row['Linha_Y']), int(row['Coluna_X'])] = [row['Red'], row['Green'], row['Blue']]

# Mostrar o resultado
plt.imshow(img_reconstruida)
plt.title("Imagem Reconstruída via Matriz")
plt.show()