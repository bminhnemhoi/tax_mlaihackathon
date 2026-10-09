import './setup-env';
import { parseTctExport } from '../lib/reconciliation/tctParser';
import { reconcileTctWithSystem } from '../lib/reconciliation/reconciliationEngine';
import { parseBankStatement } from '../lib/banking/bankStatementParser';
import {
  calculateMatchScore,
  matchInvoicesWithBankTransactions,
  checkSameDayMultipleInvoicesRule
} from '../services/bankMatcherService';
import { evaluateInvoiceLocally } from '../services/policyEngine';
import { InvoiceInput, SystemPolicyConfig } from '../lib/schemas';
import { DEFAULT_POLICY_CONFIG } from '../lib/constants';

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
console.log('KIỂM THỬ GIAI ĐOẠN 1 - SPRINT 2 (MODULE 3 + MODULE 4)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// PHẦN 1: MODULE 3 — BÓC TÁCH BẢNG KÊ CỔNG THUẾ TCT (tctParser)
// -----------------------------------------------------------------------------
console.log('--- 1. Bóc tách Bảng kê Cổng Thuế TCT ---');

const sampleTctJson = JSON.stringify([
  {
    khhdon: '1C26TBB',
    shdon: '0000001',
    tdlap: '2026-02-10',
    nbmst: '0101243150',
    nbten: 'Công ty Cổ phần MISA',
    tgtcthue: 10000000,
    tsuat: '10%',
    tgtthue: 1000000,
    tgtttbso: 11000000,
    mccqt: '0034A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5',
    tthdon: 'Hóa đơn mới'
  },
  {
    khhdon: '1C26TBB',
    shdon: '0000002',
    tdlap: '2026-02-12',
    nbmst: '0100109106',
    nbten: 'Tập đoàn Công nghiệp - Viễn thông Quân đội',
    tgtcthue: 5000000,
    tsuat: '8%',
    tgtthue: 400000,
    tgtttbso: 5400000,
    tthdon: 'Hóa đơn bị hủy'
  }
]);

const parsedJson = parseTctExport(sampleTctJson, '2026-Q1');
assert(parsedJson.length === 2, 'Bóc tách thành công 2 hóa đơn từ JSON Cổng Thuế');
assert(parsedJson[0].invoiceNumber === '0000001', 'Chuẩn hóa số hóa đơn 7 chữ số đúng');
assert(parsedJson[0].taxRate === 10, 'Nhận diện thuế suất 10% chuẩn');
assert(parsedJson[1].tctStatus === 'CANCELLED', 'Nhận diện chính xác trạng thái hóa đơn bị hủy');

const sampleTctCsv = `Ký hiệu,Số hóa đơn,Ngày lập,MST người bán,Tên người bán,Tiền chưa thuế,Thuế suất,Tiền thuế,Tổng tiền,Trạng thái
1C26TBB,0000003,2026-02-15,0100684378,Tập đoàn VNPT,2000000,10,200000,2200000,Hóa đơn mới
1C26TBB,0000004,2026-02-18,0101248141,Công ty Cổ phần Viễn thông FPT,3000000,8,240000,3240000,Hóa đơn điều chỉnh`;

const parsedCsv = parseTctExport(sampleTctCsv, '2026-Q1');
assert(parsedCsv.length === 2, 'Bóc tách thành công 2 hóa đơn từ CSV Cổng Thuế');
assert(parsedCsv[0].supplierTaxCode === '0100684378', 'Trích xuất đúng MST người bán từ CSV');
assert(parsedCsv[1].tctStatus === 'ADJUSTED', 'Nhận diện đúng trạng thái hóa đơn điều chỉnh');

// -----------------------------------------------------------------------------
// PHẦN 2: MODULE 3 — ĐỐI CHIẾU 3 CHIỀU (reconciliationEngine)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Thuật toán Đối chiếu 3 chiều (Three-Way Reconciliation) ---');

// Chuẩn bị tập dữ liệu kiểm thử 4 nhóm:
// 1. Matched: HĐ 0000001 MISA (khớp 100%)
// 2. Discrepancy: HĐ 0000002 Viettel (bị hủy trên TCT nhưng hệ thống ghi nhận)
// 3. Missing in Vault: HĐ 0000003 VNPT (có trên TCT nhưng hệ thống chưa có)
// 4. Unreported by seller: HĐ 0000999 (hệ thống có nhưng TCT không có)

const testTctInvoices = [
  ...parsedJson, // HĐ 0000001 (khớp) và HĐ 0000002 (hủy)
  parsedCsv[0]   // HĐ 0000003 VNPT (có trên TCT nhưng thiếu trong kho)
];

const testSystemInvoices: InvoiceInput[] = [
  {
    id: 'SYS-INV-001',
    invoiceNumber: '0000001',
    invoiceDate: '2026-02-10',
    supplierTaxCode: '0101243150',
    supplierName: 'Công ty Cổ phần MISA',
    invoiceSeries: '1C26TBB',
    itemName: 'Phần mềm kế toán',
    preTaxAmount: 10000000,
    taxRate: 10,
    taxAmount: 1000000,
    totalAmount: 11000000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE'
  },
  {
    id: 'SYS-INV-002',
    invoiceNumber: '0000002',
    invoiceDate: '2026-02-12',
    supplierTaxCode: '0100109106',
    supplierName: 'Tập đoàn Công nghiệp - Viễn thông Quân đội',
    invoiceSeries: '1C26TBB',
    itemName: 'Cước dịch vụ di động',
    preTaxAmount: 5000000,
    taxRate: 8,
    taxAmount: 400000,
    totalAmount: 5400000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE'
  },
  {
    id: 'SYS-INV-004-FAKE',
    invoiceNumber: '0000999', // Không có trên TCT!
    invoiceDate: '2026-02-20',
    supplierTaxCode: '0309129418',
    supplierName: 'Nhà cung cấp chưa truyền TCT',
    itemName: 'Văn phòng phẩm tổng hợp',
    preTaxAmount: 8000000,
    taxRate: 10,
    taxAmount: 800000,
    totalAmount: 8800000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE'
  }
];

const reconReport = reconcileTctWithSystem(testTctInvoices, testSystemInvoices);

assert(reconReport.matchedCount === 1, 'Phát hiện chính xác 1 ca MATCHED (HĐ 0000001 MISA)');
assert(reconReport.missingInVaultCount === 1, 'Phát hiện chính xác 1 ca MISSING_IN_VAULT (HĐ 0000003 VNPT)');
assert(reconReport.discrepancyCount === 1, 'Phát hiện chính xác 1 ca DATA_DISCREPANCY (HĐ 0000002 bị hủy trên TCT)');
assert(reconReport.unreportedBySellerCount === 1, 'Phát hiện chính xác 1 ca UNREPORTED_BY_SELLER (HĐ 0000999 không có trên TCT)');

const unrepItem = reconReport.items.find(i => i.status === 'UNREPORTED_BY_SELLER');
assert(
  unrepItem !== undefined && unrepItem.recommendedAction.includes('BÁO ĐỘNG ĐỎ'),
  'Khuyến nghị xử lý báo động đỏ cho hóa đơn chưa truyền hoặc bị hủy'
);

// -----------------------------------------------------------------------------
// PHẦN 3: MODULE 4 — BÓC TÁCH SAO KÊ NGÂN HÀNG (bankStatementParser)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Bóc tách Sao kê Ngân hàng ---');

const sampleBankCsv = `Ngày,Số bút toán,Số tiền chi,Người nhận,Nội dung
2026-02-11,FT2604291823,11000000,CONG TY CP MISA,Thanh toan tien phan mem MISA theo HD 0000001 MST 0101243150
2026-02-16,FT2604771234,2200000,VNPT HANOI,Thanh toan cuoc vien thong ky 01 HD 0000003
2026-02-25,FT2605667788,1500000,CONG TY TNHH ABC,Tam ung chi phi van phong`;

const bankTransactions = parseBankStatement(sampleBankCsv, 'VCB');
assert(bankTransactions.length === 3, 'Bóc tách thành công 3 giao dịch sao kê Vietcombank');
assert(bankTransactions[0].debitAmount === 11000000, 'Số tiền ghi nợ chuẩn xác');
assert(bankTransactions[0].beneficiaryTaxCode === '0101243150', 'Trích xuất tự động MST người nhận từ nội dung');

// -----------------------------------------------------------------------------
// PHẦN 4: MODULE 4 — SCORE-BASED AUTO MATCHER (bankMatcherService)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Khớp Tự Động Hóa Đơn — Ủy Nhiệm Chi (Auto Matcher) ---');

// Test 4.1: Tính điểm so khớp chính xác
const score1 = calculateMatchScore(testSystemInvoices[0], bankTransactions[0]);
assert(score1.score === 100, `Hóa đơn MISA khớp hoàn hảo 100 điểm với UNC ngân hàng (Điểm thực tế: ${score1.score})`);

// Test 4.2: Tự động ghép nối toàn bộ danh sách
const matchResult = matchInvoicesWithBankTransactions(testSystemInvoices, bankTransactions);
assert(matchResult.matchedPairs.length >= 1, 'Ghép nối tự động thành công ít nhất 1 cặp HĐ - UNC');
assert(matchResult.matchedPairs[0].invoiceId === 'SYS-INV-001', 'Hóa đơn MISA được auto-match đúng');
assert(matchResult.matchedPairs[0].isAutoMatched === true, 'Đánh dấu isAutoMatched = true');

// -----------------------------------------------------------------------------
// PHẦN 5: MODULE 4 — QUY TẮC GỘP NHIỀU HĐ TRONG NGÀY >= 5M (LUẬT 48/2024)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Quy tắc Gộp nhiều HĐ trong ngày >= 5.000.000 VNĐ ---');

const baseConfig: SystemPolicyConfig = {
  ...DEFAULT_POLICY_CONFIG,
  nonCashThreshold: 5_000_000
};

// Hóa đơn A: 2.500.000đ tiền mặt (nếu đứng một mình là hợp lệ vì < 5M)
const invA: InvoiceInput = {
  id: 'SAMEDAY-INV-A',
  invoiceNumber: '0000101',
  invoiceDate: '2026-03-20',
  supplierTaxCode: '0309129418',
  supplierName: 'Hệ Thống Tiện Lợi Circle K',
  itemName: 'Bánh kẹo & nước ngọt',
  preTaxAmount: 2272727,
  taxRate: 10,
  taxAmount: 227273,
  totalAmount: 2500000,
  paymentMethod: 'CASH', // Tiền mặt
  hasBankSlip: false,
  hasItemManifest: true,
  sellerStatus: 'ACTIVE'
};

// Hóa đơn B: 3.000.000đ tiền mặt cùng ngày, cùng nhà cung cấp (Tổng = 5.500.000đ >= 5M)
const invB: InvoiceInput = {
  id: 'SAMEDAY-INV-B',
  invoiceNumber: '0000102',
  invoiceDate: '2026-03-20', // Cùng ngày
  supplierTaxCode: '0309129418', // Cùng nhà cung cấp
  supplierName: 'Hệ Thống Tiện Lợi Circle K',
  itemName: 'Cà phê & đồ uống giải khát',
  preTaxAmount: 2727273,
  taxRate: 10,
  taxAmount: 272727,
  totalAmount: 3000000,
  paymentMethod: 'CASH', // Tiền mặt
  hasBankSlip: false,
  hasItemManifest: true,
  sellerStatus: 'ACTIVE'
};

// Kiểm tra hàm checkSameDayMultipleInvoicesRule độc lập
const sameDayResult = checkSameDayMultipleInvoicesRule(invA, [invA, invB], 5000000);
assert(sameDayResult.isViolation === true, 'Hàm quy tắc phát hiện vi phạm gộp trong ngày >= 5M');
assert(sameDayResult.dailyTotal === 5500000, 'Tính đúng tổng giá trị mua hàng trong ngày = 5.500.000₫');

// Kiểm tra tích hợp vào Policy Engine:
// Khi thẩm định độc lập invA (không có context): invA < 5M tiền mặt -> ROUTINE
const resSoloA = evaluateInvoiceLocally(invA, baseConfig);
assert(resSoloA.status === 'ROUTINE', 'Hóa đơn 2.5M tiền mặt đứng một mình được duyệt ROUTINE');

// Khi thẩm định invA trong bối cảnh có invB cùng ngày (tổng >= 5M tiền mặt) -> OUT_OF_POLICY!
const resGroupA = evaluateInvoiceLocally(invA, baseConfig, 'TAX-SOP-2026 v2.5', undefined, [invA, invB]);
assert(
  resGroupA.status === 'ESCALATED' &&
  resGroupA.riskGroup === 'OUT_OF_POLICY' &&
  resGroupA.flaggedReason?.includes('thanh toán TIỀN MẶT') &&
  resGroupA.plainExplanation?.includes('Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15'),
  'Hóa đơn A bị chuyển sang OUT_OF_POLICY khi tổng mua hàng trong ngày cùng NCC vượt 5 triệu đồng',
  resGroupA.flaggedReason
);

// Nếu invA và invB thanh toán chuyển khoản và có UNC ngân hàng -> ROUTINE
const invABank: InvoiceInput = {
  ...invA,
  paymentMethod: 'BANK_TRANSFER',
  hasBankSlip: true
};
const invBBank: InvoiceInput = {
  ...invB,
  paymentMethod: 'BANK_TRANSFER',
  hasBankSlip: true
};
const resGroupBank = evaluateInvoiceLocally(invABank, baseConfig, 'TAX-SOP-2026 v2.5', undefined, [invABank, invBBank]);
assert(resGroupBank.status === 'ROUTINE', 'Cụm hóa đơn trong ngày >= 5M thanh toán chuyển khoản ngân hàng được duyệt ROUTINE');

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`KẾT QUẢ: ${passed} PASS, ${failed} FAIL`);
if (failed === 0) {
  console.log('TẤT CẢ CÁC BÀI KIỂM THỬ GIAI ĐOẠN 1 SPRINT 2 ĐÃ VƯỢT QUA 100%!');
} else {
  console.error('CÓ BÀI KIỂM THỬ THẤT BẠI!');
  process.exit(1);
}
console.log('================================================================');
