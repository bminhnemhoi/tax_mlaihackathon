import { allowedActions, readRecord } from '@/services/workflowService';
import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

function json<T>(value: unknown, fallback: T): T {
  try {
    return value ? JSON.parse(String(value)) as T : fallback;
  } catch {
    return fallback;
  }
}

async function handleGET(request: NextRequest) {
  try {
    const user = requireRequestUser(request);
    const rows = getDatabase().prepare(`
      SELECT
        i.id, i.invoice_number, i.supplier_tax_code, i.invoice_date,
        i.payload_json, i.status AS invoice_status, i.content_hash,
        i.created_at, i.updated_at,
        e.id AS evaluation_id, e.decision_json, e.policy_version, e.legal_version, e.created_at AS evaluated_at,
        r.actor_role AS resolution_role, r.option_id AS resolution_option,
        r.resulting_action, r.accepted, r.created_at AS resolved_at
        , a.event_type AS latest_audit_type, a.actor_id AS latest_audit_actor,
        a.payload_json AS latest_audit_payload, a.created_at AS latest_audit_at
      FROM invoices i
      LEFT JOIN evaluations e ON e.id = (
        SELECT e2.id FROM evaluations e2
        WHERE e2.invoice_id = i.id
        ORDER BY e2.rowid DESC LIMIT 1
      )
      LEFT JOIN human_resolutions r ON r.id = (
        SELECT r2.id FROM human_resolutions r2
        WHERE r2.invoice_id = i.id AND r2.evaluation_id=e.id
        ORDER BY datetime(r2.created_at) DESC LIMIT 1
      )
      LEFT JOIN audit_events a ON a.id = (
        SELECT a2.id FROM audit_events a2 WHERE a2.entity_id = i.id ORDER BY a2.rowid DESC LIMIT 1
      )
      ORDER BY datetime(i.updated_at) DESC
      LIMIT 200
    `).all() as Array<Record<string, unknown>>;

    const items = rows.map((row) => {
      const invoice = json<Record<string, unknown>>(row.payload_json, {});
      const decision = json<Record<string, unknown> | null>(row.decision_json, null);
      const resolved = row.resolved_at != null;
      const persistedStatus = String(row.invoice_status || '');
      const status = persistedStatus || 'RECEIVED';
      const workflowRecord = readRecord(String(row.id));

      return {
        id: String(row.id),
        invoiceNumber: String(row.invoice_number),
        invoiceDate: String(row.invoice_date),
        supplierTaxCode: String(row.supplier_tax_code),
        supplierName: String(invoice.supplierName || 'Chưa có tên nhà cung cấp'),
        itemName: String(invoice.itemName || ''),
        invoice,
        totalAmount: Number(invoice.totalAmount || 0),
        taxAmount: Number(invoice.taxAmount || 0),
        status,
        revision: workflowRecord.revision,
        internalVoucherId:(getDatabase().prepare('SELECT id FROM internal_vouchers WHERE invoice_id=?').get(String(row.id)) as {id:string}|undefined)?.id || null,
        taxHold: Boolean(workflowRecord.tax_hold),
        review: JSON.parse(workflowRecord.source_review_json),
        allowedActions: allowedActions(workflowRecord, user),
        decision,
        evaluationId: row.evaluation_id ? String(row.evaluation_id) : null,
        contentHash: String(row.content_hash),
        policyVersion: row.policy_version ? String(row.policy_version) : null,
        legalVersion: row.legal_version ? String(row.legal_version) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        resolution: row.resolved_at ? {
          role: String(row.resolution_role || ''),
          option: String(row.resolution_option || ''),
          action: String(row.resulting_action || ''),
          accepted: Number(row.accepted) === 1,
          resolvedAt: String(row.resolved_at)
        } : null,
        latestAudit: row.latest_audit_type ? {
          eventType: String(row.latest_audit_type), actorId: String(row.latest_audit_actor || ''),
          payload: json<Record<string, unknown>>(row.latest_audit_payload, {}), at: String(row.latest_audit_at || '')
        } : null
      };
    }).filter((item) => !item.id.startsWith('TC-'));

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
