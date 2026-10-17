/**
 * Xử lý hóa đơn theo LÔ: máy vẫn quyết định từng hóa đơn (services/policyEngine.ts, không đổi), còn "chốt lô" là bước
 * con người ký trước khi ghi sổ — đáp ứng góp ý "không để máy tự duyệt trong tài chính" mà không bắt người duyệt từng ca
 * thường quy. Duyệt nhóm đi qua đúng answerHandoff hiện có nên mọi kiểm soát (thẩm quyền CFO, bất kiêm nhiệm,
 * quy tắc luật định không chấp nhận được) vẫn áp dụng cho từng hóa đơn, mỗi hóa đơn một sự kiện nhật ký.
 */
import crypto from 'crypto';
import { appendAuditEvent } from '@/lib/server/audit';
import type { AppUser } from '@/lib/server/auth';
import { getActivePolicy, getDatabase } from '@/lib/server/db';
import { explainDecision, type DecisionExplanation } from '@/lib/explainDecision';
import { ruleContract } from '@/data/policyContract';
import { InvoiceInputSchema, RefereeDecisionSchema, type RefereeDecision } from '@/lib/schemas';
import { answerHandoff, readRecord, WorkflowError } from '@/services/workflowService';
import { getStaff } from '@/services/staffDirectory';

export type BatchSource = 'UPLOAD' | 'GMAIL' | 'ZALO' | 'MANUAL';
export type BatchBucket = 'MACHINE_APPROVED' | 'HUMAN_APPROVED' | 'NEEDS_HUMAN' | 'ON_HOLD' | 'REJECTED' | 'ERROR' | 'PROCESSING';
export const BUCKET_LABELS: Record<BatchBucket, string> = {
  MACHINE_APPROVED: 'Máy đề xuất duyệt', HUMAN_APPROVED: 'Đã duyệt sau khi hỏi người', NEEDS_HUMAN: 'Cần người quyết',
  ON_HOLD: 'Tạm giữ', REJECTED: 'Từ chối', ERROR: 'Không đọc được', PROCESSING: 'Đang xử lý',
};
const WAITING = new Set(['WAITING_CHIEF_ACCOUNTANT', 'WAITING_CFO', 'FORWARDED', 'NEEDS_CONFIRMATION']);
const HUMAN_EVENTS = ['HANDOFF_ANSWERED', 'HUMAN_RESOLUTION_RECORDED', 'OVERRIDE', 'INVOICE_HUMAN_OVERRIDE', 'RESOLVE'];
const now = () => new Date().toISOString();

export interface BatchRow { id: string; label: string; source: BatchSource; status: 'OPEN' | 'SIGNED_OFF'; createdByUserId: string | null; createdAt: string; signedOffByUserId: string | null; signedOffAt: string | null; signoffNote: string | null }
export interface BatchItemView {
  position: number; invoiceId: string | null; fileName: string | null; error: string | null; bucket: BatchBucket; bucketLabel: string;
  invoiceNumber?: string; supplierName?: string; totalAmount?: number; taxAmount?: number; status?: string; requiresCFO?: boolean;
  submitter?: { id: string; name: string; department: string | null } | null;
  explanation?: DecisionExplanation; questionKey?: string;
}
export interface BatchGroup { key: string; label: string; invoiceIds: string[]; requiresCFO: boolean; sampleQuestion: string; questionItems: Array<{ n: number; text: string; answers: [string, string] }> }

const mapBatch = (r: Record<string, unknown>): BatchRow => ({
  id: String(r.id), label: String(r.label), source: r.source as BatchSource, status: r.status as BatchRow['status'],
  createdByUserId: (r.created_by_user_id as string) ?? null, createdAt: String(r.created_at), signedOffByUserId: (r.signed_off_by_user_id as string) ?? null,
  signedOffAt: (r.signed_off_at as string) ?? null, signoffNote: (r.signoff_note as string) ?? null,
});

