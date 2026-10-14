/**
 * Kiểm thử cho các lỗi được đợt rà soát phản biện xác nhận (15/10): trả lời "1A, 2B" ngay trên hồ sơ, không lộ
 * "undefined" (lỗi 500), công tắc dừng không làm kẹt ca thường quy, so chứng từ gốc không bị lách, quy tắc từ khóa.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { answerHandoff, applyWorkflowAction, evaluateWorkflow, readRecord, releaseHeldRoutineCases } from '../../services/workflowService';
import { checkHandoff } from '../../services/handoffService';
import { setAutomationPaused } from '../../services/automationControl';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { demoCompanyTaxCode } from '../../data/verification/challengeCases';

const accountant = { id: 'rf-accountant', role: 'ACCOUNTANT' as const, email: 'a@t', displayName: 'Kế toán viên' };
const chief = { id: 'rf-chief', role: 'CHIEF_ACCOUNTANT' as const, email: 'k@t', displayName: 'Kế toán trưởng' };
const cfo = { id: 'rf-cfo', role: 'CFO' as const, email: 'c@t', displayName: 'CFO' };
const base = { invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Dịch vụ Minh An' };

async function inSandbox<T>(fn: () => Promise<T>): Promise<T> {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = demoCompanyTaxCode;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    return fn();
  });
}
const answer = (id: string, user: typeof chief | typeof cfo, answers: Record<string, 'A' | 'B'>, values?: Record<string, string>) => {
  const row = readRecord(id);
  return answerHandoff(id, user, { answers, values, reason: 'Đã đối chiếu chứng từ gốc và hợp đồng', revision: row.revision, evaluationId: row.evaluation_id });
};

test('trả lời 1 câu: UPS 12.100.000₫ thiếu hình thức thanh toán — A (chuyển khoản có UNC) → đánh giá lại và tự hoàn tất', async () => {
  await inSandbox(async () => {
    await evaluateWorkflow({ ...base, id: 'UPS', invoiceNumber: 'UPS', itemName: 'Bộ lưu điện UPS', preTaxAmount: 11_000_000, taxRate: 10, taxAmount: 1_100_000, totalAmount: 12_100_000 }, accountant, { forceLocalOnly: true });
    const result = await answer('UPS', chief, { '1': 'A' });
    assert.equal(result.outcome, 'RE_EVALUATED_ROUTINE');
    assert.equal(readRecord('UPS').status, 'APPROVED');
    assert.ok((getDatabase().prepare("SELECT COUNT(*) n FROM audit_events WHERE entity_id='UPS' AND event_type='HANDOFF_ANSWERED'").get() as { n: number }).n === 1);
  });
});

test('trả lời B (tiền mặt) cho ca ≥ 5 triệu → đánh giá lại thành Ngoài quy định, có câu hỏi mới', async () => {
  await inSandbox(async () => {
    await evaluateWorkflow({ ...base, id: 'UPS-CASH', invoiceNumber: 'UPS-CASH', itemName: 'Bộ lưu điện UPS', preTaxAmount: 11_000_000, taxRate: 10, taxAmount: 1_100_000, totalAmount: 12_100_000 }, accountant, { forceLocalOnly: true });
    const result = await answer('UPS-CASH', chief, { '1': 'B' });
    assert.equal(result.outcome, 'RE_EVALUATED_ESCALATED');
    const decision = JSON.parse(readRecord('UPS-CASH').decision_json!);
    assert.equal(decision.riskGroup, 'OUT_OF_POLICY');
  });
});

test('laptop 330 triệu thiếu trạng thái MST: CFO trả lời "1A, 2A" một lần → duyệt; KTT và người nhập không được trả lời', async () => {
  await inSandbox(async () => {
    await evaluateWorkflow({ ...base, id: 'LAPTOP', invoiceNumber: 'LAPTOP', itemName: '10 laptop Dell Latitude', preTaxAmount: 300_000_000, taxRate: 10, taxAmount: 30_000_000, totalAmount: 330_000_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }, accountant, { forceLocalOnly: true });
    await assert.rejects(answer('LAPTOP', chief, { '1': 'A', '2': 'A' }), /CFO/);
    const result = await answer('LAPTOP', cfo, { '1': 'A', '2': 'A' });
    assert.equal(result.outcome, 'APPROVED');
    assert.equal(readRecord('LAPTOP').status, 'APPROVED');
    assert.equal(readRecord('LAPTOP').approved_deductible_tax, 30_000_000);
  });
  await inSandbox(async () => {
    await evaluateWorkflow({ ...base, id: 'SELF', invoiceNumber: 'SELF', itemName: 'Tiếp khách đối tác - rượu vang', preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER' }, chief, { forceLocalOnly: true });
    await assert.rejects(answer('SELF', chief, { '1': 'A' }), /tự trả lời/);
  });
});

test('rượu vang tiếp khách: trả lời B (chi cá nhân) → từ chối khấu trừ', async () => {
  await inSandbox(async () => {
    await evaluateWorkflow({ ...base, id: 'WINE', invoiceNumber: 'WINE', itemName: 'Tiếp khách đối tác - rượu vang', preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER', hasItemManifest: true }, accountant, { forceLocalOnly: true });
    const result = await answer('WINE', chief, { '1': 'B' });
    assert.equal(result.outcome, 'REJECTED');
    assert.equal(readRecord('WINE').status, 'REJECTED');
  });
});

test('không lộ "undefined" / lỗi 500: điều chỉnh thiếu hóa đơn gốc và bên bán đóng MST thiếu ngày đóng; nhập giá trị để trả lời', async () => {
  await inSandbox(async () => {
    const adj = await evaluateWorkflow({ ...base, id: 'ADJ', invoiceNumber: 'ADJ', itemName: 'Điều chỉnh giảm giá', preTaxAmount: 1_000_000, taxRate: 10, taxAmount: 100_000, totalAmount: 1_100_000, isAdjustment: true }, accountant, { forceLocalOnly: true });
    assert.equal(adj.decision.status, 'ESCALATED');
    assert.deepEqual(checkHandoff(adj.decision).errors, []);
    assert.doesNotMatch(adj.decision.actionableQuestion, /undefined/);
    assert.equal(adj.decision.handoff?.questionSpec?.items.length, 1, 'không hỏi trùng hóa đơn gốc hai lần');
    const closed = await evaluateWorkflow({ ...base, id: 'CLOSED', invoiceNumber: 'CLOSED', itemName: 'Văn phòng phẩm', preTaxAmount: 1_000_000, taxRate: 10, taxAmount: 100_000, totalAmount: 1_100_000, sellerStatus: 'CLOSED' }, accountant, { forceLocalOnly: true });
    assert.deepEqual(checkHandoff(closed.decision).errors, []);
    await assert.rejects(answer('ADJ', chief, { '1': 'A' }), /cần nhập/);
    const filled = await answer('ADJ', chief, { '1': 'A' }, { originalInvoiceRef: '0000123' });
    assert.equal(filled.outcome, 'RE_EVALUATED_ROUTINE');
  });
  // Tên hàng chứa chữ "true" không bị coi là lộ giá trị kỹ thuật.
  await inSandbox(async () => {
    const milk = await evaluateWorkflow({ ...base, id: 'MILK', invoiceNumber: 'MILK', itemName: 'Sữa TH true MILK cho khách', preTaxAmount: 300_000_000, taxRate: 10, taxAmount: 30_000_000, totalAmount: 330_000_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true, sellerStatus: 'ACTIVE' }, accountant, { forceLocalOnly: true });
    assert.equal(milk.decision.status, 'ESCALATED');
  });
});

test('công tắc dừng: ca thường quy bị giữ được duyệt tay; bật lại thì ca đang giữ tự hoàn tất', async () => {
  await inSandbox(async () => {
    setAutomationPaused(true, chief, 'Rà soát cuối tháng');
    const routine = { ...base, itemName: 'Văn phòng phẩm', preTaxAmount: 1_000_000, taxRate: 10 as const, taxAmount: 100_000, totalAmount: 1_100_000 };
    await evaluateWorkflow({ ...routine, id: 'H1', invoiceNumber: 'H1' }, accountant, { forceLocalOnly: true });
    await evaluateWorkflow({ ...routine, id: 'H2', invoiceNumber: 'H2' }, accountant, { forceLocalOnly: true });
    assert.equal(readRecord('H1').status, 'WAITING_CHIEF_ACCOUNTANT');
    const row = readRecord('H1');
    applyWorkflowAction('H1', chief, { action: 'OVERRIDE', targetStatus: 'APPROVED', reason: 'Duyệt tay khi tự động hóa dừng', revision: row.revision, evaluationId: row.evaluation_id });
    assert.equal(readRecord('H1').status, 'APPROVED');
    setAutomationPaused(false, chief, 'Rà soát xong, bật lại');
    assert.equal(releaseHeldRoutineCases(chief), 1);
    assert.equal(readRecord('H2').status, 'APPROVED');
    assert.equal(readRecord('H2').approved_deductible_tax, 100_000);
  });
});

test('số tiền gõ dạng chuỗi được hiểu đúng thay vì lỗi 400', async () => {
  await inSandbox(async () => {
    const r = await evaluateWorkflow({ ...base, id: 'STR', invoiceNumber: 'STR', itemName: 'In danh thiếp', preTaxAmount: '1.000.000', taxRate: '8%', taxAmount: '80000', totalAmount: '1080000' }, accountant, { forceLocalOnly: true });
    assert.equal(r.decision.status, 'ROUTINE');
  });
});

test('từ khóa: mũ bảo hiểm / máy lạnh di động 8% không bị coi là nhóm loại trừ; thuốc lá trong ngoặc và chữ Việt dạng tổ hợp vẫn bị bắt', async () => {
  await inSandbox(async () => {
    const config = getActivePolicy().config;
    const inv = (itemName: string, extra: Record<string, unknown> = {}) => ({ ...base, id: itemName, invoiceNumber: 'K1', itemName, preTaxAmount: 1_000_000, taxRate: 8 as const, taxAmount: 80_000, totalAmount: 1_080_000, paymentMethod: 'BANK_TRANSFER' as const, sellerStatus: 'ACTIVE' as const, buyerTaxCode: demoCompanyTaxCode, ...extra });
    assert.equal(evaluateInvoiceLocally(inv('Mũ bảo hiểm cho nhân viên giao hàng'), config).status, 'ROUTINE');
    assert.equal(evaluateInvoiceLocally(inv('Máy lạnh di động phòng kho'), config).status, 'ROUTINE');
    assert.equal(evaluateInvoiceLocally(inv('Cước điện thoại di động tháng 9'), config).status, 'ESCALATED');
    const tobacco = evaluateInvoiceLocally(inv('Quà khách (thuốc lá)', { taxRate: 10, taxAmount: 100_000, totalAmount: 1_100_000 }), config);
    assert.ok(tobacco.status === 'ESCALATED' && tobacco.findings?.some(f => f.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT'));
    const nfd = evaluateInvoiceLocally(inv('Rượu vang tiếp khách'.normalize('NFD'), { taxRate: 10, taxAmount: 100_000, totalAmount: 1_100_000 }), config);
    assert.equal(nfd.status === 'ESCALATED' && nfd.riskGroup, 'OUT_OF_POLICY');
  });
});

test('tách tiền mặt nhân viên ứng thành 2 hóa đơn cùng ngày không lách được quy tắc 5 triệu', async () => {
  await inSandbox(async () => {
    const half = { ...base, itemName: 'Thiết bị văn phòng', preTaxAmount: 3_000_000, taxRate: 10 as const, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'CASH' as const, isStaffReimbursed: true, hasBankSlip: true };
    await evaluateWorkflow({ ...half, id: 'S1', invoiceNumber: 'S1' }, accountant, { forceLocalOnly: true });
    const second = await evaluateWorkflow({ ...half, id: 'S2', invoiceNumber: 'S2' }, accountant, { forceLocalOnly: true });
    assert.equal(second.decision.status, 'ESCALATED');
  });
});
