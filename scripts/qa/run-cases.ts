/**
 * Chạy một loạt ca (JSON) qua đúng workflow thật, mỗi ca trên database tạm riêng, không gọi AI.
 * Dùng cho red-team/diễn tập: `npx tsx scripts/qa/run-cases.ts <cases.json> <out.json>`
 * cases.json: [{ id, invoice, expectedStatus?, expectedRiskGroup?, expectedRequiresCFO?, rationale?, context? }]
 */
import fs from 'node:fs';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { checkHandoff } from '../../services/handoffService';
import { demoCompanyTaxCode } from '../../data/verification/challengeCases';

type Case = { id: string; invoice: Record<string, unknown>; expectedStatus?: string; expectedRiskGroup?: string; expectedRequiresCFO?: boolean; rationale?: string; context?: { history?: Record<string, unknown>[] } };
const accountant = { id: 'redteam-accountant', role: 'ACCOUNTANT' as const, email: 'r@test', displayName: 'Red team' };

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: run-cases.ts <cases.json> <out.json>');
  const cases = JSON.parse(fs.readFileSync(input, 'utf8')) as Case[];
  const results = [];
  for (const c of cases) {
    const result = await runIsolated(async () => {
      const db = getDatabase(), policy = getActivePolicy();
      policy.config.companyTaxCode = demoCompanyTaxCode;
      db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
      try {
        for (const [i, h] of (c.context?.history || []).entries()) await evaluateWorkflow({ id: `${c.id}-H${i}`, ...h }, accountant, { forceLocalOnly: true });
        const r = await evaluateWorkflow({ ...c.invoice, id: c.id }, accountant, { forceLocalOnly: true });
        const d = r.decision;
        return {
          id: c.id, expectedStatus: c.expectedStatus, expectedRiskGroup: c.expectedRiskGroup ?? null, expectedRequiresCFO: c.expectedRequiresCFO ?? null, rationale: c.rationale,
          actualStatus: d.status, actualRiskGroup: d.status === 'ESCALATED' ? d.riskGroup : null, riskGroups: d.status === 'ESCALATED' ? d.riskGroups ?? [d.riskGroup] : [],
          requiresCFO: d.status === 'ESCALATED' ? d.requiresCFO : false, workflowStatus: r.workflow.status,
          findings: (d.findings || []).map((f: { ruleId: string; riskGroup: string }) => `${f.ruleId}:${f.riskGroup}`),
          question: d.status === 'ESCALATED' ? d.actionableQuestion : null, explanation: d.plainExplanation,
          questionCheck: d.status === 'ESCALATED' ? checkHandoff(d) : null,
          match: c.expectedStatus ? d.status === c.expectedStatus && (d.status === 'ROUTINE' || !c.expectedRiskGroup || d.riskGroup === c.expectedRiskGroup) : null
        };
      } catch (error) {
        return { id: c.id, expectedStatus: c.expectedStatus, expectedRiskGroup: c.expectedRiskGroup ?? null, rationale: c.rationale, actualStatus: 'ERROR', error: error instanceof Error ? error.message.slice(0, 500) : String(error), match: false };
      }
    });
    results.push(result);
  }
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
  const scored = results.filter(r => r.match !== null);
  console.log(`${results.length} ca · khớp kỳ vọng ${scored.filter(r => r.match).length}/${scored.length} · lỗi ${results.filter(r => r.actualStatus === 'ERROR').length}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
