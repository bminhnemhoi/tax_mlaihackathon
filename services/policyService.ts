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

/** Lỗi phân quyền khi công bố policy (nguyên tắc bốn mắt) — route trả 403. */
export class PolicyApprovalError extends Error { readonly status = 403; }

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
/** Tham số mà TĂNG lên là nới lỏng kiểm soát (ít ca phải dừng hơn). */
const LOOSER_WHEN_HIGHER: Array<[keyof SystemPolicyConfig, string]> = [['nonCashThreshold', 'ngưỡng thanh toán không dùng tiền mặt'], ['kttApprovalLimit', 'hạn mức Kế toán trưởng'], ['sellerStatusMaterialityVnd', 'ngưỡng bắt buộc biết trạng thái MST']];
const STRICT_FLAGS: Array<[keyof SystemPolicyConfig, string]> = [['strictBuyerTaxCodeCheck', 'kiểm tra MST người mua'], ['strictSeriesYearCheck', 'kiểm tra năm ký hiệu hóa đơn'], ['strictMccqtCheck', 'kiểm tra mã CQT']];

/**
 * Các điểm làm policy mới LỎNG hơn policy đang hiệu lực: tham số ngưỡng tăng, tỉ lệ hậu kiểm giảm, tắt kiểm tra chặt, bỏ bớt
 * nhóm loại trừ, và (nếu có kết quả chạy thử) hồ sơ thật chuyển từ "chuyển người" sang "tự duyệt" hoặc từ CFO xuống cấp thấp hơn.
 */
export function policyLoosening(baseline: SystemPolicyConfig, candidate: SystemPolicyConfig, changes: PolicyValidationResult['changes'] = []): string[] {
  const out: string[] = [];
  for (const [key, label] of LOOSER_WHEN_HIGHER) {
    const a = Number(baseline[key] ?? 0), b = Number(candidate[key] ?? 0);
    if (b > a) out.push(`Tăng ${label} ${fmt(a)}₫ → ${fmt(b)}₫`);
  }
  if ((candidate.postAuditRate ?? 0.1) < (baseline.postAuditRate ?? 0.1)) out.push(`Giảm tỉ lệ hậu kiểm ${Math.round((baseline.postAuditRate ?? 0.1) * 100)}% → ${Math.round((candidate.postAuditRate ?? 0.1) * 100)}%`);
  for (const [key, label] of STRICT_FLAGS) if (baseline[key] === true && candidate[key] === false) out.push(`Tắt ${label}`);
  if (!baseline.allowStaffReimbursement && candidate.allowStaffReimbursement) out.push('Bật hoàn ứng ủy quyền nhân viên');
  const dropped = (a?: string[], b?: string[]) => (a || []).filter(x => !(b || []).includes(x));
  const vat8 = dropped(baseline.excludedVat8Categories, candidate.excludedVat8Categories);
  if (vat8.length) out.push(`Bỏ nhóm loại trừ VAT 8%: ${vat8.join(', ')}`);
  if (baseline.scopeNotCoveredCategories && candidate.scopeNotCoveredCategories) {
    const scope = dropped(baseline.scopeNotCoveredCategories, candidate.scopeNotCoveredCategories);
    if (scope.length) out.push(`Bỏ nhóm ngoài phạm vi: ${scope.join(', ')}`);
  }
  const rank: Record<string, number> = { SYSTEM: 0, CHIEF_ACCOUNTANT: 1, CFO: 2 };
  const toRoutine = changes.filter(c => c.before.startsWith('ESCALATED') && c.after.startsWith('ROUTINE')).length;
  const downgraded = changes.filter(c => (rank[c.afterRole] ?? 0) < (rank[c.beforeRole] ?? 0) && !(c.before.startsWith('ESCALATED') && c.after.startsWith('ROUTINE'))).length;
  if (toRoutine) out.push(`${toRoutine} hồ sơ đang lưu chuyển từ "chuyển người" sang "tự duyệt"`);
  if (downgraded) out.push(`${downgraded} hồ sơ hạ cấp người duyệt`);
  return out;
}

/**
 * Công bố policy. Nguyên tắc bốn mắt (COSO — tách bạch nhiệm vụ): thay đổi làm lỏng kiểm soát phải do CFO duyệt và người duyệt
 * KHÔNG được là người soạn bản nháp. Thay đổi chặt hơn hoặc trung tính (chỉ làm hệ thống thận trọng hơn) vẫn tự công bố được.
 */
