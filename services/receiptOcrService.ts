import {z} from 'zod';
import {parseReceiptEntities} from '@/lib/receiptEntityParser';
const lineSchema=z.object({text:z.string(),confidence:z.number().min(0).max(1),bbox:z.object({x:z.number(),y:z.number(),w:z.number(),h:z.number()})});
export interface LocalOcrAssessment {
  shouldFallback: boolean;
  reasons: string[];
  averageConfidence: number;
  lowConfidenceRatio: number;
}

/**
 * Decide whether local OCR has enough evidence to populate the form. This is
 * deliberately based on confidence and generic invoice anchors, never on a
 * filename, vendor name, or one of the benchmark layouts.
 */
export function assessLocalOcr(parsed: ReturnType<typeof parseReceiptEntities>, lines: z.infer<typeof lineSchema>[]): LocalOcrAssessment {
 const averageConfidence=lines.length ? lines.reduce((sum,line)=>sum+line.confidence,0)/lines.length : 0;
 const lowConfidenceRatio=lines.length ? lines.filter(line=>line.confidence<0.8).length/lines.length : 1;
 const criticalFields=['invoiceNumber','invoiceDate','totalAmount'] as const;
 const reasons:string[]=[];
 const missing=criticalFields.filter(field=>parsed.invoice[field]===undefined);
 if(!lines.length)reasons.push('OCR không trả dòng chữ');
 if(lines.length<4)reasons.push('quá ít vùng chữ để xác định bố cục hóa đơn');
 if(averageConfidence<Number(process.env.LOCAL_OCR_MIN_AVERAGE_CONFIDENCE || 0.82))reasons.push(`độ tin cậy trung bình thấp (${averageConfidence.toFixed(2)})`);
 if(lowConfidenceRatio>Number(process.env.LOCAL_OCR_MAX_LOW_CONFIDENCE_RATIO || 0.35))reasons.push(`tỷ lệ dòng tin cậy thấp cao (${Math.round(lowConfidenceRatio*100)}%)`);
 if(missing.length)reasons.push(`thiếu trường cốt lõi: ${missing.join(', ')}`);
 if(parsed.uncertainFields.some(field=>criticalFields.includes(field as typeof criticalFields[number])))reasons.push('trường cốt lõi nằm trên vùng chữ tin cậy thấp');
 const totalEvidence=parsed.evidence.totalAmount || [];
 const suspiciousAmount=totalEvidence.some(line=>{
  const source=line.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/tong\s*(?:cong|tien(?:\s*thanh\s*toan)?|so\s*tien)|t\.?\s*cong|so\s*tien|tien\s*(?:mat|mt)/g,'')
   .replace(/[0-9.,'\s₫vnd-]/gi,'');
  return /[a-z]/i.test(source);
 });
 if(suspiciousAmount)reasons.push('vùng tổng tiền có ký tự không phải chữ số; cần kiểm tra lại');
 return {shouldFallback:reasons.length>0,reasons,averageConfidence,lowConfidenceRatio};
}

export async function extractInvoiceWithResidentOcr(base64:string) {
 const endpoint=process.env.LOCAL_OCR_URL;
 if(!endpoint)throw new Error('Chưa cấu hình worker OCR local.');
 const configuredTimeout=Number(process.env.LOCAL_OCR_TIMEOUT_MS || 2200);
 const timeoutMs=Number.isFinite(configuredTimeout) ? Math.min(15000, Math.max(500, configuredTimeout)) : 2200;
 const response=await fetch(new URL('/ocr',endpoint),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:Buffer.from(base64,'base64'),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw new Error(`Worker OCR lỗi HTTP ${response.status}.`);
 const raw=z.object({engine:z.string(),lines:z.array(lineSchema).max(4000)}).parse(await response.json());
 if(!raw.lines.length)throw new Error('OCR chưa đọc được chữ; cần ảnh rõ hơn.');
 const parsed=parseReceiptEntities(raw.lines);
 const low=raw.lines.filter(l=>l.confidence<0.8);
 const assessment=assessLocalOcr(parsed,raw.lines);
 const uncertainFields=[...parsed.uncertainFields];
 // A malformed numeric token is not a usable amount. Keep it visible for
 // review even when the local parser happened to return a finite number.
 if(assessment.reasons.some(reason=>reason.includes('vùng tổng tiền')) && !uncertainFields.includes('totalAmount'))
  uncertainFields.push('totalAmount');
 const fieldConfidences: Record<string, number> = {};
 for (const [field, evidence] of Object.entries(parsed.evidence)) {
  if (evidence.length) fieldConfidences[field] = evidence.reduce((sum, line) => sum + line.confidence, 0) / evidence.length;
 }
 return {data:parsed.invoice,engineUsed:'LOCAL_VISION_OCR' as const,uncertainFields,
  fallbackSuggested:assessment.shouldFallback,
  fallbackReasons:assessment.reasons,
  ocrLines:raw.lines,
  fieldConfidences,
  ocrDetails:{isImageBlurry:low.length>=3,blurScore:0,averageConfidence:assessment.averageConfidence,lowConfidenceLines:low,totalLines:raw.lines.length}};
}
