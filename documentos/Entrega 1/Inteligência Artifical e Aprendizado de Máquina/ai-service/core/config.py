import os
from dotenv import load_dotenv

load_dotenv()

# caminho do modelo treinado
TRAINED_MODEL_PATH = os.getenv("TRAINED_MODEL_PATH")

# câmera e confiança
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
CONFIDENCE = float(os.getenv("CONFIDENCE", "0.25"))