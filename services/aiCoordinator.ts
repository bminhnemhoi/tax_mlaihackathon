import { InvoiceInput, RiskGroup } from '@/lib/schemas';
import { GEMINI_API_CONFIG } from '@/lib/constants';
import {
  extractInvoiceWithGeminiVision,
  generateActionableQuestionWithGemini,
  GeminiQuestionResult
} from './geminiService';

export type UnifiedEngineUsed =
  | 'HYBRID_NEURAL_OCR'
  | 'LOCAL_VISION_OCR'
  | 'QWEN_AI'
  | 'GEMINI_AI'
  | 'LOCAL_FALLBACK';

export interface ExtractionCoordinatorResult {
  data: Partial<InvoiceInput>;
  engineUsed: UnifiedEngineUsed;
  uncertainFields?: string[];
  fieldConfidences?: Record<string, number>;
  ocrDetails?: {
    isImageBlurry: boolean;
    blurScore: number;
    averageConfidence: number;
    lowConfidenceLines: Array<{ text: string; confidence: number; bbox?: { x: number; y: number; w: number; h: number }; alternative?: string; reason?: string }>;
    totalLines: number;
  };
  fallbackReason?: string;
}

/**
 * Trích xuất hóa đơn trực tiếp bằng Gemini 2.5 Flash Vision.
 * Không qua tầng OCR cục bộ, gửi ảnh trực tiếp đến Vision AI của Gemini để đạt độ chính xác cao nhất.
 */
export async function extractInvoiceWithHybridPipeline(params: {
  imagePath?: string;
  fileBase64: string;
  mimeType: string;
  fileName?: string;
}): Promise<ExtractionCoordinatorResult> {
  const { fileBase64, mimeType, fileName } = params;
  console.log(`[AI Coordinator] Đang đọc ảnh hóa đơn trực tiếp 100% qua Gemini 2.5 Flash (không qua OCR)...`);
  const data = await extractInvoiceWithGeminiVision(fileBase64, mimeType, fileName);
  return {
    data,
    engineUsed: 'GEMINI_AI'
  };
}

/**
 * Đọc ảnh hóa đơn bằng Gemini 2.5 Flash Vision
 */
export async function extractInvoiceWithUnifiedAI(
  fileBase64: string,
  mimeType: string,
  fileName?: string
): Promise<{ data: Partial<InvoiceInput>; engineUsed: UnifiedEngineUsed }> {
  console.log(`[AI Coordinator] Đọc ảnh hóa đơn qua Gemini 2.5 Flash Vision...`);
  const data = await extractInvoiceWithGeminiVision(fileBase64, mimeType, fileName);
  return { data, engineUsed: 'GEMINI_AI' };
}

/**
 * Sinh câu hỏi phán quyết A/B đóng (Q-Gen) bằng Gemini 2.5 Flash:
 * Hỗ trợ KTT hoặc CFO ra phán quyết trong 3 giây đối với hóa đơn rủi ro.
 */
export async function generateActionableQuestionWithUnifiedAI(
  invoice: InvoiceInput,
  riskGroup: RiskGroup,
  detectedHint?: string,
  sopClauseHint?: string
): Promise<{ result: GeminiQuestionResult; engineUsed: UnifiedEngineUsed }> {
  try {
    console.log('[AI Coordinator] Đang sinh câu hỏi phán quyết qua Gemini 2.5 Flash...');
    const result = await generateActionableQuestionWithGemini(
      invoice,
      riskGroup,
      detectedHint,
      sopClauseHint
    );
    return { result, engineUsed: 'GEMINI_AI' };
  } catch (geminiErr: any) {
    console.error('[AI Coordinator] Gemini Q-Gen gặp sự cố:', geminiErr);
    throw new Error(`Không thể sinh câu hỏi Q-Gen từ Gemini 2.5 Flash: ${geminiErr?.message || 'Lỗi kết nối'}`);
  }
}
