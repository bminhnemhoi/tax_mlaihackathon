/** Trùng hóa đơn khi cùng một số được ghi khác cách (XML "123", ảnh/người nhập "0000123", "0000-123", lẫn O/0). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { normalizeInvoiceNumber } from '../../services/duplicateDetector';
import type { RefereeDecision } from '../../lib/schemas';

test('chuẩn hóa số hóa đơn: bỏ số 0 đầu và ký tự phân cách, đọc O/I lẫn trong dãy số; số chữ-số hỗn hợp giữ nguyên', () => {
  for (const [raw, want] of [['0000123', '123'], ['123', '123'], [' 0000-123 ', '123'], ['12O3', '1203'], ['00I23', '123'], ['0', '0'], ['INV-001', 'INV001'], ['OIL', 'OIL']] as const)
    assert.equal(normalizeInvoiceNumber(raw), want, raw);
});

test('hóa đơn đã nhập số "123" rồi nhập lại "0000123" cùng bên bán, cùng ký hiệu → bị chặn trùng; khác ký hiệu thì không', async () => {
  await runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = '0102030405';
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const acc = { id: 'dup-accountant', role: 'ACCOUNTANT' as const, email: 'dup@test', displayName: 'Kiểm thử trùng' };
    const base = { invoiceDate: '2026-10-05', invoiceSeries: '1K26TAA', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Minh An', itemName: 'Giấy in A4',
      preTaxAmount: 2_000_000, taxRate: 10, taxAmount: 200_000, totalAmount: 2_200_000, paymentMethod: 'BANK_TRANSFER' };
    const first = (await evaluateWorkflow({ ...base, id: 'DUP-A', invoiceNumber: '123' }, acc, { forceLocalOnly: true })).decision as RefereeDecision;
    assert.equal(first.status, 'ROUTINE');
    const again = (await evaluateWorkflow({ ...base, id: 'DUP-B', invoiceNumber: '0000123' }, acc, { forceLocalOnly: true })).decision as RefereeDecision;
    assert.equal(again.status, 'ESCALATED');
    const f = again.findings?.find(x => x.ruleId === 'RULE_DUPLICATE_INVOICE');
    assert.ok(f, 'có phát hiện trùng');
    assert.match(f!.flaggedReason, /\[DUP-A\].*hồ sơ gốc ghi số "123"/);
    const otherSeries = (await evaluateWorkflow({ ...base, id: 'DUP-C', invoiceNumber: '0000123', invoiceSeries: '1K26TBB' }, acc, { forceLocalOnly: true })).decision as RefereeDecision;
    assert.ok(!otherSeries.findings?.some(x => x.ruleId === 'RULE_DUPLICATE_INVOICE'), 'khác ký hiệu là hóa đơn khác');
  });
});
