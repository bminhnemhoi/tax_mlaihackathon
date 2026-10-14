import crypto from 'node:crypto';
import { ActionOption, InvoiceInput, InvoiceInputSchema, RefereeDecision, RefereeDecisionSchema, SourceConfirmation, SourceConfirmationSchema } from '@/lib/schemas';
import { AppUser } from '@/lib/server/auth';
import { appendAuditEvent, appendImmutableAudit } from '@/lib/server/audit';
import { getActivePolicy, getDatabase, getMacroState, hashPayload, jsonNow, saveMacroState } from '@/lib/server/db';
import { generateCanonicalVoucher } from '@/lib/accounting/ledgerMapper';
import { queryJevReferee } from './jevService';
import { calculateKFactor,sameDayPurchaseTotal } from './policyEngine';
import {coreDecisionFields,missingBusinessFacts,paymentThreshold,requiredDecisionFields} from '@/lib/refereeRequirements';
import {groupOf,hasNonAcceptableFinding,orderFindings,riskGroupsOf} from '@/lib/riskTaxonomy';
import {fieldAsk,type FieldAsk} from './questionBuilder';
import {buildHandoff,checkHandoff,describeRuleEvidence} from './handoffService';
import { fieldLabels } from '@/lib/workflowPresentation';
import { recordConfirmedSupplierAlias } from './taxLookupService';
import { runningCommit } from '@/lib/server/buildInfo';
import { POLICY_CONTRACT_VERSION } from '@/data/policyContract';
import { z } from 'zod';

export class WorkflowError extends Error { constructor(message: string, public status = 409) { super(message); } }
const STANDARD_VAT_RATES=[0,5,8,10];
/** Trường được so với chứng từ nguồn đã trích xuất; sửa khác nguồn mà chưa có KTT/CFO xác nhận thì không được tự duyệt. */
const SOURCE_DIFF_FIELDS=['invoiceNumber','invoiceDate','supplierTaxCode','buyerTaxCode','preTaxAmount','taxRate','taxAmount','totalAmount'] as const;
function differsFromSource(field:string,source:unknown,submitted:unknown):boolean {
  if(source===undefined || source===null || source==='')return false;
  if(typeof source==='number')return typeof submitted!=='number' || Math.abs(source-submitted)>1;
  if(field.endsWith('TaxCode'))return String(source).replace(/\D/g,'')!==String(submitted ?? '').replace(/\D/g,'');
  return String(source).trim()!==String(submitted ?? '').trim();
}
export type WorkflowRecord = { id: string; status: string; revision: number; payload_json: string; source_review_json: string; content_hash: string; approved_deductible_tax: number; created_by_user_id: string | null; tax_hold: number; paused_from: string | null; evaluation_id?: string; decision_json?: string; evaluation_policy_json?: string; evaluation_attempt_id?: string; evaluation_deadline?: string };
export function readRecord(id: string): WorkflowRecord {
  const row = getDatabase().prepare(`SELECT i.*, e.id evaluation_id, e.decision_json FROM invoices i LEFT JOIN evaluations e ON e.id = (SELECT id FROM evaluations WHERE invoice_id = i.id ORDER BY rowid DESC LIMIT 1) WHERE i.id = ?`).get(id) as WorkflowRecord | undefined;
  if (!row) throw new WorkflowError('Không tìm thấy hồ sơ.', 404);
  return row;
}
export function assertCurrent(row: WorkflowRecord, evaluationId: unknown, revision: unknown) {
  if (row.evaluation_id !== evaluationId || row.revision !== revision) throw new WorkflowError('Hồ sơ hoặc evaluation đã thay đổi. Tải lại trước khi xử lý.');
}

/** Recover only expired attempts. The revision fence rejects any late result. */
export function recoverExpiredEvaluations(now = jsonNow()): number {
  const db=getDatabase();
  const rows=db.prepare("SELECT id FROM invoices WHERE status='EVALUATING' AND (evaluation_deadline IS NULL OR evaluation_deadline<=?)").all(now) as {id:string}[];
  if(!rows.length)return 0;
  return db.transaction(()=>{
    for(const {id} of rows){
      const row=readRecord(id),before=snapshot(row);
      db.prepare("UPDATE invoices SET status='ON_HOLD',approved_deductible_tax=0,revision=revision+1,evaluation_deadline=NULL,updated_at=? WHERE id=?").run(now,id);
      syncVoucher(readRecord(id));
      recordAction(row,null,'EVALUATION_RECOVERED','Lượt đánh giá hết hạn hoặc bị gián đoạn; giữ hồ sơ để chạy lại, chưa duyệt thuế.',before,{expiredAttemptId:row.evaluation_attempt_id});
    }
    recomputeMacro();
    return rows.length;
  })();
}

