import crypto from 'node:crypto';
import { getDatabase, jsonNow } from './db';
import { eventLabels, fieldLabels, roleLabels, workflowStatusLabels } from '@/lib/workflowPresentation';

export function presentAuditEvent(event: Record<string, unknown>) {
  const payload = (event.payload || {}) as Record<string, any>;
  const actor = event.actorId ? getDatabase().prepare('SELECT display_name,role FROM users WHERE id=?').get(String(event.actorId)) as {display_name:string;role:string}|undefined : undefined;
  const actorRole = payload.actorRole || actor?.role;
  const changes:Array<{field:string;label:string;before:unknown;after:unknown}>=[];
  for(const [field,label] of [['status','Trạng thái hồ sơ'],['approvedTax','Thuế được duyệt'],['taxHold','Giữ thuế'],['voucher','Chứng từ nội bộ']]) {
    const before=payload.before?.[field],after=payload.after?.[field];
    if(JSON.stringify(before)===JSON.stringify(after))continue;
    const value=(v:any)=>field==='status' ? workflowStatusLabels[v] || v : field==='voucher' ? v?.id || 'Chưa có' : field==='taxHold' ? v?'Đang giữ':'Không giữ' : v;
    changes.push({field,label:field==='status'?'Trạng thái hồ sơ':label,before:value(before),after:value(after)});
  }
  if(event.eventType==='EVALUATION_STARTED' && payload.revision>1){
    const previous=getDatabase().prepare('SELECT payload_json FROM invoice_revisions WHERE invoice_id=? AND revision=?').get(String(event.entityId),payload.revision-1) as {payload_json:string}|undefined;
    if(previous){const old=JSON.parse(previous.payload_json);for(const field of Object.keys(fieldLabels)){
      if(JSON.stringify(old[field])!==JSON.stringify(payload.invoice?.[field]))changes.push({field,label:fieldLabels[field],before:old[field],after:payload.invoice?.[field]});
    }}
  }
  return {...event,presentation:{title:eventLabels[String(event.eventType)] || String(event.eventType),
    actorName:payload.actorName || actor?.display_name || (event.actorId ? String(event.actorId) : 'Hệ thống'),
    actorRole:actorRole ? roleLabels[actorRole] || actorRole : event.actorId?'Vai trò chưa ghi nhận':'Hệ thống',
    reason:payload.reason || payload.rationale || 'Sự kiện chưa có diễn giải.',changes,
    artifactId:payload.invoice?.sourceArtifactId || null,
    policyVersion:payload.policyVersion || null,policyHash:payload.policyHash || null,
    revision:payload.revision || null,evaluationId:payload.evaluationId || null,reversesEventId:payload.reversesEventId || null}};
}

export type AuditEventInput = {
  eventType: string;
  entityId: string;
  actorId?: string;
  payload: unknown;
};

/** Khóa HMAC cho chuỗi audit (≥ 32 ký tự, đặt ngoài database). Không có khóa thì chỉ còn chuỗi hash. */
function auditKey(): string | null {
  const key = process.env.TAX_REFEREE_AUDIT_KEY || '';
  return key.length >= 32 ? key : null;
}
/** HMAC nối chuỗi: ký cả chữ ký trước đó, nên xóa/chèn/bỏ chữ ký giữa chuỗi đều bị phát hiện. */
const macOf = (key: string, previousMac: string, eventHash: string) => crypto.createHmac('sha256', key).update(`${previousMac}|${eventHash}`).digest('hex');

export function appendAuditEvent(input: AuditEventInput): { id: string; eventHash: string; createdAt: string } {
  const db = getDatabase();
  return db.transaction(() => {
    const previous = db.prepare('SELECT event_hash, event_mac FROM audit_events ORDER BY rowid DESC LIMIT 1').get() as { event_hash?: string; event_mac?: string | null } | undefined;
    const createdAt = jsonNow();
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(input.payload);
    const eventHash = crypto.createHash('sha256')
      .update([previous?.event_hash || '', input.eventType, input.entityId, input.actorId || '', payloadJson, createdAt].join('|'))
      .digest('hex');

    const key = auditKey();
    db.prepare(`
      INSERT INTO audit_events (id, event_type, entity_id, actor_id, payload_json, previous_hash, event_hash, event_mac, created_at)
      VALUES (@id, @eventType, @entityId, @actorId, @payload, @previousHash, @eventHash, @eventMac, @createdAt)
    `).run({
      id,
      eventType: input.eventType,
      entityId: input.entityId,
      actorId: input.actorId || null,
      payload: payloadJson,
      previousHash: previous?.event_hash || null,
      eventHash,
      eventMac: key ? macOf(key, previous?.event_mac || '', eventHash) : null,
      createdAt
    });

    return { id, eventHash, createdAt };
  })();
}

export function listAuditEvents(limit = 100): Array<Record<string, unknown>> {
  const rows = getDatabase().prepare(`
    SELECT id, event_type as eventType, entity_id as entityId, actor_id as actorId,
           payload_json as payload, previous_hash as previousHash, event_hash as eventHash, created_at as createdAt
    FROM audit_events ORDER BY rowid DESC LIMIT ?
  `).all(Math.min(Math.max(limit, 1), 500)) as Array<Record<string, unknown>>;
  return rows.map((row) => presentAuditEvent({ ...row, payload: JSON.parse(String(row.payload)) }));
}

