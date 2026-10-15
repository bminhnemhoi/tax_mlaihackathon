import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { withRequestDatabase } from '@/lib/server/db';
import { reviewPostAudit, WorkflowError } from '@/services/workflowService';

export const dynamic = 'force-dynamic';

/** Ghi kết quả hậu kiểm: { result: "CONFIRMED" | "DISAGREE", reason }. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withRequestDatabase(req, async () => {
    try {
      const user = getRequestUser(req);
      if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
      const { id } = await context.params;
      return NextResponse.json(reviewPostAudit(id, user, await req.json()));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể ghi kết quả hậu kiểm.' }, { status: error instanceof WorkflowError ? error.status : 400 });
    }
  });
}
