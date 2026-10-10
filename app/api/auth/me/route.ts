import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  const user = getUserFromToken(req.cookies.get('tax_referee_session')?.value);
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
