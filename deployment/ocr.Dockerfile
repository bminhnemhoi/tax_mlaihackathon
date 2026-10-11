FROM python:3.11-slim
WORKDIR /worker
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY scripts/ocr/local-ocr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts/ocr/local-ocr/worker.py .
ENV LOCAL_OCR_HOST=0.0.0.0 LOCAL_OCR_PORT=3004
EXPOSE 3004
CMD ["python", "worker.py"]
