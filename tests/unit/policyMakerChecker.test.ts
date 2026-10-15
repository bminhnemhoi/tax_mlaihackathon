/** Nguyên tắc bốn mắt khi công bố policy (COSO — tách bạch nhiệm vụ): nới lỏng kiểm soát cần CFO khác người soạn. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listAuditEventsForEntity } from '../../lib/server/audit';
import { createPolicyDraft, listPendingDrafts, policyLoosening, PolicyApprovalError, publishPolicy, rollbackPolicy } from '../../services/policyService';

test('nhận diện nới lỏng: tăng ngưỡng/hạn mức, giảm hậu kiểm, tắt kiểm tra chặt, bỏ nhóm loại trừ; siết lại thì không tính', async () => {
  await runIsolated(async () => {
    const base = getActivePolicy().config;
    assert.deepEqual(policyLoosening(base, { ...base }), []);
    const looser = policyLoosening(base, { ...base, kttApprovalLimit: base.kttApprovalLimit * 2, postAuditRate: 0.02, strictMccqtCheck: false, excludedVat8Categories: base.excludedVat8Categories.slice(1) });
    assert.equal(looser.length, 4, looser.join(' | '));
    assert.ok(looser[0].startsWith('Tăng hạn mức Kế toán trưởng'));
    assert.deepEqual(policyLoosening(base, { ...base, postAuditRate: 0.3, kttApprovalLimit: base.kttApprovalLimit / 2 }), []);
    assert.deepEqual(policyLoosening(base, base, [{ invoiceId: 'X', before: 'ESCALATED:EXCEED_AUTHORITY', after: 'ROUTINE:', beforeRole: 'CFO', afterRole: 'SYSTEM', beforeRules: [], afterRules: [] }]), ['1 hồ sơ đang lưu chuyển từ "chuyển người" sang "tự duyệt"']);
  });
});

test('bản nháp nới lỏng: Kế toán trưởng không công bố được, CFO tự soạn cũng không; CFO khác người soạn thì được và nhật ký ghi đủ hai người', async () => {
  await runIsolated(async () => {
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user, cfo = switchRole('CFO')!.user;
    const base = getActivePolicy();
    const draft = createPolicyDraft({ config: { ...base.config, kttApprovalLimit: 300_000_000 }, version: 'MC-LOOSER' }, ktt.id);
    assert.throws(() => publishPolicy(draft.version, ktt.id, 'tự duyệt', ktt.role), (e: unknown) => e instanceof PolicyApprovalError && /cần CFO duyệt/.test(e.message));
    assert.equal(getActivePolicy().version, base.version);
    assert.deepEqual(listPendingDrafts().find(d => d.version === 'MC-LOOSER')?.loosening, ['Tăng hạn mức Kế toán trưởng 200.000.000₫ → 300.000.000₫']);
    const own = createPolicyDraft({ config: { ...base.config, kttApprovalLimit: 300_000_000 }, version: 'MC-LOOSER-CFO' }, cfo.id);
    assert.throws(() => publishPolicy(own.version, cfo.id, 'tự duyệt', cfo.role), /người soạn bản nháp không được tự công bố/);
    publishPolicy(draft.version, cfo.id, 'CFO duyệt nâng hạn mức theo quyết định HĐQT', cfo.role);
    assert.equal(getActivePolicy().version, 'MC-LOOSER');
    const event = listAuditEventsForEntity('MC-LOOSER').find(e => e.eventType === 'POLICY_PUBLISHED')!;
    const seg = (event.payload as { segregation: { createdBy: string; approvedBy: string; secondApproverRequired: boolean } }).segregation;
    assert.deepEqual([seg.createdBy, seg.approvedBy, seg.secondApproverRequired], [ktt.id, cfo.id, true]);
  });
});

test('bản nháp chặt hơn: người soạn tự công bố được; không "rollback" một bản nháp để lách bước duyệt', async () => {
  await runIsolated(async () => {
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    const base = getActivePolicy();
    const stricter = createPolicyDraft({ config: { ...base.config, postAuditRate: 0.25 }, version: 'MC-STRICTER' }, ktt.id);
    publishPolicy(stricter.version, ktt.id, 'Tăng hậu kiểm cuối quý', ktt.role);
    assert.equal(getActivePolicy().version, 'MC-STRICTER');
    const looser = createPolicyDraft({ config: { ...base.config, postAuditRate: 0 }, version: 'MC-BYPASS' }, ktt.id);
    assert.throws(() => rollbackPolicy(looser.version, ktt.id, 'lách'), /đã từng công bố/);
    rollbackPolicy(base.version, ktt.id, 'Quay lại bản chuẩn');
    assert.equal(getActivePolicy().version, base.version);
  });
});
