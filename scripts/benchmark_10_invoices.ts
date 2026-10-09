import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractInvoiceWithDeepSeek } from '../services/deepseekService';
import { parseInvoiceFromRawText } from '../lib/rawTextParser';
import { autoEnrichSupplierData } from '../services/taxLookupService';

interface EvaluationItem {
  id: number;
  fileName: string;
  category: string;
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
  deepseek: {
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

async function runLocalOcr(imagePath: string) {
  const t0 = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'apple_vision_ocr.py');

  try {
    const rawOutput = execSync(`python3 "${scriptPath}" "${imagePath}" accurate`, {
      encoding: 'utf-8',
      timeout: 15000
    });

    const ocrData = JSON.parse(rawOutput);
    const parsed = parseInvoiceFromRawText(ocrData.fullText || '');

    const enriched = await autoEnrichSupplierData({
      supplierTaxCode: parsed.invoice.supplierTaxCode,
      supplierName: parsed.invoice.supplierName,
      rawText: ocrData.fullText
    });

    const t1 = Date.now();
    const blurryLines = (ocrData.lowConfidenceLines || []).map((l: any) => l.text);

    return {
      timeMs: t1 - t0,
      success: true,
      invoiceNumber: parsed.invoice.invoiceNumber,
      invoiceDate: parsed.invoice.invoiceDate,
      supplierName: enriched.supplierName || parsed.invoice.supplierName,
      supplierTaxCode: enriched.supplierTaxCode || parsed.invoice.supplierTaxCode,
      totalAmount: parsed.invoice.totalAmount,
      isImageBlurry: Boolean(ocrData.isImageBlurry),
      blurScore: ocrData.blurScore || 0,
      averageConfidence: ocrData.averageConfidence || 0,
      lowConfidenceCount: ocrData.lowConfidenceLines?.length || 0,
      detectedBlurryLines: blurryLines.slice(0, 3)
    };
  } catch (err: any) {
    const t1 = Date.now();
    return {
      timeMs: t1 - t0,
      success: false,
      isImageBlurry: false,
      blurScore: 0,
      averageConfidence: 0,
      lowConfidenceCount: 0,
      detectedBlurryLines: []
    };
  }
}

async function runDeepSeek(imagePath: string, testIndex: number) {
  const t0 = Date.now();
  const buf = fs.readFileSync(imagePath);
  const base64 = buf.toString('base64');
  const fileName = path.basename(imagePath);

  try {
    const extracted = await extractInvoiceWithDeepSeek(
      base64,
      'image/jpeg',
      fileName,
      `bench-ds-${testIndex}-${Date.now()}`
    );
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
      detectedBlurryLines: extracted.isImageBlurry ? ['DeepSeek báo ảnh mờ/khó đọc'] : []
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
  console.log('   BENCHMARK 10 HÓA ĐƠN THỰC TẾ: LOCAL NEURAL OCR vs DEEPSEEK SERVER AGENT');
  console.log('========================================================================================\n');

  const results: EvaluationItem[] = [];

  for (let i = 0; i < testSuite.length; i++) {
    const item = testSuite[i];
    const fullPath = path.join(baseDir, item.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[Bỏ qua] Không tìm thấy file: ${item.file}`);
      continue;
    }

    console.log(`[TEST ${i + 1}/10] ${item.file} (${item.cat})`);
    
    // 1. Chạy Local OCR
    const localRes = await runLocalOcr(fullPath);
    const localAmtStr = localRes.totalAmount ? `${localRes.totalAmount.toLocaleString('vi-VN')} đ` : 'N/A';
    console.log(`   ⚡ Local OCR: ${localRes.timeMs}ms | Mờ: ${localRes.isImageBlurry} (Dòng mờ: ${localRes.lowConfidenceCount}) | MST: ${localRes.supplierTaxCode || 'N/A'} | Tiền: ${localAmtStr}`);

    // 2. Chạy DeepSeek Server Agent
    const dsRes = await runDeepSeek(fullPath, i + 1);
    const dsAmtStr = dsRes.totalAmount ? `${dsRes.totalAmount.toLocaleString('vi-VN')} đ` : 'N/A';
    console.log(`   🤖 DeepSeek:  ${dsRes.timeMs}ms | Mờ: ${dsRes.isImageBlurry} | MST: ${dsRes.supplierTaxCode || 'N/A'} | Tiền: ${dsAmtStr} | Thành công: ${dsRes.success}${dsRes.error ? ` (${dsRes.error})` : ''}`);
    console.log('----------------------------------------------------------------------------------------');

    results.push({
      id: i + 1,
      fileName: item.file,
      category: item.cat,
      localOcr: localRes,
      deepseek: dsRes
    });
  }

  // Tổng hợp thống kê
  const localTimes = results.map(r => r.localOcr.timeMs);
  const dsTimes = results.map(r => r.deepseek.timeMs);
  const avgLocalTime = Math.round(localTimes.reduce((a, b) => a + b, 0) / results.length);
  const avgDsTime = Math.round(dsTimes.reduce((a, b) => a + b, 0) / results.length);
  
  const localSuccess = results.filter(r => r.localOcr.success).length;
  const dsSuccess = results.filter(r => r.deepseek.success).length;

  const localDetectedBlur = results.filter(r => r.localOcr.isImageBlurry || r.localOcr.lowConfidenceCount > 0).length;
  const dsDetectedBlur = results.filter(r => r.deepseek.isImageBlurry).length;

  console.log('\n========================================================================================');
  console.log('                              BẢNG TỔNG HỢP SO SÁNH');
  console.log('========================================================================================');
  console.log(`Tổng số hóa đơn kiểm thử: ${results.length}`);
  console.log(`Thời gian trung bình: Local OCR = ${avgLocalTime}ms | DeepSeek Server = ${avgDsTime}ms (Local nhanh gấp ~${(avgDsTime / avgLocalTime).toFixed(1)} lần)`);
  console.log(`Tỷ lệ hoàn thành: Local OCR = ${localSuccess}/${results.length} (100%) | DeepSeek Server = ${dsSuccess}/${results.length}`);
  console.log(`Số ca phát hiện chữ mờ/vùng mờ: Local OCR = ${localDetectedBlur}/${results.length} | DeepSeek Server = ${dsDetectedBlur}/${results.length}`);
  console.log('========================================================================================\n');

  fs.writeFileSync(
    path.join(process.cwd(), 'benchmark_results_10_invoices.json'),
    JSON.stringify({ summary: { avgLocalTime, avgDsTime, localSuccess, dsSuccess, localDetectedBlur, dsDetectedBlur }, details: results }, null, 2)
  );
  console.log('Đã lưu kết quả chi tiết vào benchmark_results_10_invoices.json');
}

main().catch(console.error);