export function publishPolicy(version: string, actorId?: string, reason = 'Đã kiểm tra bộ test policy', actorRole?: string): PolicyBundle {
  const db = getDatabase();
  const row = db.prepare('SELECT payload_json, status, created_by FROM policy_versions WHERE version = ?').get(version) as { payload_json?: string; status?: string; created_by?: string | null } | undefined;
  if (!row?.payload_json) throw new Error('Không tìm thấy policy draft');
  if (row.status === 'PUBLISHED') throw new Error('Policy này đang hiệu lực.');
  const bundle = PolicyBundleSchema.parse({ ...JSON.parse(row.payload_json), status: 'PUBLISHED' });
  const validation = validatePolicyBundle(bundle);
  if (!validation.valid) throw new Error(`Policy chưa đạt bộ test: ${validation.errors.join('; ')}`);
  const loosening = policyLoosening(getActivePolicy().config, bundle.config, validation.changes);
  if (loosening.length) {
    const why = `Bản nháp làm lỏng kiểm soát (${loosening.join('; ')}).`;
    if (actorRole !== 'CFO') throw new PolicyApprovalError(`${why} Theo nguyên tắc bốn mắt, cần CFO duyệt công bố.`);
    if (!actorId || actorId === row.created_by) throw new PolicyApprovalError(`${why} Theo nguyên tắc bốn mắt, người soạn bản nháp không được tự công bố — cần một CFO khác người soạn duyệt.`);
  }
  const segregation = { createdBy: row.created_by || null, approvedBy: actorId || null, loosening, secondApproverRequired: loosening.length > 0 };
  const publishedAt = jsonNow();
  const tx = db.transaction(() => {
    db.prepare("UPDATE policy_versions SET status = 'ROLLED_BACK' WHERE status = 'PUBLISHED'").run();
    db.prepare(`UPDATE policy_versions SET status = 'PUBLISHED', payload_json = ?, approved_by = ?, published_at = ? WHERE version = ?`)
      .run(JSON.stringify(bundle), actorId || null, publishedAt, version);
    db.prepare(`INSERT INTO policy_approvals (id, policy_version, actor_id, action, reason, created_at) VALUES (?, ?, ?, 'PUBLISH', ?, ?)`)
      .run(crypto.randomUUID(), version, actorId || null, reason, publishedAt);
  });
  db.transaction(()=>{tx();appendAuditEvent({ eventType: 'POLICY_PUBLISHED', entityId: version, actorId, payload: { version, reason, validation, segregation } });})();
  return bundle;
}

/** Bản nháp chưa công bố, kèm người soạn và các điểm nới lỏng theo tham số (để người duyệt thứ hai thấy trước khi bấm duyệt). */
export function listPendingDrafts(): Array<{ version: string; createdBy: string | null; createdByName: string | null; createdAt: string; loosening: string[] }> {
  const db = getDatabase(), active = getActivePolicy().config;
  const rows = db.prepare("SELECT p.version, p.payload_json, p.created_by, p.created_at, u.display_name FROM policy_versions p LEFT JOIN users u ON u.id = p.created_by WHERE p.status = 'DRAFT' ORDER BY datetime(p.created_at) DESC LIMIT 5").all() as Array<{ version: string; payload_json: string; created_by: string | null; created_at: string; display_name: string | null }>;
  return rows.map(r => ({ version: r.version, createdBy: r.created_by, createdByName: r.display_name, createdAt: r.created_at, loosening: policyLoosening(active, PolicyBundleSchema.parse(JSON.parse(r.payload_json)).config) }));
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
  const row = db.prepare('SELECT payload_json, status FROM policy_versions WHERE version = ?').get(version) as { payload_json?: string; status?: string } | undefined;
  if (!row?.payload_json) throw new Error('Không tìm thấy policy để rollback');
  // Chỉ quay về bản ĐÃ TỪNG công bố — không cho "rollback" một bản nháp để lách bước duyệt bốn mắt.
  if (row.status !== 'ROLLED_BACK') throw new PolicyApprovalError('Chỉ quay lại được phiên bản đã từng công bố; bản nháp phải đi qua bước duyệt công bố.');
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
