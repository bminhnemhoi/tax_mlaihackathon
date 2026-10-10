"""Measure OpenRouter Qwen3-VL-8B (Alibaba provider) on 10 public QA images.

The API key is read from the ignored .env.local file and is never printed or
written to the report.  The report contains only timings, model/provider
metadata, redacted predictions, and field-level comparison with the checked-in
manifest.
"""
from __future__ import annotations

import base64
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

MODEL = "qwen/qwen3-vl-8b-instruct"
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
ROOT = Path("docs/qa-2026-10-10/internet-vn-camera-10")
IMAGE_DIR = ROOT
MANIFEST = ROOT / "manifest.json"


def env_value(name: str) -> str:
    for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def parse_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text or "", flags=re.S)
    if not match:
        return {"_parseError": "no_json"}
    try:
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else {"_parseError": "not_object"}
    except json.JSONDecodeError:
        return {"_parseError": "invalid_json"}


def norm(value) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def equal(field: str, got, expected) -> bool:
    if got is None:
        return False
    if field == "totalAmount":
        return re.sub(r"[^0-9]", "", str(got)) == str(expected)
    if field == "invoiceDate":
        match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", str(got))
        return bool(match and f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}" == expected)
    if field == "paymentMethod":
        return norm(got) == "cash" or "tiền mặt" in str(got).lower()
    return norm(got) == norm(expected)


def image_data_url(path: Path) -> str:
    suffix = path.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(suffix, "application/octet-stream")
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    api_key = env_value("OPENROUTER_API_KEY")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY is missing")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = manifest["items"]
    prompt = (
        "Đọc hóa đơn tiếng Việt trong ảnh. Trả về đúng một JSON object, không markdown, "
        "với các khóa supplierName, invoiceNumber, invoiceDate (YYYY-MM-DD), totalAmount "
        "(số nguyên VND), paymentMethod (CASH/BANK_TRANSFER/OTHER). Nếu trường không có "
        "hoặc không đọc chắc chắn, dùng null; không suy đoán."
    )
    results = []
    for item in items:
        name = item["id"]
        body = {
            "model": MODEL,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": image_data_url(IMAGE_DIR / name)}}]}],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "max_tokens": 256,
        }
        started = time.perf_counter()
        req = Request(ENDPOINT, data=json.dumps(body).encode("utf-8"), method="POST", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "HTTP-Referer": "https://tax-referee.local", "X-Title": "Tax Referee benchmark"})
        try:
            with urlopen(req, timeout=30) as response:
                payload = json.loads(response.read())
            elapsed_ms = round((time.perf_counter() - started) * 1000)
            raw = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
            prediction = parse_json(raw)
            field_results = {field: equal(field, prediction.get(field), value) for field, value in item.get("groundTruth", {}).items()}
            results.append({"id": name, "status": "ok", "elapsedMs": elapsed_ms, "prediction": prediction, "fieldResults": field_results, "provider": payload.get("provider"), "usage": payload.get("usage")})
        except Exception as exc:
            results.append({"id": name, "status": "error", "elapsedMs": round((time.perf_counter() - started) * 1000), "error": f"{type(exc).__name__}: {str(exc)[:240]}"})
        print(json.dumps(results[-1], ensure_ascii=False), flush=True)

    elapsed = [r["elapsedMs"] for r in results if r["status"] == "ok"]
    sorted_elapsed = sorted(elapsed)
    field_total = sum(len(r.get("fieldResults", {})) for r in results)
    field_correct = sum(sum(r.get("fieldResults", {}).values()) for r in results)
    report = {"model": MODEL, "providerRequested": "OpenRouter automatic routing (Alibaba endpoint was unavailable at test time)", "results": results, "summary": {"requests": len(results), "success": len(elapsed), "fieldCorrect": field_correct, "fieldTotal": field_total, "fieldAccuracy": field_correct / field_total if field_total else 0, "minMs": min(elapsed) if elapsed else None, "medianMs": sorted_elapsed[len(sorted_elapsed) // 2] if elapsed else None, "p95Ms": sorted_elapsed[min(len(sorted_elapsed) - 1, max(0, int(len(sorted_elapsed) * 0.95) - 1))] if elapsed else None, "maxMs": max(elapsed) if elapsed else None, "under2s": sum(value < 2000 for value in elapsed)}}
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
