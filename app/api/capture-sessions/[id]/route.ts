import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/server/auth';
import { appendAuditEvent } from '@/lib/server/audit';
import { getDatabase, jsonNow, withRequestDatabase } from '@/lib/server/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function handleGET(request: NextRequest, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const db = getDatabase();
    const row = db.prepare(`SELECT id,owner_user_id,status,artifact_id,error_message,expires_at,updated_at
      FROM capture_sessions WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    if (!row || row.owner_user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy phiên chụp.' }, { status: 404 });

    let status = String(row.status);
    if (['WAITING', 'READY'].includes(status) && Date.parse(String(row.expires_at)) <= Date.now()) {
      status = 'EXPIRED';
      db.prepare("UPDATE capture_sessions SET status='EXPIRED',updated_at=? WHERE id=? AND status IN ('WAITING','READY')").run(jsonNow(), id);
      appendAuditEvent({ eventType: 'CAPTURE_SESSION_EXPIRED', entityId: id, actorId: user.id, payload: {} });
    }
    return NextResponse.json({
      id,
      status,
      artifactId: row.artifact_id || null,
      error: row.error_message || null,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'Vui lòng đăng nhập.' : 'Không thể đọc phiên chụp.' }, {
      status: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500
    });
  }
}

async function handlePATCH(request: NextRequest, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const nextStatus = String(body.status || '');
    if (!['PROCESSING', 'READY', 'FAILED'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Trạng thái phiên không hợp lệ.' }, { status: 400 });
    }
    const db = getDatabase();
    const row = db.prepare('SELECT owner_user_id,status,expires_at,artifact_id FROM capture_sessions WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!row || row.owner_user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy phiên chụp.' }, { status: 404 });

    const current = String(row.status);
    const allowed = (current === 'UPLOADED' && nextStatus === 'PROCESSING') ||
      (current === 'PROCESSING' && ['READY', 'FAILED'].includes(nextStatus));
    if (!allowed) return NextResponse.json({ error: 'Phiên chụp đã thay đổi trạng thái.' }, { status: 409 });
    if (Date.parse(String(row.expires_at)) <= Date.now() && current === 'UPLOADED') {
      db.prepare("UPDATE capture_sessions SET status='EXPIRED',updated_at=? WHERE id=?").run(jsonNow(), id);
      return NextResponse.json({ error: 'Phiên chụp đã hết hạn.' }, { status: 410 });
    }

    const errorMessage = nextStatus === 'FAILED' ? String(body.error || 'Không thể đọc ảnh hóa đơn. Hãy thử tải ảnh khác.') : null;
    const now = jsonNow();
    db.prepare('UPDATE capture_sessions SET status=?,error_message=?,updated_at=?,completed_at=? WHERE id=?')
      .run(nextStatus, errorMessage, now, ['READY', 'FAILED'].includes(nextStatus) ? now : null, id);
    appendAuditEvent({
      eventType: `CAPTURE_SESSION_${nextStatus}`,
      entityId: id,
      actorId: user.id,
      payload: { artifactId: row.artifact_id || null, error: errorMessage }
    });
    return NextResponse.json({ id, status: nextStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'Vui lòng đăng nhập.' : 'Không thể cập nhật phiên chụp.' }, {
      status: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500
    });
  }
}

async function handleDELETE(request: NextRequest, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const db = getDatabase();
    const row = db.prepare('SELECT owner_user_id,status FROM capture_sessions WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!row || row.owner_user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy phiên chụp.' }, { status: 404 });
    if (!['WAITING', 'UPLOADED'].includes(String(row.status))) {
      return NextResponse.json({ error: 'Không thể hủy phiên ở trạng thái hiện tại.' }, { status: 409 });
    }
    db.prepare("UPDATE capture_sessions SET status='CANCELLED',updated_at=? WHERE id=?").run(jsonNow(), id);
    appendAuditEvent({ eventType: 'CAPTURE_SESSION_CANCELLED', entityId: id, actorId: user.id, payload: {} });
    return NextResponse.json({ id, status: 'CANCELLED' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'Vui lòng đăng nhập.' : 'Không thể hủy phiên chụp.' }, {
      status: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500
    });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
export async function PATCH(...args: Parameters<typeof handlePATCH>) { return withRequestDatabase(args[0], () => handlePATCH(...args)); }
export async function DELETE(...args: Parameters<typeof handleDELETE>) { return withRequestDatabase(args[0], () => handleDELETE(...args)); }
