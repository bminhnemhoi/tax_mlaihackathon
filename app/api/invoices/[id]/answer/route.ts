import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { withRequestDatabase } from '@/lib/server/db';
import { answerHandoff, WorkflowError } from '@/services/workflowService';

export const dynamic = 'force-dynamic';

/** Trả lời câu hỏi chuyển tiếp một lần: { answers: {"1":"A","2":"B"}, values?, reason, revision, evaluationId }. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withRequestDatabase(req, async () => {
    try {
      const user = getRequestUser(req);
      if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
      const { id } = await context.params;
      return NextResponse.json(await answerHandoff(id, user, await req.json()));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể ghi câu trả lời.' }, { status: error instanceof WorkflowError ? error.status : 400 });
    }
  });
}
