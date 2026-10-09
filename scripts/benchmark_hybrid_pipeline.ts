import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractInvoiceFromOcrTextWithDeepSeek } from '../services/deepseekService';
import { parseInvoiceFromRawText } from '../lib/rawTextParser';
import { autoEnrichSupplierData } from '../services/taxLookupService';

interface HybridResult {
  id: number;
  fileName: string;
  category: string;
  timeLocalOcrMs: number;
  timeDeepSeekTextMs: number;
  totalTimeMs: number;
  success: boolean;
  isImageBlurry: boolean;
  lowConfidenceCount: number;
  blurScore: number;
  detectedBlurryLines: string[];
  invoiceNumber?: string;
  invoiceDate?: string;
  supplierName?: string;
  supplierTaxCode?: string;
  totalAmount?: number;
  itemCount: number;
  error?: string;
}

async function runHybridPipeline(imagePath: string, testIndex: number): Promise<HybridResult> {
  const tStart = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'apple_vision_ocr.py');
  const fileName = path.basename(imagePath);

  // 1. Local OCR (Apple Vision)
  const t0 = Date.now();
  let ocrData: any;
  try {
    const rawOutput = execSync(`python3 "${scriptPath}" "${imagePath}" accurate`, {
      encoding: 'utf-8',
      timeout: 15000
    });
    ocrData = JSON.parse(rawOutput);
  } catch (err: any) {
    return {
      id: testIndex,
      fileName,
      category: '',
      timeLocalOcrMs: Date.now() - t0,
      timeDeepSeekTextMs: 0,
      totalTimeMs: Date.now() - tStart,
      success: false,
      isImageBlurry: false,
      lowConfidenceCount: 0,
      blurScore: 0,
      detectedBlurryLines: [],
      itemCount: 0,
      error: `Local OCR failed: ${err.message}`
    };
  }
  const timeLocalOcrMs = Date.now() - t0;

  // Trích xuất sơ bộ bằng Regex để lấy MST nhanh
  const parsedRegex = parseInvoiceFromRawText(ocrData.fullText || '');

  // 2. Tra cứu danh bạ thuế MST
  const enriched = await autoEnrichSupplierData({
    supplierTaxCode: parsedRegex.invoice.supplierTaxCode,
    supplierName: parsedRegex.invoice.supplierName,
    rawText: ocrData.fullText
  });

  // 3. DeepSeek Text-only parsing từ fullText
  const t1 = Date.now();
  let dsResult: any = {};
  try {
    dsResult = await extractInvoiceFromOcrTextWithDeepSeek(
      ocrData.fullText || '',
      `bench-hybrid-${testIndex}-${Date.now()}`
    );
  } catch (err: any) {
    console.warn(`[Hybrid Test ${testIndex}] DeepSeek Text parsing gặp lỗi, fallback regex:`, err?.message);
  }
  const timeDeepSeekTextMs = Date.now() - t1;
  const totalTimeMs = Date.now() - tStart;

  const finalTaxCode = enriched.supplierTaxCode || dsResult.supplierTaxCode || parsedRegex.invoice.supplierTaxCode || '';
  const finalSupplierName = enriched.supplierName || dsResult.supplierName || parsedRegex.invoice.supplierName || '';
  const finalInvoiceNum = dsResult.invoiceNumber || parsedRegex.invoice.invoiceNumber || '';
  const finalDate = dsResult.invoiceDate || parsedRegex.invoice.invoiceDate || '';
  const finalTotalAmount = dsResult.totalAmount ?? parsedRegex.invoice.totalAmount;
  const blurryLines = (ocrData.lowConfidenceLines || []).map((l: any) => l.text);

  return {
    id: testIndex,
    fileName,
    category: '',
    timeLocalOcrMs,
    timeDeepSeekTextMs,
    totalTimeMs,
    success: true,
    isImageBlurry: Boolean(ocrData.isImageBlurry),
    lowConfidenceCount: ocrData.lowConfidenceLines?.length || 0,
    blurScore: ocrData.blurScore || 0,
    detectedBlurryLines: blurryLines.slice(0, 3),
    invoiceNumber: finalInvoiceNum,
    invoiceDate: finalDate,
    supplierName: finalSupplierName,
    supplierTaxCode: finalTaxCode,
    totalAmount: finalTotalAmount,
    itemCount: Array.isArray(dsResult.items) ? dsResult.items.length : 0
  };
}

