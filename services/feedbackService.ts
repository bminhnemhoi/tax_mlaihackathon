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
 const existing=db.prepare('SELECT should_escalate,reason FROM precedent_feedback WHERE precedent_id=? AND invoice_id=? AND evaluation_id=?').get(input.precedentId,row.id,input.evaluationId) as {should_escalate:number;reason:string}|undefined;
 if(existing){
  if(Boolean(existing.should_escalate)!==input.shouldEscalate || existing.reason!==input.reason)throw new WorkflowError('Evaluation đã có nhãn hậu kiểm khác; không ghi đè nhãn.');
  return {...calibrateThreshold(input.precedentId,user),duplicate:true};
 }
 db.prepare('INSERT INTO precedent_feedback VALUES (?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),input.precedentId,row.id,input.evaluationId,amount,input.shouldEscalate?1:0,input.reason,user.id,jsonNow());
 return calibrateThreshold(input.precedentId,user);
 })();
}
type Sample={amount:number;should_escalate:number};
/** Khoảng tin cậy Wilson 95% cho tỉ lệ k/n (mẫu nhỏ vẫn cho khoảng trung thực, thường rất rộng). */
export function wilson95(k:number,n:number):{rate:number|null;low:number|null;high:number|null} {
 if(!n)return {rate:null,low:null,high:null};
 const z=1.96,p=k/n,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));
 return {rate:p,low:Math.max(0,(c-m)/d),high:Math.min(1,(c+m)/d)};
}
/** Miss: ca lẽ ra phải chuyển tiếp nhưng ngưỡng cho tự giải tỏa. Unnecessary: ca không cần chuyển tiếp nhưng vẫn bị giữ. */
function scoreThreshold(samples:Sample[],threshold:number) {
 const positives=samples.filter(s=>s.should_escalate),negatives=samples.filter(s=>!s.should_escalate);
 const missed=positives.filter(s=>s.amount<=threshold).length,unnecessary=negatives.filter(s=>s.amount>threshold).length;
 return {missed,unnecessary,positives:positives.length,negatives:negatives.length,missRate:wilson95(missed,positives.length),unnecessaryRate:wilson95(unnecessary,negatives.length)};
}
export function calibrateThreshold(precedentId:string,user:AppUser) {
 const db=getDatabase();const scope=db.prepare('SELECT * FROM precedent_scopes WHERE precedent_id=?').get(precedentId) as {maximum_amount:number;current_threshold:number;version:number}|undefined;
 if(!scope)throw new WorkflowError('Không tìm thấy phạm vi tiền lệ.');
 // Thứ tự thời gian: học trên phản hồi cũ, kiểm chứng trên phản hồi mới nhất (holdout) — không chấm trên chính dữ liệu đã học.
 const samples=db.prepare('SELECT amount,should_escalate FROM precedent_feedback WHERE precedent_id=? ORDER BY created_at, rowid').all(precedentId) as Sample[];
 if(samples.length<10)return {status:'INSUFFICIENT_FEEDBACK',sampleCount:samples.length,threshold:scope.current_threshold};
 const holdoutSize=Math.max(3,Math.round(samples.length*0.3));
 const train=samples.slice(0,samples.length-holdoutSize),holdout=samples.slice(samples.length-holdoutSize);
 const candidates=[...new Set([0,...train.map(s=>s.amount)])].filter(n=>n<=scope.maximum_amount).map(threshold=>({threshold,...scoreThreshold(train,threshold)})).filter(c=>c.missed===0).sort((a,b)=>a.unnecessary-b.unnecessary || a.threshold-b.threshold);
 const best=candidates[0];
 const baselineAll=scoreThreshold(samples,scope.current_threshold);
 // The fixed envelope prevents statutory/data/authority findings being cleared; only this scoped internal finding changes.
 if(!best || best.threshold===scope.current_threshold)return {status:'UNCHANGED',sampleCount:samples.length,threshold:scope.current_threshold,baseline:baselineAll};
 const holdoutBaseline=scoreThreshold(holdout,scope.current_threshold),holdoutCandidate=scoreThreshold(holdout,best.threshold);
 const evaluation={trainSize:train.length,holdoutSize:holdout.length,holdout:{baseline:holdoutBaseline,candidate:holdoutCandidate},all:{baseline:baselineAll,candidate:scoreThreshold(samples,best.threshold)}};
 // Chỉ chấp nhận khi trên holdout không bỏ sót thêm và chuyển tiếp thừa giảm (hoặc không tăng) — đồng thời toàn tập phải giảm chuyển tiếp thừa.
 if(holdoutCandidate.missed>holdoutBaseline.missed || holdoutCandidate.unnecessary>holdoutBaseline.unnecessary || evaluation.all.candidate.unnecessary>=baselineAll.unnecessary || evaluation.all.candidate.missed>baselineAll.missed){
  appendAuditEvent({eventType:'THRESHOLD_CANDIDATE_REJECTED',entityId:precedentId,actorId:user.id,payload:{candidate:best.threshold,currentThreshold:scope.current_threshold,evaluation,reason:'Ngưỡng đề xuất không cải thiện trên tập kiểm chứng (holdout) theo thời gian.'}});
  return {status:'REJECTED_BY_HOLDOUT',sampleCount:samples.length,threshold:scope.current_threshold,candidate:best.threshold,evaluation};
 }
 const config=getActivePolicy().config;
 const precedent=db.prepare('SELECT p.supplier_tax_code,p.effective_from,s.purpose FROM corporate_precedents p JOIN precedent_scopes s ON p.id=s.precedent_id WHERE p.id=?').get(precedentId) as {supplier_tax_code:string;effective_from:string;purpose:string};
 const amount=Math.max(1,best.threshold);
 const probe={...challengeCases[0].invoice,id:'SAFETY-GATE',invoiceNumber:'SAFETY-GATE',supplierTaxCode:precedent.supplier_tax_code,buyerTaxCode:config.companyTaxCode,invoiceDate:precedent.effective_from,itemName:`Chi tiếp khách rượu bia ${precedent.purpose}`,totalAmount:amount,preTaxAmount:amount/1.1,taxAmount:amount-amount/1.1};
 const cashAmount=Math.max(config.nonCashThreshold,5_000_000)+100;
 const authorityAmount=Math.max(config.kttApprovalLimit,275_000_000)+100;
 const adversarial=[{...probe,isImageBlurry:true},{...probe,totalAmount:probe.totalAmount+100},{...probe,paymentMethod:'CASH' as const,hasBankSlip:false,totalAmount:cashAmount,preTaxAmount:cashAmount/1.1,taxAmount:cashAmount-cashAmount/1.1},{...probe,totalAmount:authorityAmount,preTaxAmount:authorityAmount/1.1,taxAmount:authorityAmount-authorityAmount/1.1}];
 let safe=Number.isFinite(best.threshold) && best.threshold>=0 && best.threshold<=scope.maximum_amount;
 // Exercise the candidate itself inside a rollback-only savepoint.
 db.exec('SAVEPOINT threshold_candidate_gate');
 try {
  db.prepare('UPDATE precedent_scopes SET current_threshold=? WHERE precedent_id=?').run(best.threshold,precedentId);
  safe=safe && !adversarial.some((inv,i)=>{const d=evaluateInvoiceLocally(inv,config);return d.status!=='ESCALATED' || !d.findings?.some(f=>f.kind===(i<2?'DATA_QUALITY':i===2?'STATUTORY':'AUTHORITY'));});
 } finally {db.exec('ROLLBACK TO threshold_candidate_gate');db.exec('RELEASE threshold_candidate_gate');}
 if(!safe)throw new WorkflowError('Bộ kiểm tra an toàn không đạt; giữ nguyên ngưỡng.');
 const version=scope.version+1;
 db.prepare('INSERT INTO threshold_versions VALUES (?,?,?,?,?,?,1,?)').run(crypto.randomUUID(),precedentId,version,scope.current_threshold,best.threshold,samples.length,jsonNow());
 db.prepare('UPDATE precedent_scopes SET current_threshold=?,version=? WHERE precedent_id=?').run(best.threshold,version,precedentId);
 appendAuditEvent({eventType:'THRESHOLD_ADAPTED',entityId:precedentId,actorId:user.id,payload:{version,previousThreshold:scope.current_threshold,threshold:best.threshold,sampleCount:samples.length,evaluation,validation:'Học trên phản hồi cũ, kiểm chứng trên holdout mới nhất; trong biên CFO đặt; không phải đánh giá độc lập quy mô lớn.'}});
 return {status:'ADAPTED',version,previousThreshold:scope.current_threshold,threshold:best.threshold,sampleCount:samples.length,safetyCases:adversarial.length,evaluation};
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
