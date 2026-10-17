/**
 * Nút "Xóa hết hóa đơn" gọi POST /api/invoices/reset. Route này xóa dữ liệu thật, nên phải chứng minh:
 * workspace nội bộ (không phải sandbox demo) mặc định bị từ chối; chỉ mở khi máy bật công tắc TAX_REFEREE_ALLOW_WORKSPACE_RESET=1
 * (máy demo, nhờ bộ nối Zalo/Goblin xem docs/integrations/zalo-goblin-relay.md); sandbox demo luôn được phép như trước.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { getDatabase, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { POST } from '../../app/api/invoices/reset/route';

const SWITCH = 'TAX_REFEREE_ALLOW_WORKSPACE_RESET';
const resetRequest = (token: string) => new NextRequest('http://localhost/api/invoices/reset', { method: 'POST', headers: { cookie: `tax_referee_session=${token}` } });
const invoiceCount = () => (getDatabase().prepare('SELECT COUNT(*) n FROM invoices').get() as { n: number }).n;
let seq = 0;
const insertInvoice = () => { seq += 1; return getDatabase().prepare("INSERT INTO invoices (id, invoice_number, supplier_tax_code, invoice_date, payload_json, content_hash, created_at, updated_at) VALUES (?, ?, '0312345678', '2026-10-05', '{}', ?, datetime('now'), datetime('now'))").run(`RESET-T${seq}`, String(9_990_000 + seq), `reset-test-hash-${seq}`); };
async function withSwitch<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env[SWITCH];
  if (value === undefined) delete process.env[SWITCH]; else process.env[SWITCH] = value;
  try { return await fn(); } finally { if (before === undefined) delete process.env[SWITCH]; else process.env[SWITCH] = before; }
}

test('workspace nội bộ: mặc định từ chối reset (403) và không xóa gì', async () => {
  const session = switchRole('ACCOUNTANT'); assert.ok(session, 'đăng nhập vai Kế toán viên');
  insertInvoice(); const before = invoiceCount();
  const res = await withSwitch(undefined, () => POST(resetRequest(session.token)));
  assert.equal(res.status, 403);
  assert.equal(invoiceCount(), before, 'dữ liệu còn nguyên');
  const stray = await withSwitch('0', () => POST(resetRequest(session.token)));
  assert.equal(stray.status, 403, 'giá trị khác "1" không mở công tắc');
});

test('workspace nội bộ: bật công tắc thì xóa hết hóa đơn và ghi nhật ký mode=workspace', async () => {
  const session = switchRole('ACCOUNTANT'); assert.ok(session);
  insertInvoice(); assert.ok(invoiceCount() > 0);
  const res = await withSwitch('1', () => POST(resetRequest(session.token)));
  assert.equal(res.status, 200);
  assert.equal(invoiceCount(), 0);
  const audit = getDatabase().prepare("SELECT payload_json FROM audit_events WHERE event_type='SANDBOX_RESET' ORDER BY rowid DESC LIMIT 1").get() as { payload_json: string } | undefined;
  assert.ok(audit, 'có sự kiện SANDBOX_RESET'); assert.match(audit.payload_json, /"mode":"workspace"/);
});

test('sandbox demo: luôn được reset, không cần công tắc', async () => {
  await runIsolated(async () => {
    const session = switchRole('ACCOUNTANT'); assert.ok(session);
    insertInvoice();
    const res = await withSwitch(undefined, () => POST(resetRequest(session.token)));
    assert.equal(res.status, 200);
    assert.equal(invoiceCount(), 0);
  });
});
