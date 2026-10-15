import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { withRequestDatabase } from '@/lib/server/db';
import { auditAnchor } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

/** Cấp điểm neo nhật ký (số sự kiện, hash cuối, thời điểm, chữ ký HMAC) để lưu ra ngoài và đối chiếu sau. */
export async function GET(req: NextRequest) {
  return withRequestDatabase(req, async () => {
    if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
    return NextResponse.json(auditAnchor(), { headers: { 'Cache-Control': 'no-store' } });
  });
}
