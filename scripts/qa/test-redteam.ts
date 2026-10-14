/**
 * Hồi quy "red team": 72 ca đánh lừa viết từ SOP (không đọc mã engine) phải giữ đúng trạng thái + nhóm dừng,
 * và mọi câu hỏi chuyển tiếp phải đạt kiểm tra cấu trúc. Chạy qua workflow thật, mỗi ca một database tạm.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { checkHandoff } from '../../services/handoffService';
import { demoCompanyTaxCode } from '../../data/verification/challengeCases';

type Case = { id: string; invoice: Record<string, unknown>; expectedStatus: string; expectedRiskGroup: string | null; context?: { history?: Record<string, unknown>[] } };
const accountant = { id: 'redteam-accountant', role: 'ACCOUNTANT' as const, email: 'r@test', displayName: 'Red team' };

async function main() {
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'verification', 'redteam', 'cases.json'), 'utf8')) as { cases: Case[] };
  const failures: string[] = [];
  for (const c of cases) {
    await runIsolated(async () => {
      const db = getDatabase(), policy = getActivePolicy();
      policy.config.companyTaxCode = demoCompanyTaxCode;
      db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
      try {
        for (const [i, h] of (c.context?.history || []).entries()) await evaluateWorkflow({ id: `${c.id}-H${i}`, ...h }, accountant, { forceLocalOnly: true });
        const d = (await evaluateWorkflow({ ...c.invoice, id: c.id }, accountant, { forceLocalOnly: true })).decision;
        const ok = d.status === c.expectedStatus && (d.status === 'ROUTINE' || !c.expectedRiskGroup || d.riskGroup === c.expectedRiskGroup);
        if (!ok) failures.push(`${c.id}: kỳ vọng ${c.expectedStatus} ${c.expectedRiskGroup || ''}, thực tế ${d.status} ${d.status === 'ESCALATED' ? d.riskGroup : ''}`);
        if (d.status === 'ESCALATED') { const check = checkHandoff(d); if (!check.valid) failures.push(`${c.id}: câu hỏi sai cấu trúc (${check.errors.join(', ')})`); }
      } catch (error) { failures.push(`${c.id}: lỗi ${error instanceof Error ? error.message.slice(0, 160) : error}`); }
    });
  }
  assert.deepEqual(failures, [], failures.join('\n'));
  console.log(`PASS red team: ${cases.length}/${cases.length} ca đúng trạng thái và nhóm dừng; mọi câu hỏi chuyển tiếp đạt cấu trúc.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
