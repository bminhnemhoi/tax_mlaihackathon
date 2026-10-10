import {evaluateInvoiceLocally} from './policyEngine';
import {challengeCases,demoCompanyTaxCode} from '@/data/verification/challengeCases';
import {getActivePolicy} from '@/lib/server/db';
import crypto from 'node:crypto';
import {getDatabase,jsonNow} from '@/lib/server/db';
import {appendAuditEvent} from '@/lib/server/audit';
import {AppUser} from '@/lib/server/auth';
import {readRecord,WorkflowError} from './workflowService';
import {z} from 'zod';
const FeedbackSchema=z.object({precedentId:z.string().min(1),invoiceId:z.string().min(1),evaluationId:z.string().min(1),shouldEscalate:z.boolean(),reason:z.string().trim().min(8)});
export function submitFeedback(raw:unknown,user:AppUser) {
 if(user.role==='ACCOUNTANT')throw new WorkflowError('Hậu kiểm cần KTT/CFO.',403);
 const input=FeedbackSchema.parse(raw);const db=getDatabase();
 return db.transaction(()=>{
 const row=readRecord(input.invoiceId);if(row.evaluation_id!==input.evaluationId)throw new WorkflowError('Evaluation đã thay đổi.');
 const scope=db.prepare(`SELECT s.*,p.supplier_tax_code,p.risk_pattern,p.status,p.effective_from,p.effective_to FROM precedent_scopes s JOIN corporate_precedents p ON p.id=s.precedent_id WHERE s.precedent_id=?`).get(input.precedentId) as {purpose:string;maximum_amount:number;current_threshold:number;version:number;supplier_tax_code:string;risk_pattern:string;status:string;effective_from:string;effective_to:string}|undefined;
 if(!scope || scope.status!=='ACTIVE')throw new WorkflowError('Tiền lệ không hoạt động.');
 const invoice=JSON.parse(row.payload_json);const decision=JSON.parse(row.decision_json!);
 if(invoice.supplierTaxCode!==scope.supplier_tax_code || !invoice.itemName.toLocaleLowerCase('vi-VN').includes(scope.purpose.toLocaleLowerCase('vi-VN')) || invoice.invoiceDate<scope.effective_from || invoice.invoiceDate>scope.effective_to)throw new WorkflowError('Hồ sơ ngoài phạm vi tiền lệ.');
 if(decision.findings?.some((f:{kind:string})=>f.kind!=='INTERNAL_POLICY') || JSON.parse(row.source_review_json).unresolvedFields?.length)throw new WorkflowError('Không dùng ca luật định, dữ liệu hoặc thẩm quyền để học tiền lệ.');
 const amount=Math.abs(invoice.totalAmount);
 db.prepare('INSERT INTO precedent_feedback VALUES (?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),input.precedentId,row.id,input.evaluationId,amount,input.shouldEscalate?1:0,input.reason,user.id,jsonNow());
 return calibrateThreshold(input.precedentId,user);
 })();
}
export function calibrateThreshold(precedentId:string,user:AppUser) {
 const db=getDatabase();const scope=db.prepare('SELECT * FROM precedent_scopes WHERE precedent_id=?').get(precedentId) as {maximum_amount:number;current_threshold:number;version:number}|undefined;
 if(!scope)throw new WorkflowError('Không tìm thấy phạm vi tiền lệ.');
 const samples=db.prepare('SELECT amount,should_escalate FROM precedent_feedback WHERE precedent_id=?').all(precedentId) as {amount:number;should_escalate:number}[];
 if(samples.length<10)return {status:'INSUFFICIENT_FEEDBACK',sampleCount:samples.length,threshold:scope.current_threshold};
 const score=(threshold:number)=>({missed:samples.filter(s=>s.should_escalate && s.amount<=threshold).length,unnecessary:samples.filter(s=>!s.should_escalate && s.amount>threshold).length});
 const baseline=score(scope.current_threshold);
 const candidates=[...new Set([0,...samples.map(s=>s.amount)])].filter(n=>n<=scope.maximum_amount).map(threshold=>({threshold,...score(threshold)})).filter(c=>c.missed===0).sort((a,b)=>a.unnecessary-b.unnecessary || a.threshold-b.threshold);
 const best=candidates[0];
 // The fixed envelope prevents statutory/data/authority findings being cleared; only this scoped internal finding changes.
 if(!best || (baseline.missed===0 && best.unnecessary>=baseline.unnecessary))return {status:'UNCHANGED',sampleCount:samples.length,threshold:scope.current_threshold};
 const config={...getActivePolicy().config,companyTaxCode:demoCompanyTaxCode};
 const probe={...challengeCases[0].invoice,id:'SAFETY-GATE',invoiceNumber:'SAFETY-GATE'};
 const adversarial=[{...probe,isImageBlurry:true},{...probe,totalAmount:probe.totalAmount+100},{...challengeCases[3].invoice,id:'SAFETY-CASH',invoiceNumber:'SAFETY-CASH'},{...challengeCases[4].invoice,id:'SAFETY-AUTH',invoiceNumber:'SAFETY-AUTH'}];
 if(!Number.isFinite(best.threshold) || best.threshold<0 || best.threshold>scope.maximum_amount || adversarial.some((inv,i)=>{const d=evaluateInvoiceLocally(inv,config);return d.status!=='ESCALATED' || !d.findings?.some(f=>f.kind===(i<2?'DATA_QUALITY':i===2?'STATUTORY':'AUTHORITY'));}))throw new WorkflowError('Bộ kiểm tra an toàn không đạt; giữ nguyên ngưỡng.');
 const version=scope.version+1;
 db.prepare('INSERT INTO threshold_versions VALUES (?,?,?,?,?,?,1,?)').run(crypto.randomUUID(),precedentId,version,scope.current_threshold,best.threshold,samples.length,jsonNow());
 db.prepare('UPDATE precedent_scopes SET current_threshold=?,version=? WHERE precedent_id=?').run(best.threshold,version,precedentId);
 appendAuditEvent({eventType:'THRESHOLD_ADAPTED',entityId:precedentId,actorId:user.id,payload:{version,previousThreshold:scope.current_threshold,threshold:best.threshold,sampleCount:samples.length,missed:0,unnecessary:best.unnecessary,validation:'Feedback within CFO envelope; not an independent accuracy estimate'}});
 return {status:'ADAPTED',version,threshold:best.threshold,sampleCount:samples.length};
}
export function rollbackThreshold(precedentId:string,user:AppUser,reason='CFO phục hồi ngưỡng trước') {
 if(user.role!=='CFO')throw new WorkflowError('Rollback ngưỡng cần CFO.',403);
 if(reason.trim().length<8)throw new WorkflowError('Cần lý do rollback ít nhất 8 ký tự.',400);
 const db=getDatabase();return db.transaction(()=>{
 const latest=db.prepare('SELECT * FROM threshold_versions WHERE precedent_id=? AND active=1 ORDER BY version DESC LIMIT 1').get(precedentId) as {id:string;previous_threshold:number}|undefined;
 if(!latest)throw new WorkflowError('Chưa có ngưỡng để rollback.');
 db.prepare('UPDATE precedent_scopes SET current_threshold=?,version=version+1 WHERE precedent_id=?').run(latest.previous_threshold,precedentId);
 db.prepare('UPDATE threshold_versions SET active=0 WHERE id=?').run(latest.id);
 appendAuditEvent({eventType:'THRESHOLD_ROLLED_BACK',entityId:precedentId,actorId:user.id,payload:{reason,threshold:latest.previous_threshold,reversesVersionId:latest.id}});
 return {status:'ROLLED_BACK',threshold:latest.previous_threshold};
 })();
}
