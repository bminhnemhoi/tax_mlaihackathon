import '../ops/setup-env';
import fs from 'fs';
import path from 'path';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import {
  listSuppliers,
  getSupplier,
  upsertSupplier,
  recordVerificationEvidence,
  seedDefaultSuppliers
} from '../../services/supplierService';
import {
  getLegalCitation,
  listLegalCitations,
  GOVERNMENT_REGULATORY_REGISTRY
} from '../../data/regulatoryRegistry';
import { InvoiceInput, SystemPolicyConfig } from '../../lib/schemas';
import { DEFAULT_POLICY_CONFIG } from '../../lib/constants';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
    failed++;
  }
}

console.log('================================================================');
console.log('KIỂM THỬ GIAI ĐOẠN 1 - SPRINT 1 (MODULE 1 + MODULE 2 + MODULE 7)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// PHẦN 1: MODULE 1 — THẨM ĐỊNH HỢP THỨC HÓA ĐƠN ĐIỆN TỬ
// -----------------------------------------------------------------------------
console.log('--- 1. Kiểm tra MST Người mua (buyerTaxCode) ---');

const baseConfig: SystemPolicyConfig = {
  ...DEFAULT_POLICY_CONFIG,
  companyTaxCode: '0100109106',
  companyName: 'CONG TY CO PHAN CONG NGHE FPRINCIPLES'
};

const baseInvoice: InvoiceInput = {
  id: 'TEST-M1-01',
  invoiceNumber: '0000001',
  invoiceDate: '2026-03-15',
  supplierTaxCode: '0101243150',
  supplierName: 'Công ty Cổ phần MISA',
  buyerTaxCode: '0100109106', // Khớp MST công ty
  buyerName: 'CONG TY CO PHAN CONG NGHE FPRINCIPLES',
  invoiceSeries: '1C26TBB',
  invoiceTemplate: '1/001',
  taxAuthorityCode: '0034A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5', // Đúng 34 ký tự
  signingDate: '2026-03-15',
  itemName: 'Phần mềm kế toán MISA SME',
  preTaxAmount: 4_000_000,
  taxRate: 10,
  taxAmount: 400_000,
  totalAmount: 4_400_000,
  paymentMethod: 'BANK_TRANSFER',
  hasBankSlip: true,
  hasItemManifest: true,
  sellerStatus: 'ACTIVE'
};

// Test 1.1: Khớp MST người mua -> ROUTINE
const resMatchingBuyer = evaluateInvoiceLocally(baseInvoice, baseConfig);
assert(resMatchingBuyer.status === 'ROUTINE', 'Hóa đơn có đúng MST người mua được duyệt ROUTINE');

// Test 1.2: Sai lệch MST người mua -> OUT_OF_POLICY
const invWrongBuyer: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-WRONG-BUYER',
  buyerTaxCode: '0312345678' // MST công ty khác hoặc cá nhân
};
const resWrongBuyer = evaluateInvoiceLocally(invWrongBuyer, baseConfig);
assert(
  resWrongBuyer.status === 'ESCALATED' &&
  resWrongBuyer.riskGroup === 'OUT_OF_POLICY' &&
  Boolean(resWrongBuyer.findings?.some(f => f.ruleId === 'RULE_BUYER_TAX_CODE_MISMATCH')),
  'Phát hiện hóa đơn sai MST người mua (không thuộc doanh nghiệp) và chặn OUT_OF_POLICY',
  resWrongBuyer.flaggedReason
);

console.log('\n--- 2. Kiểm tra Ký hiệu hóa đơn & MCCQT 34 ký tự ---');

// Test 2.1: HĐ ký hiệu 'C' (có mã CQT) nhưng thiếu chuỗi MCCQT -> UNCERTAIN_INFO
const invMissingMccqt: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-MISSING-MCCQT',
  taxAuthorityCode: undefined // Thiếu mã CQT
};
const resMissingMccqt = evaluateInvoiceLocally(invMissingMccqt, baseConfig);
assert(
  resMissingMccqt.status === 'ESCALATED' &&
  resMissingMccqt.riskGroup === 'UNCERTAIN_INFO' &&
  resMissingMccqt.flaggedReason?.includes('chuỗi MCCQT 34 ký tự'),
  'Hóa đơn có mã CQT (ký hiệu C) thiếu MCCQT bị chặn UNCERTAIN_INFO',
  resMissingMccqt.flaggedReason
);

// Test 2.2: HĐ ký hiệu 'C' có MCCQT nhưng sai độ dài (không đủ 34 ký tự) -> UNCERTAIN_INFO
const invInvalidMccqtLength: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-INVALID-MCCQT',
  taxAuthorityCode: 'SHORT123' // Chỉ 8 ký tự
};
const resInvalidMccqt = evaluateInvoiceLocally(invInvalidMccqtLength, baseConfig);
assert(
  resInvalidMccqt.status === 'ESCALATED' &&
  resInvalidMccqt.riskGroup === 'UNCERTAIN_INFO' &&
  resInvalidMccqt.flaggedReason?.includes('chuỗi MCCQT 34 ký tự'),
  'Hóa đơn có mã CQT có MCCQT sai độ dài 34 ký tự bị chặn UNCERTAIN_INFO',
  resInvalidMccqt.flaggedReason
);

