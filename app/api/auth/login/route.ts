import { NextRequest, NextResponse } from 'next/server';
import { AppRole, login, switchRole } from '@/lib/server/auth';
import { appendAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const hasRole = Object.prototype.hasOwnProperty.call(body, 'role');
  if (hasRole && !['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO'].includes(body.role)) {
    return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
  }
  // Workspace nội bộ dùng chung: chọn vai trò không cần mật khẩu sẽ cho phép bất kỳ ai thành CFO và tự duyệt.
  // Chỉ bật khi vận hành viên chủ động đặt cờ; giám khảo/khách dùng phiên demo riêng (/api/demo/session).
  if (hasRole && process.env.TAX_REFEREE_ALLOW_INTERNAL_ROLE_LOGIN !== '1') {
    return NextResponse.json({ error: 'Workspace nội bộ cần email và mật khẩu. Hãy mở "demo riêng" để thử với vai trò mô phỏng.' }, { status: 403 });
  }
  // Internal login intentionally ignores the demo cookie: this workspace is shared.
  const result = hasRole ? switchRole(body.role as AppRole) : login(String(body.email || ''), String(body.password || ''));
  if (!result) return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
  appendAuditEvent({ eventType: 'INTERNAL_LOGIN', entityId: result.user.id, actorId: result.user.id, payload: { role: result.user.role, mode: hasRole ? 'MVP_ROLE_SELECTION' : 'PASSWORD' } });
  const response = NextResponse.json({ user: result.user });
  response.cookies.set('tax_referee_session', result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60, path: '/' });
  response.cookies.set('tax_referee_demo', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
  return response;
}
