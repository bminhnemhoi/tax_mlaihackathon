/**
 * Diễn tập "dữ liệu mới của giám khảo": các ca gõ tay tối thiểu, chưa từng có trong fixture Verify.
 * Ca thường quy phải tự xử lý (không chuyển tiếp thừa); ca chuyển tiếp phải đúng nhóm và có câu hỏi
 * trả lời được trong một câu (số hóa đơn, số tiền ₫, đáp án có hệ quả, không lộ giá trị kỹ thuật).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { checkHandoff } from '../../services/handoffService';
import type { RefereeDecision } from '../../lib/schemas';

const COMPANY = '0102030405';
const accountant = { id: 'judge-accountant', role: 'ACCOUNTANT' as const, email: 'judge@test', displayName: 'Giám khảo nhập liệu' };
const typed = (invoiceNumber: string, fields: Record<string, unknown>) => ({
  id: `JUDGE-${invoiceNumber}`, invoiceNumber, invoiceDate: '2026-10-05', supplierTaxCode: '0312345678',
  supplierName: 'Công ty TNHH Dịch vụ Minh An', ...fields
});

async function judge(input: Record<string, unknown>): Promise<RefereeDecision> {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = COMPANY;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    return (await evaluateWorkflow(input, accountant, { forceLocalOnly: true })).decision as RefereeDecision;
  });
}

function assertOneReplyQuestion(decision: RefereeDecision, invoiceNumber: string) {
  assert.equal(decision.status, 'ESCALATED');
  if (decision.status !== 'ESCALATED') return;
  const q = decision.actionableQuestion;
  assert.ok(q.includes(invoiceNumber), 'câu hỏi nêu số hóa đơn');
  assert.match(q, /\d[\d.]*₫/, 'câu hỏi có số tiền cụ thể');
  assert.match(q, / A: .+; hoặc B: /, 'mỗi ý có hai đáp án A/B');
  assert.doesNotMatch(q, /\b(false|true|undefined|NaN|null|UNKNOWN)\b/, 'không lộ giá trị kỹ thuật');
  assert.doesNotMatch(q, /xem danh sách|xem xét lại/i, 'không yêu cầu chung chung');
  assert.deepEqual(checkHandoff(decision).errors, []);
}

test('R1 nước uống 540.000₫, chỉ gõ số liệu tối thiểu → tự xử lý', async () => {
  const d = await judge(typed('0000451', { itemName: 'Nước uống đóng bình 20L', preTaxAmount: 500_000, taxRate: 8, taxAmount: 40_000, totalAmount: 540_000 }));
  assert.equal(d.status, 'ROUTINE');
});

test('R2 phí chuyển phát 2.200.000₫ chuyển khoản → tự xử lý', async () => {
  const d = await judge(typed('0000452', { itemName: 'Phí chuyển phát tài liệu tháng 9', preTaxAmount: 2_000_000, taxRate: 10, taxAmount: 200_000, totalAmount: 2_200_000, paymentMethod: 'BANK_TRANSFER' }));
  assert.equal(d.status, 'ROUTINE');
});

test('R3 bảo dưỡng máy lạnh 8.800.000₫ chuyển khoản có UNC → tự xử lý', async () => {
  const d = await judge(typed('0000453', { itemName: 'Bảo dưỡng máy lạnh văn phòng', preTaxAmount: 8_000_000, taxRate: 10, taxAmount: 800_000, totalAmount: 8_800_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }));
  assert.equal(d.status, 'ROUTINE');
});

test('E1 UPS 12.100.000₫ chưa rõ hình thức thanh toán → UNCERTAIN_INFO, hỏi chuyển khoản hay tiền mặt kèm hệ quả ₫', async () => {
  const d = await judge(typed('0000454', { itemName: 'Bộ lưu điện UPS 3kVA', preTaxAmount: 11_000_000, taxRate: 10, taxAmount: 1_100_000, totalAmount: 12_100_000 }));
  assertOneReplyQuestion(d, '0000454');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'UNCERTAIN_INFO');
  assert.match(d.status === 'ESCALATED' ? d.actionableQuestion : '', /Tiền mặt → không được khấu trừ 1\.100\.000₫/);
});

test('E2 cước di động áp 8% → OUT_OF_POLICY (nhóm không được giảm thuế), nêu mức đúng 10%', async () => {
  const d = await judge(typed('0000455', { itemName: 'Cước điện thoại di động tháng 9', preTaxAmount: 1_000_000, taxRate: 8, taxAmount: 80_000, totalAmount: 1_080_000, paymentMethod: 'BANK_TRANSFER' }));
  assertOneReplyQuestion(d, '0000455');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY');
  assert.match(d.status === 'ESCALATED' ? d.actionableQuestion : '', /10%/);
});

test('E3 10 laptop 330.000.000₫ thiếu trạng thái MST → nhóm chính EXCEED_AUTHORITY, đủ 2 ý cho CFO', async () => {
  const d = await judge(typed('0000456', { itemName: '10 laptop Dell Latitude', preTaxAmount: 300_000_000, taxRate: 10, taxAmount: 30_000_000, totalAmount: 330_000_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }));
  assertOneReplyQuestion(d, '0000456');
  if (d.status !== 'ESCALATED') return;
  assert.equal(d.riskGroup, 'EXCEED_AUTHORITY');
  assert.deepEqual(d.riskGroups, ['EXCEED_AUTHORITY', 'UNCERTAIN_INFO']);
  assert.equal(d.requiresCFO, true);
  assert.match(d.actionableQuestion, /CFO trả lời 2 ý/);
  assert.match(d.actionableQuestion, /1A, 2A/);
});

test('E4 tiếp khách có rượu vang 3.300.000₫ → OUT_OF_POLICY (đúng ví dụ đề bài), hỏi mục đích kèm số thuế', async () => {
  const d = await judge(typed('0000457', { itemName: 'Tiếp khách đối tác - rượu vang', preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER' }));
  assertOneReplyQuestion(d, '0000457');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY');
  assert.match(d.status === 'ESCALATED' ? d.actionableQuestion : '', /loại 300\.000₫ VAT/);
});

test('E5 mực in: tổng in 480.000₫ ≠ 450.000 + 45.000 → UNCERTAIN_INFO, hỏi 495.000₫ hay 480.000₫', async () => {
  const d = await judge(typed('0000458', { itemName: 'Mực in laser', preTaxAmount: 450_000, taxRate: 10, taxAmount: 45_000, totalAmount: 480_000, paymentMethod: 'BANK_TRANSFER' }));
  assertOneReplyQuestion(d, '0000458');
  if (d.status !== 'ESCALATED') return;
  assert.equal(d.riskGroup, 'UNCERTAIN_INFO');
  assert.match(d.actionableQuestion, /495\.000₫/);
  assert.match(d.actionableQuestion, /480\.000₫/);
});

test('E6 tài trợ giải chạy từ thiện → OUT_OF_POLICY: SOP không bao phủ, không tự duyệt dù số liệu đúng', async () => {
  const d = await judge(typed('0000459', { itemName: 'Tài trợ giải chạy từ thiện', preTaxAmount: 15_000_000, taxRate: 10, taxAmount: 1_500_000, totalAmount: 16_500_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }));
  assertOneReplyQuestion(d, '0000459');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY');
  assert.ok(d.findings?.some(f => f.ruleId === 'RULE_SCOPE_NOT_COVERED'));
});

test('E7 thuế suất lạ 7% → không lỗi 400, chuyển UNCERTAIN_INFO và hỏi thuế suất đúng', async () => {
  const d = await judge(typed('0000460', { itemName: 'Văn phòng phẩm', preTaxAmount: 1_000_000, taxRate: 7, taxAmount: 70_000, totalAmount: 1_070_000, paymentMethod: 'BANK_TRANSFER' }));
  assertOneReplyQuestion(d, '0000460');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'UNCERTAIN_INFO');
  assert.match(d.status === 'ESCALATED' ? d.actionableQuestion : '', /7%/);
});

test('E8 thanh toán tiền mặt 22.000.000₫ → OUT_OF_POLICY; không duyệt thuế khi còn nghi vấn', async () => {
  const d = await judge(typed('0000461', { itemName: 'Bàn ghế phòng họp', preTaxAmount: 20_000_000, taxRate: 10, taxAmount: 2_000_000, totalAmount: 22_000_000, paymentMethod: 'CASH', sellerStatus: 'ACTIVE' }));
  assertOneReplyQuestion(d, '0000461');
  if (d.status !== 'ESCALATED') return;
  assert.equal(d.riskGroup, 'OUT_OF_POLICY');
  assert.equal(d.deductibleTax, 0);
});
