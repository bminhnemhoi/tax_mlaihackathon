import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractInvoiceFromOcrTextWithDeepSeek } from '../services/deepseekService';
import { parseInvoiceFromRawText } from '../lib/rawTextParser';
import { autoEnrichSupplierData } from '../services/taxLookupService';

interface BenchmarkSuite2Item {
  id: number;
  fileName: string;
  category: string;
  groundTruth: {
    vendor: string;
    amountVnd: number;
    docType: string;
  };
  extracted: {
    vendor?: string;
    amountVnd?: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    taxCode?: string;
    itemCount: number;
  };
  metrics: {
    timeLocalMs: number;
    timeDeepSeekMs: number;
    totalTimeMs: number;
    isImageBlurry: boolean;
    lowConfidenceCount: number;
    detectedBlurryLines: string[];
    amountMatch: boolean;
    vendorMatch: boolean;
  };
}

async function runHybrid(imagePath: string, testIndex: number): Promise<any> {
  const tStart = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'apple_vision_ocr.py');

  // 1. Local OCR (Apple Vision Accurate Mode)
  const t0 = Date.now();
  const rawOutput = execSync(`python3 "${scriptPath}" "${imagePath}" accurate`, {
    encoding: 'utf-8',
    timeout: 20000
  });
  const ocrData = JSON.parse(rawOutput);
  const timeLocalMs = Date.now() - t0;

  // Trích xuất sơ bộ regex
  const parsedRegex = parseInvoiceFromRawText(ocrData.fullText || '');

  // 2. Tra cứu danh bạ thuế
  const enriched = await autoEnrichSupplierData({
    supplierTaxCode: parsedRegex.invoice.supplierTaxCode,
    supplierName: parsedRegex.invoice.supplierName,
    rawText: ocrData.fullText
  });

  // 3. DeepSeek Text-only parsing
  const t1 = Date.now();
  let dsResult: any = {};
  try {
    dsResult = await extractInvoiceFromOcrTextWithDeepSeek(
      ocrData.fullText || '',
      `suite2-${testIndex}-${Date.now()}`
    );
  } catch (err: any) {
    console.warn(`[Suite 2 - Test ${testIndex}] Lỗi DeepSeek:`, err?.message);
  }
  const timeDeepSeekMs = Date.now() - t1;
  const totalTimeMs = Date.now() - tStart;

  const blurryLines = (ocrData.lowConfidenceLines || []).map((l: any) => l.text);

  return {
    timeLocalMs,
    timeDeepSeekMs,
    totalTimeMs,
    isImageBlurry: Boolean(ocrData.isImageBlurry),
    lowConfidenceCount: ocrData.lowConfidenceLines?.length || 0,
    detectedBlurryLines: blurryLines.slice(0, 3),
    vendor: enriched.supplierName || dsResult.supplierName || parsedRegex.invoice.supplierName,
    taxCode: enriched.supplierTaxCode || dsResult.supplierTaxCode || parsedRegex.invoice.supplierTaxCode,
    invoiceNumber: dsResult.invoiceNumber || parsedRegex.invoice.invoiceNumber,
    invoiceDate: dsResult.invoiceDate || parsedRegex.invoice.invoiceDate,
    amountVnd: dsResult.totalAmount ?? parsedRegex.invoice.totalAmount,
    itemCount: Array.isArray(dsResult.items) ? dsResult.items.length : 0
  };
}

