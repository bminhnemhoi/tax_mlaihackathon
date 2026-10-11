import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/server/auth';
import { appendAuditEvent } from '@/lib/server/audit';
import { getDatabase, isSandbox, jsonNow, withRequestDatabase } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

async function handlePOST(request: NextRequest) {
  try {
    const user = requireRequestUser(request);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('base64url');
    const now = jsonNow();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO capture_sessions
      (id,token_hash,owner_user_id,status,expires_at,created_at,updated_at)
      VALUES (?,?,?,'WAITING',?,?,?)`).run(
        id,
        crypto.createHash('sha256').update(token).digest('hex'),
        user.id,
        expiresAt,
        now,
        now
      );
    appendAuditEvent({ eventType: 'CAPTURE_SESSION_CREATED', entityId: id, actorId: user.id, payload: { expiresAt } });

    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim();
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestProto = request.nextUrl.protocol.replace(':', '');
    const proto = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : requestProto;
    const configuredOrigin = process.env.APP_PUBLIC_URL;
    const publicOrigin = configuredOrigin || (host && !/^0\.0\.0\.0(?::\d+)?$/i.test(host) ? `${proto}://${host}` : request.nextUrl.origin);
    const captureUrl = new URL(`/capture/${id}`, publicOrigin);
    captureUrl.searchParams.set('token', token);
    const demoId = request.cookies.get('tax_referee_demo')?.value;
    if (isSandbox() && demoId) captureUrl.searchParams.set('demo', demoId);

    return NextResponse.json({ id, captureUrl: captureUrl.toString(), expiresAt, status: 'WAITING' }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Vui lòng đăng nhập.' : 'Không thể tạo phiên chụp.' }, { status });
  }
}

export async function POST(...args: Parameters<typeof handlePOST>) {
  return withRequestDatabase(args[0], () => handlePOST(...args));
}
