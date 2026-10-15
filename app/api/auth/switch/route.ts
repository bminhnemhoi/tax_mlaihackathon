import { isSandbox, withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { appendAuditEvent } from '@/lib/server/audit';
import { AppRole, getRequestUser, switchRole } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  const currentUser = getRequestUser(req);
  if (!currentUser) return NextResponse.json({ error: 'Vui lòng đăng nhập trước khi chuyển vai trò' }, { status: 401 });
  // Vai trò mô phỏng chỉ đổi được trong demo riêng (database của phiên). Workspace nội bộ phải đăng nhập
  // đúng tài khoản để nguyên tắc bất kiêm nhiệm và cột "ai làm" trong audit có ý nghĩa.
  if (!isSandbox()) return NextResponse.json({ error: 'Chỉ đổi vai trò được trong demo riêng. Workspace nội bộ cần đăng nhập đúng tài khoản.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const role = body.role as AppRole;
  if (!['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO'].includes(role)) {
    return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
  }

  const result = switchRole(role);
  if (!result) {
    return NextResponse.json({ error: 'Không thể chuyển đổi vai trò' }, { status: 404 });
  }

  appendAuditEvent({
    eventType: 'ROLE_SWITCHED',
    entityId: result.user.id,
    actorId: currentUser.id,
    payload: { fromRole: currentUser.role, toRole: result.user.role }
  });

  const response = NextResponse.json({ user: result.user });
  response.cookies.set('tax_referee_session', result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60,
    path: '/'
  });
  return response;
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
