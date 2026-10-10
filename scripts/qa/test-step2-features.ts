import { parseInvoiceFromRawText } from '../../lib/rawTextParser';
import { findPrecedentForInvoice, createPrecedent } from '../../services/precedentService';

console.log('================================================================');
console.log('KIỂM THỬ BƯỚC 2: TÍNH NĂNG RAW TEXT PARSING & PRECEDENT FIREWALL');
console.log('================================================================');

// 1. Kiểm thử parse văn bản thô: Ca vi phạm tiền mặt 20.35M
const rawTextSample1 = `
Số HĐ: 0048123
Ngày lập: 2026-03-15
Đơn vị bán: Công ty Cổ phần Vận tải Taxi Mai Linh
MST: 0101234567
Hàng hóa: Cước dịch vụ vận chuyển đưa đón đoàn chuyên gia
Tổng thanh toán: 20.350.000 VNĐ
Thuế suất: 10%
Hình thức thanh toán: Tiền mặt
`;

const res1 = parseInvoiceFromRawText(rawTextSample1);
console.log('\n--- 1. Kiểm tra Bóc tách Raw Text (Mai Linh 20.35M) ---');
console.log('Số HĐ:', res1.invoice.invoiceNumber);
console.log('Ngày lập:', res1.invoice.invoiceDate);
console.log('MST:', res1.invoice.supplierTaxCode);
console.log('Bên bán:', res1.invoice.supplierName);
console.log('Tổng tiền:', res1.invoice.totalAmount);
console.log('Hình thức thanh toán:', res1.invoice.paymentMethod);
console.log('Số trường nhận diện:', res1.extractedFields.length);

if (
  res1.invoice.invoiceNumber === '0048123' &&
  res1.invoice.supplierTaxCode === '0101234567' &&
  res1.invoice.totalAmount === 20350000 &&
  res1.invoice.paymentMethod === 'CASH'
) {
  console.log('[PASS] Bóc tách văn bản thô chính xác 100%');
} else {
  console.error('[FAIL] Bóc tách văn bản thô không khớp');
  process.exit(1);
}

// 2. Kiểm thử Tường lửa Pháp lý (Statutory Firewall) khi tạo tiền lệ
console.log('\n--- 2. Kiểm tra Tường lửa Tiền lệ Pháp lý (Statutory Firewall) ---');
try {
  createPrecedent({
    supplierTaxCode: '0101234567',
    supplierName: 'Công ty Cổ phần Vận tải Taxi Mai Linh',
    riskPattern: 'STATUTORY_LAW_48_CASH_PAYMENT',
    sopClause: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15',
    approvedOption: 'ACCEPT_EXPENSE_ONLY',
    rationale: 'Chi phí tiếp khách thực tế, cho phép khấu trừ',
    approvedBy: 'Trần Văn CFO (CFO)'
  });
  console.error('[FAIL] Hệ thống không được phép cho tạo tiền lệ cho Luật cứng 48!');
  process.exit(1);
} catch (err: any) {
  console.log('[PASS] Tường lửa pháp lý đã chặn thành công việc tạo tiền lệ cho Luật cứng:');
  console.log('  ->', err.message);
}

console.log('\n================================================================');
console.log('KẾT QUẢ: TẤT CẢ CÁC BÀI KIỂM THỬ BƯỚC 2 ĐÃ ĐẠT 100%!');
console.log('================================================================\n');
