import '../ops/setup-env';
import crypto from 'node:crypto';
import { getAccount, listAccounts, CHART_OF_ACCOUNTS } from '../../lib/accounting/chartOfAccounts';
import { determineExpenseAccount, generateCanonicalVoucher } from '../../lib/accounting/ledgerMapper';
import { canApproveInvoice, AppUser } from '../../lib/server/auth';
import { appendImmutableAudit, verifyImmutableAuditChain, listImmutableAuditTrail, computeImmutableHash } from '../../lib/server/audit';
import { getDatabase, jsonNow } from '../../lib/server/db';
import { InvoiceInput, RefereeDecision } from '../../lib/schemas';
import { upsertSupplier } from '../../services/supplierService';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

async function runSprint3Tests() {
  console.log('================================================================');
  console.log('KIỂM THỬ GIAI ĐOẠN 1 - SPRINT 3 (MODULE 5 + MODULE 6)');
  console.log('================================================================\n');

  const db = getDatabase();

  // ----------------------------------------------------------------
  // 1. MODULE 5: DANH MỤC TÀI KHOẢN (TT 200 & TT 133)
  // ----------------------------------------------------------------
  console.log('--- 1. Kiểm tra Hệ thống Danh mục Tài khoản (Chart of Accounts) ---');

  const acc111 = getAccount('111');
  assert(Boolean(acc111 && acc111.name === 'Tiền mặt'), 'Tra cứu tài khoản 111 (Tiền mặt) theo TT 200');

  const acc1331 = getAccount('1331');
  assert(Boolean(acc1331 && acc1331.parentCode === '133'), 'Tra cứu tài khoản 1331 (Thuế GTGT khấu trừ) có parentCode 133');

  const acc6423 = getAccount('6423', 'CIRCULAR_99_200');
  assert(Boolean(acc6423 && acc6423.name.includes('văn phòng')), 'Tra cứu tài khoản 6423 (Đồ dùng văn phòng TT 200)');

  const acc6421_133 = getAccount('6421', 'CIRCULAR_133');
  assert(Boolean(acc6421_133 && acc6421_133.regime === 'TT133'), 'Tra cứu tài khoản 6421 (Chi phí bán hàng TT 133)');

  const expenseAccountsTT200 = listAccounts('CIRCULAR_99_200', 'EXPENSE');
  assert(expenseAccountsTT200.length >= 8, `Danh mục tài khoản chi phí TT 200 đầy đủ (tìm thấy ${expenseAccountsTT200.length} TK)`);

  const assetAccounts = listAccounts('CIRCULAR_99_200', 'ASSET');
  assert(assetAccounts.some(a => a.code === '152') && assetAccounts.some(a => a.code === '1561'), 'Danh mục tài sản bao gồm 152 (NVL) và 1561 (Hàng hóa)');

  // ----------------------------------------------------------------
  // 2. MODULE 5: GỢI Ý ĐỊNH KHOẢN 3 TẦNG ƯU TIÊN
  // ----------------------------------------------------------------
  console.log('\n--- 2. Kiểm tra Gợi ý Định khoản 3 Tầng Ưu Tiên (Expense Categorization) ---');

  // Tầng 1: Ưu tiên tài khoản cấu hình mặc định trong danh bạ nhà cung cấp
  const testSupplierMst = '0101112223';
  upsertSupplier({
    taxCode: testSupplierMst,
    legalName: 'CÔNG TY DỊCH VỤ VẬN TẢI THÀNH CÔNG',
    status: 'ACTIVE',
    riskLevel: 'LOW',
    defaultExpenseAccount: '6417', // Tài khoản dịch vụ mua ngoài bán hàng
    notes: 'Nhà vận tải quen thuộc'
  });

  const accSupplierDefault = determineExpenseAccount('Vận chuyển hàng hóa đường bộ', 'CIRCULAR_99_200', '6417');
  assert(accSupplierDefault.code === '6417', 'Tầng 1: Ưu tiên lấy tài khoản mặc định của Nhà cung cấp (6417)');

  // Tầng 2 & 3: Suy luận theo từ khóa ngữ nghĩa mặt hàng (NLP Semantic)
  const accVpp = determineExpenseAccount('Giấy in Double A A4 70gsm, bút bi Thiên Long', 'CIRCULAR_99_200');
  assert(accVpp.code === '6423', `Nhận diện từ khóa văn phòng phẩm -> TK 6423 (thực tế: ${accVpp.code})`);

  const accInternet = determineExpenseAccount('Cước dịch vụ Internet cáp quang Doanh nghiệp T10/2026', 'CIRCULAR_99_200');
  assert(accInternet.code === '6427', `Nhận diện từ khóa dịch vụ viễn thông -> TK 6427 (thực tế: ${accInternet.code})`);

  const accTiepKhach = determineExpenseAccount('Tiệc tiếp khách đối tác kinh doanh tại Nhà hàng Sen Tây Hồ', 'CIRCULAR_99_200');
  assert(accTiepKhach.code === '6428', `Nhận diện từ khóa ăn uống tiếp khách -> TK 6428 (thực tế: ${accTiepKhach.code})`);

  const accVatTu = determineExpenseAccount('Thép cuộn Pomina phi 10, cát vàng xây dựng', 'CIRCULAR_99_200');
  assert(accVatTu.code === '152', `Nhận diện nguyên vật liệu sản xuất -> TK 152 (thực tế: ${accVatTu.code})`);

  const accCongCu = determineExpenseAccount('Máy in Canon LBP 2900, bàn ghế làm việc văn phòng', 'CIRCULAR_99_200');
  assert(accCongCu.code === '153', `Nhận diện công cụ dụng cụ -> TK 153 (thực tế: ${accCongCu.code})`);

  const accHangHoa = determineExpenseAccount('Sữa tươi Vinamilk có đường 180ml', 'CIRCULAR_99_200');
  assert(accHangHoa.code === '1561', `Nhận diện hàng hóa mua về bán lại -> TK 1561 (thực tế: ${accHangHoa.code})`);

  const accPhanMem = determineExpenseAccount('Bản quyền phần mềm kế toán MISA SME 3 năm', 'CIRCULAR_99_200');
  assert(accPhanMem.code === '242', `Nhận diện phần mềm dài hạn -> TK 242 Chi phí trả trước (thực tế: ${accPhanMem.code})`);

  // Chế độ TT 133
  const accSME_BanHang = determineExpenseAccount('Dịch vụ vận chuyển giao hàng bán cho khách', 'CIRCULAR_133');
  assert(accSME_BanHang.code === '6421', `TT 133: Bán hàng gộp vào TK 6421 (thực tế: ${accSME_BanHang.code})`);

  const accSME_QuanLy = determineExpenseAccount('Giấy in A4, bút, mực máy in văn phòng', 'CIRCULAR_133');
  assert(accSME_QuanLy.code === '6422', `TT 133: Quản lý gộp vào TK 6422 (thực tế: ${accSME_QuanLy.code})`);

  // ----------------------------------------------------------------
  // 3. MODULE 5: HẠCH TOÁN ĐA DÒNG HÀNG & CÂN ĐỐI SỔ CÁI
  // ----------------------------------------------------------------
  console.log('\n--- 3. Kiểm tra Hạch toán Đa dòng hàng (Multi-Line Items Voucher) ---');

  const multiItemInvoice: InvoiceInput = {
    id: 'inv_sprint3_multi_01',
    invoiceNumber: '0008899',
    invoiceSeries: '1C26TBB',
    invoiceDate: '2026-10-04',
    supplierTaxCode: '0109988776',
    supplierName: 'CÔNG TY TNHH THIẾT BỊ VÀ THƯƠNG MẠI SAO MAI',
    buyerTaxCode: '0102030405',
    itemName: 'Mua hỗn hợp thiết bị và vật tư',
    preTaxAmount: 45_000_000,
    taxRate: 10,
    taxAmount: 4_500_000,
    totalAmount: 49_500_000,
    paymentMethod: 'BANK_TRANSFER',
    hasBankSlip: true,
    items: [
      { itemName: 'Máy in văn phòng HP Laser', quantity: 2, unitPrice: 5_000_000, amount: 10_000_000, taxRate: 10 },
      { itemName: 'Thép lá nguyên liệu gia công', quantity: 1, unitPrice: 25_000_000, amount: 25_000_000, taxRate: 10 },
      { itemName: 'Giấy in văn phòng và mực in', quantity: 10, unitPrice: 1_000_000, amount: 10_000_000, taxRate: 10 }
    ]
  };

  const voucher = generateCanonicalVoucher(multiItemInvoice, null, 1, 'CIRCULAR_99_200', 4_500_000);

  const debitEntries = voucher.entries.filter(e => e.debitAmount > 0);
  const creditEntries = voucher.entries.filter(e => e.creditAmount > 0);

  assert(debitEntries.some(e => e.accountCode === '153'), 'Hạch toán đa dòng tạo dòng Nợ TK 153 (Máy in)');
  assert(debitEntries.some(e => e.accountCode === '152'), 'Hạch toán đa dòng tạo dòng Nợ TK 152 (Thép nguyên liệu)');
  assert(debitEntries.some(e => e.accountCode === '6423'), 'Hạch toán đa dòng tạo dòng Nợ TK 6423 (Giấy in & mực)');
  assert(debitEntries.some(e => e.accountCode === '1331'), 'Hạch toán dòng Nợ TK 1331 (Thuế GTGT khấu trừ)');
  assert(creditEntries.some(e => e.accountCode === '331'), 'Hạch toán dòng Có TK 331 (Phải trả người bán)');

  const sumDebits = voucher.entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const sumCredits = voucher.entries.reduce((sum, e) => sum + e.creditAmount, 0);

  assert(sumDebits === multiItemInvoice.totalAmount, `Tổng phát sinh Nợ = ${sumDebits.toLocaleString('vi-VN')}₫ khớp đúng tổng HĐ (${multiItemInvoice.totalAmount.toLocaleString('vi-VN')}₫)`);
  assert(sumCredits === multiItemInvoice.totalAmount, `Tổng phát sinh Có = ${sumCredits.toLocaleString('vi-VN')}₫ khớp đúng tổng HĐ (${multiItemInvoice.totalAmount.toLocaleString('vi-VN')}₫)`);
  assert(sumDebits === sumCredits, 'Nguyên tắc cân đối kế toán: Tổng phát sinh Nợ == Tổng phát sinh Có');

  // Hóa đơn bị loại thuế (thanh toán tiền mặt vi phạm) -> hạch toán vào 811
  const cashInvoiceOver5M: InvoiceInput = {
    id: 'inv_sprint3_cash_fail',
    invoiceNumber: '0009900',
    invoiceSeries: '1C26TBB',
    invoiceDate: '2026-10-04',
    supplierTaxCode: '0100109106',
    supplierName: 'VIETTEL',
    buyerTaxCode: '0102030405',
    itemName: 'Thiết bị viễn thông tiền mặt',
    preTaxAmount: 20_000_000,
    taxRate: 10,
    taxAmount: 2_000_000,
    totalAmount: 22_000_000,
    paymentMethod: 'CASH',
    hasBankSlip: false
  };

  const voucherCashFail = generateCanonicalVoucher(cashInvoiceOver5M, null, 2, 'CIRCULAR_99_200', 0);
  const debit811 = voucherCashFail.entries.find(e => e.accountCode === '811');
  assert(Boolean(debit811 && debit811.debitAmount === 2_000_000), 'Thuế GTGT không được khấu trừ tự động hạch toán vào TK 811 (Chi phí khác)');

  const cashDebits = voucherCashFail.entries.reduce((s, e) => s + e.debitAmount, 0);
  const cashCredits = voucherCashFail.entries.reduce((s, e) => s + e.creditAmount, 0);
  assert(cashDebits === cashCredits && cashDebits === cashInvoiceOver5M.totalAmount, 'Bút toán loại thuế vào TK 811 vẫn bảo đảm cân đối Nợ = Có = Tổng thanh toán');

  // ----------------------------------------------------------------
  // 4. MODULE 6: PHÂN QUYỀN THỨ BẬC 3 CẤP (AUTHORIZATION MATRIX)
  // ----------------------------------------------------------------
  console.log('\n--- 4. Kiểm tra Ma trận Phân quyền 3 Cấp (Role-based Authorization Matrix) ---');

  const accountantUser: AppUser = { id: 'user_acc_01', email: 'ktv@local', displayName: 'Kế toán viên A', role: 'ACCOUNTANT' };
  const chiefAccountantUser: AppUser = { id: 'user_ktt_01', email: 'ktt@local', displayName: 'Kế toán trưởng B', role: 'CHIEF_ACCOUNTANT' };
  const cfoUser: AppUser = { id: 'user_cfo_01', email: 'cfo@local', displayName: 'Giám đốc tài chính C', role: 'CFO' };

  // Case 1: Kế toán viên bấm duyệt Routine -> Phải bị từ chối
  const checkAccountant = canApproveInvoice(accountantUser, {
    id: 'inv_routine_01',
    totalAmount: 15_000_000,
    createdByUserId: 'user_other',
    requiresCFO: false
  });
  assert(!checkAccountant.allowed && checkAccountant.requiredRole === 'CHIEF_ACCOUNTANT', 'Kế toán viên không có quyền phê duyệt hóa đơn (bị chặn)');

  // Case 2: Kế toán trưởng duyệt hồ sơ Routine < 200M -> Hợp lệ
  const checkKTT_Routine = canApproveInvoice(chiefAccountantUser, {
    id: 'inv_routine_02',
    totalAmount: 50_000_000,
    createdByUserId: 'user_acc_01',
    requiresCFO: false
  });
  assert(checkKTT_Routine.allowed, 'Kế toán trưởng có thẩm quyền duyệt hồ sơ Routine < 200.000.000 VNĐ');

  // Case 3: Kế toán trưởng duyệt hồ sơ >= 200M (Vượt hạn mức) -> Bị từ chối, yêu cầu CFO
  const checkKTT_Exceed = canApproveInvoice(chiefAccountantUser, {
    id: 'inv_routine_exceed',
    totalAmount: 350_000_000,
    createdByUserId: 'user_acc_01',
    requiresCFO: false
  });
  assert(!checkKTT_Exceed.allowed && checkKTT_Exceed.requiredRole === 'CFO', 'Kế toán trưởng bị chặn khi hồ sơ vượt hạn mức >= 200 triệu đồng (yêu cầu CFO)');

  // Case 4: Kế toán trưởng duyệt hồ sơ có cờ requiresCFO = true -> Bị từ chối
  const checkKTT_RequiresCFO = canApproveInvoice(chiefAccountantUser, {
    id: 'inv_escalated_risk',
    totalAmount: 80_000_000,
    createdByUserId: 'user_acc_01',
    requiresCFO: true
  });
  assert(!checkKTT_RequiresCFO.allowed && checkKTT_RequiresCFO.requiredRole === 'CFO', 'Kế toán trưởng bị chặn với hồ sơ diện rủi ro cao requiresCFO (yêu cầu CFO)');

  // Case 5: CFO duyệt hồ sơ >= 200M hoặc có requiresCFO -> Hợp lệ
  const checkCFO_Exceed = canApproveInvoice(cfoUser, {
    id: 'inv_routine_exceed',
    totalAmount: 350_000_000,
    createdByUserId: 'user_acc_01',
    requiresCFO: false
  });
  assert(checkCFO_Exceed.allowed, 'CFO có thẩm quyền phê duyệt hồ sơ vượt hạn mức >= 200 triệu đồng');

  const checkCFO_Danger = canApproveInvoice(cfoUser, {
    id: 'inv_escalated_risk',
    totalAmount: 80_000_000,
    createdByUserId: 'user_acc_01',
    requiresCFO: true
  });
  assert(checkCFO_Danger.allowed, 'CFO có thẩm quyền phê duyệt hồ sơ diện rủi ro cao requiresCFO');

  // ----------------------------------------------------------------
  // 5. MODULE 6: CƠ CHẾ CHẶN TỰ DUYỆT (ANTI-SELF-APPROVAL / SEGREGATION OF DUTIES)
  // ----------------------------------------------------------------
  console.log('\n--- 5. Kiểm tra Cơ chế Chặn Tự duyệt (Anti-Self-Approval) ---');

  // KTT tạo hồ sơ và tự duyệt hồ sơ của chính mình
  const checkKTT_SelfApprove = canApproveInvoice(chiefAccountantUser, {
    id: 'inv_created_by_ktt',
    totalAmount: 30_000_000,
    createdByUserId: chiefAccountantUser.id, // Trùng ID người tạo
    requiresCFO: false
  });
  assert(!checkKTT_SelfApprove.allowed && checkKTT_SelfApprove.reason?.includes('Segregation of Duties'), 'Chặn Kế toán trưởng tự phê duyệt hồ sơ do chính mình nhập/tải lên');

  // CFO tạo hồ sơ và tự duyệt hồ sơ của chính mình
  const checkCFO_SelfApprove = canApproveInvoice(cfoUser, {
    id: 'inv_created_by_cfo',
    totalAmount: 500_000_000,
    createdByUserId: cfoUser.id, // Trùng ID người tạo
    requiresCFO: true
  });
  assert(!checkCFO_SelfApprove.allowed && checkCFO_SelfApprove.reason?.includes('Segregation of Duties'), 'Chặn Giám đốc tài chính (CFO) tự phê duyệt hồ sơ do chính mình nhập/tải lên');

  // Hồ sơ do Kế toán viên A tạo, Kế toán trưởng B duyệt -> Hợp lệ (khác người tạo)
  const checkDifferentUser = canApproveInvoice(chiefAccountantUser, {
    id: 'inv_created_by_acc',
    totalAmount: 30_000_000,
    createdByUserId: accountantUser.id, // Người tạo là KTV
    requiresCFO: false
  });
  assert(checkDifferentUser.allowed, 'Cho phép KTT duyệt hồ sơ khi người tạo là Kế toán viên (chuẩn Segregation of Duties)');

  // ----------------------------------------------------------------
  // 6. MODULE 6: NHẬT KÝ PHÊ DUYỆT BẤT BIẾN (IMMUTABLE AUDIT TRAIL)
  // ----------------------------------------------------------------
  console.log('\n--- 6. Kiểm tra Nhật ký Phê duyệt Bất biến (Immutable Audit Trail) ---');

  const testEntityId = `invoice_test_audit_${Date.now()}`;

  // Ghi nhận chuỗi 3 sự kiện liên tiếp
  const entry1 = appendImmutableAudit({
    eventType: 'INVOICE_SUBMITTED',
    entityId: testEntityId,
    userId: accountantUser.id,
    userRole: accountantUser.role,
    action: 'UPLOAD_INVOICE',
    rationale: 'Kế toán viên tải lên hóa đơn gốc',
    payload: { amount: 50_000_000, supplier: 'VIETTEL' }
  });

  const entry2 = appendImmutableAudit({
    eventType: 'ROUTINE_CONFIRMED',
    entityId: testEntityId,
    userId: chiefAccountantUser.id,
    userRole: chiefAccountantUser.role,
    action: 'APPROVE_ROUTINE',
    rationale: 'Kế toán trưởng phê duyệt hạch toán khấu trừ thuế',
    payload: { approvedTax: 5_000_000, voucherId: 'PKT-202610-00001' }
  });

  const entry3 = appendImmutableAudit({
    eventType: 'POSTED_TO_LEDGER',
    entityId: testEntityId,
    userId: chiefAccountantUser.id,
    userRole: chiefAccountantUser.role,
    action: 'POST_LEDGER',
    rationale: 'Đã truyền dữ liệu sang phần mềm kế toán MISA',
    payload: { misaRef: 'VCH-998877' }
  });

  assert(Boolean(entry1.entryHash && entry1.entryHash.length === 64), 'Bản ghi audit 1 có mã băm SHA-256 (64 ký tự)');
  assert(entry2.previousHash === entry1.entryHash, 'Bản ghi audit 2 xâu chuỗi chuẩn xác: previous_hash == entry1.entry_hash');
  assert(entry3.previousHash === entry2.entryHash, 'Bản ghi audit 3 xâu chuỗi chuẩn xác: previous_hash == entry2.entry_hash');

  // Xác minh tính toàn vẹn của chuỗi băm
  const chainCheck = verifyImmutableAuditChain();
  assert(chainCheck.valid, `Xác minh toàn bộ chuỗi băm bất biến thành công (${chainCheck.checked} bản ghi hợp lệ)`);

  // Thử nghiệm phát hiện giả mạo (Tamper Detection)
  const tamperStmt = db.prepare('UPDATE immutable_audit_trail SET action = ? WHERE id = ?');
  tamperStmt.run('TAMPERED_ACTION', entry2.id);

  const tamperCheck = verifyImmutableAuditChain();
  assert(!tamperCheck.valid, 'Cơ chế phát hiện giả mạo: Hệ thống phát hiện chuỗi hash bị phá vỡ khi bản ghi bị can thiệp trái phép');

  // Khôi phục lại dữ liệu ban đầu
  tamperStmt.run(entry2.action, entry2.id);
  const restoreCheck = verifyImmutableAuditChain();
  assert(restoreCheck.valid, 'Khôi phục lại dữ liệu gốc -> Chuỗi băm bất biến hợp lệ trở lại 100%');

  // Truy vấn lịch sử theo hóa đơn
  const entityTrail = listImmutableAuditTrail(testEntityId);
  assert(entityTrail.length >= 3, `Truy vấn thành công ${entityTrail.length} bản ghi nhật ký kiểm toán cho hóa đơn`);

  // ----------------------------------------------------------------
  // TỔNG KẾT
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`KẾT QUẢ: ${passCount} PASS, ${failCount} FAIL`);
  if (failCount === 0) {
    console.log('TẤT CẢ CÁC BÀI KIỂM THỬ GIAI ĐOẠN 1 SPRINT 3 ĐÃ VƯỢT QUA 100%!');
  } else {
    console.error(`CÓ ${failCount} BÀI KIỂM THỬ THẤT BẠI!`);
  }
  console.log('================================================================');

  if (failCount > 0) process.exit(1);
}

runSprint3Tests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
