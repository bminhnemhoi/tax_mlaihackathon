import assert from 'node:assert/strict';
import {getActivePolicy,getDatabase,runIsolated,hashPayload} from '../../lib/server/db';
import {developmentCases,developmentCompanyTaxCode} from '../../data/verification/developmentCases';
import {evaluateRefereeCases} from '../../services/refereeEvaluationService';
import {evaluateWorkflow,readRecord,applyWorkflowAction} from '../../services/workflowService';
import {evaluateInvoiceLocally} from '../../services/policyEngine';
import {queryJevReferee} from '../../services/jevService';
import {checkHandoff} from '../../services/handoffService';
import {isGroundedQuestion} from '../../services/questionGuard';
import {validatePolicySafety} from '../../services/policySafety';
import {createPolicyDraft,validatePolicyBundle} from '../../services/policyService';
import {policyRuleMatrix,executablePolicySummary} from '../../data/policyContract';
import {upsertSupplier} from '../../services/supplierService';
import {caseFingerprint,IndependentSetSchema} from '../../lib/refereeDataset';
import {challengeCases} from '../../data/verification/challengeCases';
import {RULE_PROBE_BASE,RULE_PROBES} from '../../data/verification/ruleProbes';
import {GEMINI_API_CONFIG} from '../../lib/constants';
import {POST as sandbox} from '../../app/api/verify/route';
import {NextRequest} from 'next/server';
let checks=0;const pass=(label:string):void=>{checks++;console.log('PASS '+label);};
const cfo={id:'core-cfo',role:'CFO' as const,email:'core@example.test',displayName:'CFO kiểm thử'};
const accountant={...cfo,id:'core-accountant',role:'ACCOUNTANT' as const};
const chief={...cfo,id:'core-chief',role:'CHIEF_ACCOUNTANT' as const};
async function main():Promise<void>{
 const savedFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Core evaluation must not call providers');};
 try{
  const policy=await runIsolated(async()=>{const p=getActivePolicy();p.config.companyTaxCode=developmentCompanyTaxCode;return p;});
  const report=await evaluateRefereeCases(developmentCases,policy);
  assert.equal(report.total,60);assert.equal(report.passed,60);assert.equal(report.errors,0);
  assert.equal(report.falsePositive.count,0);assert.equal(report.falseNegative.count,0);
  assert.ok(report.results.every(r=>'questionCheck' in r && r.questionCheck.valid));pass('60 development scenarios: 24 routine + 12 per escalation group; questions/workflow/voucher/tax/audit');
  const shuffled=await evaluateRefereeCases([...developmentCases].reverse(),policy);
  const stable=(results:typeof report.results):unknown[]=>results.map(r=>({id:r.id,actual:r.actual,...('actualRiskGroup' in r?{group:r.actualRiskGroup,role:r.requiresCFO,workflow:r.workflow,approvedTax:r.approvedTax}:{}),match:r.match})).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(stable(report.results),stable(shuffled.results));pass('Order independence: 60 reversed scenarios give identical decisions and effects');
  const beforePolicy=hashPayload(policy);await evaluateRefereeCases(developmentCases.slice(47,49),policy);assert.equal(hashPayload(policy),beforePolicy);pass('Candidate scenario context does not mutate the supplied policy snapshot');
  await runIsolated(async()=>{
   const db=getDatabase(),p=getActivePolicy();p.config.companyTaxCode=developmentCompanyTaxCode;
   db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(p),p.version);
   const base=RULE_PROBE_BASE;
   const matrixProbes=RULE_PROBES;
   const coverage=new Set<string>();
   const arithmetic=evaluateInvoiceLocally({...base,items:[{lineNumber:1,itemName:'Giấy',quantity:1,unitPrice:900_000,amount:1_000_000,taxRate:10,taxAmount:100_000}]},p.config);
   assert.equal(arithmetic.status,'ESCALATED');assert.ok(arithmetic.findings?.some(f=>f.ruleId==='RULE_LINE_ITEM_MISMATCH'));pass('Matching header cannot hide an incorrect quantity × unit price on a line');
   for(const [id,changes] of Object.entries(matrixProbes)){const invoice={...base,...changes};const original=structuredClone(invoice);const d=evaluateInvoiceLocally(invoice,p.config,p.version);assert.ok(d.findings?.some(f=>f.ruleId===id),id);assert.deepEqual(invoice,original,'Input must not be mutated');coverage.add(id);}
   const source=await evaluateWorkflow({...base,supplierTaxCode:undefined},accountant,{forceLocalOnly:true});assert.ok(source.decision.findings.some((f:any)=>f.ruleId==='RULE_SOURCE_REVIEW'));coverage.add('RULE_SOURCE_REVIEW');
   await evaluateWorkflow({...base,id:'OLD',invoiceNumber:'DUP-CORE'},accountant,{forceLocalOnly:true});
   const duplicate=evaluateInvoiceLocally({...base,id:'NEW',invoiceNumber:'DUP-CORE'},p.config);assert.ok(duplicate.findings?.some(f=>f.ruleId==='RULE_DUPLICATE_INVOICE'));coverage.add('RULE_DUPLICATE_INVOICE');
   await evaluateWorkflow({...base,id:'DAY1',invoiceNumber:'DAY1',totalAmount:3_300_000,preTaxAmount:3_000_000,taxAmount:300_000,paymentMethod:'CASH',hasBankSlip:false},accountant,{forceLocalOnly:true});
   const day=evaluateInvoiceLocally({...base,id:'DAY2',invoiceNumber:'DAY2',totalAmount:2_200_000,preTaxAmount:2_000_000,taxAmount:200_000,paymentMethod:'CASH',hasBankSlip:false},p.config);assert.ok(day.findings?.some(f=>f.ruleId==='STATUTORY_SAME_DAY_CASH_5M'));coverage.add('STATUTORY_SAME_DAY_CASH_5M');
   upsertSupplier({taxCode:base.supplierTaxCode,legalName:base.supplierName,riskLevel:'HIGH_RISK_INVOICE',status:'ACTIVE'});
   await evaluateWorkflow({...base,id:'SPLIT1',invoiceNumber:'SPLIT1',totalAmount:165_000_000,preTaxAmount:150_000_000,taxAmount:15_000_000},accountant,{forceLocalOnly:true});
   const split=evaluateInvoiceLocally({...base,id:'SPLIT2',invoiceNumber:'SPLIT2',totalAmount:165_000_000,preTaxAmount:150_000_000,taxAmount:15_000_000},p.config);assert.ok(split.findings?.some(f=>f.ruleId==='AUTHORITY_SPLIT_PURCHASE'));coverage.add('AUTHORITY_SPLIT_PURCHASE');
   const risk=evaluateInvoiceLocally(base,p.config);assert.ok(risk.findings?.some(f=>f.ruleId==='RULE_HIGH_RISK_SUPPLIER'));coverage.add('RULE_HIGH_RISK_SUPPLIER');
   upsertSupplier({taxCode:base.supplierTaxCode,legalName:base.supplierName,riskLevel:'LOW',status:'SUSPENDED'});
   assert.equal(evaluateInvoiceLocally(base,p.config).status,'ESCALATED');pass('Supplier master warnings cannot be bypassed or be used to infer ACTIVE');
   upsertSupplier({taxCode:base.supplierTaxCode,legalName:base.supplierName,riskLevel:'LOW',status:'ACTIVE'});
   assert.deepEqual([...coverage].sort(),policyRuleMatrix(p.config).map(r=>r.id).sort());pass(`MATRIX: every executable SOP rule has a targeted probe (${coverage.size} rules)`);
   assert.equal(validatePolicySafety({...p.config,kttApprovalLimit:500_000_000},'candidate').errors.length,0);
   assert.ok(validatePolicySafety({...p.config,nonCashThreshold:20_000_000},'unsafe').errors.length);pass('Policy gate follows candidate authority thresholds and retains payment safeguards');
   const draft=createPolicyDraft({version:'CORE-DRAFT',config:{...p.config,kttApprovalLimit:500_000_000},policyText:'Ghi chú nội bộ tự do, không phải quy tắc.'});
   assert.equal(draft.policyNotes,'Ghi chú nội bộ tự do, không phải quy tắc.');assert.equal(draft.policyText,executablePolicySummary(draft.config));
   await evaluateWorkflow({...base,...matrixProbes.AUTHORITY_EXCEED_KTT_LIMIT,id:'IMPACT',invoiceNumber:'IMPACT'},accountant,{forceLocalOnly:true});
   assert.ok(validatePolicyBundle(draft).changes.some(c=>c.invoiceId==='IMPACT'&&c.after==='ROUTINE:'));pass('Policy notes separated from executable SOP; dry run identifies changed invoices');
   const multi=await evaluateWorkflow({...base,...matrixProbes.AUTHORITY_EXCEED_KTT_LIMIT,id:'MULTI-CORE',invoiceNumber:'MULTI-CORE',paymentMethod:'CASH',hasBankSlip:false},accountant,{forceLocalOnly:true});
   const d=multi.decision;assert.equal(d.requiresCFO,true);assert.equal(d.handoff.openIssues.length,d.findings.length);assert.ok(checkHandoff(d).valid);
   const row=readRecord('MULTI-CORE');assert.throws(()=>applyWorkflowAction(row.id,chief,{action:'RESOLVE',revision:row.revision,evaluationId:row.evaluation_id,optionId:'A',reason:'KTT xem chứng từ nguồn'}),/CFO/);
   assert.throws(()=>applyWorkflowAction(row.id,cfo,{action:'OVERRIDE',revision:row.revision,evaluationId:row.evaluation_id,targetStatus:'APPROVED',resolvedFindingIds:['AUTHORITY_EXCEED_KTT_LIMIT'],reason:'CFO chỉ xác nhận hạn mức'}),/bằng chứng|phát hiện/);pass('Multiple findings survive handoff; wrong role/partial authority approval cannot release statutory risk');
   const events=db.prepare('SELECT payload_json FROM audit_events WHERE entity_id=?').all(row.id) as {payload_json:string}[];assert.ok(events.some(e=>JSON.parse(e.payload_json).decision?.handoff));pass('Audit preserves structured decision and handoff');
  });
  assert.equal(caseFingerprint({invoice:{a:1,b:2}}),caseFingerprint({invoice:{b:2,a:1}}));assert.notEqual(caseFingerprint({invoice:{a:1},context:{history:[]}}),caseFingerprint({invoice:{a:1}}));
  assert.throws(()=>IndependentSetSchema.parse({status:'AWAITING_HUMAN_LABELS',cases:[]}));pass('Independent labels reject unlocked/empty data; fingerprints include context and canonical keys');
  const response=await sandbox(new NextRequest('http://localhost/api/verify',{method:'POST',body:JSON.stringify({sampleType:'CUSTOM',customInvoice:developmentCases[3].invoice}),headers:{'Content-Type':'application/json'}}));const body=await response.json();assert.equal(response.status,200);assert.equal(body.workflow.status,'APPROVED');assert.equal(body.workflow.internalVoucherCreated,true);pass('Public sandbox calls the same workflow and emits actual completion effects');
  await runIsolated(async()=>{
   const p=getActivePolicy(),inv=challengeCases[4].invoice;const canonical=await queryJevReferee(inv,{forceLocalOnly:true});assert.equal(canonical.decision.status,'ESCALATED');
   if(canonical.decision.status!=='ESCALATED')throw new Error('Missing escalation');
   const d=canonical.decision;assert.equal(isGroundedQuestion(inv,d,{actionableQuestion:d.actionableQuestion,plainExplanation:d.plainExplanation,requiresCFO:d.requiresCFO}),true);
   assert.equal(isGroundedQuestion(inv,d,{actionableQuestion:d.actionableQuestion+' 999999999999',plainExplanation:d.plainExplanation}),false);
   assert.equal(isGroundedQuestion(inv,d,{actionableQuestion:'Hóa đơn '+inv.invoiceNumber+' CFO xem xét lại',plainExplanation:'Vui lòng kiểm tra lại toàn bộ.'}),false);pass('Question guard rejects invented amounts and generic requests');
   const key=GEMINI_API_CONFIG.API_KEY;GEMINI_API_CONFIG.API_KEY='qa-mocked-only';
   try{
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...d,actionableQuestion:d.actionableQuestion})}}]}),{status:200});
    const good=await queryJevReferee(inv);assert.equal(good.decision.status==='ESCALATED'&&good.decision.handoff?.questionSource,'AI_GROUNDED');
    globalThis.fetch=async()=>{throw new Error('Mock provider offline');};const offline=await queryJevReferee(inv);assert.equal(offline.engineUsed,'LOCAL_FALLBACK');assert.equal(offline.decision.status==='ESCALATED'&&offline.decision.handoff?.questionSource,'POLICY_TEMPLATE');pass('AI wording accepted only when grounded; offline uses the complete policy question');
   }finally{GEMINI_API_CONFIG.API_KEY=key;}
  });
 }finally{globalThis.fetch=savedFetch;}
 console.log(`${checks} core checks passed; synthetic fixtures only, no live provider requests.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
