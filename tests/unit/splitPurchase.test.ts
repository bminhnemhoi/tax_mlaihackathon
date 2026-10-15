/**
 * Tách nhỏ hóa đơn để né hạn mức phê duyệt (split purchase): từng hóa đơn dưới hạn mức Kế toán trưởng
 * nhưng cộng các hóa đơn cùng bên bán trong ngày đạt hạn mức → phải chuyển CFO, câu hỏi nêu tổng cộng dồn.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { checkHandoff } from '../../services/handoffService';
import type { RefereeDecision } from '../../lib/schemas';

const COMPANY = '0102030405';
const accountant = { id: 'split-accountant', role: 'ACCOUNTANT' as const, email: 'split@test', displayName: 'Kiểm thử tách nhỏ' };
const inv = (n: string, total: number, date = '2026-10-07', supplier = '0312345678') => ({
  id: `SPLIT-${n}`, invoiceNumber: n, invoiceDate: date, supplierTaxCode: supplier, supplierName: 'Công ty TNHH Thiết bị Minh An',
  itemName: 'Bàn ghế văn phòng', preTaxAmount: total / 1.1, taxRate: 10, taxAmount: total / 11, totalAmount: total,
  paymentMethod: 'BANK_TRANSFER', hasBankSlip: true, sellerStatus: 'ACTIVE'
});
async function sequence(invoices: Array<ReturnType<typeof inv>>): Promise<RefereeDecision[]> {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = COMPANY;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const out: RefereeDecision[] = [];
    for (const i of invoices) out.push((await evaluateWorkflow(i, accountant, { forceLocalOnly: true })).decision as RefereeDecision);
    return out;
  });
}

test('hai hóa đơn 165 triệu cùng bên bán, cùng ngày → hóa đơn thứ hai chuyển CFO (vượt thẩm quyền), câu hỏi nêu tổng 330 triệu', async () => {
  const [first, second] = await sequence([inv('0008001', 165_000_000), inv('0008002', 165_000_000)]);
  assert.equal(first.status, 'ROUTINE');
  assert.equal(second.status, 'ESCALATED');
  if (second.status !== 'ESCALATED') return;
  assert.equal(second.riskGroup, 'EXCEED_AUTHORITY');
  assert.equal(second.requiresCFO, true);
  assert.ok(second.findings?.some(f => f.ruleId === 'AUTHORITY_SPLIT_PURCHASE'));
  assert.match(second.actionableQuestion, /330\.000\.000₫/);
  assert.deepEqual(checkHandoff(second).errors, []);
});

test('không chặn nhầm: khác ngày, khác bên bán, hoặc tổng trong ngày dưới hạn mức', async () => {
  const otherDay = await sequence([inv('0008011', 165_000_000, '2026-10-07'), inv('0008012', 165_000_000, '2026-10-08')]);
  assert.equal(otherDay[1].status, 'ROUTINE');
  const otherSupplier = await sequence([inv('0008021', 165_000_000), inv('0008022', 165_000_000, '2026-10-07', '0319876543')]);
  assert.equal(otherSupplier[1].status, 'ROUTINE');
  const below = await sequence([inv('0008031', 150_000_000), inv('0008032', 44_000_000)]);
  assert.equal(below[1].status, 'ROUTINE');
});

test('một hóa đơn tự vượt hạn mức (đã do CFO duyệt riêng) không làm các hóa đơn nhỏ cùng ngày bị coi là tách nhỏ', async () => {
  const [big, small] = await sequence([inv('0008041', 330_000_000), inv('0008042', 2_200_000)]);
  assert.equal(big.status, 'ESCALATED');
  assert.equal(small.status, 'ROUTINE');
});
