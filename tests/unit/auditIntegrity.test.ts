import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDatabase, runIsolated } from '../../lib/server/db';
import { appendAuditEvent, auditHead, verifyAuditChain } from '../../lib/server/audit';

test('nhật ký kiểm toán chỉ ghi thêm: UPDATE/DELETE bị database từ chối', async () => {
  await runIsolated(async () => {
    const event = appendAuditEvent({ eventType: 'TEST_EVENT', entityId: 'AUDIT-1', payload: { reason: 'Kiểm thử chỉ ghi thêm' } });
    const db = getDatabase();
    assert.throws(() => db.prepare("UPDATE audit_events SET payload_json='{}' WHERE id=?").run(event.id), /chỉ được ghi thêm/);
    assert.throws(() => db.prepare('DELETE FROM audit_events WHERE id=?').run(event.id), /chỉ được ghi thêm/);
    assert.equal(verifyAuditChain().valid, true);
  });
});

test('có khóa HMAC: tính lại toàn bộ chuỗi hash mà không có khóa vẫn bị phát hiện', async () => {
  const saved = process.env.TAX_REFEREE_AUDIT_KEY;
  process.env.TAX_REFEREE_AUDIT_KEY = 'k'.repeat(40);
  try {
    await runIsolated(async () => {
      for (let i = 0; i < 3; i++) appendAuditEvent({ eventType: 'TEST_EVENT', entityId: `AUDIT-${i}`, payload: { i } });
      const ok = verifyAuditChain();
      assert.equal(ok.valid, true);
      assert.equal(ok.keyed, true);
      assert.equal(ok.macVerified, 3);
      assert.equal(auditHead().count, 3);
      // Kẻ gian có quyền ghi file: gỡ trigger, sửa payload rồi tính lại hash cho cả chuỗi — nhưng không có khóa HMAC.
      const db = getDatabase();
      db.exec('DROP TRIGGER audit_events_no_update');
      const crypto = require('node:crypto') as typeof import('node:crypto');
      const rows = db.prepare('SELECT rowid, * FROM audit_events ORDER BY rowid').all() as Array<Record<string, string>>;
      let previous = '';
      for (const row of rows) {
        const payload = row.entity_id === 'AUDIT-1' ? JSON.stringify({ i: 999 }) : row.payload_json;
        const hash = crypto.createHash('sha256').update([previous, row.event_type, row.entity_id, row.actor_id || '', payload, row.created_at].join('|')).digest('hex');
        db.prepare('UPDATE audit_events SET payload_json=?, previous_hash=?, event_hash=? WHERE rowid=?').run(payload, previous || null, hash, row.rowid);
        previous = hash;
      }
      const tampered = verifyAuditChain();
      assert.equal(tampered.valid, false);
      assert.match(tampered.error || '', /HMAC/);
    });
  } finally {
    if (saved === undefined) delete process.env.TAX_REFEREE_AUDIT_KEY; else process.env.TAX_REFEREE_AUDIT_KEY = saved;
  }
});
