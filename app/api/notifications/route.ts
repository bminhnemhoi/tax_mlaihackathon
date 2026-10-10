import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '@/services/notificationService';
import { getRequestUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  const user = getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type') || undefined;
  const notifications = listNotifications(type);
  const unreadCount = getUnreadNotificationCount();

  return NextResponse.json({
    notifications,
    unreadCount
  });
}

async function handlePOST(req: NextRequest) {
  const user = getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });

  try {
    const body = await req.json();
    if (body.action === 'markAllRead') {
      markAllNotificationsAsRead();
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    if (body.action === 'markRead' && body.id) {
      markNotificationAsRead(body.id);
      const unreadCount = getUnreadNotificationCount();
      return NextResponse.json({ success: true, unreadCount });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi xử lý thông báo' }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
