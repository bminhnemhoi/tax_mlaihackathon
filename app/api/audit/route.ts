import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { listAuditEvents, listAuditEventsForEntity, verifyAuditChain } from '@/lib/server/audit';
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

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

