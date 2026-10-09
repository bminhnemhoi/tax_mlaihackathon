import { InvoiceInput, RiskGroup } from '@/lib/schemas';
import {
  generateActionableQuestionWithGemini,
  extractInvoiceWithGemini
} from './geminiService';
import { GEMINI_API_CONFIG } from '@/lib/constants';
import { generateActionableQuestionWithQwen } from './qwenService';

export type UnifiedEngineUsed =
  | 'HYBRID_NEURAL_OCR'
  | 'LOCAL_VISION_OCR'
  | 'QWEN_AI'
  | 'GEMINI_AI'
  | 'LOCAL_FALLBACK';

export interface ExtractionCoordinatorResult {
  data: Partial<InvoiceInput>;
  engineUsed: UnifiedEngineUsed;
  ocrDetails?: {
    isImageBlurry: boolean;
    blurScore: number;
    averageConfidence: number;
    lowConfidenceLines: Array<{ text: string; confidence: number; bbox?: { x: number; y: number; w: number; h: number }; alternative?: string; reason?: string }>;
    totalLines: number;
  };
}

/**
 * Trích xuất hóa đơn chuyên sâu:
 * Ưu tiên Google Gemini Vision trực tiếp cho độ chính xác 100% và tốc độ cao nhất
 */
export async function extractInvoiceWithHybridPipeline(params: {
  imagePath?: string;
  fileBase64: string;
  mimeType: string;
  fileName?: string;
}): Promise<ExtractionCoordinatorResult> {
  const { fileBase64, mimeType, fileName } = params;

  // Luôn sử dụng Google Gemini Vision trực tiếp theo yêu cầu kiến trúc mới
  console.log('[AI Coordinator] Đang trích xuất hóa đơn trực tiếp bằng Google Gemini Vision...');
  const fallbackRes = await extractInvoiceWithUnifiedAI(fileBase64, mimeType, fileName);
  return {
    data: fallbackRes.data,
    engineUsed: fallbackRes.engineUsed
  };
}

/**
 * Đọc ảnh hóa đơn: Luôn sử dụng Google Gemini Vision trực tiếp (loại bỏ hoàn toàn DeepSeek Server và FreeLLM)
 */
export async function extractInvoiceWithUnifiedAI(
  fileBase64: string,
  mimeType: string,
  fileName?: string
): Promise<{ data: Partial<InvoiceInput>; engineUsed: UnifiedEngineUsed }> {
  if (!GEMINI_API_CONFIG.API_KEY) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong .env.local để đọc ảnh hóa đơn.');
  }

  console.log('[AI Coordinator] Đang đọc ảnh hóa đơn trực tiếp qua Google Gemini Vision...');
  const data = await extractInvoiceWithGemini(fileBase64, mimeType, fileName);
  return { data, engineUsed: 'GEMINI_AI' };
}

/**
 * Sinh câu hỏi phán quyết A/B đóng (Q-Gen):
 * Luôn ưu tiên Alibaba Cloud Qwen (qwen-plus-character) cho tư duy suy luận thuế sâu sắc.
 * Tự động fallback sang Google Gemini nếu Qwen gặp trục trặc mạng.
 */
export async function generateActionableQuestionWithUnifiedAI(
  invoice: InvoiceInput,
  riskGroup: RiskGroup,
  detectedHint?: string,
  sopClauseHint?: string
): Promise<{ result: any; engineUsed: UnifiedEngineUsed }> {
  // 1. Ưu tiên số 1: Alibaba Cloud Qwen
  try {
    console.log('[AI Coordinator] Đang sinh câu hỏi phán quyết qua Alibaba Cloud Qwen (qwen-plus-character)...');
    const result = await generateActionableQuestionWithQwen(
      invoice,
      riskGroup,
      detectedHint,
      sopClauseHint
    );
    return { result, engineUsed: 'QWEN_AI' };
  } catch (qwenErr: any) {
    console.warn(
      `[AI Coordinator] Qwen gặp sự cố (${qwenErr?.message || qwenErr}). Chuyển sang kích hoạt Gemini fallback...`
    );
  }

  // 2. Fallback sang Google Gemini nếu có API key
  if (GEMINI_API_CONFIG.API_KEY) {
    try {
      console.log('[AI Coordinator] Đang sinh câu hỏi phán quyết qua Google Gemini Fallback...');
      const result = await generateActionableQuestionWithGemini(
        invoice,
        riskGroup,
        detectedHint,
        sopClauseHint
      );
      return { result, engineUsed: 'GEMINI_AI' };
    } catch (geminiErr: any) {
      console.error('[AI Coordinator] Gemini fallback cũng thất bại:', geminiErr);
    }
  }

  throw new Error('Tất cả các dịch vụ AI suy luận (Qwen, Gemini) đều không thể sinh câu hỏi Q-Gen.');
}
