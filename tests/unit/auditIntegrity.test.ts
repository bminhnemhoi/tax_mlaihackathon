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
    await runIsolated(async () => {
      for (let i = 0; i < 3; i++) appendAuditEvent({ eventType: 'TEST_EVENT', entityId: `STRIP-${i}`, payload: { i } });
      const db = getDatabase();
      db.exec('DROP TRIGGER audit_events_no_update');
      // Xóa chữ ký của một sự kiện giữa chuỗi (kiểu tấn công "hạ cấp" để né kiểm HMAC).
      db.prepare("UPDATE audit_events SET event_mac=NULL WHERE entity_id='STRIP-1'").run();
      const stripped = verifyAuditChain();
      assert.equal(stripped.valid, false);
      assert.match(stripped.error || '', /thiếu chữ ký/);
    });
    await runIsolated(async () => {
      for (let i = 0; i < 3; i++) appendAuditEvent({ eventType: 'TEST_EVENT', entityId: `CP-${i}`, payload: { i } });
      const db = getDatabase();
      assert.throws(() => db.prepare("INSERT INTO audit_chain_checkpoints (cutoff_rowid, anchor_hash, reason, created_at) VALUES (999, 'x', 'giả', '2026-01-01')").run(), /chỉ được tạo/);
      db.exec('DROP TRIGGER audit_chain_checkpoints_no_insert');
      const max = (db.prepare('SELECT MAX(rowid) m FROM audit_events').get() as { m: number }).m;
      const head = (db.prepare('SELECT event_hash h FROM audit_events WHERE rowid=?').get(max) as { h: string }).h;
      db.prepare("INSERT INTO audit_chain_checkpoints (cutoff_rowid, anchor_hash, reason, created_at) VALUES (?, ?, 'giả', '2026-01-01')").run(max, head);
      const forged = verifyAuditChain();
      assert.equal(forged.valid, false);
      assert.match(forged.error || '', /mốc giả/);
    });
  } finally {
    if (saved === undefined) delete process.env.TAX_REFEREE_AUDIT_KEY; else process.env.TAX_REFEREE_AUDIT_KEY = saved;
  }
});

test('điểm neo nhật ký: phát hiện cắt đuôi và viết lại; ghi thêm sau điểm neo vẫn hợp lệ; điểm neo giả bị từ chối', async () => {
  const { auditAnchor, verifyAgainstAnchor } = await import('../../lib/server/audit');
  const saved = process.env.TAX_REFEREE_AUDIT_KEY;
  process.env.TAX_REFEREE_AUDIT_KEY = 'a'.repeat(40);
  try {
    await runIsolated(async () => {
      for (let i = 0; i < 5; i++) appendAuditEvent({ eventType: 'TEST_EVENT', entityId: `ANC-${i}`, payload: { i } });
      const anchor = auditAnchor();
      assert.equal(anchor.count, 5); assert.equal(anchor.signed, true);
      appendAuditEvent({ eventType: 'TEST_EVENT', entityId: 'ANC-later', payload: { later: true } });
      assert.equal(verifyAgainstAnchor(anchor).valid, true, 'ghi thêm sau điểm neo vẫn hợp lệ');
      assert.match(verifyAgainstAnchor({ ...anchor, count: anchor.count + 1 }).error || '', /Chữ ký/);
      const db = getDatabase();
      db.exec('DROP TRIGGER audit_events_no_delete');
      db.prepare('DELETE FROM audit_events WHERE rowid IN (SELECT rowid FROM audit_events ORDER BY rowid DESC LIMIT 3)').run();
      const cut = verifyAgainstAnchor(anchor);
      assert.equal(cut.valid, false); assert.match(cut.error || '', /cắt đuôi/);
    });
  } finally {
    if (saved === undefined) delete process.env.TAX_REFEREE_AUDIT_KEY; else process.env.TAX_REFEREE_AUDIT_KEY = saved;
  }
});

test('chống hạ cấp HMAC: xóa hết chữ ký rồi tính lại chuỗi — hợp lệ kèm cảnh báo nếu không có mốc, bị bắt khi đặt mốc bắt buộc ký ngoài DB', async () => {
  const saved = { key: process.env.TAX_REFEREE_AUDIT_KEY, since: process.env.TAX_REFEREE_AUDIT_SIGNED_SINCE };
  process.env.TAX_REFEREE_AUDIT_KEY = 'd'.repeat(40);
  try {
    await runIsolated(async () => {
      for (let i = 0; i < 3; i++) appendAuditEvent({ eventType: 'TEST_EVENT', entityId: `DOWNGRADE-${i}`, payload: { i } });
      const db = getDatabase();
      db.exec('DROP TRIGGER audit_events_no_update');
      db.prepare('UPDATE audit_events SET event_mac = NULL').run();
      delete process.env.TAX_REFEREE_AUDIT_SIGNED_SINCE;
      assert.equal(verifyAuditChain().valid, true, 'không có mốc: kẻ gian hạ cấp được (giới hạn đã biết)');
      process.env.TAX_REFEREE_AUDIT_SIGNED_SINCE = '2020-01-01T00:00:00Z';
      const r = verifyAuditChain();
      assert.equal(r.valid, false);
      assert.match(r.error || '', /hạ cấp/);
    });
  } finally {
    for (const [k, v] of [['TAX_REFEREE_AUDIT_KEY', saved.key], ['TAX_REFEREE_AUDIT_SIGNED_SINCE', saved.since]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('production không đặt khóa audit: tự sinh khóa một lần, lưu file cạnh database, các lần sau dùng lại cùng khóa', async () => {
  const fsm = await import('node:fs'), os = await import('node:os'), pathm = await import('node:path');
  const { auditKey, auditKeySource } = await import('../../lib/server/audit');
  const dir = fsm.mkdtempSync(pathm.join(os.tmpdir(), 'audit-key-'));
  const file = pathm.join(dir, '.audit-key');
  const saved = { env: process.env.NODE_ENV, key: process.env.TAX_REFEREE_AUDIT_KEY, file: process.env.TAX_REFEREE_AUDIT_KEY_FILE };
  const env = process.env as Record<string, string | undefined>;
  try {
    delete env.TAX_REFEREE_AUDIT_KEY; env.NODE_ENV = 'production'; env.TAX_REFEREE_AUDIT_KEY_FILE = file;
    const first = auditKey();
    assert.match(first || '', /^[0-9a-f]{64}$/);
    assert.equal(fsm.readFileSync(file, 'utf8'), first);
    assert.equal(auditKey(), first, 'cùng khóa ở lần sau');
    assert.equal(auditKeySource(), 'file');
    env.TAX_REFEREE_AUDIT_KEY = 'e'.repeat(40);
    assert.equal(auditKey(), 'e'.repeat(40), 'biến môi trường được ưu tiên');
    assert.equal(auditKeySource(), 'env');
  } finally {
    for (const [k, v] of [['NODE_ENV', saved.env], ['TAX_REFEREE_AUDIT_KEY', saved.key], ['TAX_REFEREE_AUDIT_KEY_FILE', saved.file]] as const) if (v === undefined) delete env[k]; else env[k] = v;
  }
});
