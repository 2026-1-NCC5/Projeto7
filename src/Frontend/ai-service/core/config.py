import os
from dotenv import load_dotenv

load_dotenv()

TRAINED_MODEL_PATH = os.getenv("TRAINED_MODEL_PATH", r"C:\Users\felip\Downloads\best.pt")
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
CONFIDENCE = float(os.getenv("CONFIDENCE", "0.45"))

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")