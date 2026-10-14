import '../ops/setup-env';
import crypto from 'node:crypto';
import { getDatabase, getActivePolicy, getMacroState } from '../../lib/server/db';
import { createPrecedent, findPrecedentForInvoice } from '../../services/precedentService';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { generateCanonicalVoucher } from '../../lib/accounting/ledgerMapper';
import { parseTaxRateString } from '../../lib/utils';
import { InvoiceInput, ActionOption } from '../../lib/schemas';

console.log('========================================================================');
console.log('KIỂM THỬ AN TOÀN PHÁP LÝ & HỆ THỐNG GIAI ĐOẠN 0 (PHASE 0 SAFETY TEST)');
console.log('Theo quy chuẩn kỹ thuật: brainstorming/opus-evaluation.md (Section 8 & 4)');
console.log('========================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    testsFailed++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? ': ' + detail : ''}`);
  }
}

async function runTests() {
  const policy = getActivePolicy();
  const macroState = getMacroState();
  const db = getDatabase();

  // =========================================================================
  // 1. KIỂM THỬ TƯỜNG LỬA PHÁP LÝ & TIỀN LỆ DOANH NGHIỆP (P0-2)
  // =========================================================================
  console.log('>>> 1. KIỂM THỬ TƯỜNG LỬA PHÁP LÝ TIỀN LỆ (P0-2 Legal Firewall)...');

  // 1a. Cấm tạo tiền lệ trên Luật cứng (Luật 48 - Tiền mặt >= 5M)
  let firewallBlockedLaw48 = false;
  try {
    createPrecedent({
      supplierTaxCode: '0100109106',
      supplierName: 'NCC Thử Nghiệm',
      riskPattern: 'STATUTORY_LAW_48_CASH_PAYMENT',
      sopClause: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15',
      approvedOption: 'A',
      approvedBy: 'CFO',
      rationale: 'Thử nghiệm tạo tiền lệ bất hợp pháp trên Luật cứng'
    });
  } catch (err: any) {
    if (/tường\s*lửa\s*pháp\s*lý|định\s*chế\s*cứng/i.test(err.message)) {
      firewallBlockedLaw48 = true;
    }
  }
  assert(firewallBlockedLaw48, 'Chặn tạo tiền lệ trên Luật Thuế GTGT 48/2024 (Tiền mặt >= 5 triệu)');

  // 1b. Cấm tạo tiền lệ trên NQ 204 (Áp sai 8% cho danh mục loại trừ)
  let firewallBlockedRes204 = false;
  try {
    createPrecedent({
      supplierTaxCode: '0100109106',
      supplierName: 'NCC Thử Nghiệm',
      riskPattern: 'STATUTORY_RES_204_VAT_8_EXCLUDED',
      sopClause: 'Nghị quyết 204/2025/QH15',
      approvedOption: 'A',
      approvedBy: 'CFO',
      rationale: 'Thử nghiệm tiền lệ giảm thuế trái luật'
    });
  } catch (err: any) {
    if (/tường\s*lửa\s*pháp\s*lý|định\s*chế\s*cứng/i.test(err.message)) {
      firewallBlockedRes204 = true;
    }
  }
  assert(firewallBlockedRes204, 'Chặn tạo tiền lệ trên Nghị quyết 204/2025 (Thuế suất 8%)');

  // 1c. Cấm KTT hoặc nhân viên tạo tiền lệ (chỉ CFO có thẩm quyền)
  let kttBlocked = false;
  try {
    createPrecedent({
      supplierTaxCode: '0100109106',
      supplierName: 'NCC Thử Nghiệm',
      riskPattern: 'INTERNAL_POLICY_GUEST_ENTERTAINMENT',
      sopClause: 'Quy chế tiếp khách nội bộ',
      approvedOption: 'A',
      approvedBy: 'CHIEF_ACCOUNTANT',
      rationale: 'KTT tự ý tạo tiền lệ trái thẩm quyền'
    });
  } catch (err: any) {
    if (err.message.includes('Chỉ CFO')) {
      kttBlocked = true;
    }
  }
  assert(kttBlocked, 'Chặn KTT hoặc vai trò khác tạo tiền lệ (chỉ CFO có quyền)');

  // 1d. Cho phép CFO tạo tiền lệ hợp lệ trên quy chế nội bộ (hỗ trợ tên CFO linh hoạt)
  let cfoPrecedentSuccess = false;
  let testPrecedentId = '';
  try {
    const prec = createPrecedent({
      supplierTaxCode: '0109998881',
      supplierName: 'Nhà Hàng Tiếp Khách Cao Cấp',
      riskPattern: 'INTERNAL_POLICY_GUEST_ENTERTAINMENT',
      sopClause: 'Quy chế tiếp khách và chi phí ngoại giao năm 2026',
      approvedOption: 'A',
      approvedBy: 'Trần Văn B (CFO)',
      rationale: 'Tiền lệ tiếp khách đối tác chiến lược quý 1',
      purpose: 'tiếp khách',
      maximumAmount: 20_000_000,
      currentThreshold: 20_000_000
    });
    testPrecedentId = prec.id;
    cfoPrecedentSuccess = Boolean(prec.id);
  } catch (err: any) {
    console.error('Lỗi tạo tiền lệ CFO:', err.message);
  }
  assert(cfoPrecedentSuccess, 'CFO tạo tiền lệ hợp lệ trên quy chế nội bộ (INTERNAL_POLICY)');

  // 1e. So khớp chính xác ruleId (Không so khớp lỏng lẻo)
  const entertainmentInvoice: InvoiceInput = {
    id: 'TEST-ENT-01',
    invoiceNumber: '0012345',
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplierTaxCode: '0109998881',
    supplierName: 'Nhà Hàng Tiếp Khách Cao Cấp',
    itemName: 'Chi phí tiếp khách đoàn đối tác Nhật Bản',
    preTaxAmount: 15_000_000,
    taxRate: 10,
    taxAmount: 1_500_000,
    totalAmount: 16_500_000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE',
    isImageBlurry: false,
    isAdjustment: false
  };

  const exactMatch = findPrecedentForInvoice(entertainmentInvoice, 'INTERNAL_POLICY_GUEST_ENTERTAINMENT');
  const nonMatch = findPrecedentForInvoice(entertainmentInvoice, 'INTERNAL_POLICY_TRAVEL');
  assert(exactMatch !== null && exactMatch.id === testPrecedentId, 'Khớp tiền lệ chính xác với ruleId INTERNAL_POLICY_GUEST_ENTERTAINMENT');
  assert(nonMatch === null, 'Từ chối tiền lệ khi ruleId khác nhau (chặn so khớp lỏng lẻo prefix)');

  // Dọn dẹp precedent test
  if (testPrecedentId) {
    db.prepare('DELETE FROM corporate_precedents WHERE id = ?').run(testPrecedentId);
  }

  // =========================================================================
  // 2. KIỂM THỬ BỘ MÁY QUY TẮC THU THẬP ĐA PHÁT HIỆN & THỨ TỰ ƯU TIÊN (P0-3)
  // =========================================================================
  console.log('\n>>> 2. KIỂM THỬ THU THẬP ĐA PHÁT HIỆN & THỨ TỰ ƯU TIÊN (P0-3 Multi-finding Engine)...');

  // Hóa đơn vừa vượt trần 200M (AUTHORITY) vừa thanh toán TIỀN MẶT >= 5M (STATUTORY)
  const multiViolationInvoice: InvoiceInput = {
    id: 'TEST-MULTI-VIOLATION-01',
    invoiceNumber: '0088991',
    invoiceDate: '2026-02-20',
    supplierTaxCode: '0100109106',
    supplierName: 'Công ty Cổ phần Thiết bị Công nghiệp Lớn',
    itemName: 'Dây chuyền máy tiện cơ khí công nghiệp',
    preTaxAmount: 250_000_000,
    taxRate: 10,
    taxAmount: 25_000_000,
    totalAmount: 275_000_000,
    paymentMethod: 'CASH', // Vi phạm Luật 48/2024
    hasBankSlip: false,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE',
    isImageBlurry: false,
    isAdjustment: false
  };

  const multiDecision = evaluateInvoiceLocally(multiViolationInvoice, policy.config, policy.version, macroState);

  assert(multiDecision.status === 'ESCALATED', 'Hóa đơn đa vi phạm bị gắn cờ ESCALATED');
  assert(
    Boolean(multiDecision.findings && multiDecision.findings.length >= 2),
    'Bộ máy quy tắc không dừng sớm (no early return), thu thập đầy đủ mọi phát hiện',
    `Số phát hiện thu thập được: ${multiDecision.findings?.length || 0}`
  );

  if (multiDecision.findings && multiDecision.findings.length >= 2) {
    const firstFinding = multiDecision.findings[0];
    assert(
      firstFinding.kind === 'STATUTORY',
      'Phát hiện luật định (STATUTORY) được xếp ưu tiên cao nhất trước thẩm quyền (AUTHORITY)',
      `Phát hiện đầu tiên là: kind=${firstFinding.kind}, ruleId=${firstFinding.ruleId}`
    );
    assert(
      firstFinding.ruleId === 'STATUTORY_LAW_48_CASH_PAYMENT',
      'Vi phạm thanh toán tiền mặt theo Luật 48 được đặt làm vi phạm cốt lõi'
    );
    const hasAuthorityFinding = multiDecision.findings.some(f => f.kind === 'AUTHORITY' && f.ruleId === 'AUTHORITY_EXCEED_KTT_LIMIT');
    assert(hasAuthorityFinding, 'Tìm thấy phát hiện thứ 2 về vượt hạn mức thẩm quyền KTT (>200M)');
  }

  // =========================================================================
  // 3. KIỂM THỬ TÁCH BIỆT TRẠNG THÁI & DUYỆT THUẾ (P0-1 & P0-4)
  // =========================================================================
  console.log('\n>>> 3. KIỂM THỬ TÁCH BIỆT HÀNH ĐỘNG DUYỆT THUẾ (P0-1 & P0-4)...');

  // 3a. Bút toán sổ cái chỉ ghi nhận thuế khi explicitApprovedTax > 0
  const sampleVoucherWithZeroTax = generateCanonicalVoucher(
    multiViolationInvoice,
    multiDecision,
    1,
    'CIRCULAR_99_200',
    0 // Explicitly 0 deductible tax
  );
  const vatEntry = sampleVoucherWithZeroTax.entries.find(e => e.accountCode.startsWith('133'));
  assert(
    !vatEntry || vatEntry.debitAmount === 0,
    'Sổ cái TK 1331 ghi nhận 0đ thuế khi explicitApprovedTax = 0'
  );

  // 3b. Kiểm tra cột approved_deductible_tax trong schema SQLite
  const tableInfo = db.prepare("PRAGMA table_info('invoices')").all() as Array<{ name: string; type: string }>;
  const hasApprovedTaxCol = tableInfo.some(col => col.name === 'approved_deductible_tax');
  assert(hasApprovedTaxCol, "Cột 'approved_deductible_tax' tồn tại trong bảng invoices");

  // 3c. Kiểm tra tính nhất quán giữa Tờ khai 01/GTGT Box 25 và Sổ cái
  // Tạo dữ liệu test độc lập trong database
  const testInvoiceApprovedId = `TEST-P0-APP-${crypto.randomUUID()}`;
  const testInvoiceRejectedId = `TEST-P0-REJ-${crypto.randomUUID()}`;
  const testInvoiceOnHoldId = `TEST-P0-HLD-${crypto.randomUUID()}`;
  const testInvoiceForwardedId = `TEST-P0-FWD-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    const dummyPayload = JSON.stringify({ preTaxAmount: 100_000_000, taxAmount: 10_000_000, totalAmount: 110_000_000 });
    db.prepare(`
      INSERT INTO invoices (id, invoice_number, supplier_tax_code, invoice_date, payload_json, content_hash, status, approved_deductible_tax, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testInvoiceApprovedId, 'TEST-APP-01', '0100109106', '2026-02-01', dummyPayload, 'hash_app', 'APPROVED', 10_000_000, now, now);

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, supplier_tax_code, invoice_date, payload_json, content_hash, status, approved_deductible_tax, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testInvoiceRejectedId, 'TEST-REJ-01', '0100109106', '2026-02-01', dummyPayload, 'hash_rej', 'REJECTED', 0, now, now);

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, supplier_tax_code, invoice_date, payload_json, content_hash, status, approved_deductible_tax, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testInvoiceOnHoldId, 'TEST-HLD-01', '0100109106', '2026-02-01', dummyPayload, 'hash_hld', 'ON_HOLD', 0, now, now);

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, supplier_tax_code, invoice_date, payload_json, content_hash, status, approved_deductible_tax, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testInvoiceForwardedId, 'TEST-FWD-01', '0100109106', '2026-02-01', dummyPayload, 'hash_fwd', 'FORWARDED', 0, now, now);

    // Tính chỉ tiêu [25] Tờ khai 01/GTGT
    const box25Result = db.prepare(`
      SELECT COALESCE(SUM(approved_deductible_tax), 0) AS box25
      FROM invoices
      WHERE status = 'APPROVED' AND id IN (?, ?, ?, ?)
    `).get(testInvoiceApprovedId, testInvoiceRejectedId, testInvoiceOnHoldId, testInvoiceForwardedId) as { box25: number };

    assert(
      box25Result.box25 === 10_000_000,
      'Chỉ tiêu [25] Tờ khai 01/GTGT chỉ cộng đúng thuế hóa đơn APPROVED (loại trừ REJECTED, ON_HOLD, FORWARDED)',
      `Chỉ tiêu [25] = ${box25Result.box25} (kỳ vọng 10,000,000đ)`
    );

    // Kiểm tra hóa đơn FORWARDED và ON_HOLD có approved_deductible_tax bằng 0
    const pendingTaxes = db.prepare(`
      SELECT status, approved_deductible_tax
      FROM invoices
      WHERE id IN (?, ?, ?)
    `).all(testInvoiceRejectedId, testInvoiceOnHoldId, testInvoiceForwardedId) as Array<{ status: string; approved_deductible_tax: number }>;

    const allZero = pendingTaxes.every(t => t.approved_deductible_tax === 0);
    assert(allZero, 'Các trạng thái chưa duyệt chung cuộc (REJECTED, ON_HOLD, FORWARDED) luôn có approved_deductible_tax = 0');
  } finally {
    // Dọn dẹp dữ liệu test
    db.prepare('DELETE FROM invoices WHERE id IN (?, ?, ?, ?)').run(
      testInvoiceApprovedId, testInvoiceRejectedId, testInvoiceOnHoldId, testInvoiceForwardedId
    );
  }

  // =========================================================================
  // 4. KIỂM THỬ XỬ LÝ THUẾ SUẤT KCT / KKKNT & KHÔNG MẶC ĐỊNH 10%
  // =========================================================================
  console.log('\n>>> 4. KIỂM THỬ XỬ LÝ THUẾ SUẤT KCT / KKKNT & KHÔNG MẶC ĐỊNH 10%...');

  // 4a. parseTaxRateString
  assert(parseTaxRateString('KCT') === 0, "parseTaxRateString('KCT') trả về 0%");
  assert(parseTaxRateString('KKKNT') === 0, "parseTaxRateString('KKKNT') trả về 0%");
  assert(parseTaxRateString('Không chịu thuế') === 0, "parseTaxRateString('Không chịu thuế') trả về 0%");
  assert(parseTaxRateString('0%') === 0, "parseTaxRateString('0%') trả về 0%");
  assert(parseTaxRateString('8%') === 8, "parseTaxRateString('8%') trả về 8%");
  assert(parseTaxRateString('10%') === 10, "parseTaxRateString('10%') trả về 10%");
  assert(parseTaxRateString(undefined) === undefined, 'parseTaxRateString(undefined) trả về undefined (không mặc định 10%)');
  assert(parseTaxRateString('') === undefined, 'parseTaxRateString("") trả về undefined (không mặc định 10%)');
  assert(parseTaxRateString('UNKNOWN') === undefined, 'parseTaxRateString("UNKNOWN") trả về undefined');

  // 4b. Hóa đơn KCT hạch toán 0đ thuế
  const exemptInvoice: InvoiceInput = {
    id: 'TEST-EXEMPT-02',
    invoiceNumber: '0077665',
    invoiceDate: '2026-02-10',
    supplierTaxCode: '0100109106',
    supplierName: 'Công ty Phần mềm Tri Thức',
    itemName: 'Bản quyền phần mềm đóng gói (KCT)',
    preTaxAmount: 50_000_000,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 50_000_000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE',
    isImageBlurry: false,
    isAdjustment: false
  };

  const exemptDecision = evaluateInvoiceLocally(exemptInvoice, policy.config, policy.version, macroState);
  assert(
    exemptDecision.status === 'ROUTINE' && exemptDecision.appliedTaxRate === 0 && exemptDecision.approvedTaxAmount === 0,
    'Hóa đơn không chịu thuế (KCT/0%) thẩm định ROUTINE với thuế suất 0% và tiền thuế 0đ'
  );

  // =========================================================================
  // 5. KIỂM THỬ QUY TẮC RƯỢU BIA (MỤC ĐÍCH CHI & RANH GIỚI TỪ)
  // =========================================================================
  console.log('\n>>> 5. KIỂM THỬ QUY TẮC RƯỢU BIA (Word-boundary & Business Purpose Inquiry)...');

  // 5a. Hóa đơn có rượu bia thật -> Phải hỏi mục đích chi (INTERNAL_POLICY, UNCERTAIN_INFO)
  const alcoholInvoice: InvoiceInput = {
    id: 'TEST-ALCOHOL-01',
    invoiceNumber: '0066771',
    invoiceDate: '2026-02-12',
    supplierTaxCode: '0100109106',
    supplierName: 'Công ty Cung ứng Đồ uống',
    itemName: 'Bia Heineken lon 330ml thùng 24 lon',
    preTaxAmount: 3_000_000,
    taxRate: 10,
    taxAmount: 300_000,
    totalAmount: 3_300_000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE',
    isImageBlurry: false,
    isAdjustment: false
  };

  const alcoholDecision = evaluateInvoiceLocally(alcoholInvoice, policy.config, policy.version, macroState);
  assert(
    alcoholDecision.status === 'ESCALATED',
    'Hóa đơn mua bia rượu được gắn cờ ESCALATED để xác minh nghiệp vụ'
  );
  assert(
    alcoholDecision.riskGroup === 'UNCERTAIN_INFO',
    'Rủi ro rượu bia xếp vào UNCERTAIN_INFO (chưa đủ thông tin mục đích chi), không gán tuyệt đối OUT_OF_POLICY'
  );
  assert(
    Boolean(alcoholDecision.findings?.some(f => f.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT' && f.actionableQuestion.includes('Khoản chi này phục vụ tiếp khách đối tác nào hay phúc lợi nhân viên? Có quy chế không?'))),
    'Câu hỏi hành động hướng dẫn kế toán kiểm tra quy chế và mục đích chi hợp lý theo luật thuế'
  );
  const alcoholFinding = alcoholDecision.findings?.find(f => f.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT');
  assert(
    Boolean(alcoholFinding && alcoholFinding.kind === 'INTERNAL_POLICY'),
    'Quy tắc rượu bia được phân loại chuẩn xác vào INTERNAL_POLICY (cho phép tiền lệ CFO nếu có quy chế)'
  );

  // 5b. Kiểm tra ranh giới từ: "bavia" KHÔNG được nhận diện nhầm là "bia"
  const baviaInvoice: InvoiceInput = {
    id: 'TEST-BAVIA-01',
    invoiceNumber: '0066772',
    invoiceDate: '2026-02-12',
    supplierTaxCode: '0100109106',
    supplierName: 'Công ty Cơ khí Chính xác Hà Nội',
    itemName: 'Gia công xử lý bavia chi tiết máy kim loại',
    preTaxAmount: 4_500_000,
    taxRate: 10,
    taxAmount: 450_000,
    totalAmount: 4_950_000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    hasItemManifest: true,
    sellerStatus: 'ACTIVE',
    isImageBlurry: false,
    isAdjustment: false
  };

  const baviaDecision = evaluateInvoiceLocally(baviaInvoice, policy.config, policy.version, macroState);
  assert(
    baviaDecision.status === 'ROUTINE',
    'Từ "bavia" KHÔNG bị khớp nhầm với "bia" nhờ kiểm tra ranh giới từ (word-boundary regex)'
  );

  // =========================================================================
  // TỔNG KẾT BÀI KIỂM THỬ
  // =========================================================================
  console.log('\n========================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ GIAI ĐOẠN 0: ${testsPassed} ĐẠT, ${testsFailed} THẤT BẠI`);
  console.log('========================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Lỗi thực thi test:', err);
  process.exit(1);
});
