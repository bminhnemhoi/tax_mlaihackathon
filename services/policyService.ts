import crypto from 'node:crypto';
import { InvoiceInputSchema, PolicyBundle, PolicyBundleSchema, RefereeDecisionSchema, SystemPolicyConfig, SystemPolicyConfigSchema } from '@/lib/schemas';
import { getActivePolicy, getDatabase, jsonNow } from '@/lib/server/db';
import { appendAuditEvent } from '@/lib/server/audit';
import { evaluateInvoiceLocally } from './policyEngine';
import { executablePolicySummary, implementedPolicyRules,POLICY_CONTRACT_VERSION } from '@/data/policyContract';
import { validatePolicySafety } from './policySafety';

function contentHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function readActivePolicy(): PolicyBundle {
  return getActivePolicy();
}

export function createPolicyDraft(input: Partial<PolicyBundle> & { config: SystemPolicyConfig }, actorId?: string): PolicyBundle {
  const config = SystemPolicyConfigSchema.parse(input.config);
  const policyText=executablePolicySummary(config);
  const policyNotes=input.policyNotes ?? (input.policyText && input.policyText!==policyText?input.policyText:'');
  const version = input.version || `policy-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  const bundle = PolicyBundleSchema.parse({
    version,
    status: 'DRAFT',
    createdAt: jsonNow(),
    effectiveFrom: input.effectiveFrom || new Date().toISOString().slice(0, 10),
    effectiveTo: input.effectiveTo,
    sourceDocumentVersions: input.sourceDocumentVersions || [],
    policyText,policyNotes,contractVersion:POLICY_CONTRACT_VERSION,
    rules: implementedPolicyRules(config),
    config,
    contentHash: contentHash({ version, config, policyText,policyNotes,contractVersion:POLICY_CONTRACT_VERSION,rules:implementedPolicyRules(config) })
  });

  getDatabase().prepare(`
    INSERT INTO policy_versions (version, status, effective_from, effective_to, payload_json, content_hash, created_by, created_at)
    VALUES (@version, 'DRAFT', @effectiveFrom, @effectiveTo, @payload, @contentHash, @createdBy, @createdAt)
  `).run({
    version: bundle.version,
    effectiveFrom: bundle.effectiveFrom,
    effectiveTo: bundle.effectiveTo || null,
    payload: JSON.stringify(bundle),
    contentHash: bundle.contentHash,
    createdBy: actorId || null,
    createdAt: bundle.createdAt
  });
  appendAuditEvent({ eventType: 'POLICY_DRAFT_CREATED', entityId: bundle.version, actorId, payload: bundle });
  return bundle;
}

export function publishPolicy(version: string, actorId?: string, reason = 'Đã kiểm tra bộ test policy'): PolicyBundle {
  const db = getDatabase();
  const row = db.prepare('SELECT payload_json FROM policy_versions WHERE version = ?').get(version) as { payload_json?: string } | undefined;
  if (!row?.payload_json) throw new Error('Không tìm thấy policy draft');
  const bundle = PolicyBundleSchema.parse({ ...JSON.parse(row.payload_json), status: 'PUBLISHED' });
  const validation = validatePolicyBundle(bundle);
  if (!validation.valid) throw new Error(`Policy chưa đạt bộ test: ${validation.errors.join('; ')}`);
  const publishedAt = jsonNow();
  const tx = db.transaction(() => {
    db.prepare("UPDATE policy_versions SET status = 'ROLLED_BACK' WHERE status = 'PUBLISHED'").run();
    db.prepare(`UPDATE policy_versions SET status = 'PUBLISHED', payload_json = ?, approved_by = ?, published_at = ? WHERE version = ?`)
      .run(JSON.stringify(bundle), actorId || null, publishedAt, version);
    db.prepare(`INSERT INTO policy_approvals (id, policy_version, actor_id, action, reason, created_at) VALUES (?, ?, ?, 'PUBLISH', ?, ?)`)
      .run(crypto.randomUUID(), version, actorId || null, reason, publishedAt);
  });
  db.transaction(()=>{tx();appendAuditEvent({ eventType: 'POLICY_PUBLISHED', entityId: version, actorId, payload: { version, reason, validation } });})();
  return bundle;
}

export interface PolicyValidationResult {valid:boolean;errors:string[];safetyCases:number;operationalCases:number;changes:Array<{invoiceId:string;before:string;after:string;beforeRole:string;afterRole:string;beforeRules:string[];afterRules:string[]}>;baselinePolicyVersion:string;candidatePolicyVersion:string;parameterChanges:string[];contractVersion:string;legacyNotes:boolean}
export function validatePolicyBundle(bundle: PolicyBundle):PolicyValidationResult {
  const rows = getDatabase().prepare('SELECT id, payload_json FROM invoices ORDER BY datetime(updated_at) DESC LIMIT 200').all() as Array<{ id: string; payload_json: string }>;
  const safety=validatePolicySafety(bundle.config,bundle.version);
  const errors: string[] = [...safety.errors];
  const baseline=getActivePolicy();
  const changes:Array<{invoiceId:string;before:string;after:string;beforeRole:string;afterRole:string;beforeRules:string[];afterRules:string[]}>=[];
  if(bundle.contractVersion===POLICY_CONTRACT_VERSION && (bundle.policyText!==executablePolicySummary(bundle.config)
    || JSON.stringify(bundle.rules)!==JSON.stringify(PolicyBundleSchema.shape.rules.parse(implementedPolicyRules(bundle.config)))))errors.push('SOP/registry không khớp cấu hình thực thi.');
  for (const row of rows) {
    const parsedInvoice = InvoiceInputSchema.safeParse(JSON.parse(row.payload_json));
    if (!parsedInvoice.success) {
      errors.push(`${row.id}: dữ liệu hóa đơn không hợp lệ`);
      continue;
    }
    const decision = evaluateInvoiceLocally(parsedInvoice.data, bundle.config, bundle.version);
    if (!RefereeDecisionSchema.safeParse(decision).success) errors.push(`${row.id}: phán quyết không hợp lệ theo schema`);
    const before=evaluateInvoiceLocally(parsedInvoice.data,baseline.config,baseline.version);
    const key=(d:typeof decision):string=>`${d.status}:${d.status==='ESCALATED'?d.riskGroup:''}`;
    const role=(d:typeof decision):string=>d.status==='ROUTINE'?'SYSTEM':d.requiresCFO?'CFO':'CHIEF_ACCOUNTANT';
    const ruleIds=(d:typeof decision):string[]=>(d.findings||[]).map(f=>f.ruleId).sort();
    if(key(before)!==key(decision)||role(before)!==role(decision)||JSON.stringify(ruleIds(before))!==JSON.stringify(ruleIds(decision)))changes.push({invoiceId:row.id,before:key(before),after:key(decision),beforeRole:role(before),afterRole:role(decision),beforeRules:ruleIds(before),afterRules:ruleIds(decision)});
  }
  return { valid: errors.length === 0, errors, safetyCases:safety.tested, operationalCases:rows.length,changes,
    baselinePolicyVersion:baseline.version,candidatePolicyVersion:bundle.version,parameterChanges:Object.entries(bundle.config).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(new Map(Object.entries(baseline.config)).get(k))).map(([k])=>k),
    contractVersion:POLICY_CONTRACT_VERSION,legacyNotes:bundle.contractVersion!==POLICY_CONTRACT_VERSION };
}

export function rollbackPolicy(version: string, actorId?: string, reason = 'Rollback theo yêu cầu vận hành'): PolicyBundle {
  const db = getDatabase();
  const row = db.prepare('SELECT payload_json FROM policy_versions WHERE version = ?').get(version) as { payload_json?: string } | undefined;
  if (!row?.payload_json) throw new Error('Không tìm thấy policy để rollback');
  const bundle = PolicyBundleSchema.parse({ ...JSON.parse(row.payload_json), status: 'PUBLISHED' });
  const validation=validatePolicyBundle(bundle);
  if(!validation.valid)throw new Error(`Policy rollback không đạt kiểm thử: ${validation.errors.join('; ')}`);
  const timestamp = jsonNow();
  const tx = db.transaction(() => {
    db.prepare("UPDATE policy_versions SET status = 'ROLLED_BACK' WHERE status = 'PUBLISHED'").run();
    db.prepare('UPDATE policy_versions SET status = \'PUBLISHED\', payload_json = ?, approved_by = ?, published_at = ? WHERE version = ?')
      .run(JSON.stringify(bundle), actorId || null, timestamp, version);
    db.prepare(`INSERT INTO policy_approvals (id, policy_version, actor_id, action, reason, created_at) VALUES (?, ?, ?, 'ROLLBACK', ?, ?)`)
      .run(crypto.randomUUID(), version, actorId || null, reason, timestamp);
  });
  db.transaction(()=>{tx();appendAuditEvent({ eventType: 'POLICY_ROLLED_BACK', entityId: version, actorId, payload: { version, reason, validation } });})();
  return bundle;
}

export function listPolicyVersions(): PolicyBundle[] {
  const rows = getDatabase().prepare('SELECT payload_json FROM policy_versions ORDER BY datetime(created_at) DESC').all() as Array<{ payload_json: string }>;
  return rows.map((row) => PolicyBundleSchema.parse(JSON.parse(row.payload_json)));
}