function requireBatch(id: string): BatchRow {
  const r = getDatabase().prepare('SELECT * FROM batches WHERE id=?').get(id) as Record<string, unknown> | undefined;
  if (!r) throw new WorkflowError('Không tìm thấy lô.', 404);
  return mapBatch(r);
}

export function createBatch(user: AppUser, input: { label?: string; source?: BatchSource } = {}): BatchRow {
  const source: BatchSource = input.source && ['UPLOAD', 'GMAIL', 'ZALO', 'MANUAL'].includes(input.source) ? input.source : 'UPLOAD';
  const id = `LO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const label = (input.label || '').trim().slice(0, 120) || `Lô ${source === 'UPLOAD' ? 'tải lên' : source} ${new Date().toLocaleString('vi-VN')}`;
  getDatabase().prepare('INSERT INTO batches (id,label,source,status,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)').run(id, label, source, 'OPEN', user.id, now());
  appendAuditEvent({ eventType: 'BATCH_CREATED', entityId: `batch:${id}`, actorId: user.id, payload: { label, source, actorRole: user.role } });
  return requireBatch(id);
}

/** Gắn một hóa đơn (hoặc một file đọc lỗi) vào lô. Cùng mã băm file trong cùng lô thì trả lại mục cũ (gửi lại không tạo bản trùng). */
export function attachToBatch(user: AppUser, batchId: string, input: { invoiceId?: string | null; fileName?: string | null; fileSha256?: string | null; sourceRef?: string | null; submitterStaffId?: string | null; error?: string | null }): { position: number; duplicate: boolean } {
  const db = getDatabase();
  const batch = requireBatch(batchId);
  if (batch.status !== 'OPEN') throw new WorkflowError('Lô đã chốt, không thêm hóa đơn được.', 409);
  if (input.invoiceId && !db.prepare('SELECT 1 FROM invoices WHERE id=?').get(input.invoiceId)) throw new WorkflowError('Không tìm thấy hóa đơn để gắn vào lô.', 404);
  if (input.fileSha256) {
    const existing = db.prepare('SELECT position FROM batch_items WHERE batch_id=? AND file_sha256=?').get(batchId, input.fileSha256) as { position: number } | undefined;
    if (existing) return { position: existing.position, duplicate: true };
  }
  return db.transaction(() => {
    const position = ((db.prepare('SELECT COALESCE(MAX(position),0) p FROM batch_items WHERE batch_id=?').get(batchId) as { p: number }).p) + 1;
    db.prepare('INSERT INTO batch_items (batch_id,position,invoice_id,file_name,file_sha256,source_ref,submitter_staff_id,error,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(batchId, position, input.invoiceId ?? null, input.fileName?.slice(0, 200) ?? null, input.fileSha256 ?? null, input.sourceRef?.slice(0, 200) ?? null, input.submitterStaffId ?? null, input.error?.slice(0, 300) ?? null, now());
    void user;
    return { position, duplicate: false };
  })();
}

export function listBatches(limit = 30): Array<BatchRow & { items: number; approved: number; waiting: number }> {
  const rows = getDatabase().prepare(`SELECT b.*, COUNT(bi.position) items,
      SUM(CASE WHEN i.status='APPROVED' THEN 1 ELSE 0 END) approved,
      SUM(CASE WHEN i.status IN ('WAITING_CHIEF_ACCOUNTANT','WAITING_CFO','FORWARDED','NEEDS_CONFIRMATION') THEN 1 ELSE 0 END) waiting
    FROM batches b LEFT JOIN batch_items bi ON bi.batch_id=b.id LEFT JOIN invoices i ON i.id=bi.invoice_id
    GROUP BY b.id ORDER BY b.created_at DESC LIMIT ?`).all(Math.min(Math.max(limit, 1), 100)) as Array<Record<string, unknown>>;
  return rows.map(r => ({ ...mapBatch(r), items: Number(r.items) || 0, approved: Number(r.approved) || 0, waiting: Number(r.waiting) || 0 }));
}

function humanTouched(invoiceId: string): boolean {
  const placeholders = HUMAN_EVENTS.map(() => '?').join(',');
  return Boolean(getDatabase().prepare(`SELECT 1 FROM audit_events WHERE entity_id=? AND actor_id IS NOT NULL AND event_type IN (${placeholders}) LIMIT 1`).get(invoiceId, ...HUMAN_EVENTS));
}

function bucketOf(status: string | undefined, error: string | null, invoiceId: string | null): BatchBucket {
  if (error || !invoiceId || !status) return error ? 'ERROR' : 'PROCESSING';
  if (status === 'APPROVED') return humanTouched(invoiceId) ? 'HUMAN_APPROVED' : 'MACHINE_APPROVED';
  if (WAITING.has(status)) return 'NEEDS_HUMAN';
  if (status === 'ON_HOLD' || status === 'PAUSED') return 'ON_HOLD';
  if (status === 'REJECTED') return 'REJECTED';
  return 'PROCESSING';
}

/** Khóa nhóm câu hỏi: cùng danh sách quy tắc theo đúng thứ tự ý hỏi ⇒ cùng câu hỏi, trả lời chung được. */
function questionKey(decision: RefereeDecision): string | undefined {
  if (decision.status !== 'ESCALATED') return undefined;
  const items = decision.handoff?.questionSpec?.items;
  if (!items?.length) return undefined;
  // Ý "xác minh dữ liệu nguồn" hỏi những dữ kiện khác nhau (ủy nhiệm chi, bảng kê, trạng thái MST…): phải cùng nội dung câu hỏi
  // mới được gộp. Bỏ số tiền, số hóa đơn và phần trong ngoặc kép để các tờ cùng loại câu hỏi vẫn gộp được.
  const shape = (text: string) => text.replace(/“[^”]*”/g, '').replace(/[\d.,]+\s?₫?/g, '#').replace(/\s+/g, ' ').trim();
  return items.map(item => item.ruleIds.includes('RULE_SOURCE_REVIEW') ? `${item.ruleIds.join('+')}:${shape(item.text)}` : item.ruleIds.join('+')).join(' | ');
}

export function getBatch(batchId: string, user: AppUser): {
  batch: BatchRow; items: BatchItemView[]; summary: Record<BatchBucket, number> & { total: number; vatApproved: number; vatPending: number };
  groups: BatchGroup[]; canSignOff: boolean; signOffBlockers: string[];
} {
  const db = getDatabase();
  const batch = requireBatch(batchId);
  const config = getActivePolicy().config;
  const rows = db.prepare(`SELECT bi.*, i.status, i.payload_json, i.approved_deductible_tax, e.decision_json
      FROM batch_items bi LEFT JOIN invoices i ON i.id=bi.invoice_id
      LEFT JOIN evaluations e ON e.id=(SELECT id FROM evaluations WHERE invoice_id=bi.invoice_id ORDER BY rowid DESC LIMIT 1)
      WHERE bi.batch_id=? ORDER BY bi.position`).all(batchId) as Array<Record<string, unknown>>;
  const summary = { MACHINE_APPROVED: 0, HUMAN_APPROVED: 0, NEEDS_HUMAN: 0, ON_HOLD: 0, REJECTED: 0, ERROR: 0, PROCESSING: 0, total: rows.length, vatApproved: 0, vatPending: 0 };
  const groups = new Map<string, BatchGroup>();
  const items: BatchItemView[] = rows.map(r => {
    const invoiceId = (r.invoice_id as string) ?? null;
    const error = (r.error as string) ?? null;
    const bucket = bucketOf(r.status as string | undefined, error, invoiceId);
    summary[bucket] += 1;
    const view: BatchItemView = { position: Number(r.position), invoiceId, fileName: (r.file_name as string) ?? null, error, bucket, bucketLabel: BUCKET_LABELS[bucket] };
    const staff = getStaff(r.submitter_staff_id as string | null);
    view.submitter = staff ? { id: staff.id, name: staff.fullName, department: staff.department } : null;
    if (!invoiceId || !r.payload_json) return view;
    const invoice = InvoiceInputSchema.safeParse(JSON.parse(String(r.payload_json)));
    const decision = r.decision_json ? RefereeDecisionSchema.safeParse(JSON.parse(String(r.decision_json))) : null;
    if (!invoice.success) return view;
    Object.assign(view, { invoiceNumber: invoice.data.invoiceNumber, supplierName: invoice.data.supplierName, totalAmount: invoice.data.totalAmount, taxAmount: invoice.data.taxAmount, status: r.status as string });
    if (bucket === 'MACHINE_APPROVED' || bucket === 'HUMAN_APPROVED') summary.vatApproved += Number(r.approved_deductible_tax) || 0;
    if (bucket === 'NEEDS_HUMAN') summary.vatPending += Math.max(0, invoice.data.taxAmount);
    if (decision?.success) {
      const d = decision.data;
      view.requiresCFO = d.status === 'ESCALATED' ? d.requiresCFO : false;
      view.explanation = explainDecision(invoice.data, d, config);
      if (bucket === 'NEEDS_HUMAN' && d.status === 'ESCALATED') {
        const key = questionKey(d);
        if (key) {
          view.questionKey = key;
          const group = groups.get(key) ?? { key, label: key.split(' | ').map(part => part.split(':')[0].split('+').map(id => ruleContract(id).label).join(' + ') + (part.includes(':') ? ` (${part.slice(part.indexOf(':') + 1).slice(0, 60)})` : '')).join(' · '), invoiceIds: [], requiresCFO: false, sampleQuestion: d.handoff?.question ?? '', questionItems: (d.handoff?.questionSpec?.items ?? []).map(item => ({ n: item.n, text: item.text, answers: item.answers })) };
          group.invoiceIds.push(invoiceId);
          group.requiresCFO = group.requiresCFO || d.requiresCFO;
          groups.set(key, group);
        }
      }
    }
    return view;
  });
  const blockers = signOffBlockers(batch, items, user);
  return { batch, items, summary, groups: [...groups.values()].filter(g => g.invoiceIds.length > 1), canSignOff: blockers.length === 0, signOffBlockers: blockers };
}

function signOffBlockers(batch: BatchRow, items: BatchItemView[], user: AppUser): string[] {
  const out: string[] = [];
  const kttLimit = getActivePolicy().config.kttApprovalLimit ?? 200_000_000;
  if (batch.status !== 'OPEN') out.push('Lô đã được chốt.');
  if (user.role === 'ACCOUNTANT') out.push('Chỉ Kế toán trưởng hoặc CFO được chốt lô.');
  if (batch.createdByUserId && batch.createdByUserId === user.id) out.push('Người tạo lô không được tự chốt lô (bất kiêm nhiệm).');
  if (items.some(i => i.bucket === 'PROCESSING')) out.push('Còn hóa đơn đang xử lý.');
  if (!items.some(i => i.bucket === 'MACHINE_APPROVED' || i.bucket === 'HUMAN_APPROVED')) out.push('Chưa có hóa đơn nào đủ điều kiện để chốt.');
  if (user.role !== 'CFO' && items.some(i => (i.bucket === 'MACHINE_APPROVED' || i.bucket === 'HUMAN_APPROVED') && Math.abs(i.totalAmount ?? 0) >= kttLimit))
    out.push('Lô có hóa đơn từ hạn mức CFO — cần CFO chốt.');
  return out;
}

/** Chốt lô: người ký xác nhận các hóa đơn đã duyệt được ghi sổ. Hóa đơn còn chờ người quyết không bị ghi sổ. */
export function signOffBatch(batchId: string, user: AppUser, note: string): { batchId: string; postedInvoices: number; vat: number; stillWaiting: number } {
  const text = (note || '').trim();
  if (text.length < 8) throw new WorkflowError('Ghi lý do chốt lô (ít nhất 8 ký tự).', 400);
  const view = getBatch(batchId, user);
  if (view.signOffBlockers.length) throw new WorkflowError(view.signOffBlockers[0], user.role === 'ACCOUNTANT' || view.signOffBlockers.some(b => b.includes('bất kiêm nhiệm') || b.includes('cần CFO')) ? 403 : 409);
  const posted = view.items.filter(i => i.bucket === 'MACHINE_APPROVED' || i.bucket === 'HUMAN_APPROVED');
  const vat = view.summary.vatApproved;
  const db = getDatabase();
  db.transaction(() => {
    const changed = db.prepare("UPDATE batches SET status='SIGNED_OFF', signed_off_by_user_id=?, signed_off_at=?, signoff_note=? WHERE id=? AND status='OPEN'").run(user.id, now(), text.slice(0, 500), batchId);
    if (changed.changes !== 1) throw new WorkflowError('Lô vừa được người khác chốt. Tải lại.', 409);
    appendAuditEvent({ eventType: 'BATCH_SIGNED_OFF', entityId: `batch:${batchId}`, actorId: user.id, payload: { actorRole: user.role, actorName: user.displayName, reason: text, invoiceIds: posted.map(i => i.invoiceId), vat, stillWaiting: view.summary.NEEDS_HUMAN } });
    for (const item of posted) appendAuditEvent({ eventType: 'INVOICE_POSTED_BY_BATCH', entityId: String(item.invoiceId), actorId: user.id, payload: { batchId, actorRole: user.role, reason: text } });
  })();
  return { batchId, postedInvoices: posted.length, vat, stillWaiting: view.summary.NEEDS_HUMAN };
}

/**
 * Duyệt nhóm: cùng một đáp án cho các hóa đơn cùng câu hỏi trong lô. Từng hóa đơn đi qua answerHandoff (thẩm quyền,
 * bất kiêm nhiệm, quy tắc không chấp nhận được), lỗi ở một hóa đơn không chặn các hóa đơn khác.
 */
export async function answerGroup(batchId: string, user: AppUser, input: { invoiceIds: string[]; answers: Record<string, string>; reason: string }):
  Promise<Array<{ invoiceId: string; ok: boolean; status?: string; error?: string }>> {
  if (user.role === 'ACCOUNTANT') throw new WorkflowError('Cần Kế toán trưởng hoặc CFO trả lời câu hỏi chuyển tiếp.', 403);
  const ids = [...new Set(input.invoiceIds)].slice(0, 50);
  if (ids.length < 2) throw new WorkflowError('Duyệt nhóm cần ít nhất 2 hóa đơn cùng câu hỏi.', 400);
  const view = getBatch(batchId, user);
  const members = view.items.filter(i => i.invoiceId && ids.includes(i.invoiceId));
  if (members.length !== ids.length) throw new WorkflowError('Có hóa đơn không thuộc lô này.', 400);
  const keys = new Set(members.map(m => m.questionKey));
  if (keys.size !== 1 || !members[0].questionKey) throw new WorkflowError('Chỉ duyệt nhóm các hóa đơn cùng câu hỏi (cùng quy tắc) và đang chờ trả lời.', 400);
  const results: Array<{ invoiceId: string; ok: boolean; status?: string; error?: string }> = [];
  for (const id of ids) {
    try {
      const row = readRecord(id);
      const outcome = await answerHandoff(id, user, { answers: input.answers, reason: input.reason, revision: row.revision, evaluationId: row.evaluation_id }) as { status?: string };
      results.push({ invoiceId: id, ok: true, status: outcome.status });
    } catch (error) {
      results.push({ invoiceId: id, ok: false, error: error instanceof Error ? error.message : 'Không xử lý được.' });
    }
  }
  appendAuditEvent({ eventType: 'BATCH_GROUP_ANSWERED', entityId: `batch:${batchId}`, actorId: user.id, payload: { actorRole: user.role, answers: input.answers, reason: input.reason, results } });
  return results;
}
