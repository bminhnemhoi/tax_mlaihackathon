import crypto from 'node:crypto';
import { getDatabase, jsonNow } from './db';

export type AuditEventInput = {
  eventType: string;
  entityId: string;
  actorId?: string;
  payload: unknown;
};

export function appendAuditEvent(input: AuditEventInput): { id: string; eventHash: string; createdAt: string } {
  const db = getDatabase();
  return db.transaction(() => {
    const previous = db.prepare('SELECT event_hash FROM audit_events ORDER BY rowid DESC LIMIT 1').get() as { event_hash?: string } | undefined;
    const createdAt = jsonNow();
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(input.payload);
    const eventHash = crypto.createHash('sha256')
      .update([previous?.event_hash || '', input.eventType, input.entityId, input.actorId || '', payloadJson, createdAt].join('|'))
      .digest('hex');

    db.prepare(`
      INSERT INTO audit_events (id, event_type, entity_id, actor_id, payload_json, previous_hash, event_hash, created_at)
      VALUES (@id, @eventType, @entityId, @actorId, @payload, @previousHash, @eventHash, @createdAt)
    `).run({
      id,
      eventType: input.eventType,
      entityId: input.entityId,
      actorId: input.actorId || null,
      payload: payloadJson,
      previousHash: previous?.event_hash || null,
      eventHash,
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
  return rows.map((row) => ({ ...row, payload: JSON.parse(String(row.payload)) }));
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
  return rows.map((row) => ({ ...row, payload: JSON.parse(String(row.payload)) }));
}

export function verifyAuditChain(): { valid: boolean; checked: number; legacy: boolean; warning?: string; error?: string } {
  const db = getDatabase();
  const checkpoint = db.prepare('SELECT cutoff_rowid, anchor_hash FROM audit_chain_checkpoints ORDER BY id DESC LIMIT 1').get() as { cutoff_rowid?: number; anchor_hash?: string } | undefined;
  const rows = db.prepare(`
    SELECT event_type as eventType, entity_id as entityId, actor_id as actorId,
           payload_json as payload, previous_hash as previousHash, event_hash as eventHash, created_at as createdAt
    FROM audit_events WHERE rowid > ? ORDER BY rowid ASC
  `).all(checkpoint?.cutoff_rowid || 0) as Array<Record<string, unknown>>;
  let previous = checkpoint?.anchor_hash || '';
  for (const row of rows) {
    const expected = crypto.createHash('sha256')
      .update([previous, row.eventType, row.entityId, row.actorId || '', row.payload, row.createdAt].join('|'))
      .digest('hex');
    if (row.previousHash !== (previous || null) || row.eventHash !== expected) {
      return { valid: false, checked: rows.indexOf(row) + 1, legacy: Boolean(checkpoint), error: 'Chuỗi hash audit không hợp lệ' };
    }
    previous = String(row.eventHash);
  }
  return {
    valid: true,
    checked: rows.length,
    legacy: Boolean(checkpoint),
    warning: checkpoint ? 'Các event trước checkpoint là audit legacy và chưa được xác minh lại.' : undefined
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

