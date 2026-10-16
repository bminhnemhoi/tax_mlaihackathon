/** Các phép thử tấn công của trang /trust chạy trong CI: mọi phép thử phải đạt, nhanh, và không chạm DB của phiên. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseFingerprint, getDatabase, runIsolated } from '../../lib/server/db';
import { runSecurityProbes } from '../../services/securityProbeService';

test('12 phép thử theo 4 trụ (định danh, đặc quyền tối thiểu, ranh giới thực thi, cách ly) đều đạt, dưới 5 giây', async () => {
  await runIsolated(async () => {
    const started = Date.now();
    const count = () => (getDatabase().prepare('SELECT COUNT(*) n FROM invoices').get() as { n: number }).n;
    const results = await runSecurityProbes({ fingerprint: databaseFingerprint(), countInvoices: count });
    const failed = results.filter(r => !r.pass).map(r => `${r.id}: ${r.observed}`);
    assert.deepEqual(failed, []);
    assert.equal(results.length, 12);
    assert.deepEqual([...new Set(results.map(r => r.pillar))].sort(), ['Cách ly', 'Ranh giới thực thi', 'Định danh', 'Đặc quyền tối thiểu'].sort());
    assert.ok(Date.now() - started < 5000, `${Date.now() - started}ms`);
  });
});