async function main() {
  const baseDir = '/Users/xuannguyen/Desktop/Competitions/2026/MLAI - Track 2/billmate (END)/sample_inputs';
  const manifestPath = path.join(baseDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // 10 hóa đơn mới hoàn toàn
  const testFiles = [
    { file: '05_flight_vietnam_airlines_eticket.png', cat: 'Vé máy bay điện tử Vietnam Airlines' },
    { file: '06_flight_vietjet_air_boarding_pass.png', cat: 'Thẻ lên máy bay Vietjet Air' },
    { file: '07_grab_car_airport_trip.png', cat: 'Biên nhận chuyến đi GrabCar' },
    { file: '08_grab_food_team_overtime.png', cat: 'Biên lai đơn hàng GrabFood' },
    { file: '09_hotel_muong_thanh_grand_folio.png', cat: 'Folio khách sạn Mường Thanh Grand' },
    { file: '10_hotel_boutique_hanoi_lodging.png', cat: 'Hóa đơn khách sạn Hanoi Boutique' },
    { file: '11_mcocr_stationery_campha_bookstore.jpg', cat: 'Bill giấy in nhiệt Nhà sách Cẩm Phả' },
    { file: '13_mcocr_restaurant_uudam_chay.jpg', cat: 'Bill nhà hàng Ưu Đàm Chay' },
    { file: '18_vietqr_bank_transfer_techcombank.png', cat: 'Lệnh chuyển khoản VietQR Techcombank' },
    { file: '20_edge_case_late_night_alcohol_violation.png', cat: 'Hóa đơn quán Bar & Lounge đêm khuya' }
  ];

  console.log('========================================================================================');
  console.log('   BENCHMARK 10 HÓA ĐƠN MỚI: HYBRID PIPELINE vs GROUND TRUTH CHÍNH THỨC');
  console.log('========================================================================================\n');

  const results: BenchmarkSuite2Item[] = [];

  for (let i = 0; i < testFiles.length; i++) {
    const item = testFiles[i];
    const fullPath = path.join(baseDir, item.file);
    const meta = manifest.find((m: any) => m.filename === item.file) || {};

    const gtVendor = meta.vendor || 'Chưa rõ';
    const gtAmount = meta.amount_vnd || 0;
    const gtDocType = meta.document_type || item.cat;

    console.log(`[TEST ${i + 1}/10] ${item.file} (${item.cat})`);
    console.log(`   🎯 Ground Truth: [${gtVendor}] | Chuẩn: ${gtAmount.toLocaleString('vi-VN')} đ`);

    const extracted = await runHybrid(fullPath, i + 1);

    // Đánh giá khớp số tiền và tên đối tác
    const amountMatch = extracted.amountVnd === gtAmount || (gtAmount > 0 && Math.abs(extracted.amountVnd - gtAmount) <= 1000);
    const vendorMatch = extracted.vendor && gtVendor.toLowerCase().includes(extracted.vendor.toLowerCase().slice(0, 5));

    console.log(`   ⚡ Thời gian: Tổng ${extracted.totalTimeMs}ms (Local: ${extracted.timeLocalMs}ms | DeepSeek: ${extracted.timeDeepSeekMs}ms)`);
    console.log(`   🤖 Bóc tách: [${extracted.vendor || 'N/A'}] | Tiền: ${extracted.amountVnd ? extracted.amountVnd.toLocaleString('vi-VN') : 'N/A'} đ | HĐ: ${extracted.invoiceNumber || 'N/A'}`);
    console.log(`   🔍 Chất lượng: Mờ: ${extracted.isImageBlurry} (Dòng mờ: ${extracted.lowConfidenceCount}) | Khớp tiền: ${amountMatch ? '✅ CHÍNH XÁC' : '❌ LỆCH'}`);
    console.log('----------------------------------------------------------------------------------------');

    results.push({
      id: i + 1,
      fileName: item.file,
      category: item.cat,
      groundTruth: {
        vendor: gtVendor,
        amountVnd: gtAmount,
        docType: gtDocType
      },
      extracted: {
        vendor: extracted.vendor,
        amountVnd: extracted.amountVnd,
        invoiceNumber: extracted.invoiceNumber,
        invoiceDate: extracted.invoiceDate,
        taxCode: extracted.taxCode,
        itemCount: extracted.itemCount
      },
      metrics: {
        timeLocalMs: extracted.timeLocalMs,
        timeDeepSeekMs: extracted.timeDeepSeekMs,
        totalTimeMs: extracted.totalTimeMs,
        isImageBlurry: extracted.isImageBlurry,
        lowConfidenceCount: extracted.lowConfidenceCount,
        detectedBlurryLines: extracted.detectedBlurryLines,
        amountMatch: Boolean(amountMatch),
        vendorMatch: Boolean(vendorMatch)
      }
    });
  }

  // Tổng hợp thống kê
  const totalTimes = results.map(r => r.metrics.totalTimeMs);
  const avgTotal = Math.round(totalTimes.reduce((a, b) => a + b, 0) / results.length);
  const amountMatches = results.filter(r => r.metrics.amountMatch).length;
  const blurDetected = results.filter(r => r.metrics.isImageBlurry || r.metrics.lowConfidenceCount > 0).length;

  console.log('\n========================================================================================');
  console.log('                         TỔNG HỢP KẾT QUẢ 10 HÓA ĐƠN MỚI');
  console.log('========================================================================================');
  console.log(`Tổng số mẫu: ${results.length}`);
  console.log(`Thời gian trung bình: ${avgTotal}ms / hóa đơn`);
  console.log(`Độ chính xác Số tiền khớp Ground Truth: ${amountMatches}/${results.length} (${(amountMatches / results.length * 100).toFixed(0)}%)`);
  console.log(`Số ca phát hiện vùng mờ / dòng mờ: ${blurDetected}/${results.length}`);
  console.log('========================================================================================\n');

  fs.writeFileSync(
    path.join(process.cwd(), 'benchmark_hybrid_suite_2_results.json'),
    JSON.stringify({ summary: { avgTotal, amountMatches, blurDetected }, details: results }, null, 2)
  );
  console.log('Đã lưu kết quả chi tiết vào benchmark_hybrid_suite_2_results.json');
}

main().catch(console.error);
