import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/server/auth';

async function handlePOST(req: NextRequest) {
  const token = req.cookies.get('tax_referee_session')?.value;
  logout(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('tax_referee_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  response.cookies.delete('tax_referee_demo');
  return response;
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
