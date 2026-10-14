/**
 * Bộ chạy kiểm thử chuẩn (cross-platform) cho `npm test`.
 *
 * - Chạy unit test bằng node:test (tests/unit/*.test.ts).
 * - Chạy các bộ hồi quy trong scripts/qa, mỗi bộ trong một tiến trình riêng với thư mục dữ liệu tạm riêng
 *   (TAX_REFEREE_DATA_DIR), nên không bao giờ ghi vào database thật và chạy được trên Windows/macOS/Linux.
 * - In bảng PASS/FAIL kèm dấu thời gian; thoát mã 1 nếu có bộ thất bại.
 *
 * Dùng: `npm test` (tất cả) hoặc `npm test -- referee-core workflow` (lọc theo tên).
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ensureQaFixtures} from './qa-fixtures';

type Suite = {name: string; files: string[]; env?: Record<string, string>; memoryDb?: boolean};

const MOCK_AI = {OPENROUTER_API_KEY: 'qa-mocked-only', QWEN_API_KEY: 'qa-mocked-only'};

export const suites: Suite[] = [
  {name: 'unit', files: []},
  {name: 'manifest', files: ['scripts/qa/test-regression-manifest.ts']},
  {name: 'referee-core', files: ['scripts/qa/test-referee-core.ts']},
  {name: 'referee-labels', files: ['scripts/qa/test-referee-labeling.ts']},
  {name: 'workflow', files: ['scripts/qa/test-workflow-safety.ts']},
  {name: 'phase0', files: ['scripts/qa/test-phase0-safety.ts']},
  {name: 'challenge-a', files: ['scripts/qa/test-challenge-a-improvements.ts'], env: MOCK_AI},
  {name: 'supplier-inference', files: ['scripts/qa/test-supplier-inference-safety.ts'], memoryDb: true},
  {name: 'official-supplier', files: ['scripts/qa/test-official-supplier-lookup.ts', 'scripts/qa/test-supplier-identity-resolver.ts']},
  {name: 'ai-fallback', files: ['scripts/qa/test-ai-fallback.ts']},
  {name: 'review-regressions', files: ['scripts/qa/test-review-regressions.ts'], memoryDb: true},
  {name: 'receipt-entities', files: ['scripts/qa/test-receipt-entities.ts']},
  {name: 'image-preflight', files: ['scripts/qa/test-image-preflight.ts']},
  {name: 'qa-regressions', files: ['scripts/qa/test-qa-regressions.ts'], memoryDb: true, env: {...MOCK_AI, DOCUMENT_IMAGE_ENGINE: 'vision'}},
  {name: 'workspace-ui', files: ['scripts/qa/test-workspace-ui.ts']}
];

const root = path.resolve(__dirname, '..', '..');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function unitTestFiles(): string[] {
  const dir = path.join(root, 'tests', 'unit');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.test.ts')).sort().map(f => path.join('tests', 'unit', f));
}

function run(suite: Suite) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `tax-referee-${suite.name}-`));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    TAX_REFEREE_DATA_DIR: dataDir,
    TAX_REFEREE_DB_PATH: suite.memoryDb ? ':memory:' : path.join(dataDir, 'tax-referee.sqlite'),
    ...suite.env
  };
  const startedAt = new Date();
  let ok = true;
  let detail = '';
  const commands: string[][] = suite.name === 'unit'
    ? (unitTestFiles().length ? [['--import', 'tsx', '--test', ...unitTestFiles()]] : [])
    : suite.files.map(file => [tsxCli, file]);
  for (const args of commands) {
    const result = spawnSync(process.execPath, args, {cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (result.status !== 0) {
      ok = false;
      detail = output.split(/\r?\n/).filter(Boolean).slice(-25).join('\n');
      break;
    }
    const passLines = output.split(/\r?\n/).filter(line => /^\s*(PASS\b|✓|✔|ok \d)/.test(line)).length;
    detail = `${passLines} kiểm tra`;
  }
  fs.rmSync(dataDir, {recursive: true, force: true});
  return {suite: suite.name, ok, startedAt, ms: Date.now() - startedAt.getTime(), detail};
}

async function main() {
  await ensureQaFixtures(root);
  const filters = process.argv.slice(2);
  const selected = filters.length ? suites.filter(s => filters.some(f => s.name.includes(f))) : suites;
  if (!selected.length) {
    console.error(`Không có bộ nào khớp: ${filters.join(', ')}`);
    process.exit(1);
  }
  const results = selected.map(suite => {
    const r = run(suite);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.suite.padEnd(20)} ${String(r.ms).padStart(6)} ms  ${r.startedAt.toISOString()}  ${r.ok ? r.detail : ''}`);
    if (!r.ok) console.log(r.detail.replace(/^/gm, '      │ '));
    return r;
  });
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} bộ kiểm thử đạt · ${new Date().toISOString()}`);
  if (failed.length) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
