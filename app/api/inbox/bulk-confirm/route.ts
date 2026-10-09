import { NextRequest, NextResponse } from 'next/server';
import { canApproveInvoice, requireRequestUser } from '@/lib/server/auth';
import { appendAuditEvent, appendImmutableAudit } from '@/lib/server/audit';
import { getDatabase, jsonNow } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = requireRequestUser(request);
    if (user.role === 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Kế toán viên không có thẩm quyền phê duyệt hồ sơ (chỉ Kế toán trưởng hoặc Giám đốc tài chính)' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const invoiceIds: unknown = body.invoiceIds;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'Danh sách ID hóa đơn không hợp lệ hoặc để trống' }, { status: 400 });
    }

    const db = getDatabase();
    const timestamp = jsonNow();
    const confirmedIds: string[] = [];
    const skippedIds: string[] = [];
    let totalConfirmedAmount = 0;

    // Chuẩn bị statement
    const getInvoiceStmt = db.prepare(`
      SELECT i.id, i.status, i.payload_json, i.created_by_user_id, e.decision_json
      FROM invoices i
      LEFT JOIN evaluations e ON e.id = (
        SELECT e2.id FROM evaluations e2 WHERE e2.invoice_id = i.id
        ORDER BY datetime(e2.created_at) DESC LIMIT 1
      )
      WHERE i.id = ?
    `);

    const updateInvoiceStmt = db.prepare('UPDATE invoices SET status = ?, approved_deductible_tax = ?, updated_at = ? WHERE id = ?');

    for (const rawId of invoiceIds) {
      const id = String(rawId);
      const row = getInvoiceStmt.get(id) as { id: string; status: string; payload_json: string; created_by_user_id?: string | null; decision_json?: string } | undefined;
      
      if (!row) {
        skippedIds.push(id);
        continue;
      }

      const decision = row.decision_json ? JSON.parse(row.decision_json) : null;
      // Guardrail IMP-09: Chỉ duyệt ca có phán quyết ROUTINE và đang ở trạng thái ROUTINE_PROPOSED
      if (!decision || decision.status !== 'ROUTINE' || row.status !== 'ROUTINE_PROPOSED') {
        skippedIds.push(id);
        continue;
      }

      const invoicePayload = JSON.parse(row.payload_json);

      // Phân quyền thứ bậc & chặn tự duyệt (Anti-Self-Approval)
      const authCheck = canApproveInvoice(user, {
        id,
        totalAmount: invoicePayload.totalAmount || 0,
        createdByUserId: row.created_by_user_id,
        requiresCFO: decision.requiresCFO
      });
      if (!authCheck.allowed) {
        skippedIds.push(id);
        continue;
      }

      const approvedTax = Number(decision.approvedTaxAmount ?? invoicePayload.taxAmount ?? 0);
      updateInvoiceStmt.run('APPROVED', approvedTax, timestamp, id);
      totalConfirmedAmount += (invoicePayload.totalAmount || 0);
      confirmedIds.push(id);

      appendAuditEvent({
        eventType: 'ROUTINE_CONFIRMED',
        entityId: id,
        actorId: user.id,
        payload: {
          invoice: invoicePayload,
          decision,
          role: user.role,
          batchAction: true,
          confirmedCount: invoiceIds.length
        }
      });

      appendImmutableAudit({
        eventType: 'ROUTINE_CONFIRMED',
        entityId: id,
        userId: user.id,
        userRole: user.role,
        action: 'BULK_APPROVE_ROUTINE',
        rationale: 'Phê duyệt hàng loạt hồ sơ Routine đủ điều kiện',
        payload: {
          invoice: invoicePayload,
          decision,
          role: user.role,
          batchAction: true
        }
      });
    }

    return NextResponse.json({
      ok: true,
      confirmedCount: confirmedIds.length,
      confirmedIds,
      skippedCount: skippedIds.length,
      skippedIds,
      totalAmount: totalConfirmedAmount
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lỗi xử lý xác nhận hàng loạt' },
      { status: 400 }
    );
  }
}
