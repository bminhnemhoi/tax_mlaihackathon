import {runIsolated,getActivePolicy,hashPayload} from '@/lib/server/db';
import {challengeCases,commonCases,regressionCases,demoCompanyTaxCode} from '@/data/verification/challengeCases';
import {developmentCases,RefereeCase} from '@/data/verification/developmentCases';
import {evaluateRefereeCases} from './refereeEvaluationService';
import crypto from 'node:crypto';
import type {ActionOption,RefereeHandoff,RiskGroup} from '@/lib/schemas';
export interface VerificationResult {testId:string;sourceFile:string;expectedStatus:string;actualStatus:string;schemaValid:boolean;isMatchExpected:boolean;workflowValid:boolean;plainExplanation:string;invoiceNumber?:string;supplierName?:string;totalAmount?:number;riskGroup?:RiskGroup;requiresCFO?:boolean;actualWorkflowStatus?:string;internalVoucherCreated?:boolean;auditRecorded?:boolean;approvedTax?:number;actionableQuestion?:string;questionCheck?:{valid:boolean;errors:string[]};handoff?:RefereeHandoff;options?:ActionOption[];provenance?:string;executionTimeMs?:number}
export interface VerificationSummary {runId:string;policyHash:string;executionMode:string;errorCases:number;mode:string;totalCases:number;passedCases:number;routineCases:number;escalatedCases:number;schemaValidCases:number;allSchemaValid:boolean;isMatchExpected:boolean;totalTimeMs:number;timestamp:string;policyVersion:string;fixtureHash:string;metrics:{falseNegativeRate:number;falseNegativeCases:number;falsePositiveRate:number;falsePositiveCases:number;straightThroughProcessingRate:number;routineCompletionRate:number;autoApprovedRoutineCases:number;denominators:{expectedEscalated:number;expectedRoutine:number;total:number};thresholdAdaptationStatus:string}}
export async function runVerification(mode='challenge_a'):Promise<{summary:VerificationSummary;results:VerificationResult[]}> {
 if(!['common_4','challenge_a','regression_15','development_60'].includes(mode))throw new Error('Bộ kiểm thử không hợp lệ.');
 const fixtures=mode==='common_4'?commonCases:mode==='regression_15'?regressionCases:mode==='development_60'?developmentCases:challengeCases;
 const cases:RefereeCase[]=fixtures.map(c=>({...c,rationale:'rationale' in c?c.rationale:'Kết quả kỳ vọng của bộ hồi quy theo SOP.'}));
 const policy=await runIsolated(async()=>{const p=getActivePolicy();p.config.companyTaxCode=demoCompanyTaxCode;return p;});
 const start=performance.now();const report=await evaluateRefereeCases(cases,policy);
 const results=report.results.map((r,index):VerificationResult=>r.actual==='ERROR'?{testId:r.id,sourceFile:r.name,expectedStatus:r.expected,actualStatus:'ERROR',schemaValid:false,isMatchExpected:false,workflowValid:false,plainExplanation:r.error}:({
  testId:r.id,sourceFile:r.name,invoiceNumber:cases[index].invoice.invoiceNumber || r.decision.invoiceId,supplierName:r.decision.supplierName,totalAmount:r.decision.totalAmount,expectedStatus:r.expected,actualStatus:r.actual,
  riskGroup:r.actualRiskGroup||undefined,requiresCFO:r.requiresCFO,schemaValid:true,isMatchExpected:r.match&&r.questionCheck.valid,workflowValid:r.workflowValid,
  actualWorkflowStatus:r.workflow,internalVoucherCreated:r.voucher,auditRecorded:r.auditCount>0,approvedTax:r.approvedTax,
  actionableQuestion:r.question||undefined,questionCheck:r.questionCheck,handoff:r.decision.status==='ESCALATED'?r.decision.handoff:undefined,
  options:r.decision.status==='ESCALATED'?r.decision.options:undefined,plainExplanation:r.decision.plainExplanation,provenance:r.provenance,executionTimeMs:r.durationMs}));
 const expectedE=cases.filter(c=>c.expectedStatus==='ESCALATED').length,expectedR=cases.length-expectedE;
 return {summary:{runId:crypto.randomUUID(),policyHash:report.policyHash,executionMode:'DETERMINISTIC_LOCAL_PER_CASE',errorCases:report.errors,mode,totalCases:cases.length,
  passedCases:results.filter(r=>r.isMatchExpected).length,routineCases:results.filter(r=>r.actualStatus==='ROUTINE').length,escalatedCases:results.filter(r=>r.actualStatus==='ESCALATED').length,
  schemaValidCases:results.filter(r=>r.schemaValid).length,allSchemaValid:results.every(r=>r.schemaValid),isMatchExpected:results.every(r=>r.isMatchExpected),
  totalTimeMs:Math.round(performance.now()-start),timestamp:new Date().toISOString(),policyVersion:policy.version,fixtureHash:hashPayload(cases),
  metrics:{falseNegativeRate:(report.falseNegative.rate||0)*100,falseNegativeCases:report.falseNegative.count,falsePositiveRate:(report.falsePositive.rate||0)*100,falsePositiveCases:report.falsePositive.count,
   straightThroughProcessingRate:(report.stp.rate||0)*100,routineCompletionRate:(report.routineCompletion.rate||0)*100,autoApprovedRoutineCases:report.stp.count,
   denominators:{expectedEscalated:expectedE,expectedRoutine:expectedR,total:cases.length},thresholdAdaptationStatus:'Hồi quy/phát triển tổng hợp; không phải đánh giá độc lập'}},results};
}
