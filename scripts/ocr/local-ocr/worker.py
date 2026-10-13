"""Experimental resident PP-OCRv5 worker. Local only; sends no images to providers."""

import time

started = time.perf_counter()
import os
import threading

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from rapidocr import EngineType, ModelType, OCRVersion, RapidOCR

engine = RapidOCR(
    params={
        "Det.engine_type": EngineType.ONNXRUNTIME,
        "Det.model_type": ModelType.MOBILE,
        "Det.ocr_version": OCRVersion.PPOCRV5,
        "Rec.engine_type": EngineType.ONNXRUNTIME,
        "Rec.lang_type": "latin",
        "Rec.model_type": ModelType.MOBILE,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "EngineConfig.onnxruntime.intra_op_num_threads": 4,
        "EngineConfig.onnxruntime.inter_op_num_threads": 1,
        "Det.limit_side_len": 960,
        "Det.limit_type": os.getenv("LOCAL_OCR_DET_LIMIT_TYPE", "min"),
        "Global.max_side_len": 1800,
        "Global.text_score": 0.5,
    }
)
# Build sessions and execute a warm-up before advertising readiness.
warm = np.full((160, 800, 3), 255, dtype=np.uint8)
cv2.putText(
    warm,
    "Invoice 123 VAT 10% Total 1000",
    (20, 100),
    cv2.FONT_HERSHEY_SIMPLEX,
    1.2,
    (0, 0, 0),
    2,
)
engine(warm)
startup_ms = round((time.perf_counter() - started) * 1000)
lock = threading.Lock()
app = FastAPI()


@app.get("/health")
def health():
    return {
        "ready": True,
        "engine": "PP-OCRv5-mobile-latin-ONNX-CPU",
        "startupMs": startup_ms,
        "detLimitType": os.getenv("LOCAL_OCR_DET_LIMIT_TYPE", "min"),
    }


@app.post("/ocr")
async def ocr(request: Request):
    t = time.perf_counter()
    if int(request.headers.get("content-length", "0")) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image too large")
    raw = await request.body()
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image too large")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Invalid image")
    h, w = image.shape[:2]
    if h * w > 40_000_000:
        raise HTTPException(413, "Too many pixels")
    scale = min(1, 1800 / max(h, w))
    if scale < 1:
        image = cv2.resize(
            image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA
        )
    prep_ms = (time.perf_counter() - t) * 1000
    # Serialize on this worker; latency includes any queue wait. No subprocess per image.
    with lock:
        o = time.perf_counter()
        result = engine(image)
        ocr_ms = (time.perf_counter() - o) * 1000
    lines = []
    if result.txts is not None:
        for text, score, box in zip(result.txts, result.scores, result.boxes):
            pts = np.asarray(box)
            x, y = pts.min(axis=0)
            xx, yy = pts.max(axis=0)
            # Emit normalized top-left coordinates, matching the browser, parser and
            # Apple Vision adapter rather than leaking worker-image pixel positions.
            lines.append(
                {
                    "text": text,
                    "confidence": float(score),
                    "bbox": {
                        "x": float(x / image.shape[1]),
                        "y": float(y / image.shape[0]),
                        "w": float((xx - x) / image.shape[1]),
                        "h": float((yy - y) / image.shape[0]),
                    },
                }
            )
    return {
        "engine": "PP-OCRv5-mobile-latin-ONNX-CPU",
        "lines": lines,
        "imageWidth": image.shape[1],
        "imageHeight": image.shape[0],
        "performance": {
            "preprocessMs": round(prep_ms, 2),
            "ocrMs": round(ocr_ms, 2),
            "workerMs": round((time.perf_counter() - t) * 1000, 2),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("LOCAL_OCR_HOST", "127.0.0.1"),
        port=int(os.getenv("LOCAL_OCR_PORT", "3004")),
        log_level="warning",
    )
