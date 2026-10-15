import crypto from 'node:crypto';
import { getDatabase, jsonNow } from '@/lib/server/db';
import { appendAuditEvent } from '@/lib/server/audit';
import { wilson95 } from './feedbackService';

/**
 * Hậu kiểm ngẫu nhiên ca máy tự duyệt (lấy mẫu kiểm toán, ISA 530): một tỉ lệ nhỏ ca thường quy đã tự duyệt được đưa vào
 * danh sách để Kế toán trưởng/CFO xem lại. Mục đích: chống tin máy quá mức, phát hiện quy tắc "trôi" theo thời gian và có
 * số đo đồng thuận người–máy thật (kèm khoảng tin cậy Wilson 95%). Chọn mẫu tất định theo mã hồ sơ + nội dung để tái lập được.
 */
export const DEFAULT_POST_AUDIT_RATE = 0.1;
export type PostAuditResult = 'CONFIRMED' | 'DISAGREE';
export interface PostAuditRow { invoiceId: string; invoiceNumber: string; supplierName: string; totalAmount: number; taxAmount: number; sampledAt: string; status: 'PENDING' | 'REVIEWED'; result: PostAuditResult | null; reason: string | null; reviewerRole: string | null; reviewedAt: string | null }

function ensureTable(): void {
  getDatabase().exec(`CREATE TABLE IF NOT EXISTS post_audits (
    invoice_id TEXT PRIMARY KEY, evaluation_id TEXT, sampled_at TEXT NOT NULL, rate REAL NOT NULL, forced INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING', result TEXT, reviewer_id TEXT, reviewer_role TEXT, reason TEXT, reviewed_at TEXT)`);
}

/**
 * Số ngẫu nhiên tất định trong [0, 1) cho một hồ sơ. Có khóa audit thì dùng HMAC (người nhập không đoán trước được ca nào
 * bị chọn để né — như Amazon A2I lấy mẫu "để kiểm toán mô hình"); không có khóa thì băm thường. Cùng hồ sơ, cùng nội dung → cùng kết quả.
 */
export function postAuditDraw(invoiceId: string, contentHash: string): number {
  const key = process.env.TAX_REFEREE_AUDIT_KEY && process.env.TAX_REFEREE_AUDIT_KEY.length >= 32 ? process.env.TAX_REFEREE_AUDIT_KEY : '';
  const digest = key ? crypto.createHmac('sha256', key).update(`post-audit|${invoiceId}|${contentHash}`).digest('hex') : crypto.createHash('sha256').update(`${invoiceId}|${contentHash}`).digest('hex');
  return parseInt(digest.slice(0, 8), 16) / 0x100000000;
}

/**
 * Lấy mẫu phân tầng (ISA 530): ca sát dưới một ngưỡng quyết định (trong khoảng 15% dưới ngưỡng tiền mặt, ngưỡng trạng thái MST,
 * hạn mức Kế toán trưởng) có rủi ro sai/lách cao hơn nên được chọn với tỉ lệ gấp 3 (tối đa 100%).
 */
export function stratifiedRate(baseRate: number, totalAmount: number, thresholds: number[]): { rate: number; nearThreshold: number | null } {
  const amount = Math.abs(totalAmount);
  const near = thresholds.find(t => t > 0 && amount < t && amount >= t * 0.85) ?? null;
  return { rate: near ? Math.min(1, baseRate * 3) : baseRate, nearThreshold: near };
}

/** Gọi sau khi một ca thường quy được tự duyệt. Trả về true nếu ca được chọn hậu kiểm. */
export function samplePostAudit(row: { id: string; content_hash: string; evaluation_id?: string }, rate: number, forced = false, nearThreshold: number | null = null): boolean {
  if (!forced && !(rate > 0 && postAuditDraw(row.id, row.content_hash) < rate)) return false;
  ensureTable();
  const db = getDatabase();
  const existing = db.prepare('SELECT status FROM post_audits WHERE invoice_id = ?').get(row.id) as { status: string } | undefined;
  if (existing) return true;
  db.prepare('INSERT INTO post_audits (invoice_id, evaluation_id, sampled_at, rate, forced) VALUES (?, ?, ?, ?, ?)').run(row.id, row.evaluation_id || null, jsonNow(), rate, forced ? 1 : 0);
  appendAuditEvent({ eventType: 'POST_AUDIT_SAMPLED', entityId: row.id, payload: { rate, forced, nearThreshold, reason: `Ca tự duyệt được chọn hậu kiểm ngẫu nhiên (tỉ lệ ${Math.round(rate * 100)}%${nearThreshold ? `, tầng sát ngưỡng ${new Intl.NumberFormat('vi-VN').format(nearThreshold)}₫` : ''}) để Kế toán trưởng xem lại.` } });
  return true;
}

export function postAuditStatus(invoiceId: string): { status: string; result: string | null } | null {
  ensureTable();
  return (getDatabase().prepare('SELECT status, result FROM post_audits WHERE invoice_id = ?').get(invoiceId) as { status: string; result: string | null } | undefined) ?? null;
}

export function listPostAudits() {
  ensureTable();
  const rows = getDatabase().prepare(`SELECT p.invoice_id, p.sampled_at, p.status, p.result, p.reason, p.reviewer_role, p.reviewed_at, i.payload_json
    FROM post_audits p JOIN invoices i ON i.id = p.invoice_id ORDER BY p.status = 'PENDING' DESC, p.sampled_at DESC`).all() as Array<Record<string, string | null>>;
  const items: PostAuditRow[] = rows.map(r => {
    const inv = JSON.parse(String(r.payload_json));
    return { invoiceId: String(r.invoice_id), invoiceNumber: inv.invoiceNumber, supplierName: inv.supplierName, totalAmount: inv.totalAmount, taxAmount: inv.taxAmount,
      sampledAt: String(r.sampled_at), status: r.status as PostAuditRow['status'], result: (r.result as PostAuditResult) || null, reason: r.reason, reviewerRole: r.reviewer_role, reviewedAt: r.reviewed_at };
  });
  const reviewed = items.filter(i => i.status === 'REVIEWED');
  const agreed = reviewed.filter(i => i.result === 'CONFIRMED').length;
  return { items, stats: { sampled: items.length, pending: items.length - reviewed.length, reviewed: reviewed.length, agreed, disagreed: reviewed.length - agreed, agreement: wilson95(agreed, reviewed.length) } };
}

/** Ghi kết quả hậu kiểm (quyền và giữ thuế khi không đồng ý do workflowService kiểm tra/thực hiện). */
export function recordPostAuditReview(invoiceId: string, reviewer: { id: string; role: string; displayName: string }, result: PostAuditResult, reason: string): void {
  ensureTable();
  getDatabase().prepare("UPDATE post_audits SET status = 'REVIEWED', result = ?, reviewer_id = ?, reviewer_role = ?, reason = ?, reviewed_at = ? WHERE invoice_id = ?")
    .run(result, reviewer.id, reviewer.role, reason, jsonNow(), invoiceId);
  appendAuditEvent({ eventType: 'POST_AUDIT_REVIEWED', entityId: invoiceId, actorId: reviewer.id,
    payload: { actorRole: reviewer.role, actorName: reviewer.displayName, result, reason: `Hậu kiểm: ${result === 'CONFIRMED' ? 'đồng ý với quyết định tự duyệt' : 'không đồng ý — giữ thuế để xem lại'}. ${reason}` } });
}
