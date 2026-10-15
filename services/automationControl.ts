import { getDatabase, jsonNow } from '@/lib/server/db';
import { appendAuditEvent } from '@/lib/server/audit';
import type { AppUser } from '@/lib/server/auth';

/**
 * Công tắc dừng tự động hóa toàn hệ thống: khi tắt, không hóa đơn nào được tự duyệt; ca thường quy chuyển
 * Kế toán trưởng duyệt tay, ca ngoại lệ vẫn đi đúng luồng. Bật/tắt là sự kiện audit có người thực hiện và lý do.
 */
export interface AutomationState { paused: boolean; updatedAt: string | null; updatedBy: string | null; reason: string | null }

function ensureTable(): void {
  getDatabase().exec('CREATE TABLE IF NOT EXISTS system_controls (key TEXT PRIMARY KEY, value TEXT NOT NULL, reason TEXT, updated_by TEXT, updated_at TEXT NOT NULL)');
}

export function automationState(): AutomationState {
  ensureTable();
  const row = getDatabase().prepare("SELECT value, reason, updated_by, updated_at FROM system_controls WHERE key='AUTO_APPROVE'").get() as { value: string; reason: string | null; updated_by: string | null; updated_at: string } | undefined;
  return { paused: row?.value === 'PAUSED', updatedAt: row?.updated_at ?? null, updatedBy: row?.updated_by ?? null, reason: row?.reason ?? null };
}

export function isAutomationPaused(): boolean {
  return automationState().paused;
}

export function setAutomationPaused(paused: boolean, user: AppUser, reason: string): AutomationState {
  if (user.role === 'ACCOUNTANT') throw new Error('Chỉ Kế toán trưởng hoặc CFO được dừng/bật lại tự động hóa.');
  if (reason.trim().length < 8) throw new Error('Ghi lý do ít nhất 8 ký tự.');
  ensureTable();
  const db = getDatabase(), now = jsonNow();
  db.transaction(() => {
    db.prepare("INSERT INTO system_controls (key,value,reason,updated_by,updated_at) VALUES ('AUTO_APPROVE',?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
      .run(paused ? 'PAUSED' : 'RUNNING', reason.trim(), user.id, now);
    appendAuditEvent({ eventType: paused ? 'AUTOMATION_PAUSED' : 'AUTOMATION_RESUMED', entityId: 'system:auto-approve', actorId: user.id,
      payload: { actorRole: user.role, actorName: user.displayName, reason: reason.trim(), effect: paused ? 'Mọi ca thường quy chờ Kế toán trưởng duyệt tay; chưa ghi nhận thuế tự động.' : 'Ca thường quy được tự duyệt trở lại theo SOP.' } });
  })();
  return automationState();
}
