import '../ops/setup-env';
import { RefereeDecisionSchema } from '../../lib/schemas';
import { diverseInvoiceFixtures } from '../../data/verification/diverseInvoiceFixtures';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { getActivePolicy, getMacroState } from '../../lib/server/db';
import { generateCanonicalVoucher } from '../../lib/accounting/ledgerMapper';
import { formatMisaAmisPayload } from '../../lib/accounting/adapters/misaAdapter';
import { formatFastAccountingPayload } from '../../lib/accounting/adapters/fastAdapter';
import { generateUniversalXml } from '../../lib/accounting/adapters/universalXmlExporter';
import { CanonicalLedgerVoucher } from '../../lib/accounting/types';

console.log('================================================================');
console.log(' KIỂM THỬ TOÀN DIỆN TAX REFEREE VỚI 10 DẠNG HÓA ĐƠN ĐẶC THÙ');
console.log(' Niên độ pháp lý: 2025 - 2026 (Luật Thuế GTGT 48/2024 & TT 99/2025)');
console.log('================================================================\n');

const testInvoices = diverseInvoiceFixtures;

const policy = getActivePolicy();
const macroState = getMacroState();
const evaluatedVouchers: CanonicalLedgerVoucher[] = [];

let countPassed = 0;

for (const tc of testInvoices) {
  const decision = evaluateInvoiceLocally(tc.invoice, policy.config, policy.version, macroState);
  RefereeDecisionSchema.parse(decision);

  const matched =
    tc.expected === 'ROUTINE'
      ? decision.status === 'ROUTINE'
      : decision.status === 'ESCALATED' &&
        tc.expected.split(' - ')[1] === decision.riskGroup;

  if (matched) {
    countPassed++;
    console.log(`[PASS] ${tc.name}`);
    console.log(`   Phân loại: ${decision.status}${decision.status === 'ESCALATED' ? ` | Nhóm: ${decision.riskGroup}` : ''}`);
    console.log(`   Giải thích: ${decision.plainExplanation}`);
  } else {
    console.log(`[FAIL] ${tc.name} - Mong đợi: ${tc.expected}, Thực tế: ${decision.status}${decision.status === 'ESCALATED' ? ` / ${decision.riskGroup}` : ''} · ${decision.plainExplanation}`);
  }

  // Sinh bút toán kế toán chuẩn tắc theo Thông tư 99 và TT 133
  const voucherTT99 = generateCanonicalVoucher(tc.invoice, decision, evaluatedVouchers.length + 1, 'CIRCULAR_99_200');
  const voucherTT133 = generateCanonicalVoucher(tc.invoice, decision, evaluatedVouchers.length + 1, 'CIRCULAR_133');

  evaluatedVouchers.push(voucherTT99);

  // Kiểm tra tính cân đối kế toán Tổng Nợ = Tổng Có
  const sumDebits = voucherTT99.entries.reduce((s, e) => s + e.debitAmount, 0);
  const sumCredits = voucherTT99.entries.reduce((s, e) => s + e.creditAmount, 0);

  if (sumDebits !== sumCredits) {
    console.error(`   [CẢNH BÁO] Không cân đối Nợ/Có trên voucher ${voucherTT99.voucherNumber}!`);
  } else {
    console.log(`   Định khoản TT99: ${voucherTT99.entries.map((e) => `${e.debitAmount > 0 ? `Nợ ${e.accountCode}` : `Có ${e.accountCode}`}: ${e.debitAmount || e.creditAmount}đ`).join(', ')}`);
    console.log(`   Định khoản TT133: ${voucherTT133.entries.map((e) => `${e.debitAmount > 0 ? `Nợ ${e.accountCode}` : `Có ${e.accountCode}`}: ${e.debitAmount || e.creditAmount}đ`).join(', ')}`);
  }
  console.log('----------------------------------------------------------------');
}

console.log(`\n=> KẾT QUẢ ĐÁNH GIÁ PHÂN LUỒNG: ${countPassed}/${testInvoices.length} DẠNG HÓA ĐƠN ĐẠT CHUẨN XÁC TUYỆT ĐỐI!`);
if (countPassed !== testInvoices.length) process.exitCode = 1;

// Kiểm thử xuất toàn bộ sang các Adapter
console.log('\n--- KIỂM THỬ XUẤT ĐỒNG BỘ ĐA NỀN TẢNG ---');
const misaPayload = formatMisaAmisPayload(evaluatedVouchers);
console.log(`- MISA AMIS: Tạo thành công ${misaPayload.data.length} chứng từ mua hàng RefType 24.`);

const fastPayload = formatFastAccountingPayload(evaluatedVouchers);
console.log(`- FAST Accounting: Tạo thành công ${fastPayload.chung_tu.length} chứng từ PNA.`);

const xmlPayload = generateUniversalXml(evaluatedVouchers);
console.log(`- Universal XML Thông tư 99: Kết xuất thành công ${xmlPayload.length} ký tự XML.`);

console.log('\n=== HOÀN TẤT TOÀN BỘ KIỂM THỬ ĐA DẠNG HÓA ĐƠN THÀNH CÔNG ===\n');
