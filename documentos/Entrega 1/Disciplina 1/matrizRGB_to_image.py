import pandas as pd
import numpy as np
import cv2
import matplotlib.pyplot as plt

# 1. Carregar os dados da planilha (CSV)
# Certifique-se de que o nome do arquivo é o mesmo que você salvou anteriormente
df_lido = pd.read_csv('matriz_imagem_alimento.csv')

# 2. Descobrir as dimensões da imagem original a partir das coordenadas
# O valor máximo de 'Linha_Y' + 1 nos dá a altura, e 'Coluna_X' + 1 a largura
altura = df_lido['Linha_Y'].max() + 1
largura = df_lido['Coluna_X'].max() + 1

print(f"Reconstruindo imagem de dimensões: {altura}x{largura}")

# 3. Criar uma matriz vazia (preta) com as dimensões e 3 canais de cor (RGB)
# Usamos uint8 porque os pixels variam de 0 a 255
img_reconstruida = np.zeros((altura, largura, 3), dtype=np.uint8)

# 4. Preencher a matriz com os dados vindos do CSV
for index, linha in df_lido.iterrows():
    y = int(linha['Linha_Y'])
    x = int(linha['Coluna_X'])
    r = int(linha['Red'])
    g = int(linha['Green'])
    b = int(linha['Blue'])
    
    # Atribui o vetor de cor [R, G, B] à posição (y, x) da matriz
    img_reconstruida[y, x] = [r, g, b]

# 5. Exibir o resultado final
plt.figure(figsize=(10, 6))
plt.imshow(img_reconstruida)
plt.title("Imagem Reconstruída a partir da Representação Matricial")
plt.axis('off') # Remove os eixos para parecer uma foto
plt.show()

# Opcional: Salvar a imagem reconstruída para colocar no relatório
# Lembre-se que o OpenCV usa BGR, então precisamos inverter para salvar corretamente
cv2.imwrite('imagem_reconstruida_final.jpg', cv2.cvtColor(img_reconstruida, cv2.COLOR_RGB2BGR))