import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractInvoiceWithGemini } from '../services/geminiService';
import { parseInvoiceFromRawText } from '../lib/rawTextParser';
import { autoEnrichSupplierData } from '../services/taxLookupService';

interface BenchmarkResult {
  fileName: string;
  localOcr: {
    timeMs: number;
    success: boolean;
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierName?: string;
    supplierTaxCode?: string;
    totalAmount?: number;
    isImageBlurry: boolean;
    blurScore: number;
    averageConfidence: number;
    lowConfidenceCount: number;
    detectedBlurryLines: string[];
  };
  vlm: {
    timeMs: number;
    success: boolean;
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierName?: string;
    supplierTaxCode?: string;
    totalAmount?: number;
    isImageBlurry: boolean;
    detectedBlurryLines: string[];
    error?: string;
  };
}

async function runLocalOcrPipeline(imagePath: string) {
  const t0 = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'apple_vision_ocr.py');
  
  const rawOutput = execSync(`python3 "${scriptPath}" "${imagePath}" accurate`, {
    encoding: 'utf-8',
    timeout: 10000
  });

  const ocrData = JSON.parse(rawOutput);
  const parsedInvoice = parseInvoiceFromRawText(ocrData.fullText || '');

  // Auto-enrich
  const enriched = await autoEnrichSupplierData({
    supplierTaxCode: parsedInvoice.invoice.supplierTaxCode,
    supplierName: parsedInvoice.invoice.supplierName,
    rawText: ocrData.fullText
  });

  const t1 = Date.now();

  const blurryLines = (ocrData.lowConfidenceLines || []).map((l: any) => l.text);

  return {
    timeMs: t1 - t0,
    success: true,
    invoiceNumber: parsedInvoice.invoice.invoiceNumber,
    invoiceDate: parsedInvoice.invoice.invoiceDate,
    supplierName: enriched.supplierName || parsedInvoice.invoice.supplierName,
    supplierTaxCode: enriched.supplierTaxCode || parsedInvoice.invoice.supplierTaxCode,
    totalAmount: parsedInvoice.invoice.totalAmount,
    isImageBlurry: Boolean(ocrData.isImageBlurry),
    blurScore: ocrData.blurScore || 0,
    averageConfidence: ocrData.averageConfidence || 0,
    lowConfidenceCount: ocrData.lowConfidenceLines?.length || 0,
    detectedBlurryLines: blurryLines.slice(0, 3)
  };
}

async function runVlmPipeline(imagePath: string) {
  const t0 = Date.now();
  const buf = fs.readFileSync(imagePath);
  const base64 = buf.toString('base64');
  const fileName = path.basename(imagePath);

  try {
    const extracted = await extractInvoiceWithGemini(base64, 'image/jpeg', fileName);
    const t1 = Date.now();

    return {
      timeMs: t1 - t0,
      success: true,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      supplierName: extracted.supplierName,
      supplierTaxCode: extracted.supplierTaxCode,
      totalAmount: extracted.totalAmount,
      isImageBlurry: Boolean(extracted.isImageBlurry),
      detectedBlurryLines: extracted.isImageBlurry ? ['AI đánh dấu ảnh chụp bị mờ/khó đọc toàn bộ'] : []
    };
  } catch (err: any) {
    const t1 = Date.now();
    return {
      timeMs: t1 - t0,
      success: false,
      isImageBlurry: false,
      detectedBlurryLines: [],
      error: err?.message || String(err)
    };
  }
}

async function main() {
  const testImages = [
    'input-sample/07_real_bill_circle_k.jpg',
    'input-sample/08_real_bill_coopfood.jpg',
    'input-sample/11_real_invoice_photo.jpg'
  ];

  console.log('=============================================================================');
  console.log('    BẢNG SO SÁNH ĐỐI ĐẦU: LOCAL NEURAL OCR vs VLM (DEEPSEEK / VISION LLM)');
  console.log('=============================================================================\n');

  const results: BenchmarkResult[] = [];

  for (const imgPath of testImages) {
    if (!fs.existsSync(imgPath)) continue;
    const fileName = path.basename(imgPath);
    console.log(`[ĐANG TEST]: ${fileName}...`);

    console.log(' -> Chạy Local Neural OCR (Apple Vision + Blur Analytics)...');
    const localRes = await runLocalOcrPipeline(imgPath);

    console.log(' -> Chạy Cloud VLM (Vision LLM)...');
    const vlmRes = await runVlmPipeline(imgPath);

    results.push({
      fileName,
      localOcr: localRes,
      vlm: vlmRes
    });
    console.log(` -> Hoàn thành ${fileName}!\n`);
  }

  console.log('\n=============================================================================');
  console.log('                           KẾT QUẢ SO SÁNH CHI TIẾT');
  console.log('=============================================================================');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
