import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { listAuditEvents, listAuditEventsForEntity, verifyAgainstAnchor, verifyAuditChain } from '@/lib/server/audit';
import { getRequestUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập để xem audit' }, { status: 401 });
  if (req.nextUrl.searchParams.get('verify') === '1') {
    // Đối chiếu thêm với điểm neo đã lưu (từ /api/audit/anchor): ?anchorCount=&anchorHash=&anchorAt=&anchorSig=
    const q = req.nextUrl.searchParams, count = Number(q.get('anchorCount'));
    const anchor = Number.isInteger(count) && count >= 0 && q.get('anchorHash') ? verifyAgainstAnchor({ count, headHash: q.get('anchorHash'), createdAt: q.get('anchorAt') || undefined, signature: q.get('anchorSig') }) : undefined;
    return NextResponse.json({ ...verifyAuditChain(), ...(anchor ? { anchor } : {}) });
  }
  const entityId=req.nextUrl.searchParams.get('entityId');
  if(entityId)return NextResponse.json({events:listAuditEventsForEntity(entityId)});
  const limit = Number(req.nextUrl.searchParams.get('limit') || 100);
  return NextResponse.json({ events: listAuditEvents(limit) });
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

