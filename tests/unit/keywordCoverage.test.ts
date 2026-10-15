/**
 * Các ca "ngoài quy định" từng bị tự duyệt trong đợt chấm nghiêm khắc 15/10 (gõ không dấu, quà tặng, chi cá nhân,
 * thép/xăng/bia áp 8%), cùng các ca không được chặn nhầm (bìa hồ sơ, đồng hồ, mũ bảo hiểm, nước uống).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { userStudyCases } from '../../data/verification/userStudyCases';
import type { RefereeDecision } from '../../lib/schemas';
import { checkHandoff } from '../../services/handoffService';

const COMPANY = '0102030405';
const accountant = { id: 'kw-accountant', role: 'ACCOUNTANT' as const, email: 'kw@test', displayName: 'Kiểm thử từ khóa' };
let seq = 0;
async function judge(itemName: string, extra: Record<string, unknown> = {}): Promise<RefereeDecision> {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = COMPANY;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const n = String(++seq).padStart(7, '0');
    return (await evaluateWorkflow({ id: `KW-${n}`, invoiceNumber: n, invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Minh An',
      itemName, preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER', ...extra }, accountant, { forceLocalOnly: true })).decision as RefereeDecision;
  });
}
const at8 = { taxRate: 8, preTaxAmount: 3_000_000, taxAmount: 240_000, totalAmount: 3_240_000 };

test('ngoài quy định được nhận ra cả khi gõ không dấu, tiếng Anh, quà tặng, chi cá nhân', async () => {
  for (const item of ['tiep khach ruou', 'Chi phi tiep khach nha hang', 'Rượu vang tiếp đối tác', 'Giỏ quà Tết biếu đối tác', 'Quà tặng sinh nhật khách hàng', 'Charity donation',
    'Mỹ phẩm cá nhân', 'Tour du lịch Đà Lạt cho gia đình giám đốc', 'Học phí con giám đốc', 'Đồ chơi trẻ em', 'Sponsorship giải golf', 'Tien phat cham nop']) {
    const d = await judge(item);
    assert.equal(d.status, 'ESCALATED', item);
    assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY', item);
  }
});

test('hàng không được giảm thuế 8% (thép, ống đồng, xăng dầu, bia, thuốc lá) bị chặn khi áp 8%', async () => {
  for (const item of ['Thép hộp mạ kẽm', 'Ống đồng máy lạnh', 'Xăng RON95', 'Dầu diesel', 'Bia lon Hà Nội', 'Thuốc lá', 'thep tam can nong']) {
    const d = await judge(item, at8);
    assert.equal(d.status, 'ESCALATED', item);
    assert.ok(d.status === 'ESCALATED' && d.findings?.some(f => f.ruleId === 'STATUTORY_RES_204_VAT_8_EXCLUDED' || f.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT'), item);
  }
});

test('không chặn nhầm hàng thông thường', async () => {
  for (const [item, extra] of [['Bìa hồ sơ nhựa', {}], ['Đồng hồ treo tường', at8], ['Mũ bảo hiểm cho nhân viên', at8], ['Nước uống đóng bình 20L', at8], ['Máy tính cá nhân cho kế toán', {}], ['Biểu mẫu in sẵn', {}], ['Phi chuyen phat nhanh tai lieu', {}], ['Bieu mau in san', {}]] as const) {
    const d = await judge(item, extra);
    assert.equal(d.status, 'ROUTINE', item);
  }
});

test('ca bẫy U2 của buổi thử người dùng 16/10 giữ nguyên thiết kế (hệ thống tự duyệt sai có chủ đích)', async () => {
  const u2 = userStudyCases.find(c => c.id === 'U2')!;
  assert.equal(u2.designedAs.trap, true);
  const d = await runIsolated(async () => (await evaluateWorkflow({ id: 'U2', ...u2.invoice }, accountant, { forceLocalOnly: true })).decision as RefereeDecision);
  assert.equal(d.status, 'ROUTINE');
});

test('ngày lập muộn hơn hôm nay quá 6 tháng (nhập sai năm) không được tự duyệt; câu hỏi hợp lệ', async () => {
  const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const d = await judge('Giấy in A4', { invoiceDate: future });
  assert.equal(d.status, 'ESCALATED');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'UNCERTAIN_INFO');
  assert.deepEqual(checkHandoff(d).errors, []);
});
