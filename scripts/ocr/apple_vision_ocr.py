#!/usr/bin/env python3
"""
Apple Vision Framework Local Neural OCR Engine với Blur Detection & Confidence Scoring
Tối ưu hóa chạy trên Apple Silicon Neural Engine (NPU) và GPU của macOS.
"""
import sys
import json
import time
import os

try:
    import Vision
    import Quartz
    import Cocoa
    from PIL import Image, ImageFilter, ImageStat
except ImportError as e:
    print(json.dumps({"error": f"Required library not available: {str(e)}"}))
    sys.exit(1)

def calculate_image_blur(image_path):
    """
    Đo độ sắc nét / độ mờ của ảnh bằng phương sai cạnh vi sai (Laplacian/Edge Variance) qua Pillow.
    - Ảnh rõ nét, chữ sắc sảo: edge_variance >= 120.0
    - Ảnh mờ nét, chụp rung tay, out-focus: edge_variance < 80.0
    """
    try:
        img = Image.open(image_path).convert("L")
        # Resize nhẹ nếu ảnh quá lớn để đo blur < 10ms
        img.thumbnail((1000, 1000))
        edges = img.filter(ImageFilter.FIND_EDGES)
        stat = ImageStat.Stat(edges)
        variance = stat.var[0]
        is_blurry = variance < 70.0
        return round(float(variance), 2), bool(is_blurry)
    except Exception as e:
        return 100.0, False

def run_apple_vision_ocr(image_path, recognition_level="accurate"):
    t0 = time.time()
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}

    blur_score, is_blurry = calculate_image_blur(image_path)

    url = Cocoa.NSURL.fileURLWithPath_(image_path)
    image = Quartz.CIImage.imageWithContentsOfURL_(url)
    if not image:
        return {"error": "Cannot decode image file"}

    handler = Vision.VNImageRequestHandler.alloc().initWithCIImage_options_(image, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    
    if recognition_level == "fast":
        request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelFast)
    else:
        request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)

    request.setUsesLanguageCorrection_(True)
    request.setRecognitionLanguages_(["vi-VN", "en-US"])

    success, error = handler.performRequests_error_([request], None)
    if not success:
        return {"error": str(error)}

    results = request.results() or []
    lines = []
    low_confidence_lines = []
    total_conf = 0.0

    for obs in results:
        top_candidates = obs.topCandidates_(2)
        if not top_candidates:
            continue
            
        primary = top_candidates[0]
        text = primary.string()
        conf = float(primary.confidence())
        total_conf += conf

        # Lấy tọa độ bounding box (tỉ lệ 0.0 - 1.0)
        box = obs.boundingBox()
        bbox_dict = {
            "x": round(float(box.origin.x), 3),
            "y": round(float(box.origin.y), 3),
            "w": round(float(box.size.width), 3),
            "h": round(float(box.size.height), 3)
        }

        # Nếu có ứng viên thay thế sát nút (nguy cơ đọc nhầm chữ số/ký tự)
        alt_text = top_candidates[1].string() if len(top_candidates) > 1 else None
        alt_conf = float(top_candidates[1].confidence()) if len(top_candidates) > 1 else None

        line_item = {
            "text": text,
            "confidence": round(conf, 3),
            "bbox": bbox_dict
        }

        if alt_text and alt_conf and (conf - alt_conf < 0.15):
            line_item["alternative"] = alt_text

        lines.append(line_item)

        # Ngưỡng cảnh báo chữ mờ / độ tin cậy thấp: < 0.75
        if conf < 0.75:
            low_confidence_lines.append({
                "text": text,
                "confidence": round(conf, 3),
                "bbox": bbox_dict,
                "alternative": alt_text,
                "reason": "Chữ in bị mờ nét, đứt đoạn hoặc nhòe quang học"
            })

    t1 = time.time()
    elapsed_ms = round((t1 - t0) * 1000, 1)
    avg_confidence = round(total_conf / len(lines), 3) if lines else 0.0

    # Nếu có nhiều dòng bị low confidence hoặc variance quá thấp -> ảnh có vùng mờ lớn
    has_blurry_sections = len(low_confidence_lines) >= 3 or is_blurry

    return {
        "engine": "APPLE_VISION_LOCAL_NPU",
        "processingTimeMs": elapsed_ms,
        "isImageBlurry": has_blurry_sections,
        "blurScore": blur_score,
        "averageConfidence": avg_confidence,
        "totalLines": len(lines),
        "lines": lines,
        "lowConfidenceLines": low_confidence_lines,
        "fullText": "\n".join([line["text"] for line in lines])
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: apple_vision_ocr.py <image_path> [accurate|fast]"}))
        sys.exit(1)

    img_path = sys.argv[1]
    level = sys.argv[2] if len(sys.argv) > 2 else "accurate"
    res = run_apple_vision_ocr(img_path, level)
    print(json.dumps(res, ensure_ascii=False, indent=2))
