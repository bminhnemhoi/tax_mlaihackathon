import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { withRequestDatabase } from '@/lib/server/db';
import { listPostAudits } from '@/services/postAuditService';

export const dynamic = 'force-dynamic';

/** Danh sách hậu kiểm ngẫu nhiên ca tự duyệt + tỉ lệ đồng thuận người–máy (Wilson 95%). */
export async function GET(req: NextRequest) {
  return withRequestDatabase(req, async () => {
    if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
    return NextResponse.json(listPostAudits(), { headers: { 'Cache-Control': 'no-store' } });
  });
}
