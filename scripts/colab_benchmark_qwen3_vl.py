"""Benchmark Qwen3-VL-2B directly on a remote Colab GPU.

The model is never loaded on the developer laptop.  The script downloads the
public QA images inside the ephemeral Colab VM, asks the model for a strict
entity JSON object, and prints one compact JSON report for local evidence.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

MODEL = "Qwen/Qwen3-VL-2B-Instruct"
ROOT = Path("/content/tax-referee-qwen3-vl")
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
GROUND_TRUTH = {
    "1.jpeg": {"supplierName": "LIKE CAFE", "invoiceNumber": "HD190114-46", "invoiceDate": "2014-01-19", "totalAmount": 540000},
    "10.jpg": {"supplierName": "CỬA HÀNG ĐẠI VIỆT", "invoiceNumber": "0002", "invoiceDate": "2018-04-23", "totalAmount": 112000, "paymentMethod": "CASH"},
    "11.jpg": {"supplierName": "CAFE KHOA", "invoiceNumber": "0001", "invoiceDate": "2018-02-12", "totalAmount": 1243925, "paymentMethod": "CASH"},
    "12.jpg": {"supplierName": "Insanity Cafe & Lounge", "invoiceDate": "2019-01-12", "totalAmount": 945000},
    "13.png": {"supplierName": "Coffee Kem Sen Trắng", "invoiceNumber": "0006", "invoiceDate": "2017-09-13", "totalAmount": 151200, "paymentMethod": "CASH"},
    "14.jpg": {"supplierName": "CUM COFFEE & TEA", "invoiceDate": "2018-06-26", "totalAmount": 50400, "paymentMethod": "CASH"},
    "15.jpg": {"supplierName": "THE OPERA", "invoiceNumber": "0002", "invoiceDate": "2017-05-30", "totalAmount": 89000, "paymentMethod": "CASH"},
    "16.jpg": {"supplierName": "MR.BOOM", "invoiceNumber": "0003", "invoiceDate": "2018-04-20", "totalAmount": 209000, "paymentMethod": "CASH"},
    "17.jpg": {"supplierName": "CÂY DỪA KARAOKE CLUB", "totalAmount": 679999},
    "18.jpeg": {"supplierName": "CAFE & BAKERY", "invoiceNumber": "0003", "invoiceDate": "2018-04-18", "totalAmount": 81000, "paymentMethod": "CASH"},
}


def install() -> None:
    # Colab images occasionally ship an incompatible torchvision/Pillow pair.
    # Qwen3-VL only needs PIL for this path, so remove torchvision and install
    # a coherent Pillow wheel before importing Transformers.
    subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchvision"], check=False)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-U", "transformers", "accelerate", "--force-reinstall", "pillow"])


def download_images() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, url in IMAGES.items():
        path = ROOT / name
        if path.exists() and path.stat().st_size > 1000:
            continue
        req = Request(url, headers={"User-Agent": "tax-referee-colab-benchmark/1.0"})
        with urlopen(req, timeout=30) as response:
            path.write_bytes(response.read())


def parse_json(text: str) -> dict:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.S | re.I)
    candidate = fenced.group(1) if fenced else text
    match = re.search(r"\{.*\}", candidate, flags=re.S)
    if not match:
        return {"_parseError": "no_json", "_raw": text}
    try:
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else {"_parseError": "not_object", "_raw": text}
    except json.JSONDecodeError:
        return {"_parseError": "invalid_json", "_raw": text}


def norm(value) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def field_equal(field: str, got, expected) -> bool:
    if got is None:
        return False
    if field == "totalAmount":
        digits = re.sub(r"[^0-9]", "", str(got))
        return digits == str(expected)
    if field == "invoiceDate":
        m = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", str(got))
        return bool(m and f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" == expected)
    if field == "paymentMethod":
        return "cash" in norm(got) or "tiền mặt" in str(got).lower()
    return norm(got) == norm(expected)


def main() -> None:
    install()
    download_images()
    import torch
    from PIL import Image
    from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

    load_started = time.perf_counter()
    model = Qwen3VLForConditionalGeneration.from_pretrained(
        MODEL, torch_dtype=torch.float16, device_map="auto"
    )
    processor = AutoProcessor.from_pretrained(MODEL)
    load_ms = round((time.perf_counter() - load_started) * 1000)
    prompt = (
        "Đọc hóa đơn tiếng Việt trong ảnh. Trả về đúng MỘT JSON object, không markdown, "
        "với các khóa supplierName, invoiceNumber, invoiceDate (YYYY-MM-DD), totalAmount "
        "(số nguyên VND), paymentMethod (CASH/BANK_TRANSFER/OTHER). Nếu trường không đọc "
        "được hoặc không có, dùng null; tuyệt đối không suy đoán."
    )
    results = []
    for name in IMAGES:
        started = time.perf_counter()
        try:
            image = Image.open(ROOT / name).convert("RGB")
            messages = [{"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": prompt}]}]
            inputs = processor.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")
            inputs = {k: v.to(model.device) if hasattr(v, "to") else v for k, v in inputs.items()}
            with torch.inference_mode():
                generated = model.generate(**inputs, max_new_tokens=128, do_sample=False)
            trimmed = generated[0][inputs["input_ids"].shape[-1]:]
            raw = processor.decode(trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)
            parsed = parse_json(raw)
            expected = GROUND_TRUTH[name]
            field_results = {field: field_equal(field, parsed.get(field), value) for field, value in expected.items()}
            results.append({"id": name, "status": "ok", "elapsedMs": round((time.perf_counter() - started) * 1000), "prediction": parsed, "raw": raw, "fieldResults": field_results})
        except Exception as exc:
            results.append({"id": name, "status": "error", "elapsedMs": round((time.perf_counter() - started) * 1000), "error": f"{type(exc).__name__}: {exc}"})
        print(json.dumps({k: v for k, v in results[-1].items() if k not in {"raw", "prediction"}}, ensure_ascii=False), flush=True)

    field_total = sum(len(r.get("fieldResults", {})) for r in results)
    field_correct = sum(sum(r.get("fieldResults", {}).values()) for r in results)
    elapsed = [r["elapsedMs"] for r in results if r.get("status") == "ok"]
    elapsed_sorted = sorted(elapsed)
    print(json.dumps({"model": MODEL, "device": str(model.device), "loadMs": load_ms, "results": results, "summary": {"fieldCorrect": field_correct, "fieldTotal": field_total, "fieldAccuracy": field_correct / field_total if field_total else 0, "minMs": min(elapsed) if elapsed else None, "medianMs": elapsed_sorted[len(elapsed_sorted) // 2] if elapsed else None, "maxMs": max(elapsed) if elapsed else None, "under2s": sum(v < 2000 for v in elapsed)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
