import { withRequestDatabase } from '@/lib/server/db';
import { NextResponse } from 'next/server';
import { listAuditEvents } from '@/lib/server/audit';
import { getActivePolicy, getMacroState,isSandbox } from '@/lib/server/db';
import { getRequestUser } from '@/lib/server/auth';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  return NextResponse.json({ demo:isSandbox(), policy: getActivePolicy(), macroState: getMacroState(), audit: listAuditEvents(100) });
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
