import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/server/auth';
import { createHash } from 'node:crypto';
import { isSandbox } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  const user = getUserFromToken(req.cookies.get('tax_referee_session')?.value);
  const workspaceScope=isSandbox()?'demo:'+createHash('sha256').update(req.cookies.get('tax_referee_demo')?.value || '').digest('hex').slice(0,16):'internal';
  return user ? NextResponse.json({ user,workspaceScope },{headers:{'Cache-Control':'no-store'}}) : NextResponse.json({ user: null }, { status: 401 });
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
