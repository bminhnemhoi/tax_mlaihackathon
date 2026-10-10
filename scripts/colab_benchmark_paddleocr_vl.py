"""Benchmark PaddleOCR-VL-1.6 on Vietnamese camera receipts in Colab.

This script is intentionally self-contained for `colab run --gpu T4`.
It downloads only the public QA images, keeps the model on the remote VM,
and prints compact JSON so the caller can save the benchmark locally.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request

MODEL_PACKAGE = "paddleocr[doc-parser]"
PADDLE_GPU_INDEX = "https://www.paddlepaddle.org.cn/packages/stable/cu126/"
ROOT = Path("/content/tax-referee-vn-camera")
IMAGES = {
    "1.jpeg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/1.jpeg",
    "10.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/10.jpg",
    "11.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/11.jpg",
    "12.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/12.jpg",
    "13.png": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/13.png",
    "14.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/14.jpg",
    "15.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/15.jpg",
    "16.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/16.jpg",
    "17.jpg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/17.jpg",
    "18.jpeg": "https://raw.githubusercontent.com/tienhung2812/ocr/master/stock/receipt/18.jpeg",
}


def ensure_packages() -> None:
    needs_gpu = True
    try:
        import paddleocr  # noqa: F401
        import paddle  # noqa: F401
        needs_gpu = not paddle.device.is_compiled_with_cuda()
    except Exception:
        pass
    if needs_gpu:
        # Colab's default `paddlepaddle` wheel is CPU-only.  PaddleOCR-VL
        # needs the CUDA wheel; use the official CUDA 12.6 index used by
        # current Colab T4 runtimes.
        subprocess.check_call([
            sys.executable, "-m", "pip", "uninstall", "-y", "-q", "paddlepaddle"
        ])
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-q",
            "paddlepaddle-gpu==3.3.0", "-i", PADDLE_GPU_INDEX,
            MODEL_PACKAGE,
        ])


def download_images() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, url in IMAGES.items():
        path = ROOT / name
        if path.exists() and path.stat().st_size > 1000:
            continue
        req = Request(url, headers={"User-Agent": "tax-referee-colab-benchmark/1.0"})
        with urlopen(req, timeout=30) as response:
            path.write_bytes(response.read())


def result_to_dict(result):
    value = getattr(result, "json", None)
    if callable(value):
        value = value()
    if value is None:
        value = getattr(result, "res", None)
    if value is None and hasattr(result, "to_dict"):
        value = result.to_dict()
    if isinstance(value, dict):
        return value
    return {"raw": str(value if value is not None else result)}


def extract_text(payload: dict) -> str:
    for candidate in (
        payload.get("markdown"),
        payload.get("res", {}).get("markdown") if isinstance(payload.get("res"), dict) else None,
        payload.get("prunedResult", {}).get("markdown") if isinstance(payload.get("prunedResult"), dict) else None,
    ):
        if isinstance(candidate, dict) and isinstance(candidate.get("text"), str):
            return candidate["text"]
        if isinstance(candidate, str):
            return candidate
    return ""


def main() -> None:
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    ensure_packages()
    download_images()
    from paddleocr import PaddleOCRVL

    load_started = time.perf_counter()
    pipeline = PaddleOCRVL(
        pipeline_version="v1.6",
        use_layout_detection=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        device="gpu:0",
    )
    load_ms = round((time.perf_counter() - load_started) * 1000)

    results = []
    for name in IMAGES:
        started = time.perf_counter()
        try:
            output = list(pipeline.predict(str(ROOT / name)))
            payload = result_to_dict(output[0]) if output else {}
            text = extract_text(payload)
            results.append({
                "id": name,
                "status": "ok",
                "elapsedMs": round((time.perf_counter() - started) * 1000),
                "text": text,
                "raw": payload,
            })
        except Exception as exc:
            results.append({
                "id": name,
                "status": "error",
                "elapsedMs": round((time.perf_counter() - started) * 1000),
                "error": f"{type(exc).__name__}: {exc}",
            })
        print(json.dumps({k: v for k, v in results[-1].items() if k not in {"raw", "text"}}, ensure_ascii=False), flush=True)

    print(json.dumps({
        "model": "PaddleOCR-VL-1.6-0.9B",
        "device": "gpu:0",
        "loadMs": load_ms,
        "results": results,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