function undoCandidate(row:WorkflowRecord) {
  const events=getDatabase().prepare('SELECT id,event_type,payload_json FROM audit_events WHERE entity_id=? ORDER BY rowid DESC').all(row.id) as {id:string;event_type:string;payload_json:string}[];
  const reversed=new Set(events.filter(e=>e.event_type==='INVOICE_ACTION_REVERTED').map(e=>JSON.parse(e.payload_json).reversesEventId));
  const latest=events.find(e=>!reversed.has(e.id) && !['INVOICE_ACTION_REVERTED','EVALUATION_STARTED','EVALUATION_FAILED','EVALUATION_RECOVERED','INVOICE_EVALUATED','BANK_EVIDENCE_RECORDED'].includes(e.event_type) && JSON.parse(e.payload_json).before);
  if(!latest)return null;
  const payload=JSON.parse(latest.payload_json);
  return payload.after.status===row.status && payload.revision===row.revision ? {id:latest.id,eventType:latest.event_type,payload} : null;
}
export function approvalBlock(row: WorkflowRecord, user: AppUser): string | null {
  if (user.role === 'ACCOUNTANT') return 'Cần Kế toán trưởng hoặc CFO.';
  if (row.created_by_user_id === user.id) return 'Người nhập hồ sơ không được tự phê duyệt.';
  if (row.status === 'PAUSED' || row.status === 'EVALUATING') return 'Hồ sơ đang dừng hoặc đang được đánh giá.';
  if (!row.decision_json) return 'Chưa có evaluation.';
  const d = RefereeDecisionSchema.parse(JSON.parse(row.decision_json));
  if (d.status === 'ESCALATED' && (d.requiresCFO || row.status==='FORWARDED') && user.role !== 'CFO') return 'Hồ sơ cần CFO.';
  const review = JSON.parse(row.source_review_json || '{}');
  if (review.needsReevaluation) return 'Bằng chứng đã thay đổi; cần đánh giá lại hồ sơ.';
  if (review.unresolvedFields?.length) return `Cần xác minh: ${review.unresolvedFields.join(', ')}.`;
  if (d.status === 'ESCALATED' && (!d.findings?.length || hasNonAcceptableFinding(d.findings))) return 'Cần bổ sung/sửa bằng chứng và đánh giá lại tất cả phát hiện trước khi duyệt.';
  if (row.tax_hold) return 'Đang tạm giữ thuế; cần giải phóng và đánh giá lại.';
  return null;
}
export function allowedActions(row: WorkflowRecord, user: AppUser) {
  const operator = user.role !== 'ACCOUNTANT';
  const blockedReason = approvalBlock(row, user);
  const undo=undoCandidate(row);
  return { approve: !blockedReason && ['WAITING_CHIEF_ACCOUNTANT','WAITING_CFO','FORWARDED'].includes(row.status),
    pause: operator && row.status !== 'PAUSED', resume: operator && row.status === 'PAUSED',
    undo: operator && Boolean(undo), undoTarget:operator && undo ? {eventId:undo.id,eventType:undo.eventType,targetStatus:undo.payload.before.status==='EVALUATING'?'ON_HOLD':undo.payload.before.status} : null,
    taxHold: operator, requestInformation: operator && !['PAUSED','EVALUATING','APPROVED','REJECTED'].includes(row.status),
    savePrecedent: user.role === 'CFO' && !blockedReason && JSON.parse(row.decision_json || '{}').findings?.some((f: {kind:string}) => f.kind === 'INTERNAL_POLICY'), blockedReason };
}
function snapshot(row: WorkflowRecord) {
  return { status: row.status, approvedTax: row.approved_deductible_tax, taxHold: row.tax_hold, pausedFrom: row.paused_from,
    voucher: getDatabase().prepare('SELECT * FROM internal_vouchers WHERE invoice_id = ?').get(row.id) || null };
}
export function recomputeMacro() {
  const db = getDatabase();
  const baseline = db.prepare('SELECT payload_json FROM macro_baseline WHERE id = 1').get() as {payload_json:string};
  const base = JSON.parse(baseline.payload_json);
  const sums = db.prepare(`SELECT COALESCE(SUM(json_extract(payload_json,'$.preTaxAmount')),0) purchases, COALESCE(SUM(approved_deductible_tax),0) tax FROM invoices WHERE status = 'APPROVED'`).get() as {purchases:number;tax:number};
  const next = { ...base, totalPurchases: base.totalPurchases + sums.purchases, totalDeductibleTax: base.totalDeductibleTax + sums.tax };
  const k = calculateKFactor(0, getActivePolicy().config.kFactorSafeMin, getActivePolicy().config.kFactorSafeMax, next);
  saveMacroState({...next, kFactor:k.kFactor, zone:k.zone});
}
export function recordAction(row: WorkflowRecord, user: AppUser | null, eventType: string, reason: string, before: ReturnType<typeof snapshot>, extra: Record<string,unknown> = {}) {
  const after = readRecord(row.id);
  const policy = after.evaluation_policy_json ? JSON.parse(after.evaluation_policy_json) : getActivePolicy();
  const payload = { evaluationId: after.evaluation_id, revision: after.revision, policyVersion:policy.version, policyHash:policy.contentHash || hashPayload(policy), actorRole:user?.role || 'SYSTEM_REFEREE', actorName:user?.displayName || 'Hệ thống',
    invoice: JSON.parse(after.payload_json), review:JSON.parse(after.source_review_json), decision:after.decision_json?JSON.parse(after.decision_json):null, before, after:snapshot(after),
    previousStatus:before.status, targetStatus:after.status, previousApprovedDeductibleTax:before.approvedTax, approvedDeductibleTax:after.approved_deductible_tax, reason,
    inputHash:after.content_hash, contractVersion:POLICY_CONTRACT_VERSION, commit:runningCommit() || null, ...extra };
  const event = appendAuditEvent({eventType,entityId:row.id,actorId:user?.id,payload});
  appendImmutableAudit({eventType,entityId:row.id,userId:user?.id || 'system',userRole:user?.role || 'SYSTEM_REFEREE',action:eventType,rationale:reason,payload:{...payload,auditEventId:event.id}});
  return event;
}
function syncVoucher(row: WorkflowRecord) {
  const db=getDatabase();
  if (row.status !== 'APPROVED' || row.tax_hold) { db.prepare('DELETE FROM internal_vouchers WHERE invoice_id = ?').run(row.id); return; }
  const invoice=InvoiceInputSchema.parse(JSON.parse(row.payload_json));
  const d=RefereeDecisionSchema.parse(JSON.parse(row.decision_json!));
  const voucher=generateCanonicalVoucher(invoice,d,row.revision,'CIRCULAR_99_200',row.approved_deductible_tax);
  const t=jsonNow();
  db.prepare(`INSERT INTO internal_vouchers (id, invoice_id, evaluation_id, regime, voucher_json, created_at, updated_at) VALUES (?,?,?,'CIRCULAR_99_200',?,?,?) ON CONFLICT(invoice_id) DO UPDATE SET id=excluded.id,evaluation_id=excluded.evaluation_id,voucher_json=excluded.voucher_json,updated_at=excluded.updated_at`).run(voucher.id,row.id,row.evaluation_id,JSON.stringify({...voucher,status:'READY_TO_POST'}),t,t);
}
export async function evaluateWorkflow(raw: unknown, user: AppUser | null, options: {forceLocalOnly?:boolean; confirmedFields?:string[]; evidence?:string; expectedRevision?:number; confirmations?:SourceConfirmation[]} = {}) {
  // Thuế suất ngoài 0/5/8/10% không bị lỗi 400: coi là dữ kiện chưa xác minh và hỏi lại bằng câu hỏi cụ thể.
  const rawTaxRate=(raw as {taxRate?:unknown})?.taxRate;
  const nonStandardTaxRate=typeof rawTaxRate==='number' && !STANDARD_VAT_RATES.includes(rawTaxRate) ? rawTaxRate : undefined;
  const parseable=nonStandardTaxRate===undefined ? raw : {...(raw as object),taxRate:undefined};
  const partial=Object.fromEntries(Object.entries(InvoiceInputSchema.partial().parse(parseable)).filter(([,value])=>value!==undefined)) as Partial<InvoiceInput>;
  if((raw as any)?.sourceUncertainFields && (!Array.isArray((raw as any).sourceUncertainFields) || (raw as any).sourceUncertainFields.some((f:unknown)=>typeof f!=='string')))throw new WorkflowError('Danh sách trường nghi vấn sai cấu trúc.',400);
  const required=coreDecisionFields;
  const missing=required.filter(k=>partial[k] === undefined);
  const id=partial.id || crypto.randomUUID();
  const invoice=InvoiceInputSchema.parse({invoiceNumber:'Chưa xác minh',invoiceDate:'2026-01-01',supplierTaxCode:'0000000000',supplierName:'Chưa xác minh',itemName:'Chưa xác minh',preTaxAmount:0,taxRate:0,taxAmount:0,totalAmount:0,...partial,id});
  const db=getDatabase(); recoverExpiredEvaluations(); const policy=getActivePolicy();
  let existing: WorkflowRecord | null=null; try {existing=readRecord(id);} catch(e) {if (!(e instanceof WorkflowError && e.status===404)) throw e;}
  if (existing?.status==='PAUSED') throw new WorkflowError('Hồ sơ đang dừng; tiếp tục trước khi đánh giá.');
  if (existing?.status==='EVALUATING') throw new WorkflowError('Hồ sơ đang được xử lý.');
  const source=invoice.sourceArtifactId ? db.prepare('SELECT a.content_hash, a.invoice_id, r.payload_json review FROM document_artifacts a LEFT JOIN extraction_reviews r ON r.artifact_id=a.id WHERE a.id=?').get(invoice.sourceArtifactId) as {content_hash:string;invoice_id:string;review?:string}|undefined : undefined;
  let sharedDuplicateSource=false;
  if(source && ![id,`pending:${invoice.sourceArtifactId}`].includes(source.invoice_id)){
    const canonical=db.prepare('SELECT payload_json FROM invoices WHERE id=?').get(source.invoice_id) as {payload_json:string}|undefined;
    if(canonical){const original=JSON.parse(canonical.payload_json);sharedDuplicateSource=original.supplierTaxCode===invoice.supplierTaxCode && original.invoiceNumber===invoice.invoiceNumber && (original.invoiceSeries || '')===(invoice.invoiceSeries || '');}
  }
  if (invoice.sourceArtifactId && (!source || source.content_hash!==invoice.sourceHash || (!sharedDuplicateSource && ![id,`pending:${invoice.sourceArtifactId}`].includes(source.invoice_id)))) throw new WorkflowError('Chứng từ nguồn không thuộc hồ sơ này.');
  const extracted=source?.review ? JSON.parse(source.review) : {};
  const sourceInvoice=(extracted.cachedResult?.invoice || null) as Record<string,unknown>|null;
  const sourceConflicts:string[]=sourceInvoice ? SOURCE_DIFF_FIELDS.filter(field=>differsFromSource(field,sourceInvoice[field],(invoice as unknown as Record<string,unknown>)[field])) : [];
  const previousReview=existing ? JSON.parse(existing.source_review_json || '{}') : {};
  const dailyTotal=sameDayPurchaseTotal(invoice);
  const requiredFields=requiredDecisionFields(invoice,policy.config,dailyTotal);
  // Flagged optional identifiers remain relevant even if their extracted value is absent.
  for(const field of ['buyerTaxCode','invoiceSeries','taxAuthorityCode','signingDate','items','isAdjustment'])if([...(extracted.uncertainFields||[]),...((raw as any)?.sourceUncertainFields||[])].includes(field))requiredFields.add(field);
  const unknownBusinessFields=missingBusinessFacts(invoice,policy.config,dailyTotal);
  const sourceFields=[...(extracted.uncertainFields || []),...((raw as any)?.sourceUncertainFields || []),...unknownBusinessFields,...sourceConflicts];
  const inferredFields=extracted.inferredFields || [];
  const oldInvoice=existing ? JSON.parse(existing.payload_json) : {};
  const priorConfirmations = (previousReview.confirmations || []) as Array<{field:string;value:unknown;evidence:string;confirmedBy:string;confirmedAt:string;artifactId?:string}>;
  const confirmations = priorConfirmations.filter(c => JSON.stringify(c.value) === JSON.stringify((invoice as any)[c.field]));
  const confirmed=(previousReview.confirmedFields || []).filter((field:string)=>JSON.stringify(oldInvoice[field])===JSON.stringify((invoice as any)[field]));
  const newConfirmations = z.array(SourceConfirmationSchema).max(100).parse(options.confirmations || []);
  const legacyFields = z.array(z.string().refine(field => field in InvoiceInputSchema.shape, 'Trường xác minh không hợp lệ')).max(100).parse(options.confirmedFields || []);
  if (newConfirmations.length || legacyFields.length) {
    if (!user || user.role==='ACCOUNTANT') throw new WorkflowError('KTT/CFO cần xác minh dữ liệu.',403);
    if (legacyFields.length && (!options.evidence || options.evidence.trim().length<8)) throw new WorkflowError('KTT/CFO cần ghi bằng chứng xác minh dữ liệu.',403);
    for (const confirmation of [...newConfirmations, ...legacyFields.map(field => ({field,evidence:options.evidence!}))]) {
      const value = (invoice as any)[confirmation.field];
      if (missing.includes(confirmation.field as typeof missing[number]) || value === undefined || value === 'UNKNOWN')
        throw new WorkflowError(`Chưa có giá trị để xác minh ${fieldLabels[confirmation.field] || confirmation.field}.`,400);
      confirmed.push(confirmation.field);
      const existingConfirmation = confirmations.find(c => c.field===confirmation.field && JSON.stringify(c.value)===JSON.stringify(value) && c.evidence===confirmation.evidence);
      if (!existingConfirmation) {
        const index=confirmations.findIndex(c=>c.field===confirmation.field); if(index>=0)confirmations.splice(index,1);
        confirmations.push({field:confirmation.field,value,evidence:confirmation.evidence,confirmedBy:user.id,confirmedAt:jsonNow(),artifactId:invoice.sourceArtifactId});
      }
    }
  }
  const identityVerified = extracted.supplierIdentity?.status === 'VERIFIED'
    && extracted.supplierIdentity.supplierTaxCode === invoice.supplierTaxCode
    && extracted.supplierIdentity.legalName === invoice.supplierName;
  const allWarnings=[...new Set<string>([...missing,...sourceFields,...inferredFields,...(previousReview.unresolvedFields || [])])];
  const unresolved=allWarnings.filter(field=>requiredFields.has(field))
    .filter(f=>identityVerified && ['supplierName','supplierTaxCode'].includes(f)
      ? missing.includes(f as typeof missing[number])
      : !confirmed.includes(f) || missing.includes(f as typeof missing[number]));
  const recordedIdentity = extracted.supplierIdentity || previousReview.supplierIdentity;
  const supplierIdentity = recordedIdentity?.status === 'VERIFIED'
    && (recordedIdentity.supplierTaxCode !== invoice.supplierTaxCode || recordedIdentity.legalName !== invoice.supplierName)
    ? { ...recordedIdentity, status: 'CONFLICT', message: 'Thông tin nhà cung cấp đã thay đổi so với kết quả đối chiếu nguồn.' }
    : recordedIdentity;
  const review={rawInput:raw,sourceValues:extracted.invoice || previousReview.sourceValues || null,sourceConflicts,supplierIdentity,inferredFields,unresolvedFields:unresolved,nonBlockingFields:allWarnings.filter(field=>!requiredFields.has(field)),confirmedFields:[...new Set(confirmed)],confirmations,evidence:options.evidence || previousReview.evidence || null,confirmedBy:newConfirmations.length || legacyFields.length ? user?.id : previousReview.confirmedBy};
  const hash=hashPayload({invoice,review});
  if(existing?.content_hash===hash && existing.evaluation_id && ['APPROVED','REJECTED','WAITING_CFO','WAITING_CHIEF_ACCOUNTANT','FORWARDED'].includes(existing.status)) return {decision:JSON.parse(existing.decision_json!),workflow:{status:existing.status,revision:existing.revision,evaluationId:existing.evaluation_id,duplicate:true},policy};
  if(existing && options.expectedRevision!==existing.revision) throw new WorkflowError('Cần phiên bản hồ sơ hiện hành để bổ sung dữ liệu.');
  const initialSnapshot=existing ? snapshot(existing) : {status:'RECEIVED',approvedTax:0,taxHold:0,pausedFrom:null,voucher:null};
  const revision=existing ? existing.revision+1 : 1; const t=jsonNow();
  const attemptId=crypto.randomUUID();
  const leaseMs=Math.max(60_000,Math.min(300_000,Number(process.env.EVALUATION_LEASE_MS) || 120_000));
  const deadline=new Date(Date.now()+leaseMs).toISOString();
  db.transaction(()=>{
    db.prepare(`INSERT INTO invoices (id,invoice_number,supplier_tax_code,invoice_date,payload_json,content_hash,status,approved_deductible_tax,created_by_user_id,created_at,updated_at,revision,source_review_json) VALUES (?,?,?,?,?,?,'EVALUATING',0,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET invoice_number=excluded.invoice_number,supplier_tax_code=excluded.supplier_tax_code,invoice_date=excluded.invoice_date,payload_json=excluded.payload_json,content_hash=excluded.content_hash,status='EVALUATING',approved_deductible_tax=0,updated_at=excluded.updated_at,revision=excluded.revision,source_review_json=excluded.source_review_json`).run(id,invoice.invoiceNumber,invoice.supplierTaxCode,invoice.invoiceDate,JSON.stringify(invoice),hash,user?.id || null,t,t,revision,JSON.stringify(review));
    db.prepare('UPDATE invoices SET evaluation_attempt_id=?,evaluation_deadline=?,evaluation_policy_json=? WHERE id=?').run(attemptId,deadline,JSON.stringify(policy),id);
    db.prepare('INSERT INTO invoice_revisions VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),id,revision,JSON.stringify(invoice),JSON.stringify(review),t);
    const confirmedSupplierName = confirmations.find(c => c.field === 'supplierName' && c.value === invoice.supplierName);
    const confirmedSupplierTaxCode = confirmations.find(c => c.field === 'supplierTaxCode' && c.value === invoice.supplierTaxCode);
    if (user && confirmedSupplierName && confirmedSupplierTaxCode) {
      recordConfirmedSupplierAlias({
        supplierName: invoice.supplierName,
        supplierTaxCode: invoice.supplierTaxCode,
        supplierAddress: invoice.supplierAddress,
        invoiceId: id,
        nameEvidence: confirmedSupplierName.evidence,
        taxCodeEvidence: confirmedSupplierTaxCode.evidence,
        verifiedBy: `${confirmedSupplierName.confirmedBy},${confirmedSupplierTaxCode.confirmedBy}`,
        confirmedAt: [confirmedSupplierName.confirmedAt, confirmedSupplierTaxCode.confirmedAt].sort().at(-1)
      });
    }
    if(source) db.prepare("UPDATE document_artifacts SET invoice_id=? WHERE id=? AND invoice_id LIKE 'pending:%'").run(id,invoice.sourceArtifactId);
    syncVoucher(readRecord(id)); recomputeMacro();
    recordAction(readRecord(id),user,'EVALUATION_STARTED','Tiếp nhận revision mới; khóa tự duyệt cho đến khi đánh giá xong.',initialSnapshot);
  })();
  try {
    const result=await queryJevReferee(unresolved.length ? {...invoice,isImageBlurry:true} : invoice,{forceLocalOnly:options.forceLocalOnly,useGenerativeQGen:process.env.QGEN_AI==='1' && !options.forceLocalOnly && !unresolved.length,customConfig:policy.config,policyVersion:policy.version,customSopVersion:policy.version,macroState:getMacroState()});
    let decision=result.decision;
    let fieldAsks:FieldAsk[]=[];
    if(unresolved.length && decision.status==='ESCALATED') {
      const names:Record<string,string>={invoiceNumber:'Số hóa đơn',invoiceDate:'Ngày lập',supplierTaxCode:'MST bên bán',supplierName:'Tên bên bán',itemName:'Nội dung hàng hóa',preTaxAmount:'Tiền trước thuế',taxRate:'Thuế suất',taxAmount:'Tiền thuế',totalAmount:'Tổng thanh toán',paymentMethod:'Thanh toán',hasBankSlip:'Chứng từ ngân hàng',hasItemManifest:'Bảng kê hàng hóa',sellerStatus:'Trạng thái bên bán'};
      const isMissing=(field:string)=>missing.includes(field as typeof missing[number]) || (field==='taxRate' && nonStandardTaxRate!==undefined);
      const details=unresolved.map(field=>`${fieldLabels[field] || names[field] || field}: ${isMissing(field)?'chưa có dữ liệu':sourceConflicts.includes(field)?'khác chứng từ gốc':'chưa xác minh'}`).join('; ');
      const threshold=paymentThreshold(invoice,policy.config);
      fieldAsks=unresolved.map(field=>fieldAsk(field,invoice,{missing:isMissing(field),nonCashThreshold:threshold,rawTaxRate:field==='taxRate'?nonStandardTaxRate:undefined,sourceValue:sourceConflicts.includes(field)?sourceInvoice?.[field]:undefined}));
      const engineFindings=decision.findings?.filter(f=>!['RULE_DATA_QUALITY','RULE_IMAGE_BLURRY'].includes(f.ruleId)) || [];
      const sourceOptions:[ActionOption,ActionOption]=[
        {id:'A',label:'Xác nhận các giá trị theo câu trả lời rồi đánh giá lại',actionDescription:'Ghi giá trị và nguồn cho từng trường; chạy lại mọi quy tắc.',resultingAction:'CONFIRM_CORRECTED_DATA'},
        {id:'B',label:'Chưa đủ chứng từ — yêu cầu bổ sung, chưa duyệt thuế',actionDescription:'Giữ hồ sơ chờ người nộp bổ sung; chưa duyệt thuế.',resultingAction:'REQUEST_INFORMATION'}];
      const sourceFinding={ruleId:'RULE_SOURCE_REVIEW',kind:'DATA_QUALITY' as const,severity:'HIGH' as const,riskGroup:'UNCERTAIN_INFO' as const,flaggedReason:`Cần xác nhận ${unresolved.length} dữ kiện trước khi kết luận (${details}).`,
        plainExplanation:'Một số dữ kiện cần cho quy tắc chưa có, chưa được xác minh hoặc khác chứng từ gốc. Hệ thống không đoán và chưa duyệt thuế cho đến khi người có thẩm quyền xác nhận.',legalBasis:'Quy trình kiểm soát dữ liệu đầu vào',sopClause:'Dữ liệu đầu vào',actionableQuestion:'Xác nhận từng dữ kiện bên dưới.',options:sourceOptions};
      // Không kết luận "vi phạm"/"vượt quyền" dựa trên dữ kiện chưa xác minh: nhóm chính tính theo bảng phân loại.
      const ordered=orderFindings([sourceFinding,...engineFindings],unresolved);
      const primary=ordered[0];
      const primaryOptions=(primary.options?.length===2?primary.options:sourceOptions) as [ActionOption,ActionOption];
      decision={...decision,riskGroup:groupOf(primary.ruleId,primary.kind),riskGroups:riskGroupsOf(ordered,unresolved),flaggedReason:ordered.map(f=>f.flaggedReason).join(' '),actionableQuestion:primary.actionableQuestion || sourceFinding.flaggedReason,
        options:primaryOptions,plainExplanation:primary.plainExplanation,sopClause:primary.sopClause || decision.sopClause,findings:ordered};
    }
    if(decision.status==='ESCALATED'){
      const groundedQuestion=!unresolved.length && decision.handoff?.questionSource==='AI_GROUNDED'?decision.actionableQuestion:undefined;
      decision={...decision,findings:decision.findings?.map(f=>describeRuleEvidence(f,invoice.invoiceDate))};
      const primary=decision.findings?.[0];
      decision=buildHandoff(invoice,{...decision,sopClause:primary?.sopClause || decision.sopClause},{policyHash:policy.contentHash || hashPayload(policy),unresolvedFields:unresolved,missingFields:[...missing],confirmations,fieldAsks});
      if(groundedQuestion){decision={...decision,actionableQuestion:groundedQuestion,handoff:{...decision.handoff!,question:groundedQuestion,questionSource:'AI_GROUNDED'}};}
      decision.handoff!.automatedCheck=checkHandoff(decision);
      if(!decision.handoff!.automatedCheck.valid)throw new WorkflowError('Cấu trúc chuyển tiếp không đủ dữ kiện; giữ hồ sơ để kiểm tra.',500);
    }
    RefereeDecisionSchema.parse(decision);
    const evaluationId=crypto.randomUUID();
    db.transaction(()=>{
      const current=readRecord(id);
      if(current.revision!==revision || current.status!=='EVALUATING' || current.evaluation_attempt_id!==attemptId) throw new WorkflowError('Hồ sơ đã dừng hoặc thay đổi; kết quả AI không được ghi nhận.');
      const before=snapshot(current);
      if(current.tax_hold) throw new WorkflowError('Cần giải phóng giữ thuế trước khi ghi kết quả.');
      const status=decision.status==='ROUTINE' ? 'APPROVED' : decision.requiresCFO ? 'WAITING_CFO' : 'WAITING_CHIEF_ACCOUNTANT';
      db.prepare('INSERT INTO evaluations (id,invoice_id,decision_json,policy_version,legal_version,created_at) VALUES (?,?,?,?,?,?)').run(evaluationId,id,JSON.stringify(decision),policy.version,decision.applicableRegulations?.join(',') || null,jsonNow());
      db.prepare('UPDATE invoices SET status=?,approved_deductible_tax=?,updated_at=?,evaluation_deadline=NULL WHERE id=?').run(status,decision.status==='ROUTINE' ? decision.approvedTaxAmount : 0,jsonNow(),id);
      const row=readRecord(id);syncVoucher(row);recomputeMacro();
      recordAction(row,null,decision.status==='ROUTINE'?'ROUTINE_AUTO_APPROVED':'INVOICE_EVALUATED',decision.plainExplanation,before);
    })();
    const row=readRecord(id);
    return {...result,decision,workflow:{status:row.status,revision,evaluationId,autoApproved:decision.status==='ROUTINE',externalSync:'MANUAL',internalVoucherId:(db.prepare('SELECT id FROM internal_vouchers WHERE invoice_id=?').get(id) as {id:string}|undefined)?.id || null},policy};
  } catch(error) {
    db.transaction(()=>{const row=readRecord(id);if(row.status==='EVALUATING' && row.revision===revision){const before=snapshot(row);db.prepare("UPDATE invoices SET status='ON_HOLD', updated_at=? WHERE id=?").run(jsonNow(),id);recordAction(row,null,'EVALUATION_FAILED','Không có kết quả chắc chắn; giữ hồ sơ để thử lại.',before);}})();
    throw error;
  }
}
export function applyWorkflowAction(id: string, user: AppUser, input: {action:string;reason:string;evaluationId?:string|null;revision:number;optionId?:string;targetStatus?:string;resolvedFindingIds?:string[]}) {
  if(user.role==='ACCOUNTANT') throw new WorkflowError('Cần Kế toán trưởng hoặc CFO.',403);
  if(input.reason.trim().length<8) throw new WorkflowError('Ghi lý do ít nhất 8 ký tự.',400);
  const db=getDatabase();
  return db.transaction(()=>{
    const row=readRecord(id); assertCurrent(row,input.evaluationId,input.revision);const before=snapshot(row);
    let eventType=input.action;
    if(input.action==='PAUSE') {
      if(row.status==='PAUSED') throw new WorkflowError('Hồ sơ đã dừng.');
      db.prepare("UPDATE invoices SET paused_from=status,status='PAUSED',approved_deductible_tax=0 WHERE id=?").run(id);
    } else if(input.action==='RESUME') {
      if(row.status!=='PAUSED') throw new WorkflowError('Hồ sơ chưa dừng.');
      // Resume never revives a discarded/in-flight AI result or stale approval.
      db.prepare("UPDATE invoices SET status='ON_HOLD',paused_from=NULL,approved_deductible_tax=0 WHERE id=?").run(id);
    } else if(input.action==='TAX_HOLD') {
      db.prepare("UPDATE invoices SET tax_hold=1,status='ON_HOLD',approved_deductible_tax=0 WHERE id=?").run(id);
    } else if(input.action==='RELEASE_TAX_HOLD') {
      db.prepare("UPDATE invoices SET tax_hold=0,status='ON_HOLD',approved_deductible_tax=0 WHERE id=?").run(id);
    } else if(input.action==='UNDO') {
      const latest=undoCandidate(row);
      if(!latest) throw new WorkflowError('Không có thao tác an toàn để hoàn tác.');
      const payload=latest.payload;
      const saved=payload.before;
      db.prepare('UPDATE invoices SET status=?,approved_deductible_tax=?,tax_hold=?,paused_from=? WHERE id=?').run(saved.status==='EVALUATING'?'ON_HOLD':saved.status,saved.approvedTax,saved.taxHold,saved.pausedFrom,id);
      db.prepare("UPDATE corporate_precedents SET status='REVOKED' WHERE id IN (SELECT precedent_id FROM precedent_scopes WHERE origin_event_id=?)").run(latest.id);
      db.prepare('UPDATE invoices SET revision=revision+1,updated_at=? WHERE id=?').run(jsonNow(),id);
      syncVoucher(readRecord(id));recomputeMacro();
      const event=recordAction(row,user,'INVOICE_ACTION_REVERTED',input.reason,before,{reversesEventId:latest.id});
      return {ok:true,status:readRecord(id).status,revision:readRecord(id).revision,auditEventId:event.id};
    } else {
      if(['APPROVED','REJECTED','PAUSED','EVALUATING'].includes(row.status)) throw new WorkflowError('Hồ sơ không còn chờ xử lý.');
      let target=input.targetStatus;
      if(input.action==='RESOLVE') {
        const d=RefereeDecisionSchema.parse(JSON.parse(row.decision_json!));
        if(d.status!=='ESCALATED') throw new WorkflowError('Hồ sơ không phải ngoại lệ.');
        if((d.requiresCFO || row.status==='FORWARDED') && user.role!=='CFO') throw new WorkflowError('Cần CFO.',403);
        const option=d.options.find(o=>o.id===input.optionId);if(!option) throw new WorkflowError('Phương án không hợp lệ.',400);
        target=['ACCEPT_WITH_DOCS','ACCEPT_ADJUSTMENT','ACCEPT_WITH_DEFENSE_DOSSIER'].includes(option.resultingAction)?'APPROVED':option.resultingAction==='FORWARD_TO_CFO'?'FORWARDED':option.resultingAction==='REJECT_TAX_DEDUCTION'?'REJECTED':'ON_HOLD';
        db.prepare('INSERT INTO human_resolutions (id,invoice_id,evaluation_id,actor_id,actor_role,option_id,resulting_action,reason,accepted,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),id,row.evaluation_id,user.id,user.role,option.id,option.resultingAction,input.reason,target==='APPROVED'?1:0,jsonNow());
        eventType='HUMAN_RESOLUTION_RECORDED';
      }
      if(!target || !['APPROVED','ON_HOLD','REJECTED','FORWARDED'].includes(target)) throw new WorkflowError('Trạng thái không hợp lệ.',400);
      if(target==='APPROVED') {const block=approvalBlock(row,user);if(block) throw new WorkflowError(block,403);const d=JSON.parse(row.decision_json!);if(d.status==='ESCALATED' && d.findings?.some((f:{ruleId:string})=>!input.resolvedFindingIds?.includes(f.ruleId)))throw new WorkflowError('Cần xác nhận giải quyết từng phát hiện còn mở trước khi duyệt.',400);}
      const invoice=JSON.parse(row.payload_json);
      db.prepare('UPDATE invoices SET status=?,approved_deductible_tax=? WHERE id=?').run(target,target==='APPROVED'?invoice.taxAmount:0,id);
    }
    db.prepare('UPDATE invoices SET revision=revision+1,updated_at=? WHERE id=?').run(jsonNow(),id);
    syncVoucher(readRecord(id));recomputeMacro();
    const event=recordAction(row,user,eventType,input.reason,before);
    return {ok:true,status:readRecord(id).status,revision:readRecord(id).revision,auditEventId:event.id,macroState:getMacroState()};
  })();
}

/** Attach bank evidence without reviving an old evaluation or an in-flight AI result. */
export function recordBankEvidence(id: string, transactionId: string, user: AppUser) {
  const db = getDatabase();
  return db.transaction(() => {
    const row = readRecord(id);
    const invoice = InvoiceInputSchema.parse(JSON.parse(row.payload_json));
    if (invoice.hasBankSlip === true && invoice.bankReference === transactionId) return false;
    const before = snapshot(row);
    const next = { ...invoice, hasBankSlip: true, bankReference: transactionId };
    const review = { ...JSON.parse(row.source_review_json || '{}'), needsReevaluation: true,
      bankEvidence: { transactionId, actorId: user.id, recordedAt: jsonNow() } };
    const revision = row.revision + 1;
    db.prepare(`UPDATE invoices SET payload_json=?,source_review_json=?,content_hash=?,revision=?,
      status=?,approved_deductible_tax=0,updated_at=? WHERE id=?`).run(JSON.stringify(next),JSON.stringify(review),
        hashPayload({invoice:next,review}),revision,row.status==='PAUSED'?'PAUSED':'ON_HOLD',jsonNow(),id);
    db.prepare('INSERT INTO invoice_revisions VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),id,revision,JSON.stringify(next),JSON.stringify(review),jsonNow());
    syncVoucher(readRecord(id)); recomputeMacro();
    recordAction(row,user,'BANK_EVIDENCE_RECORDED','Bổ sung bằng chứng ngân hàng; cần đánh giá lại toàn bộ hồ sơ.',before,{transactionId});
    return true;
  })();
}
