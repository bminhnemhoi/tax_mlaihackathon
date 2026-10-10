import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { listAuditEvents, listAuditEventsForEntity, verifyAuditChain } from '@/lib/server/audit';
import { appendAuditEvent } from '@/lib/server/audit';
import { getRequestUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập để xem audit' }, { status: 401 });
  if (req.nextUrl.searchParams.get('verify') === '1') return NextResponse.json(verifyAuditChain());
  const entityId=req.nextUrl.searchParams.get('entityId');
  if(entityId)return NextResponse.json({events:listAuditEventsForEntity(entityId)});
  const limit = Number(req.nextUrl.searchParams.get('limit') || 100);
  return NextResponse.json({ events: listAuditEvents(limit) });
}

async function handlePOST(req: NextRequest) {
  try {
    const user = getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập để ghi audit' }, { status: 401 });
    const body = await req.json();
    if (!body.action || !body.entityId) return NextResponse.json({ error: 'Thiếu hành động hoặc entityId' }, { status: 400 });
    return NextResponse.json(appendAuditEvent({
      eventType: String(body.action),
      entityId: String(body.entityId),
      actorId: user.id,
      payload: { reason: body.reason || '' }
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể ghi audit' }, { status: 400 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
