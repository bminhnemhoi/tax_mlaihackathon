import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface LocalNeuralOcrResult {
  success: boolean;
  fullText: string;
  isImageBlurry: boolean;
  blurScore: number;
  averageConfidence: number;
  totalLines: number;
  lowConfidenceLines: Array<{ text: string; confidence: number; bbox?: any; alternative?: string; reason?: string }>;
  processingTimeMs: number;
  error?: string;
}

let isVisionChecked = false;
let isVisionAvailableCache = false;

/**
 * Kiểm tra xem môi trường máy tính có hỗ trợ Apple Vision Framework qua Python PyObjC hay không
 */
export function isAppleVisionAvailable(): boolean {
  if (isVisionChecked) return isVisionAvailableCache;
  if (process.platform !== 'darwin') {
    isVisionChecked = true;
    isVisionAvailableCache = false;
    return false;
  }

  try {
    execSync('python3 -c "import Quartz, Vision"', { stdio: 'ignore', timeout: 2000 });
    isVisionAvailableCache = true;
  } catch {
    isVisionAvailableCache = false;
  }

  isVisionChecked = true;
  return isVisionAvailableCache;
}

/**
 * Thực thi Local Neural OCR chạy trực tiếp trên Apple Silicon Neural Engine (NPU/GPU)
 * Tích hợp đo độ mờ quang học Laplacian và tính điểm tin cậy quang học cho từng dòng chữ.
 */
export async function runAppleVisionOcr(
  imagePath: string,
  mode: 'accurate' | 'fast' = 'accurate'
): Promise<LocalNeuralOcrResult> {
  const t0 = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'apple_vision_ocr.py');

  if (!fs.existsSync(scriptPath) || !fs.existsSync(imagePath)) {
    return {
      success: false,
      fullText: '',
      isImageBlurry: false,
      blurScore: 0,
      averageConfidence: 0,
      totalLines: 0,
      lowConfidenceLines: [],
      processingTimeMs: Date.now() - t0,
      error: 'Không tìm thấy file ảnh hoặc script OCR'
    };
  }

  try {
    const rawOutput = execSync(`python3 "${scriptPath}" "${imagePath}" ${mode}`, {
      encoding: 'utf-8',
      timeout: 15000
    });

    const parsed = JSON.parse(rawOutput);

    return {
      success: true,
      fullText: parsed.fullText || '',
      isImageBlurry: Boolean(parsed.isImageBlurry),
      blurScore: Number(parsed.blurScore) || 0,
      averageConfidence: Number(parsed.averageConfidence) || 0,
      totalLines: Number(parsed.totalLines) || 0,
      lowConfidenceLines: Array.isArray(parsed.lowConfidenceLines) ? parsed.lowConfidenceLines : [],
      processingTimeMs: Date.now() - t0
    };
  } catch (err: any) {
    return {
      success: false,
      fullText: '',
      isImageBlurry: false,
      blurScore: 0,
      averageConfidence: 0,
      totalLines: 0,
      lowConfidenceLines: [],
      processingTimeMs: Date.now() - t0,
      error: err?.message || String(err)
    };
  }
}
