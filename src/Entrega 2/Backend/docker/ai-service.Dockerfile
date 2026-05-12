FROM python:3.11-slim
WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*


RUN python -m pip install --upgrade pip
RUN pip install fastapi[all] uvicorn numpy opencv-python-headless


COPY ai-service/ ./

EXPOSE 8001
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8001"]
