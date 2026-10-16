import { NextRequest, NextResponse } from 'next/server';
import { databaseFingerprint, getActivePolicy, getDatabase, withRequestDatabase } from '@/lib/server/db';
import { getRequestUser } from '@/lib/server/auth';
import { allowRate } from '@/lib/server/rateLimit';
import { runningCommit } from '@/lib/server/buildInfo';
import { runSecurityProbes } from '@/services/securityProbeService';

export const dynamic = 'force-dynamic';

/** Chạy phép thử tấn công trên mã đang deploy (mỗi phép thử một DB :memory:, không gọi mạng). Cần phiên; tối đa 10 lần/10 phút. */
export async function POST(req: NextRequest) {
  return withRequestDatabase(req, async () => {
    const user = getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Mở trang /trust để tạo phiên thử nghiệm.' }, { status: 401 });
    if (!allowRate(`probes:${user.id}`, 10, 10 * 60_000)) return NextResponse.json({ error: 'Đã chạy quá 10 lần trong 10 phút; thử lại sau.' }, { status: 429 });
    const started = performance.now(), runAt = new Date().toISOString();
    const results = await runSecurityProbes({ fingerprint: databaseFingerprint(), countInvoices: () => (getDatabase().prepare('SELECT COUNT(*) n FROM invoices').get() as { n: number }).n });
    const policy = getActivePolicy();
    return NextResponse.json({ runAt, commit: runningCommit() || 'unknown', policyVersion: policy.version, policyHash: policy.contentHash,
      summary: { passed: results.filter(r => r.pass).length, total: results.length, ms: Math.round(performance.now() - started) }, results }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
