import {runIsolated,getDatabase, getActivePolicy, hashPayload} from '@/lib/server/db';
import {RefereeDecisionSchema} from '@/lib/schemas';
import {evaluateWorkflow,readRecord} from './workflowService';
import {challengeCases,commonCases,regressionCases,demoCompanyTaxCode,VerificationCase} from '@/data/verification/challengeCases';
import crypto from 'node:crypto';
export async function runVerification(mode='challenge_a') {
 if(!['common_4','challenge_a','regression_15'].includes(mode))throw new Error('Bộ kiểm thử không hợp lệ.');
 const cases=mode==='common_4'?commonCases:mode==='regression_15'?regressionCases:challengeCases;
 return runIsolated(async()=>{
 const db=getDatabase();const policy=getActivePolicy();policy.config.companyTaxCode=demoCompanyTaxCode;
 db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy),policy.version);
 const start=Date.now();const results=[];
 for(const c of cases){const t=Date.now();try{
 const r=await evaluateWorkflow(c.invoice,null,{forceLocalOnly:true});const d=r.decision;const row=readRecord(c.invoice.id);
 const voucher=db.prepare('SELECT id FROM internal_vouchers WHERE invoice_id=?').get(c.invoice.id);
 const audit=db.prepare('SELECT id FROM audit_events WHERE entity_id=?').get(c.invoice.id);
 const schemaValid=RefereeDecisionSchema.safeParse(d).success;
 const classified=d.status===c.expectedStatus && (d.status!=='ESCALATED' || d.riskGroup===c.expectedRiskGroup && d.requiresCFO===c.expectedRequiresCFO);
 const effects=d.status==='ROUTINE'?row.status==='APPROVED' && Boolean(voucher) && Boolean(audit) && row.approved_deductible_tax===c.invoice.taxAmount:row.approved_deductible_tax===0 && !voucher && Boolean(audit);
 results.push({testId:c.id,sourceFile:c.name,invoiceNumber:c.invoice.invoiceNumber,supplierName:c.invoice.supplierName,totalAmount:c.invoice.totalAmount,expectedStatus:c.expectedStatus,actualStatus:d.status,riskGroup:d.status==='ESCALATED'?d.riskGroup:undefined,requiresCFO:d.status==='ESCALATED'?d.requiresCFO:false,schemaValid,isMatchExpected:classified && effects,workflowValid:effects,actualWorkflowStatus:row.status,internalVoucherCreated:Boolean(voucher),auditRecorded:Boolean(audit),approvedTax:row.approved_deductible_tax,actionableQuestion:d.status==='ESCALATED'?d.actionableQuestion:undefined,options:d.status==='ESCALATED'?d.options:undefined,plainExplanation:d.plainExplanation,provenance:c.provenance,executionTimeMs:Date.now()-t});
 }catch(e){results.push({testId:c.id,sourceFile:c.name,expectedStatus:c.expectedStatus,actualStatus:'ERROR',schemaValid:false,isMatchExpected:false,workflowValid:false,plainExplanation:e instanceof Error?e.message:'Lỗi kiểm thử'});}}
 const expectedE=cases.filter(c=>c.expectedStatus==='ESCALATED').length;const expectedR=cases.length-expectedE;
 const fn=results.filter(r=>r.expectedStatus==='ESCALATED' && r.actualStatus==='ROUTINE').length;const fp=results.filter(r=>r.expectedStatus==='ROUTINE' && r.actualStatus==='ESCALATED').length;
 const auto=results.filter(r=>r.actualStatus==='ROUTINE' && r.workflowValid).length;
 return {summary:{runId:crypto.randomUUID(),policyHash:hashPayload(policy.config),executionMode:'DETERMINISTIC_LOCAL',errorCases:results.filter(r=>r.actualStatus==='ERROR').length,mode,totalCases:cases.length,passedCases:results.filter(r=>r.isMatchExpected).length,routineCases:results.filter(r=>r.actualStatus==='ROUTINE').length,escalatedCases:results.filter(r=>r.actualStatus==='ESCALATED').length,schemaValidCases:results.filter(r=>r.schemaValid).length,allSchemaValid:results.every(r=>r.schemaValid),isMatchExpected:results.every(r=>r.isMatchExpected),totalTimeMs:Date.now()-start,timestamp:new Date().toISOString(),policyVersion:policy.version,fixtureHash:hashPayload(cases),metrics:{falseNegativeRate:expectedE?fn/expectedE*100:0,falseNegativeCases:fn,falsePositiveRate:expectedR?fp/expectedR*100:0,falsePositiveCases:fp,straightThroughProcessingRate:auto/cases.length*100,routineCompletionRate:expectedR?results.filter(r=>r.expectedStatus==='ROUTINE' && r.actualStatus==='ROUTINE' && r.workflowValid).length/expectedR*100:0,autoApprovedRoutineCases:auto,denominators:{expectedEscalated:expectedE,expectedRoutine:expectedR,total:cases.length},thresholdAdaptationStatus:'Bộ hồi quy tổng hợp; không phải đánh giá độc lập'}},results};
 });
}
