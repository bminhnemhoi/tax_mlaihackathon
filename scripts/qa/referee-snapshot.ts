/**
 * Ảnh chụp quyết định của engine trên mọi fixture — lưới an toàn khi sửa nhanh (vòng cải tiến có giới hạn thời gian).
 *   npm run referee:snapshot  → ghi baseline data/verification/decision-snapshot.json (chỉ chạy khi chủ ý đổi hành vi)
 *   npm run referee:diff      → chạy lại, so với baseline, liệt kê từng ca đổi; exit 1 nếu có ca đổi
 * Mỗi ca chạy trên một DB :memory: riêng (runIsolated), không gọi mạng (forceLocalOnly). Chỉ so trường quyết định:
 * status, nhóm dừng, người nhận CFO, danh sách quy tắc, thuế được duyệt. Chữ câu hỏi/căn cứ không nằm trong phép so.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Row = Record<string, unknown>;
const BASELINE = path.join(process.cwd(), 'data', 'verification', 'decision-snapshot.json');

async function main() {
  // Đặt môi trường trước khi nạp module DB (import động bên dưới).
  if (!process.env.TAX_REFEREE_DATA_DIR) process.env.TAX_REFEREE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-snapshot-'));
  Object.assign(process.env, { NODE_ENV: 'test' });
  const { getActivePolicy, getDatabase, runIsolated } = await import('../../lib/server/db');
  const { evaluateWorkflow } = await import('../../services/workflowService');
  const { challengeCases, commonCases, regressionCases, demoCompanyTaxCode } = await import('../../data/verification/challengeCases');
  const { developmentCases } = await import('../../data/verification/developmentCases');
  const { RULE_PROBE_BASE, RULE_PROBES } = await import('../../data/verification/ruleProbes');
  const { userStudyCases } = await import('../../data/verification/userStudyCases');
  const { DEMO_SAMPLE_CASES } = await import('../../services/demoSeed');

  const cases: Array<[string, Row | undefined]> = [];
  for (const c of [...challengeCases, ...commonCases, ...regressionCases] as Row[]) cases.push([`verify:${c.id}`, c.invoice as Row]);
  for (const c of developmentCases as unknown as Row[]) cases.push([`dev:${c.id}`, (c.invoice ?? c.input) as Row]);
  const red = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'verification', 'redteam', 'cases.json'), 'utf-8')) as { cases: Row[] };
  for (const c of red.cases) cases.push([`red:${c.id}`, c.invoice as Row]);
  for (const [k, patch] of Object.entries(RULE_PROBES)) cases.push([`probe:${k}`, { ...RULE_PROBE_BASE, ...patch } as Row]);
  for (const c of userStudyCases as unknown as Row[]) cases.push([`study:${c.id}`, (c.invoice ?? c.input) as Row]);
  for (const c of DEMO_SAMPLE_CASES as unknown as Row[]) cases.push([`demo:${(c.id ?? (c.invoice as Row)?.id) as string}`, (c.invoice ?? c) as Row]);

  const accountant = { id: 'snapshot-accountant', role: 'ACCOUNTANT' as const, email: 'snapshot@test', displayName: 'Ảnh chụp quyết định' };
  const current: Record<string, Row> = {};
  const started = Date.now();
  for (const [key, invoice] of cases) {
    if (!invoice) { current[key] = { error: 'thiếu hóa đơn' }; continue; }
    await runIsolated(async () => {
      const db = getDatabase(), policy = getActivePolicy();
      policy.config.companyTaxCode = demoCompanyTaxCode;
      db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
      try {
        const result = await evaluateWorkflow({ ...invoice, id: key.replace(/[^A-Za-z0-9_-]/g, '_') }, accountant, { forceLocalOnly: true }) as Row;
        const d = (result.decision ?? {}) as Row;
        current[key] = {
          status: d.status, riskGroup: d.riskGroup ?? null, riskGroups: d.riskGroups ?? null, requiresCFO: d.requiresCFO ?? null,
          rules: ((d.findings ?? []) as Row[]).map(f => f.ruleId).sort(), approvedTax: d.approvedTaxAmount ?? null,
        };
      } catch (e) { current[key] = { error: String((e as Error).message).slice(0, 160) }; }
    });
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 1) + '\n');
    console.log(`Đã ghi baseline: ${Object.keys(current).length} ca (${seconds}s) → ${path.relative(process.cwd(), BASELINE)}`);
    return;
  }
  if (!fs.existsSync(BASELINE)) { console.error('Chưa có baseline. Chạy: npm run referee:snapshot'); process.exit(2); }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf-8')) as Record<string, Row>;
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort();
  const changed = keys.filter(k => JSON.stringify(baseline[k]) !== JSON.stringify(current[k]));
  for (const k of changed) console.log(`ĐỔI  ${k}\n      trước: ${JSON.stringify(baseline[k])}\n      sau:   ${JSON.stringify(current[k])}`);
  const status = (s: Record<string, Row>) => Object.values(s).reduce((acc, r) => { const key = String(r.status ?? 'LỖI'); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  console.log(`\n${changed.length === 0 ? 'KHÔNG ĐỔI' : `${changed.length} CA ĐỔI`} / ${keys.length} ca (${seconds}s) · trước ${JSON.stringify(status(baseline))} · sau ${JSON.stringify(status(current))}`);
  process.exit(changed.length === 0 ? 0 : 1);
}

main().catch(error => { console.error(error); process.exit(1); });
