import { InvoiceInput, RiskGroup,EscalatedDecision } from '@/lib/schemas';
import {
  extractInvoiceImageWithGeminiVision,
  generateActionableQuestionWithGemini,
  GeminiQuestionResult,
  GeminiVisionDocumentType
} from './geminiService';

export type UnifiedEngineUsed = 'GEMINI_AI' | 'LOCAL_FALLBACK';

export interface ExtractionCoordinatorResult {
  data: Partial<InvoiceInput>;
  engineUsed: UnifiedEngineUsed;
  documentType?: GeminiVisionDocumentType;
}

/** Reads the image bytes directly with Gemini Vision; this path never invokes OCR. */
export async function extractInvoiceWithHybridPipeline(params: {
  imagePath?: string;
  fileBase64: string;
  mimeType: string;
  fileName?: string;
}): Promise<ExtractionCoordinatorResult> {
  const extraction = await extractInvoiceImageWithGeminiVision(params.fileBase64, params.mimeType, params.fileName);
  return { data: extraction.data, documentType: extraction.documentType, engineUsed: 'GEMINI_AI' };
}

/** Compatibility entry point for scanned PDF and ingestion callers. */
export async function extractInvoiceWithUnifiedAI(
  fileBase64: string,
  mimeType: string,
  fileName?: string
): Promise<{ data: Partial<InvoiceInput>; engineUsed: UnifiedEngineUsed }> {
  const extraction = await extractInvoiceImageWithGeminiVision(fileBase64, mimeType, fileName);
  return { data: extraction.data, engineUsed: 'GEMINI_AI' };
}

/** Generate the reviewer's A/B decision prompt through Gemini. */
export async function generateActionableQuestionWithUnifiedAI(
  invoice: InvoiceInput,
  riskGroup: RiskGroup,
  detectedHint?: string,
  sopClauseHint?: string,
  canonicalDecision?:EscalatedDecision
): Promise<{ result: GeminiQuestionResult; engineUsed: UnifiedEngineUsed }> {
  try {
    const result = await generateActionableQuestionWithGemini(invoice, riskGroup, detectedHint, sopClauseHint,canonicalDecision);
    return { result, engineUsed: 'GEMINI_AI' };
  } catch (geminiErr: any) {
    console.error('[AI Coordinator] Gemini Q-Gen gặp sự cố:', geminiErr);
    throw new Error(`Không thể sinh câu hỏi Q-Gen từ Gemini: ${geminiErr?.message || 'Lỗi kết nối'}`);
  }
}
