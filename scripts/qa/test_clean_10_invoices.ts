import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const baseDir = '/Users/xuannguyen/Desktop/Competitions/2026/MLAI - Track 2/billmate (END)/sample_inputs';

  const testFiles = [
    { file: '01_vat_einvoice_abeco_hardware.jpg', cat: 'Hóa đơn linh kiện Abeco' },
    { file: '02_vat_einvoice_telecom_service.jpg', cat: 'Hóa đơn cước viễn thông' },
    { file: '03_vat_einvoice_office_supplies.jpg', cat: 'Hóa đơn văn phòng phẩm' },
    { file: '04_vat_einvoice_material_procurement.jpg', cat: 'Hóa đơn vật tư xây dựng' },
    { file: '05_flight_vietnam_airlines_eticket.png', cat: 'Vé máy bay Vietnam Airlines' },
    { file: '07_grab_car_airport_trip.png', cat: 'Biên nhận GrabCar' },
    { file: '09_hotel_muong_thanh_grand_folio.png', cat: 'Folio khách sạn Mường Thanh' },
    { file: '14_mcocr_milano_coffee_vietnam.jpg', cat: 'Bill cà phê Milano Coffee' },
    { file: '16_mcocr_supermarket_winmart_retail.jpg', cat: 'Bill siêu thị WinMart' },
    { file: '18_vietqr_bank_transfer_techcombank.png', cat: 'Chuyển khoản VietQR Techcombank' }
  ];

  console.log('========================================================================================');
  console.log('   KIỂM THỬ TRỰC TIẾP API PARSE VỚI 10 HÓA ĐƠN (ĐÃ TINH GỌN CẢNH BÁO)');
  console.log('========================================================================================\n');

  for (let i = 0; i < testFiles.length; i++) {
    const item = testFiles[i];
    const fullPath = path.join(baseDir, item.file);
    if (!fs.existsSync(fullPath)) continue;

    const fileBuf = fs.readFileSync(fullPath);
    const blob = new Blob([fileBuf], { type: item.file.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, item.file);

    const t0 = Date.now();
    try {
      const res = await fetch('http://localhost:3000/api/documents/parse', {
        method: 'POST',
        body: formData
      });

      const timeMs = Date.now() - t0;
      if (!res.ok) {
        console.error(`[TEST ${i + 1}] Lỗi HTTP ${res.status}:`, await res.text());
        continue;
      }

      const json = await res.json();
      const inv = json.invoice || {};
      const amtStr = inv.totalAmount ? `${Number(inv.totalAmount).toLocaleString('vi-VN')} đ` : 'N/A';

      console.log(`[TEST ${i + 1}/10] ${item.file} (${item.cat}) - ${timeMs}ms`);
      console.log(`   🏢 Đối tác: ${inv.supplierName || 'N/A'} | MST: ${inv.supplierTaxCode || 'N/A'} | HĐ: ${inv.invoiceNumber || 'N/A'}`);
      console.log(`   💰 Số tiền: ${amtStr} | Cần duyệt (needsReview): ${json.needsReview ? '⚠️ CÓ' : '✅ KHÔNG'}`);
      console.log(`   📋 Cảnh báo tinh gọn (${json.warnings?.length || 0} mục):`);
      if (json.warnings && json.warnings.length > 0) {
        json.warnings.forEach((w: string) => console.log(`      • ${w}`));
      } else {
        console.log('      (Không có cảnh báo thừa)');
      }
      console.log('----------------------------------------------------------------------------------------');
    } catch (err: any) {
      console.error(`[TEST ${i + 1}] Exception:`, err.message);
    }
  }
}

main().catch(console.error);
