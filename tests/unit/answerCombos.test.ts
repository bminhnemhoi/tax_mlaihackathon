import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listAuditEventsForEntity } from '../../lib/server/audit';
import { seedDemoCases } from '../../services/demoSeed';
import { answerHandoff, evaluateWorkflow, readRecord } from '../../services/workflowService';

type Spec = { items: Array<{ n: number }> };
const combos = (n: number): Array<Record<string, 'A' | 'B'>> =>
  Array.from({ length: 2 ** n }, (_, mask) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), (mask >> i) & 1 ? 'B' : 'A'])));

test('"trả lời một lần": mọi tổ hợp A/B trên 3 ca mẫu chuyển tiếp đều kết thúc hoặc chuyển sang câu hỏi khác, không hỏi lại câu cũ', async () => {
  for (const id of ['MAU-0009002', 'MAU-0009003', 'MAU-0009004']) {
    const n = await runIsolated(async () => {
      switchRole('ACCOUNTANT'); await seedDemoCases();
      return (JSON.parse(readRecord(id).decision_json!).handoff.questionSpec as Spec).items.length;
    });
    for (const answers of combos(n)) {
      await runIsolated(async () => {
        switchRole('ACCOUNTANT'); await seedDemoCases();
        const before = readRecord(id), question = JSON.parse(before.decision_json!).actionableQuestion;
        const user = switchRole(JSON.parse(before.decision_json!).requiresCFO ? 'CFO' : 'CHIEF_ACCOUNTANT')!.user;
        const result = await answerHandoff(id, user, { answers, reason: 'Kiểm thử tổ hợp đáp án', revision: before.revision, evaluationId: before.evaluation_id });
        const after = readRecord(id), label = `${id} ${JSON.stringify(answers)} → ${result.outcome}/${after.status}`;
        if (['WAITING_CHIEF_ACCOUNTANT', 'WAITING_CFO', 'FORWARDED'].includes(after.status))
          assert.notEqual(JSON.parse(after.decision_json!).actionableQuestion, question, `${label}: hỏi lại đúng câu vừa trả lời`);
        else assert.ok(['APPROVED', 'REJECTED', 'ON_HOLD'].includes(after.status), label);
        assert.equal(listAuditEventsForEntity(id).filter(e => e.eventType === 'HANDOFF_ANSWERED').length, 1, `${label}: ghi đúng 1 sự kiện trả lời`);
      });
    }
  }
});

test('trả lời B "tiền mặt → không được khấu trừ" kết thúc bằng từ chối khấu trừ; câu trả lời thiếu giá trị không để lại dấu "đã trả lời"', async () => {
  await runIsolated(async () => {
    switchRole('ACCOUNTANT'); await seedDemoCases();
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    const rec = readRecord('MAU-0009002');
    const r = await answerHandoff('MAU-0009002', ktt, { answers: { '1': 'B' }, reason: 'Đã trả tiền mặt cho NCC', revision: rec.revision, evaluationId: rec.evaluation_id });
    assert.equal(r.outcome, 'REJECTED');
    assert.equal(readRecord('MAU-0009002').status, 'REJECTED');
  });
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    await evaluateWorkflow({ id: 'ADJ-1', invoiceNumber: '0000777', invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'NCC thử', itemName: 'Điều chỉnh giảm giá', preTaxAmount: 1_000_000, taxRate: 10, taxAmount: 100_000, totalAmount: 1_100_000, paymentMethod: 'BANK_TRANSFER', isAdjustment: true }, acc, { forceLocalOnly: true });
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    const rec = readRecord('ADJ-1');
    const n = JSON.parse(rec.decision_json!).handoff.questionSpec.items.length as number;
    const answers = Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 'A' as const]));
    await assert.rejects(answerHandoff('ADJ-1', ktt, { answers, reason: 'Thiếu số hóa đơn gốc', revision: rec.revision, evaluationId: rec.evaluation_id }), /cần nhập/);
    assert.equal(listAuditEventsForEntity('ADJ-1').filter(e => e.eventType === 'HANDOFF_ANSWERED').length, 0);
  });
});

test('không "rửa" được ca chờ CFO: Kế toán viên gửi lại cùng mã với số tiền thấp hơn thì phải chờ KTT xác nhận, không tự duyệt', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    const base = { id: 'LAUNDER-1', invoiceNumber: '0007001', invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'NCC thử', itemName: 'Máy chủ', taxRate: 10, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true, sellerStatus: 'ACTIVE' };
    await evaluateWorkflow({ ...base, preTaxAmount: 300_000_000, taxAmount: 30_000_000, totalAmount: 330_000_000 }, acc, { forceLocalOnly: true });
    assert.equal(readRecord('LAUNDER-1').status, 'WAITING_CFO');
    await evaluateWorkflow({ ...base, preTaxAmount: 15_000_000, taxAmount: 1_500_000, totalAmount: 16_500_000 }, acc, { forceLocalOnly: true, expectedRevision: readRecord('LAUNDER-1').revision });
    const after = readRecord('LAUNDER-1');
    assert.notEqual(after.status, 'APPROVED');
    assert.ok(JSON.parse(after.source_review_json || '{}').postEscalationEdits.includes('totalAmount'));
  });
});