// Test 2.3: HĐ ký hiệu 'K' (không có mã CQT) không bắt buộc MCCQT -> ROUTINE
const invSeriesK: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-SERIES-K',
  invoiceSeries: '2K26TBB',
  taxAuthorityCode: undefined
};
const resSeriesK = evaluateInvoiceLocally(invSeriesK, baseConfig);
assert(resSeriesK.status === 'ROUTINE', 'Hóa đơn không có mã CQT (ký hiệu K) không bắt buộc MCCQT');

console.log('\n--- 3. Kiểm tra Dải năm ký hiệu so với Ngày lập hóa đơn ---');

// Test 3.1: Ký hiệu năm 2024 ('1C24TBB') nhưng ngày lập năm 2026 -> UNCERTAIN_INFO
const invMismatchedYear: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-YEAR-MISMATCH',
  invoiceSeries: '1C24TBB', // Dải năm 24
  invoiceDate: '2026-03-15'  // Lập năm 26
};
const resMismatchedYear = evaluateInvoiceLocally(invMismatchedYear, baseConfig);
assert(
  resMismatchedYear.status === 'ESCALATED' &&
  resMismatchedYear.riskGroup === 'UNCERTAIN_INFO' &&
  resMismatchedYear.flaggedReason?.includes('không khớp với năm lập hóa đơn'),
  'Phát hiện hóa đơn lệch dải năm giữa ký hiệu và ngày lập thực tế',
  resMismatchedYear.flaggedReason
);

console.log('\n--- 4. Kiểm tra Ngày ký số (signingDate) so với Ngày lập ---');

// Test 4.1: Ngày ký số sau ngày lập 45 ngày (> 30 ngày) -> UNCERTAIN_INFO
const invDelayedSigning: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M1-DELAYED-SIGNING',
  invoiceDate: '2026-01-10',
  signingDate: '2026-03-01' // Lệch 50 ngày
};
const resDelayedSigning = evaluateInvoiceLocally(invDelayedSigning, baseConfig);
assert(
  resDelayedSigning.status === 'ESCALATED' &&
  resDelayedSigning.riskGroup === 'UNCERTAIN_INFO' &&
  resDelayedSigning.flaggedReason?.includes('Chữ ký số bên bán được ký vào ngày'),
  'Cảnh báo ngày ký số lệch quá 30 ngày so với ngày lập',
  resDelayedSigning.flaggedReason
);

// -----------------------------------------------------------------------------
// PHẦN 2: MODULE 2 — DANH BẠ NHÀ CUNG CẤP & BẰNG CHỨNG TRA CỨU CỔNG TCT
// -----------------------------------------------------------------------------
console.log('\n--- 5. Quản lý Danh bạ Nhà cung cấp (supplier_master) ---');

// Seed default suppliers
seedDefaultSuppliers();
const suppliers = listSuppliers();
assert(suppliers.length >= 6, `Khởi tạo danh bạ nhà cung cấp mặc định thành công (hiện có ${suppliers.length} NCC)`);

const viettel = getSupplier('0100109106');
assert(viettel !== null && viettel.tradeName === 'VIETTEL', 'Tra cứu nhà cung cấp Viettel theo MST');

// Test 5.1: Upsert nhà cung cấp rủi ro cao
const highRiskSupplier = upsertSupplier({
  taxCode: '0109999999',
  legalName: 'Công ty TNHH Ma Thuật Hóa Đơn Khống',
  status: 'ACTIVE',
  riskLevel: 'HIGH_RISK_INVOICE',
  verificationSource: 'TCT_PORTAL',
  notes: 'Thuộc diện nghi vấn gian lận hóa đơn theo CV 2392/TCT-QLRR'
});
assert(highRiskSupplier.riskLevel === 'HIGH_RISK_INVOICE', 'Thêm mới nhà cung cấp diện rủi ro cao thành công');

// Test 5.2: Hóa đơn từ nhà cung cấp rủi ro cao -> OUT_OF_POLICY
const invFromHighRisk: InvoiceInput = {
  ...baseInvoice,
  id: 'TEST-M2-HIGH-RISK-SUPPLIER',
  supplierTaxCode: '0109999999',
  supplierName: 'Công ty TNHH Ma Thuật Hóa Đơn Khống'
};
const resHighRisk = evaluateInvoiceLocally(invFromHighRisk, baseConfig);
assert(
  resHighRisk.status === 'ESCALATED' &&
  resHighRisk.riskGroup === 'OUT_OF_POLICY' &&
  Boolean(resHighRisk.findings?.some(f => f.ruleId === 'RULE_HIGH_RISK_SUPPLIER')),
  'Hệ thống tự động phát hiện hóa đơn từ nhà cung cấp cảnh báo rủi ro cao trong danh bạ',
  resHighRisk.flaggedReason
);

