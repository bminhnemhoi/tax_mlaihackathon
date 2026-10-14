import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSandbox, withDemoDatabase, withRequestDatabase } from '@/lib/server/db';
import { AppRole, getRequestUser, switchRole } from '@/lib/server/auth';
import { allowRate, clientIp } from '@/lib/server/rateLimit';

const DEMO_ROLES: AppRole[] = ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO'];

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
    const reuse = previous && /^[a-f0-9-]{36}$/.test(previous);
    // Mỗi phiên demo mới là một tệp SQLite trên đĩa: giới hạn theo IP để không bị tạo vô hạn.
    if (!reuse && process.env.NODE_ENV !== 'test' && !allowRate(`demo:${clientIp(req.headers)}`, Number(process.env.TAX_REFEREE_DEMO_PER_HOUR || 30), 60 * 60 * 1000))
      return NextResponse.json({ error: 'Đã tạo quá nhiều phiên demo từ địa chỉ này. Hãy dùng lại phiên hiện có hoặc thử lại sau.' }, { status: 429 });
    const id = reuse ? previous : crypto.randomUUID();
    return await withDemoDatabase(id, async () => {
      // Mặc định vào vai Kế toán viên (người nhập liệu) để ca chuyển tiếp được KTT/CFO — một tài khoản khác — duyệt.
      const role: AppRole = DEMO_ROLES.includes(body.role) ? body.role : 'ACCOUNTANT';
      const session = switchRole(role);
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
