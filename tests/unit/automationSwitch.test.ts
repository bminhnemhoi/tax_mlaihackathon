import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow, readRecord } from '../../services/workflowService';
import { automationState, setAutomationPaused } from '../../services/automationControl';
import { challengeCases, demoCompanyTaxCode } from '../../data/verification/challengeCases';

const accountant = { id: 'switch-accountant', role: 'ACCOUNTANT' as const, email: 'a@test', displayName: 'Kế toán viên' };
const chief = { id: 'switch-chief', role: 'CHIEF_ACCOUNTANT' as const, email: 'k@test', displayName: 'Kế toán trưởng' };

test('dừng tự động hóa: ca thường quy không được tự duyệt, chờ KTT, không ghi thuế; bật lại thì tự duyệt; mọi lần đổi có audit', async () => {
  await runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = demoCompanyTaxCode;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    assert.throws(() => setAutomationPaused(true, accountant, 'Kế toán viên thử dừng hệ thống'), /Kế toán trưởng hoặc CFO/);
    assert.throws(() => setAutomationPaused(true, chief, 'ngắn'), /8 ký tự/);
    setAutomationPaused(true, chief, 'Tạm dừng để rà soát cuối tháng');
    assert.equal(automationState().paused, true);
    const held = await evaluateWorkflow({ ...challengeCases[0].invoice, id: 'HELD', invoiceNumber: 'HELD' }, accountant, { forceLocalOnly: true });
    assert.equal(held.decision.status, 'ROUTINE');
    assert.equal(held.workflow.status, 'WAITING_CHIEF_ACCOUNTANT');
    assert.equal(readRecord('HELD').approved_deductible_tax, 0);
    setAutomationPaused(false, chief, 'Rà soát xong, bật lại tự động hóa');
    const auto = await evaluateWorkflow({ ...challengeCases[0].invoice, id: 'AUTO', invoiceNumber: 'AUTO' }, accountant, { forceLocalOnly: true });
    assert.equal(auto.workflow.status, 'APPROVED');
    const events = db.prepare("SELECT event_type FROM audit_events WHERE entity_id='system:auto-approve' ORDER BY rowid").all() as Array<{ event_type: string }>;
    assert.deepEqual(events.map(e => e.event_type), ['AUTOMATION_PAUSED', 'AUTOMATION_RESUMED']);
    const heldEvent = db.prepare("SELECT event_type FROM audit_events WHERE entity_id='HELD' AND event_type='ROUTINE_HELD_AUTOMATION_PAUSED'").get();
    assert.ok(heldEvent, 'ca bị giữ do công tắc có sự kiện audit riêng');
  });
});
