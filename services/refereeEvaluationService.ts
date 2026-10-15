import { getActivePolicy, getDatabase, getMacroState, hashPayload, runIsolated } from '@/lib/server/db';
import { evaluateWorkflow, readRecord } from './workflowService';
import type { PolicyBundle,RefereeDecision,RiskGroup } from '@/lib/schemas';
import { PolicyBundleSchema,RefereeDecisionSchema } from '@/lib/schemas';
import {checkHandoff} from './handoffService';
import type { RefereeCase } from '@/data/verification/developmentCases';

export interface EvaluationMetric {count:number;denominator:number;rate:number|null}
export interface RefereeCaseSuccess {
  id:string;name:string;expected:'ROUTINE'|'ESCALATED';expectedRiskGroup?:RiskGroup;expectedRequiresCFO:boolean;
  actual:'ROUTINE'|'ESCALATED';actualRiskGroup:RiskGroup|null;requiresCFO:boolean;workflow:string;
  approvedTax:number;voucher:boolean;auditCount:number;workflowValid:boolean;match:boolean;durationMs:number;startedAt:string;finishedAt:string;
  question:string|null;questionCheck:{valid:boolean;errors:string[]};decision:RefereeDecision;rationale:string;provenance:string;policyHash:string;
}
export interface RefereeCaseError {id:string;name:string;expected:'ROUTINE'|'ESCALATED';actual:'ERROR';match:false;error:string;durationMs:number;startedAt:string;finishedAt:string}
export type RefereeCaseResult=RefereeCaseSuccess|RefereeCaseError;
export interface RefereeEvaluationReport {policy:PolicyBundle;policyHash:string;total:number;passed:number;errors:number;falseNegative:EvaluationMetric;falsePositive:EvaluationMetric;classificationAndRouting:EvaluationMetric;routineCompletion:EvaluationMetric;stp:EvaluationMetric;results:RefereeCaseResult[]}
export async function evaluateRefereeCases(cases: RefereeCase[], policy?: PolicyBundle):Promise<RefereeEvaluationReport> {
  const snapshot = policy || await runIsolated(async()=>getActivePolicy());
  const results:RefereeCaseResult[] = [];
  for (const c of cases) {
    const start = performance.now(), startedAt = new Date().toISOString();
    try {
      const result = await runIsolated(async()=>{
        const db=getDatabase();
        const p=PolicyBundleSchema.parse({...snapshot, config:{...snapshot.config,...c.context?.config}});
        db.prepare('UPDATE policy_versions SET payload_json=? WHERE status=\'PUBLISHED\'').run(JSON.stringify(p));
        if(c.context?.macroBaseline) {
          const state={...getMacroState(),...c.context.macroBaseline};
          db.prepare('UPDATE macro_baseline SET payload_json=? WHERE id=1').run(JSON.stringify(state));
          db.prepare('UPDATE macro_state SET payload_json=? WHERE id=1').run(JSON.stringify(state));
        }
        for(const history of c.context?.history || []) await evaluateWorkflow(history,null,{forceLocalOnly:true});
        const evaluation=await evaluateWorkflow(c.invoice,null,{forceLocalOnly:true});
        const d=RefereeDecisionSchema.parse(evaluation.decision), row=readRecord(evaluation.decision.invoiceId);
        const voucher=Boolean(db.prepare('SELECT id FROM internal_vouchers WHERE invoice_id=?').get(row.id));
        const auditCount=(db.prepare('SELECT COUNT(*) n FROM audit_events WHERE entity_id=?').get(row.id) as {n:number}).n;
        const effects=d.status==='ROUTINE' ? row.status==='APPROVED' && voucher && auditCount>0 && row.approved_deductible_tax===d.approvedTaxAmount
          : row.approved_deductible_tax===0 && !voucher && auditCount>0;
        const group=d.status==='ESCALATED'?d.riskGroup:null, requiresCFO=d.status==='ESCALATED' && d.requiresCFO;
        const match=d.status===c.expectedStatus && requiresCFO===c.expectedRequiresCFO && (d.status==='ROUTINE'||group===c.expectedRiskGroup)
          && effects && (c.expectedRuleIds || []).every(id=>d.findings?.some(f=>f.ruleId===id));
        return {id:c.id,name:c.name,expected:c.expectedStatus,expectedRiskGroup:c.expectedRiskGroup,expectedRequiresCFO:c.expectedRequiresCFO,questionCheck:checkHandoff(d),
          actual:d.status,actualRiskGroup:group,requiresCFO,workflow:row.status,approvedTax:row.approved_deductible_tax,voucher,auditCount,workflowValid:effects,
          match,question:d.status==='ESCALATED'?d.actionableQuestion:null,decision:d,rationale:c.rationale,provenance:c.provenance,policyHash:hashPayload(p.config)};
      });
      results.push({...result,durationMs:Math.round(performance.now()-start),startedAt,finishedAt:new Date().toISOString()});
    } catch(error) {results.push({id:c.id,name:c.name,expected:c.expectedStatus,actual:'ERROR' as const,match:false,error:error instanceof Error?error.message:String(error),durationMs:Math.round(performance.now()-start),startedAt,finishedAt:new Date().toISOString()});}
  }
  const expectedE=cases.filter(c=>c.expectedStatus==='ESCALATED').length,expectedR=cases.length-expectedE;
  const metric=(count:number,denominator:number):EvaluationMetric=>({count,denominator,rate:denominator?count/denominator:null});
  return {policy:snapshot,policyHash:hashPayload(snapshot),total:cases.length,passed:results.filter(r=>r.match).length,errors:results.filter(r=>r.actual==='ERROR').length,
    falseNegative:metric(results.filter(r=>r.expected==='ESCALATED'&&r.actual==='ROUTINE').length,expectedE),
    falsePositive:metric(results.filter(r=>r.expected==='ROUTINE'&&r.actual==='ESCALATED').length,expectedR),
    classificationAndRouting:metric(results.filter(r=>r.expected==='ESCALATED'&&r.match).length,expectedE),
    routineCompletion:metric(results.filter(r=>r.expected==='ROUTINE'&&'workflow' in r&&r.workflow==='APPROVED'&&r.match).length,expectedR),
    stp:metric(results.filter(r=>'workflow' in r&&r.actual==='ROUTINE'&&r.workflowValid).length,cases.length),results};
}