// Test 5.3: Lưu snapshot bằng chứng tra cứu Cổng TCT
const evidenceRes = recordVerificationEvidence('0109999999', {
  source: 'TCT_PORTAL',
  rawPayload: {
    mst: '0109999999',
    ten_nnt: 'Công ty TNHH Ma Thuật Hóa Đơn Khống',
    trang_thai: 'Đang hoạt động nhưng có dấu hiệu rủi ro cao',
    ma_cqt_quan_ly: '101'
  },
  notes: 'Đã tra cứu Cổng Tổng cục Thuế lúc 09:00 ngày 15/03/2026',
  newRiskLevel: 'HIGH_RISK_INVOICE'
});
assert(
  fs.existsSync(path.join(process.cwd(), evidenceRes.snapshotPath)),
  'Tạo file snapshot bằng chứng tra cứu Cổng TCT thành công: ' + evidenceRes.snapshotPath
);

// -----------------------------------------------------------------------------
// PHẦN 3: MODULE 7 — CHUẨN HÓA CĂN CỨ PHÁP LÝ & URL NGUỒN CHÍNH THỨC
// -----------------------------------------------------------------------------
console.log('\n--- 6. Chuẩn hóa Căn cứ Pháp lý (LegalCitation Registry) ---');

const citations = listLegalCitations();
assert(citations.length >= 8, `Danh mục trích dẫn pháp lý chuẩn mực đủ ${citations.length} căn cứ`);

// Kiểm tra trích dẫn Luật 48/2024 điểm b khoản 2 Điều 14 (luật chỉ nêu nguyên tắc; ngưỡng 5 triệu ở Điều 26 NĐ 181/2025)
const citLaw48 = getLegalCitation('LUAT-48-2024-D14-K2');
assert(
  citLaw48 !== undefined &&
  citLaw48.officialSourceUrl.endsWith('docid=212476') &&
  citLaw48.exactQuote.includes('chứng từ thanh toán không dùng tiền mặt') &&
  !citLaw48.exactQuote.includes('05 triệu'),
  'Trích dẫn Luật 48/2024/QH15 điểm b khoản 2 Điều 14 đúng văn bản (docid 212476) và đúng nguyên văn'
);
const citNd181 = getLegalCitation('ND-181-2025-D26-K3');
assert(
  citNd181 !== undefined && citNd181.officialSourceUrl.endsWith('docid=214336') && citNd181.exactQuote.includes('dưới 05 triệu đồng'),
  'Trích dẫn khoản 3 Điều 26 Nghị định 181/2025/NĐ-CP (mua nhiều lần trong ngày) đúng văn bản và nguyên văn'
);

// Kiểm tra trích dẫn Nghị định 123/2020 điểm a khoản 2 Điều 3 (hóa đơn có mã của cơ quan thuế; Điều 14 là dịch vụ hóa đơn)
const citNd123 = getLegalCitation('ND-123-2020-D3-K2');
assert(
  citNd123 !== undefined &&
  citNd123.officialSourceUrl.endsWith('docid=201365') &&
  citNd123.exactQuote.includes('Hóa đơn điện tử có mã của cơ quan thuế'),
  'Trích dẫn Nghị định 123/2020/NĐ-CP điểm a khoản 2 Điều 3 về mã của cơ quan thuế đúng văn bản'
);

// Kiểm tra trích dẫn Thông tư 78/2021 Điều 4 (Ký hiệu HĐ)
const citTt78 = getLegalCitation('TT-78-2021-D4-K1');
assert(
  citTt78 !== undefined &&
  citTt78.exactQuote.includes('Ký hiệu hóa đơn điện tử là nhóm 6 ký tự'),
  'Trích dẫn Thông tư 78/2021/TT-BTC Điều 4 về ký hiệu 6 ký tự chính xác'
);

// Kiểm tra xem Nghị định 123 và Thông tư 78 có trong danh mục tổng hợp
const hasNd123 = GOVERNMENT_REGULATORY_REGISTRY.some(d => d.id === 'ND-123-2020');
const hasTt78 = GOVERNMENT_REGULATORY_REGISTRY.some(d => d.id === 'TT-78-2021');
assert(hasNd123 && hasTt78, 'Nghị định 123/2020 và Thông tư 78/2021 có mặt trong GOVERNMENT_REGULATORY_REGISTRY');

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`KẾT QUẢ: ${passed} PASS, ${failed} FAIL`);
if (failed === 0) {
  console.log('TẤT CẢ CÁC BÀI KIỂM THỬ GIAI ĐOẠN 1 SPRINT 1 ĐÃ VƯỢT QUA 100%!');
} else {
  console.error('CÓ BÀI KIỂM THỬ THẤT BẠI!');
  process.exit(1);
}
console.log('================================================================');