export function listAuditEventsForEntity(entityId: string, limit = 5000): Array<Record<string, unknown>> {
  const rows = getDatabase().prepare(`
    SELECT id, event_type as eventType, entity_id as entityId, actor_id as actorId,
           payload_json as payload, previous_hash as previousHash, event_hash as eventHash, created_at as createdAt
    FROM audit_events
    WHERE entity_id = ?
    ORDER BY rowid ASC
    LIMIT ?
  `).all(entityId, Math.min(Math.max(limit, 1), 10000)) as Array<Record<string, unknown>>;
  return rows.map((row) => presentAuditEvent({ ...row, payload: JSON.parse(String(row.payload)) }));
}

export function auditHead(): { count: number; headHash: string | null; keyed: boolean } {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) n, (SELECT event_hash FROM audit_events ORDER BY rowid DESC LIMIT 1) head FROM audit_events').get() as { n: number; head: string | null };
  return { count: row.n, headHash: row.head, keyed: Boolean(auditKey()) };
}

export function verifyAuditChain(): { valid: boolean; checked: number; legacy: boolean; keyed: boolean; macVerified: number; warning?: string; error?: string } {
  const db = getDatabase();
  const checkpoint = db.prepare('SELECT cutoff_rowid, anchor_hash FROM audit_chain_checkpoints ORDER BY id DESC LIMIT 1').get() as { cutoff_rowid?: number; anchor_hash?: string } | undefined;
  const rows = db.prepare(`
    SELECT event_type as eventType, entity_id as entityId, actor_id as actorId,
           payload_json as payload, previous_hash as previousHash, event_hash as eventHash, event_mac as eventMac, created_at as createdAt
    FROM audit_events WHERE rowid > ? ORDER BY rowid ASC
  `).all(checkpoint?.cutoff_rowid || 0) as Array<Record<string, unknown>>;
  const key = auditKey();
  let previous = checkpoint?.anchor_hash || '', macVerified = 0;
  // Mốc chỉ hợp lệ khi được tạo trước lúc bắt đầu ký: mốc bao trùm sự kiện đã ký là mốc giả để bỏ qua phần chuỗi.
  if (checkpoint?.cutoff_rowid && (db.prepare('SELECT COUNT(*) n FROM audit_events WHERE rowid <= ? AND event_mac IS NOT NULL').get(checkpoint.cutoff_rowid) as { n: number }).n > 0)
    return { valid: false, checked: 0, legacy: true, keyed: Boolean(key), macVerified: 0, error: 'Điểm mốc audit bao trùm sự kiện đã ký: mốc giả.' };
  let previousMac = checkpoint?.cutoff_rowid ? ((db.prepare('SELECT event_mac FROM audit_events WHERE rowid <= ? ORDER BY rowid DESC LIMIT 1').get(checkpoint.cutoff_rowid) as { event_mac?: string | null } | undefined)?.event_mac || '') : '';
  let signingStarted = false;
  for (const row of rows) {
    const expected = crypto.createHash('sha256')
      .update([previous, row.eventType, row.entityId, row.actorId || '', row.payload, row.createdAt].join('|'))
      .digest('hex');
    if (row.previousHash !== (previous || null) || row.eventHash !== expected) {
      return { valid: false, checked: rows.indexOf(row) + 1, legacy: Boolean(checkpoint), keyed: Boolean(key), macVerified, error: 'Chuỗi hash audit không hợp lệ' };
    }
    if (row.eventMac) signingStarted = true;
    else if (signingStarted) return { valid: false, checked: rows.indexOf(row) + 1, legacy: Boolean(checkpoint), keyed: Boolean(key), macVerified, error: 'Sự kiện thiếu chữ ký HMAC sau khi đã bật khóa: chữ ký bị xóa' };
    if (key && row.eventMac) {
      if (row.eventMac !== macOf(key, previousMac, String(row.eventHash))) return { valid: false, checked: rows.indexOf(row) + 1, legacy: Boolean(checkpoint), keyed: true, macVerified, error: 'Chữ ký HMAC audit không khớp: chuỗi đã bị tính lại hoặc sửa' };
      macVerified++;
    }
    previousMac = String(row.eventMac || '');
    previous = String(row.eventHash);
  }
  const warnings = [checkpoint ? 'Các event trước checkpoint là audit legacy và chưa được xác minh lại.' : '',
    key ? (macVerified < rows.length ? `${rows.length - macVerified} event ghi trước khi bật khóa HMAC chỉ được kiểm bằng chuỗi hash.` : '') : 'Chưa đặt TAX_REFEREE_AUDIT_KEY: chuỗi hash phát hiện sửa giữa chuỗi nhưng chưa chống tính lại toàn bộ chuỗi.'].filter(Boolean);
  return {
    valid: true,
    checked: rows.length,
    legacy: Boolean(checkpoint),
    keyed: Boolean(key),
    macVerified,
    warning: warnings.length ? warnings.join(' ') : undefined
  };
}

