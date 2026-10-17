/**
 * Xử lý theo lô có kiểm soát: máy quyết từng hóa đơn, người chốt lô trước khi ghi sổ; duyệt nhóm đi qua đúng
 * kiểm soát của từng hóa đơn; phiếu giải trình nói đúng lý do duyệt hoặc dừng.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainDecision } from '../../lib/explainDecision';
import { getActivePolicy, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listAuditEventsForEntity } from '../../lib/server/audit';
import type { InvoiceInput } from '../../lib/schemas';
import { answerGroup, attachToBatch, createBatch, getBatch, signOffBatch } from '../../services/batchService';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { answerHandoff, evaluateWorkflow, readRecord } from '../../services/workflowService';

const base = { invoiceDate: '2026-10-05', supplierTaxCode: '0316789013', supplierName: 'Công ty TNHH Văn Phòng Xanh', isImageBlurry: false, isAdjustment: false, sellerStatus: 'UNKNOWN' as const };
const water = (n: string): InvoiceInput => ({ ...base, id: `NUOC-${n}`, invoiceNumber: n, itemName: 'Nước uống đóng bình 20L', preTaxAmount: 500_000, taxRate: 8, taxAmount: 40_000, totalAmount: 540_000 });
// Mỗi hóa đơn rượu một nhà hàng khác nhau: cùng người bán cùng ngày sẽ cộng dồn thành cụm và bị hỏi thêm chứng từ (câu hỏi khác).
const wine = (n: string): InvoiceInput => ({ ...base, id: `RUOU-${n}`, invoiceNumber: n, supplierTaxCode: `03198${n.slice(-5)}`, supplierName: `Nhà hàng Sen Vàng ${n.slice(-2)}`, itemName: 'Tiếp khách đối tác - rượu vang', preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER' });
const laptop = (n: string): InvoiceInput => ({ ...base, id: `LAP-${n}`, invoiceNumber: n, itemName: '10 laptop Dell Latitude', preTaxAmount: 300_000_000, taxRate: 10, taxAmount: 30_000_000, totalAmount: 330_000_000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true, sellerStatus: 'ACTIVE' });

test('phiếu giải trình: ca thường quy liệt kê điều kiện đã đạt (không điều kiện nào trượt); ca dừng tô đúng quy tắc và trường', () => {
  const config = { kttApprovalLimit: 200_000_000 };
  const ok = water('0000001');
  const okExplain = explainDecision(ok, evaluateInvoiceLocally(ok, config), config);
  assert.equal(okExplain.verdict, 'APPROVED');
  assert.ok(okExplain.checks.every(c => c.ok !== false), JSON.stringify(okExplain.checks.filter(c => c.ok === false)));
  assert.match(okExplain.checks.find(c => c.key === 'payment')!.detail, /dưới ngưỡng 5\.000\.000₫/);
  const stop = wine('0000002');
  const stopExplain = explainDecision(stop, evaluateInvoiceLocally(stop, config), config);
  assert.equal(stopExplain.verdict, 'STOPPED');
  assert.ok(stopExplain.highlights.some(h => h.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT' && h.groupLabel.length > 0));
  assert.equal(stopExplain.checks.find(c => c.key === 'scope')!.ok, false);
  assert.equal(stopExplain.vatAtStake, 300_000);
});

test('lô: phân đúng máy đề xuất duyệt / cần người; nhóm cùng câu hỏi; gắn trùng file không tạo bản trùng', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    const batch = createBatch(acc, { label: 'Lô thử', source: 'UPLOAD' });
    for (const inv of [water('0000011'), water('0000012'), wine('0000013'), wine('0000014')]) {
      await evaluateWorkflow(inv, acc, { forceLocalOnly: true });
      attachToBatch(acc, batch.id, { invoiceId: inv.id, fileName: `${inv.invoiceNumber}.xml`, fileSha256: `sha-${inv.invoiceNumber}` });
    }
    assert.deepEqual(attachToBatch(acc, batch.id, { invoiceId: 'NUOC-0000011', fileSha256: 'sha-0000011' }), { position: 1, duplicate: true });
    const view = getBatch(batch.id, acc);
    assert.equal(view.summary.total, 4);
    assert.equal(view.summary.MACHINE_APPROVED, 2);
    assert.equal(view.summary.NEEDS_HUMAN, 2);
    assert.equal(view.groups.length, 1);
    assert.deepEqual(view.groups[0].invoiceIds.sort(), ['RUOU-0000013', 'RUOU-0000014']);
    assert.equal(view.canSignOff, false, 'kế toán viên không chốt được lô');
  });
});

test('duyệt nhóm: kế toán viên bị chặn; KTT trả lời một lần cho cả nhóm, mỗi hóa đơn một sự kiện nhật ký riêng', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    const batch = createBatch(acc, { label: 'Lô tiếp khách' });
    for (const inv of [wine('0000021'), wine('0000022'), water('0000023')]) {
      await evaluateWorkflow(inv, acc, { forceLocalOnly: true });
      attachToBatch(acc, batch.id, { invoiceId: inv.id });
    }
    await assert.rejects(answerGroup(batch.id, acc, { invoiceIds: ['RUOU-0000021', 'RUOU-0000022'], answers: { '1': 'A', '2': 'A' }, reason: 'Tiếp khách theo quy chế' }), /Kế toán trưởng hoặc CFO/);
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    await assert.rejects(answerGroup(batch.id, ktt, { invoiceIds: ['RUOU-0000021', 'NUOC-0000023'], answers: { '1': 'A' }, reason: 'Trộn nhóm khác câu hỏi' }), /cùng câu hỏi/);
    const results = await answerGroup(batch.id, ktt, { invoiceIds: ['RUOU-0000021', 'RUOU-0000022'], answers: { '1': 'A', '2': 'A' }, reason: 'Tiếp khách đối tác theo quy chế, đã có bảng kê' });
    assert.ok(results.every(r => r.ok), JSON.stringify(results));
    for (const id of ['RUOU-0000021', 'RUOU-0000022']) {
      assert.equal(readRecord(id).status, 'APPROVED');
      assert.equal(listAuditEventsForEntity(id).filter(e => e.eventType === 'HANDOFF_ANSWERED').length, 1);
    }
    assert.equal(getBatch(batch.id, ktt).summary.HUMAN_APPROVED, 2);
  });
});

test('chốt lô: người tạo không tự chốt; lô có ca từ hạn mức CFO thì KTT không chốt được; chốt rồi không chốt lại; ghi nhật ký từng hóa đơn', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    const batch = createBatch(acc, { label: 'Lô cuối tháng' });
    for (const inv of [water('0000031'), laptop('0000032')]) {
      await evaluateWorkflow(inv, acc, { forceLocalOnly: true });
      attachToBatch(acc, batch.id, { invoiceId: inv.id });
    }
    const cfo = switchRole('CFO')!.user;
    const rec = readRecord('LAP-0000032');
    const spec = JSON.parse(rec.decision_json!).handoff.questionSpec as { items: unknown[] };
    await answerHandoff('LAP-0000032', cfo, { answers: Object.fromEntries(spec.items.map((_, i) => [String(i + 1), 'A'])), reason: 'CFO phê duyệt mua laptop theo hợp đồng', revision: rec.revision, evaluationId: rec.evaluation_id });
    assert.equal(readRecord('LAP-0000032').status, 'APPROVED');
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    assert.throws(() => signOffBatch(batch.id, ktt, 'Chốt lô cuối tháng 10'), /cần CFO chốt/);
    assert.throws(() => signOffBatch(batch.id, cfo, 'ngắn'), /ít nhất 8 ký tự/);
    const done = signOffBatch(batch.id, cfo, 'Chốt lô cuối tháng 10, đã xem mẫu hậu kiểm');
    assert.equal(done.postedInvoices, 2);
    assert.equal(done.vat, 30_040_000);
    assert.throws(() => signOffBatch(batch.id, cfo, 'Chốt lại lần hai cho chắc'), /đã được chốt/);
    assert.equal(listAuditEventsForEntity('NUOC-0000031').filter(e => e.eventType === 'INVOICE_POSTED_BY_BATCH').length, 1);
    const own = createBatch(ktt, { label: 'Lô KTT tự tạo' });
    await evaluateWorkflow(water('0000033'), acc, { forceLocalOnly: true });
    attachToBatch(ktt, own.id, { invoiceId: 'NUOC-0000033' });
    assert.throws(() => signOffBatch(own.id, ktt, 'Tự chốt lô của mình'), /bất kiêm nhiệm/);
    void getActivePolicy;
  });
});
