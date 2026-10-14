import {runIsolated,getActivePolicy,hashPayload} from '@/lib/server/db';
import {challengeCases,commonCases,regressionCases,demoCompanyTaxCode,type VerificationCase} from '@/data/verification/challengeCases';
import {developmentCases,RefereeCase} from '@/data/verification/developmentCases';
import {evaluateRefereeCases} from './refereeEvaluationService';
import crypto from 'node:crypto';
import {runningCommit} from '@/lib/server/buildInfo';
import type {ActionOption,RefereeHandoff,RiskGroup} from '@/lib/schemas';
export interface VerificationResult {suite?:string;startedAt?:string;finishedAt?:string;expectedRiskGroup?:RiskGroup;riskGroups?:RiskGroup[];testId:string;sourceFile:string;expectedStatus:string;actualStatus:string;schemaValid:boolean;isMatchExpected:boolean;workflowValid:boolean;plainExplanation:string;invoiceNumber?:string;supplierName?:string;totalAmount?:number;riskGroup?:RiskGroup;requiresCFO?:boolean;actualWorkflowStatus?:string;internalVoucherCreated?:boolean;auditRecorded?:boolean;approvedTax?:number;actionableQuestion?:string;questionCheck?:{valid:boolean;errors:string[]};handoff?:RefereeHandoff;options?:ActionOption[];provenance?:string;executionTimeMs?:number}
export interface VerificationSummary {suites?:Array<{mode:string;label:string;passed:number;total:number}>;commit?:string;runId:string;policyHash:string;executionMode:string;errorCases:number;mode:string;totalCases:number;passedCases:number;routineCases:number;escalatedCases:number;schemaValidCases:number;allSchemaValid:boolean;isMatchExpected:boolean;totalTimeMs:number;timestamp:string;policyVersion:string;fixtureHash:string;metrics:{falseNegativeRate:number;falseNegativeCases:number;falsePositiveRate:number;falsePositiveCases:number;straightThroughProcessingRate:number;routineCompletionRate:number;autoApprovedRoutineCases:number;denominators:{expectedEscalated:number;expectedRoutine:number;total:number};thresholdAdaptationStatus:string}}
export const VERIFY_MODES=['judge','common_4','challenge_a','regression_15','development_60'] as const;
const SUITE_LABELS:Record<string,string>={common_4:'4 ca kiểm thử chung',challenge_a:'5 ca Đề A (3 tự xử lý + 2 chuyển tiếp)',regression_15:'15 ca hồi quy',development_60:'60 ca phát triển'};
export async function runVerification(mode='judge'):Promise<{summary:VerificationSummary;results:VerificationResult[]}> {
 if(!(VERIFY_MODES as readonly string[]).includes(mode))throw new Error('Bộ kiểm thử không hợp lệ.');
 // "judge": một nút chạy tuần tự 4 ca chung rồi 5 ca Đề A, đúng kịch bản 90 giây của giám khảo.
 const single=mode==='common_4'?commonCases:mode==='regression_15'?regressionCases:mode==='development_60'?developmentCases:challengeCases;
 const suiteFixtures:Array<[string,Array<VerificationCase|RefereeCase>]>=mode==='judge'?[['common_4',commonCases],['challenge_a',challengeCases]]:[[mode,single]];
 const suiteOf:string[]=suiteFixtures.flatMap(([suite,list])=>list.map(()=>suite));
 const cases:RefereeCase[]=suiteFixtures.flatMap(([,list])=>list).map(c=>({...c,rationale:'rationale' in c && typeof c.rationale==='string'?c.rationale:'Kết quả kỳ vọng của bộ hồi quy theo SOP.'}));
 const policy=await runIsolated(async()=>{const p=getActivePolicy();p.config.companyTaxCode=demoCompanyTaxCode;return p;});
 const start=performance.now();const report=await evaluateRefereeCases(cases,policy);
 const results=report.results.map((r,index):VerificationResult=>r.actual==='ERROR'?{suite:suiteOf[index],startedAt:r.startedAt,finishedAt:r.finishedAt,testId:r.id,sourceFile:r.name,expectedStatus:r.expected,actualStatus:'ERROR',schemaValid:false,isMatchExpected:false,workflowValid:false,plainExplanation:r.error}:({
  suite:suiteOf[index],startedAt:r.startedAt,finishedAt:r.finishedAt,expectedRiskGroup:cases[index].expectedRiskGroup,riskGroups:r.decision.status==='ESCALATED'?r.decision.riskGroups:undefined,
  testId:r.id,sourceFile:r.name,invoiceNumber:cases[index].invoice.invoiceNumber || r.decision.invoiceId,supplierName:r.decision.supplierName,totalAmount:r.decision.totalAmount,expectedStatus:r.expected,actualStatus:r.actual,
  riskGroup:r.actualRiskGroup||undefined,requiresCFO:r.requiresCFO,schemaValid:true,isMatchExpected:r.match&&r.questionCheck.valid,workflowValid:r.workflowValid,
  actualWorkflowStatus:r.workflow,internalVoucherCreated:r.voucher,auditRecorded:r.auditCount>0,approvedTax:r.approvedTax,
  actionableQuestion:r.question||undefined,questionCheck:r.questionCheck,handoff:r.decision.status==='ESCALATED'?r.decision.handoff:undefined,
  options:r.decision.status==='ESCALATED'?r.decision.options:undefined,plainExplanation:r.decision.plainExplanation,provenance:r.provenance,executionTimeMs:r.durationMs}));
 const expectedE=cases.filter(c=>c.expectedStatus==='ESCALATED').length,expectedR=cases.length-expectedE;
 const suites=suiteFixtures.map(([suite])=>({mode:suite,label:SUITE_LABELS[suite]||suite,passed:results.filter(r=>r.suite===suite&&r.isMatchExpected).length,total:results.filter(r=>r.suite===suite).length}));
 return {summary:{suites,commit:runningCommit(),runId:crypto.randomUUID(),policyHash:report.policyHash,executionMode:'DETERMINISTIC_LOCAL_PER_CASE',errorCases:report.errors,mode,totalCases:cases.length,
  passedCases:results.filter(r=>r.isMatchExpected).length,routineCases:results.filter(r=>r.actualStatus==='ROUTINE').length,escalatedCases:results.filter(r=>r.actualStatus==='ESCALATED').length,
  schemaValidCases:results.filter(r=>r.schemaValid).length,allSchemaValid:results.every(r=>r.schemaValid),isMatchExpected:results.every(r=>r.isMatchExpected),
  totalTimeMs:Math.round(performance.now()-start),timestamp:new Date().toISOString(),policyVersion:policy.version,fixtureHash:hashPayload(cases),
  metrics:{falseNegativeRate:(report.falseNegative.rate||0)*100,falseNegativeCases:report.falseNegative.count,falsePositiveRate:(report.falsePositive.rate||0)*100,falsePositiveCases:report.falsePositive.count,
   straightThroughProcessingRate:(report.stp.rate||0)*100,routineCompletionRate:(report.routineCompletion.rate||0)*100,autoApprovedRoutineCases:report.stp.count,
   denominators:{expectedEscalated:expectedE,expectedRoutine:expectedR,total:cases.length},thresholdAdaptationStatus:'Hồi quy/phát triển tổng hợp; không phải đánh giá độc lập'}},results};
}
