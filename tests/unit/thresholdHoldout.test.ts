import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { createPrecedent } from '../../services/precedentService';
import { submitFeedback, wilson95 } from '../../services/feedbackService';
import { challengeCases, demoCompanyTaxCode } from '../../data/verification/challengeCases';

const cfo = { id: 'holdout-cfo', role: 'CFO' as const, email: 'c@test', displayName: 'CFO' };
const importer = { id: 'holdout-importer', role: 'ACCOUNTANT' as const, email: 'i@test', displayName: 'Nhập liệu' };

async function learn(labels: Array<[number, boolean]>) {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = demoCompanyTaxCode;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const base = challengeCases[0].invoice;
    const precedent = createPrecedent({ supplierTaxCode: base.supplierTaxCode, supplierName: base.supplierName, riskPattern: 'INTERNAL_POLICY_GUEST_ENTERTAINMENT', sopClause: 'Quy chế tiếp khách', approvedOption: 'ACCEPT_ADJUSTMENT', rationale: 'CFO cho phép tiếp khách hợp lệ', approvedBy: 'CFO', purpose: 'tiếp khách', maximumAmount: 4_000_000, currentThreshold: 0 });
    let last: Record<string, unknown> = {};
    for (const [i, [amount, shouldEscalate]] of labels.entries()) {
      const invoice = { ...base, id: `HO-${i}`, invoiceNumber: `HO-${i}`, invoiceDate: new Date().toISOString().slice(0, 10), itemName: 'Chi tiếp khách rượu bia', preTaxAmount: amount / 1.1, taxAmount: amount - amount / 1.1, totalAmount: amount, paymentMethod: 'BANK_TRANSFER' as const };
      const r = await evaluateWorkflow(invoice, importer, { forceLocalOnly: true });
      last = submitFeedback({ precedentId: precedent.id, invoiceId: invoice.id, evaluationId: r.workflow.evaluationId, shouldEscalate, reason: 'Hậu kiểm chứng từ và mục đích chi' }, cfo) as Record<string, unknown>;
    }
    return last;
  });
}

test('ngưỡng học trên phản hồi cũ bị bác nếu bỏ sót ca cần dừng trong holdout mới nhất', async () => {
  const labels: Array<[number, boolean]> = [[1_100_000, false], [1_200_000, false], [1_300_000, false], [1_400_000, false], [1_600_000, false], [1_800_000, false], [2_000_000, false], [3_000_000, false], [1_500_000, true], [3_300_000, true]];
  const result = await learn(labels);
  assert.equal(result.status, 'REJECTED_BY_HOLDOUT');
  assert.equal(result.threshold, 0, 'giữ nguyên ngưỡng cũ');
  const evaluation = result.evaluation as { trainSize: number; holdoutSize: number; holdout: { candidate: { missed: number } } };
  assert.equal(evaluation.trainSize, 7);
  assert.equal(evaluation.holdoutSize, 3);
  assert.equal(evaluation.holdout.candidate.missed, 1);
});

test('ngưỡng được áp dụng khi holdout không bỏ sót và giảm chuyển tiếp thừa; báo cáo tỉ lệ kèm mẫu số', async () => {
  const labels: Array<[number, boolean]> = [[1_100_000, false], [1_200_000, false], [1_300_000, false], [1_400_000, false], [1_500_000, false], [3_200_000, true], [1_600_000, false], [1_700_000, false], [3_300_000, true], [3_400_000, true]];
  const result = await learn(labels);
  assert.equal(result.status, 'ADAPTED');
  assert.ok((result.threshold as number) < 3_200_000, 'không giải tỏa các ca CFO đã đánh dấu cần dừng');
  const evaluation = result.evaluation as { holdout: { candidate: { missed: number; positives: number; missRate: { rate: number } } } };
  assert.equal(evaluation.holdout.candidate.missed, 0);
  assert.ok(evaluation.holdout.candidate.positives > 0);
});

test('khoảng tin cậy Wilson trung thực với mẫu nhỏ', () => {
  const w = wilson95(0, 3);
  assert.equal(w.rate, 0);
  assert.ok((w.high as number) > 0.5, 'mẫu 3 ca không chứng minh được tỉ lệ bỏ sót thấp');
  assert.deepEqual(wilson95(0, 0), { rate: null, low: null, high: null });
});
