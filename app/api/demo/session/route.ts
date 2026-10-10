import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSandbox, withDemoDatabase, withRequestDatabase } from '@/lib/server/db';
import { getRequestUser, switchRole } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.preserveExisting === true) {
      const existing = await withRequestDatabase(req, async () => {
        const user = getRequestUser(req);
        return user ? { user, demo: isSandbox() } : null;
      });
      // Verify must not replace an internal login or reset an existing demo role.
      if (existing) return NextResponse.json(existing);
    }

    const previous = req.cookies.get('tax_referee_demo')?.value;
    const id = previous && /^[a-f0-9-]{36}$/.test(previous) ? previous : crypto.randomUUID();
    return await withDemoDatabase(id, async () => {
      const session = switchRole('CHIEF_ACCOUNTANT');
      if (!session) throw new Error('Không thể mở demo.');
      const res = NextResponse.json({ user: session.user, demo: true });
      const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 60 * 60 };
      res.cookies.set('tax_referee_demo', id, opts);
      res.cookies.set('tax_referee_session', session.token, opts);
      return res;
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Demo không khả dụng.' }, { status: 503 });
  }
}
