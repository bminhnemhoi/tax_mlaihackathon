import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ActionOptionSchema, InvoiceInputSchema, RefereeDecisionSchema } from '@/lib/schemas';
import { appendAuditEvent, appendImmutableAudit } from '@/lib/server/audit';
import { getActivePolicy, getDatabase, getMacroState, jsonNow, saveMacroState } from '@/lib/server/db';
import { calculateKFactor } from '@/services/policyEngine';
import { getRequestUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

const acceptedActions = new Set([
  'ACCEPT_WITH_DOCS',
  'ACCEPT_ADJUSTMENT',
  'ACCEPT_WITH_DEFENSE_DOSSIER'
]);

export async function POST(req: NextRequest) {
  try {
    const user = getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập để phê duyệt hồ sơ' }, { status: 401 });
    const body = await req.json();
    const invoiceId = String(body.invoiceId || '');
    const evaluationId = String(body.evaluationId || '');
    const optionId = String(body.optionId || '');
    if (!invoiceId || !evaluationId || !optionId) throw new Error('Thiếu invoiceId, evaluationId hoặc optionId');
    const db = getDatabase();
    const row = db.prepare(`
      SELECT i.id, i.status, i.payload_json, i.created_by_user_id, e.id AS evaluation_id, e.decision_json
      FROM invoices i
      JOIN evaluations e ON e.invoice_id = i.id
      WHERE i.id = ? AND e.id = ?
    `).get(invoiceId, evaluationId) as { id: string; status: string; payload_json: string; created_by_user_id?: string | null; evaluation_id: string; decision_json: string } | undefined;
    if (!row) throw new Error('Không tìm thấy evaluation hiện hành của hồ sơ');
    const invoice = InvoiceInputSchema.parse(JSON.parse(row.payload_json));
    const decision = RefereeDecisionSchema.parse(JSON.parse(row.decision_json));
    if (decision.status !== 'ESCALATED') throw new Error('Chỉ có thể xử lý hồ sơ ESCALATED');
    const option = ActionOptionSchema.parse(decision.options.find((candidate) => candidate.id === optionId));
    if (row.status === 'APPROVED' || row.status === 'REJECTED') {
      throw new Error('Hồ sơ đã được xử lý chung cuộc trước đó');
    }

    // Kiểm tra nguyên tắc Segregation of Duties (Chặn người tạo tự duyệt)
    if (row.created_by_user_id && row.created_by_user_id === user.id) {
      throw new Error('Nguyên tắc Segregation of Duties: Người tạo/nhập hóa đơn không được phép tự phê duyệt hồ sơ của chính mình');
    }

    const requiredRole = decision.status === 'ESCALATED' && decision.requiresCFO ? 'CFO' : 'CHIEF_ACCOUNTANT';
    const actorRole = user.role;
    // Thứ bậc thẩm quyền: CFO có quyền giải quyết mọi ca của Kế toán trưởng
    const hasAuthority = actorRole === requiredRole || (actorRole === 'CFO' && requiredRole === 'CHIEF_ACCOUNTANT');
    if (!hasAuthority) throw new Error(`Case này cần thẩm quyền tối thiểu ${requiredRole}`);

    const replay = db.prepare('SELECT id FROM human_resolutions WHERE invoice_id = ? AND evaluation_id = ? AND actor_role = ? LIMIT 1').get(invoiceId, evaluationId, actorRole);
    if (replay) throw new Error('Evaluation này đã có quyết định xử lý từ vai trò của bạn');

    const accepted = acceptedActions.has(option.resultingAction);
    const timestamp = jsonNow();
    const state = getMacroState();
    const activePolicy = getActivePolicy();

    // Xác định trạng thái đích của hóa đơn dựa trên resultingAction
    let targetStatus: string;
    let approvedDeductibleTax = 0;

    if (accepted) {
      targetStatus = 'APPROVED';
      approvedDeductibleTax = invoice.taxAmount;
      const nextPurchases = state.totalPurchases + invoice.preTaxAmount;
      const nextK = calculateKFactor(invoice.preTaxAmount, activePolicy.config.kFactorSafeMin, activePolicy.config.kFactorSafeMax, state);
      saveMacroState({
        ...state,
        totalPurchases: nextPurchases,
        kFactor: nextK.kFactor,
        zone: nextK.zone,
        totalDeductibleTax: state.totalDeductibleTax + approvedDeductibleTax
      });
    } else if (option.resultingAction === 'FORWARD_TO_CFO') {
      targetStatus = 'FORWARDED';
      approvedDeductibleTax = 0;
    } else if (option.resultingAction === 'REQUEST_SUPPLIER_REISSUE') {
      targetStatus = 'ON_HOLD';
      approvedDeductibleTax = 0;
    } else {
      // REJECT_TAX_DEDUCTION
      targetStatus = 'REJECTED';
      approvedDeductibleTax = 0;
    }

    const resolutionId = crypto.randomUUID();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO human_resolutions (id, invoice_id, evaluation_id, actor_id, actor_role, option_id, resulting_action, reason, accepted, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(resolutionId, invoice.id, evaluationId, user.id, actorRole, option.id, option.resultingAction, body.reason || option.actionDescription, accepted ? 1 : 0, timestamp);
      db.prepare('UPDATE invoices SET status = ?, approved_deductible_tax = ?, updated_at = ? WHERE id = ?')
        .run(targetStatus, approvedDeductibleTax, timestamp, invoice.id);
    })();

    // IMP-12: Lưu Tiền lệ Doanh nghiệp: CHỈ CFO mới được tạo và CHỈ KHI quyết định là Chấp thuận (accepted)
    let createdPrecedent = null;
    if (body.saveAsPrecedent) {
      if (actorRole !== 'CFO') {
        console.warn('[Precedent Guard] Chỉ CFO mới có thẩm quyền tạo Tiền lệ Doanh nghiệp');
      } else if (!accepted) {
        console.warn('[Precedent Guard] Không được tạo tiền lệ tự động cho quyết định từ chối hoặc tạm dừng');
      } else {
        try {
          const { createPrecedent } = await import('@/services/precedentService');
          // Phân loại pattern rõ ràng cho chi phí nội bộ
          const isSensitive = /rượu|bia|whisky|wine|karaoke|massage/i.test(invoice.itemName);
          const rulePattern = isSensitive ? 'INTERNAL_POLICY_GUEST_ENTERTAINMENT' : `INTERNAL_POLICY_${decision.riskGroup}`;

          createdPrecedent = createPrecedent({
            supplierTaxCode: invoice.supplierTaxCode,
            supplierName: invoice.supplierName,
            riskPattern: rulePattern,
            sopClause: decision.sopClause,
            approvedOption: option.label,
            rationale: body.reason || option.actionDescription,
            approvedBy: `${user.displayName} (CFO)`,
            effectiveMonths: body.precedentMonths || 6
          });
        } catch (precErr) {
          console.warn('Lỗi tự động tạo tiền lệ:', precErr);
        }
      }
    }

    appendAuditEvent({
      eventType: 'HUMAN_RESOLUTION_RECORDED',
      entityId: invoice.id,
      actorId: user.id,
      payload: { resolutionId, invoice, decision, option, actorRole, accepted, precedent: createdPrecedent }
    });

    appendImmutableAudit({
      eventType: 'HUMAN_RESOLUTION_RECORDED',
      entityId: invoice.id,
      userId: user.id,
      userRole: actorRole,
      action: option.resultingAction,
      rationale: body.reason || option.actionDescription,
      payload: { resolutionId, evaluationId, optionId, resultingAction: option.resultingAction, accepted, precedent: createdPrecedent }
    });

    return NextResponse.json({ resolutionId, accepted, macroState: getMacroState(), precedent: createdPrecedent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể ghi nhận quyết định' }, { status: 400 });
  }
}
