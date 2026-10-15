import { NextRequest, NextResponse } from 'next/server';
import { withRequestDatabase } from '@/lib/server/db';
import { getRequestUser } from '@/lib/server/auth';
import { automationState, setAutomationPaused } from '@/services/automationControl';
import { releaseHeldRoutineCases } from '@/services/workflowService';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  if (!getRequestUser(req)) return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  return NextResponse.json(automationState());
}

async function handlePOST(req: NextRequest) {
  const user = getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.paused !== 'boolean') return NextResponse.json({ error: 'Thiếu trạng thái dừng/bật' }, { status: 400 });
  try {
    const state = setAutomationPaused(body.paused, user, String(body.reason || ''));
    // Bật lại: hoàn tất các ca thường quy đã bị giữ trong lúc dừng (mỗi ca một sự kiện audit).
    const released = state.paused ? 0 : releaseHeldRoutineCases(user);
    return NextResponse.json({ ...state, released });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể cập nhật' }, { status: user.role === 'ACCOUNTANT' ? 403 : 400 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
