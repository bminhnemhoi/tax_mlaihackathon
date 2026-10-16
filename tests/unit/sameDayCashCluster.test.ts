/** Cụm tiền mặt cùng ngày vượt ngưỡng: hóa đơn tiền mặt đã tự duyệt trước đó cũng phải giữ thuế (không để lọt khấu trừ). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listAuditEventsForEntity } from '../../lib/server/audit';
import { evaluateWorkflow, readRecord } from '../../services/workflowService';

const cash = (n: string, pay: 'CASH' | 'BANK_TRANSFER' = 'CASH') => ({ id: `CC-${n}`, invoiceNumber: n, invoiceDate: '2026-10-06', supplierTaxCode: '0312345678',
  supplierName: 'Cửa hàng Văn phòng phẩm Minh An', itemName: 'Văn phòng phẩm', preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: pay });

test('hai hóa đơn tiền mặt 3,3 triệu cùng bên bán, cùng ngày: hóa đơn sau chuyển tiếp, hóa đơn trước đã tự duyệt bị giữ thuế', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    await evaluateWorkflow(cash('0006101'), acc, { forceLocalOnly: true });
    assert.equal(readRecord('CC-0006101').status, 'APPROVED');
    const second = await evaluateWorkflow(cash('0006102'), acc, { forceLocalOnly: true });
    assert.equal(second.decision.status, 'ESCALATED');
    assert.ok(second.decision.findings.some((f: { ruleId: string }) => f.ruleId === 'STATUTORY_SAME_DAY_CASH_5M'));
    const first = readRecord('CC-0006101');
    assert.equal(first.status, 'ON_HOLD');
    assert.equal(first.approved_deductible_tax, 0);
    assert.ok(listAuditEventsForEntity('CC-0006101').some(e => e.eventType === 'LINKED_CASH_HOLD'));
  });
});

test('hóa đơn chuyển khoản cùng ngày không bị giữ thuế theo cụm tiền mặt', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    await evaluateWorkflow(cash('0006201', 'BANK_TRANSFER'), acc, { forceLocalOnly: true });
    await evaluateWorkflow(cash('0006202'), acc, { forceLocalOnly: true });
    await evaluateWorkflow(cash('0006203'), acc, { forceLocalOnly: true });
    assert.equal(readRecord('CC-0006201').status, 'APPROVED');
  });
});

test('không phụ thuộc thứ tự: hóa đơn tiền mặt đã tự duyệt bị giữ thuế khi hóa đơn chuyển khoản sau làm cụm vượt ngưỡng', async () => {
  await runIsolated(async () => {
    const acc = switchRole('ACCOUNTANT')!.user;
    await evaluateWorkflow(cash('0006301'), acc, { forceLocalOnly: true });
    assert.equal(readRecord('CC-0006301').status, 'APPROVED');
    await evaluateWorkflow({ ...cash('0006302', 'BANK_TRANSFER'), hasBankSlip: true }, acc, { forceLocalOnly: true });
    assert.equal(readRecord('CC-0006302').status, 'APPROVED', 'hóa đơn chuyển khoản có UNC vẫn khấu trừ được');
    assert.equal(readRecord('CC-0006301').status, 'ON_HOLD', 'hóa đơn tiền mặt trong cụm mất điều kiện khấu trừ');
  });
});