export interface ImmutableAuditInput {
  eventType: string;
  entityId: string;
  userId: string;
  userRole: string;
  action: string;
  rationale?: string;
  payload?: unknown;
}

export interface ImmutableAuditRecord {
  id: string;
  eventType: string;
  entityId: string;
  userId: string;
  userRole: string;
  action: string;
  rationale: string | null;
  previousHash: string | null;
  entryHash: string;
  payload: unknown;
  createdAt: string;
}

export function computeImmutableHash(
  previousHash: string,
  eventType: string,
  entityId: string,
  userId: string,
  userRole: string,
  action: string,
  rationale: string,
  payloadJson: string,
  createdAt: string
): string {
  return crypto.createHash('sha256')
    .update([previousHash, eventType, entityId, userId, userRole, action, rationale, payloadJson, createdAt].join('|'))
    .digest('hex');
}

export function appendImmutableAudit(input: ImmutableAuditInput): ImmutableAuditRecord {
  const db = getDatabase();
  return db.transaction(() => {
    const previous = db.prepare('SELECT entry_hash FROM immutable_audit_trail ORDER BY rowid DESC LIMIT 1').get() as { entry_hash?: string } | undefined;
    const createdAt = jsonNow();
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(input.payload ?? {});
    const rationale = input.rationale || '';
    const previousHash = previous?.entry_hash || '';
    const entryHash = computeImmutableHash(
      previousHash,
      input.eventType,
      input.entityId,
      input.userId,
      input.userRole,
      input.action,
      rationale,
      payloadJson,
      createdAt
    );

    db.prepare(`
      INSERT INTO immutable_audit_trail (id, event_type, entity_id, user_id, user_role, action, rationale, previous_hash, entry_hash, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.eventType,
      input.entityId,
      input.userId,
      input.userRole,
      input.action,
      rationale || null,
      previousHash || null,
      entryHash,
      payloadJson,
      createdAt
    );

    return {
      id,
      eventType: input.eventType,
      entityId: input.entityId,
      userId: input.userId,
      userRole: input.userRole,
      action: input.action,
      rationale: rationale || null,
      previousHash: previousHash || null,
      entryHash,
      payload: input.payload ?? {},
      createdAt
    };
  })();
}

export function listImmutableAuditTrail(entityId?: string, limit = 100): ImmutableAuditRecord[] {
  const db = getDatabase();
  let rows: Array<Record<string, unknown>>;
  if (entityId) {
    rows = db.prepare(`
      SELECT id, event_type as eventType, entity_id as entityId, user_id as userId,
             user_role as userRole, action, rationale, previous_hash as previousHash,
             entry_hash as entryHash, payload_json as payload, created_at as createdAt
      FROM immutable_audit_trail
      WHERE entity_id = ?
      ORDER BY rowid ASC
      LIMIT ?
    `).all(entityId, Math.min(Math.max(limit, 1), 1000)) as Array<Record<string, unknown>>;
  } else {
    rows = db.prepare(`
      SELECT id, event_type as eventType, entity_id as entityId, user_id as userId,
             user_role as userRole, action, rationale, previous_hash as previousHash,
             entry_hash as entryHash, payload_json as payload, created_at as createdAt
      FROM immutable_audit_trail
      ORDER BY rowid DESC
      LIMIT ?
    `).all(Math.min(Math.max(limit, 1), 1000)) as Array<Record<string, unknown>>;
  }

  return rows.map((r) => ({
    id: String(r.id),
    eventType: String(r.eventType),
    entityId: String(r.entityId),
    userId: String(r.userId),
    userRole: String(r.userRole),
    action: String(r.action),
    rationale: r.rationale ? String(r.rationale) : null,
    previousHash: r.previousHash ? String(r.previousHash) : null,
    entryHash: String(r.entryHash),
    payload: JSON.parse(String(r.payload || '{}')),
    createdAt: String(r.createdAt)
  }));
}

export function verifyImmutableAuditChain(): { valid: boolean; checked: number; error?: string } {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT event_type as eventType, entity_id as entityId, user_id as userId,
           user_role as userRole, action, rationale, previous_hash as previousHash,
           entry_hash as entryHash, payload_json as payloadJson, created_at as createdAt
    FROM immutable_audit_trail ORDER BY rowid ASC
  `).all() as Array<Record<string, unknown>>;

  let previous = '';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expected = computeImmutableHash(
      previous,
      String(row.eventType),
      String(row.entityId),
      String(row.userId),
      String(row.userRole),
      String(row.action),
      String(row.rationale || ''),
      String(row.payloadJson || '{}'),
      String(row.createdAt)
    );

    if (row.previousHash !== (previous || null) || row.entryHash !== expected) {
      return {
        valid: false,
        checked: i + 1,
        error: `Chuỗi hash audit không hợp lệ tại bản ghi index ${i}`
      };
    }
    previous = String(row.entryHash);
  }

  return { valid: true, checked: rows.length };
}

