import { recoverExpiredEvaluations } from '@/services/workflowService';
import { readInboxItems } from '@/services/inboxReadService';
import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

async function handleGET(request: NextRequest) {
  try {
    const user = requireRequestUser(request);
    recoverExpiredEvaluations();
    const items = readInboxItems(user);

    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ user, items, counts });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để mở Inbox' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Không thể tải Inbox' }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