async function main() {
  const baseDir = '/Users/xuannguyen/Desktop/Competitions/2026/MLAI - Track 2/billmate (END)/sample_inputs';

  const testSuite = [
    { file: '19_edge_case_blurred_unreadable.jpg', cat: 'Ảnh mờ cực đoan (Edge Case Blur)' },
    { file: '01_vat_einvoice_abeco_hardware.jpg', cat: 'Hóa đơn GTGT linh kiện Abeco' },
    { file: '02_vat_einvoice_telecom_service.jpg', cat: 'Hóa đơn GTGT cước viễn thông' },
    { file: '03_vat_einvoice_office_supplies.jpg', cat: 'Hóa đơn GTGT văn phòng phẩm' },
    { file: '04_vat_einvoice_material_procurement.jpg', cat: 'Hóa đơn GTGT vật tư xây dựng' },
    { file: '14_mcocr_milano_coffee_vietnam.jpg', cat: 'Bill in nhiệt Milano Coffee' },
    { file: '16_mcocr_supermarket_winmart_retail.jpg', cat: 'Bill bán lẻ siêu thị WinMart' },
    { file: '15_mcocr_supermarket_saigon_coop.jpg', cat: 'Bill bán lẻ siêu thị Saigon Co.op' },
    { file: '12_mcocr_restaurant_cukcuk_bbq.jpg', cat: 'Bill tính tiền nhà hàng nướng BBQ' },
    { file: '17_mcocr_vietcombank_pos_slip.jpg', cat: 'Biên lai thanh toán thẻ POS VCB' }
  ];

  console.log('========================================================================================');
  console.log('     BENCHMARK HYBRID PIPELINE: LOCAL NEURAL OCR + DEEPSEEK TEXT-ONLY PARSER');
  console.log('========================================================================================\n');

  const results: HybridResult[] = [];

  for (let i = 0; i < testSuite.length; i++) {
    const item = testSuite[i];
    const fullPath = path.join(baseDir, item.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[Bỏ qua] Không tìm thấy: ${item.file}`);
      continue;
    }

    console.log(`[TEST ${i + 1}/10] ${item.file} (${item.cat})`);
    const res = await runHybridPipeline(fullPath, i + 1);
    res.category = item.cat;

    const amtStr = res.totalAmount ? `${res.totalAmount.toLocaleString('vi-VN')} đ` : 'N/A';
    console.log(`   ⚡ Thời gian: Tổng ${res.totalTimeMs}ms (Local: ${res.timeLocalOcrMs}ms | DeepSeek: ${res.timeDeepSeekTextMs}ms)`);
    console.log(`   🔍 Chất lượng: Mờ: ${res.isImageBlurry} (Dòng mờ: ${res.lowConfidenceCount}) | MST: ${res.supplierTaxCode || 'N/A'}`);
    console.log(`   💰 Dữ liệu: Tiền: ${amtStr} | Mặt hàng: ${res.itemCount} món | HĐ: ${res.invoiceNumber || 'N/A'}`);
    console.log('----------------------------------------------------------------------------------------');

    results.push(res);
  }

  // Tổng hợp thống kê
  const totalTimes = results.map(r => r.totalTimeMs);
  const localTimes = results.map(r => r.timeLocalOcrMs);
  const dsTimes = results.map(r => r.timeDeepSeekTextMs);

  const avgTotal = Math.round(totalTimes.reduce((a, b) => a + b, 0) / results.length);
  const avgLocal = Math.round(localTimes.reduce((a, b) => a + b, 0) / results.length);
  const avgDs = Math.round(dsTimes.reduce((a, b) => a + b, 0) / results.length);
  const detectedBlurCount = results.filter(r => r.isImageBlurry || r.lowConfidenceCount > 0).length;
  const validAmountCount = results.filter(r => r.totalAmount && r.totalAmount > 0).length;

  console.log('\n========================================================================================');
  console.log('                         TỔNG HỢP HIỆU NĂNG HYBRID PIPELINE');
  console.log('========================================================================================');
  console.log(`Tổng số hóa đơn: ${results.length}`);
  console.log(`Thời gian trung bình: ${avgTotal}ms (Local OCR: ${avgLocal}ms + DeepSeek Text: ${avgDs}ms)`);
  console.log(`Tỷ lệ phát hiện chữ mờ / nhòe nét: ${detectedBlurCount}/${results.length} (Đo bằng quang học vật lý)`);
  console.log(`Tỷ lệ bóc tách Tổng tiền thành công: ${validAmountCount}/${results.length} (${(validAmountCount / results.length * 100).toFixed(0)}%)`);
  console.log('========================================================================================\n');

  fs.writeFileSync(
    path.join(process.cwd(), 'benchmark_hybrid_results.json'),
    JSON.stringify({ summary: { avgTotal, avgLocal, avgDs, detectedBlurCount, validAmountCount }, details: results }, null, 2)
  );
  console.log('Đã lưu kết quả chi tiết vào benchmark_hybrid_results.json');
}

main().catch(console.error);
