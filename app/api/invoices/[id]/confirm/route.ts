import { NextRequest, NextResponse } from 'next/server';
import { canApproveInvoice, requireRequestUser } from '@/lib/server/auth';
import { appendAuditEvent, appendImmutableAudit } from '@/lib/server/audit';
import { getDatabase, jsonNow } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const db = getDatabase();
    const row = db.prepare(`
      SELECT i.id, i.payload_json, i.created_by_user_id, e.decision_json
      FROM invoices i
      LEFT JOIN evaluations e ON e.id = (
        SELECT e2.id FROM evaluations e2 WHERE e2.invoice_id = i.id
        ORDER BY datetime(e2.created_at) DESC LIMIT 1
      )
      WHERE i.id = ?
    `).get(id) as { id: string; payload_json: string; created_by_user_id?: string | null; decision_json?: string } | undefined;
    if (!row) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 });
    const payload = JSON.parse(row.payload_json);
    const decision = row.decision_json ? JSON.parse(row.decision_json) : null;
    if (!decision || decision.status !== 'ROUTINE') {
      return NextResponse.json({ error: 'Chỉ có thể xác nhận đề xuất Routine' }, { status: 400 });
    }

    // Kiểm tra ma trận phân quyền thứ bậc & cơ chế chặn tự duyệt (Anti-Self-Approval)
    const authCheck = canApproveInvoice(user, {
      id,
      totalAmount: payload.totalAmount || 0,
      createdByUserId: row.created_by_user_id,
      requiresCFO: decision.requiresCFO
    });
    if (!authCheck.allowed) {
      return NextResponse.json({ error: authCheck.reason }, { status: 403 });
    }

    const timestamp = jsonNow();
    const approvedTax = Number(decision.approvedTaxAmount ?? payload.taxAmount ?? 0);
    db.prepare('UPDATE invoices SET status = ?, approved_deductible_tax = ?, updated_at = ? WHERE id = ?')
      .run('APPROVED', approvedTax, timestamp, id);

    const event = appendAuditEvent({
      eventType: 'ROUTINE_CONFIRMED',
      entityId: id,
      actorId: user.id,
      payload: { invoice: payload, decision, role: user.role }
    });

    appendImmutableAudit({
      eventType: 'ROUTINE_CONFIRMED',
      entityId: id,
      userId: user.id,
      userRole: user.role,
      action: 'APPROVE_ROUTINE',
      rationale: 'Xác nhận hạch toán đề xuất Routine đủ điều kiện',
      payload: { invoice: payload, decision, role: user.role }
    });

    return NextResponse.json({ ok: true, status: 'APPROVED', auditId: event.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể xác nhận hồ sơ' }, { status: 400 });
  }
}
