import { NextRequest, NextResponse } from 'next/server';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Chống giả mạo yêu cầu từ trang khác (CSRF) cho mọi API thay đổi dữ liệu. Trình duyệt luôn gửi Sec-Fetch-Site:
 * yêu cầu không đến từ chính trang này bị chặn, kể cả trang "cùng site" khác dưới *.hostingersite.com (cookie SameSite=Lax vẫn được gửi).
 * Gọi từ máy chủ (webhook, script kiểm thử) không có header này nên không bị ảnh hưởng.
 */
export function middleware(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method) || request.nextUrl.pathname.startsWith('/api/webhooks/')) return NextResponse.next();
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return NextResponse.json({ error: 'Yêu cầu từ trang khác bị chặn.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if (!site && origin) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    try { if (host && new URL(origin).host !== host) return NextResponse.json({ error: 'Yêu cầu từ trang khác bị chặn.' }, { status: 403 }); } catch { return NextResponse.json({ error: 'Origin không hợp lệ.' }, { status: 403 }); }
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
