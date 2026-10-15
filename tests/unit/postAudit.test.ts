/** Hậu kiểm ngẫu nhiên ca máy tự duyệt (lấy mẫu kiểm toán) và tỉ lệ đồng thuận người–máy. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listAuditEventsForEntity } from '../../lib/server/audit';
import { evaluateWorkflow, readRecord, reviewPostAudit } from '../../services/workflowService';
import { listPostAudits, postAuditDraw, stratifiedRate } from '../../services/postAuditService';

const routine = (n: string) => ({ id: `PA-${n}`, invoiceNumber: n, invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Minh An',
  itemName: 'Phí chuyển phát tài liệu', preTaxAmount: 2_000_000, taxRate: 10, taxAmount: 200_000, totalAmount: 2_200_000, paymentMethod: 'BANK_TRANSFER' });
function setRate(rate: number) {
  const db = getDatabase(), policy = getActivePolicy();
  policy.config.postAuditRate = rate;
  db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
}

test('chọn mẫu tất định và đúng tỉ lệ: cùng hồ sơ cho cùng kết quả; khoảng 10% trên 4000 hồ sơ', () => {
  assert.equal(postAuditDraw('HD-1', 'abc'), postAuditDraw('HD-1', 'abc'));
  const n = 4000, hit = Array.from({ length: n }, (_, i) => postAuditDraw(`HD-${i}`, `hash-${i}`)).filter(x => x < 0.1).length;
  assert.ok(hit / n > 0.08 && hit / n < 0.12, `tỉ lệ ${hit / n}`);
});

test('lấy mẫu phân tầng: ca sát dưới ngưỡng được chọn với tỉ lệ gấp 3; có khóa audit thì kết quả chọn khác (không đoán trước được)', () => {
  assert.deepEqual(stratifiedRate(0.1, 4_600_000, [5_000_000, 20_000_000, 200_000_000]), { rate: 0.30000000000000004, nearThreshold: 5_000_000 });
  assert.deepEqual(stratifiedRate(0.1, 2_200_000, [5_000_000, 20_000_000, 200_000_000]), { rate: 0.1, nearThreshold: null });
  assert.equal(stratifiedRate(0.1, 195_000_000, [5_000_000, 20_000_000, 200_000_000]).nearThreshold, 200_000_000);
  const plain = postAuditDraw('HD-9', 'h');
  const saved = process.env.TAX_REFEREE_AUDIT_KEY;
  process.env.TAX_REFEREE_AUDIT_KEY = 'k'.repeat(40);
  try { assert.notEqual(postAuditDraw('HD-9', 'h'), plain); } finally { if (saved === undefined) delete process.env.TAX_REFEREE_AUDIT_KEY; else process.env.TAX_REFEREE_AUDIT_KEY = saved; }
});

test('ca tự duyệt được chọn hậu kiểm: vẫn duyệt, vào danh sách chờ, có sự kiện nhật ký; tỉ lệ 0 thì không chọn', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    setRate(1);
    await evaluateWorkflow(routine('0007101'), acc, { forceLocalOnly: true });
    assert.equal(readRecord('PA-0007101').status, 'APPROVED');
    const list = listPostAudits();
    assert.equal(list.stats.pending, 1);
    assert.ok(listAuditEventsForEntity('PA-0007101').some(e => e.eventType === 'POST_AUDIT_SAMPLED'));
    setRate(0);
    await evaluateWorkflow(routine('0007102'), acc, { forceLocalOnly: true });
    assert.equal(listPostAudits().stats.sampled, 1);
  });
});

test('hậu kiểm: kế toán viên/người nhập không được làm; đồng ý tính vào tỉ lệ đồng thuận; không đồng ý thì giữ thuế', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    setRate(1);
    await evaluateWorkflow(routine('0007201'), acc, { forceLocalOnly: true });
    await evaluateWorkflow(routine('0007202'), acc, { forceLocalOnly: true });
    assert.throws(() => reviewPostAudit('PA-0007201', acc, { result: 'CONFIRMED', reason: 'Kế toán viên tự xem lại' }), /Kế toán trưởng hoặc CFO/);
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    reviewPostAudit('PA-0007201', ktt, { result: 'CONFIRMED', reason: 'Đúng phí chuyển phát, có UNC' });
    assert.throws(() => reviewPostAudit('PA-0007201', ktt, { result: 'CONFIRMED', reason: 'Hậu kiểm lần hai' }), /đã được hậu kiểm/);
    reviewPostAudit('PA-0007202', ktt, { result: 'DISAGREE', reason: 'Chưa có hợp đồng chuyển phát' });
    const held = readRecord('PA-0007202');
    assert.equal(held.status, 'ON_HOLD');
    assert.equal(held.approved_deductible_tax, 0);
    const { stats } = listPostAudits();
    assert.equal(stats.reviewed, 2); assert.equal(stats.agreed, 1); assert.equal(stats.disagreed, 1);
    assert.ok(stats.agreement.low !== null && stats.agreement.high !== null && stats.agreement.low < 0.5 && stats.agreement.high > 0.5);
  });
});
