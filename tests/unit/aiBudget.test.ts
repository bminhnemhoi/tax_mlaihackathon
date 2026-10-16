/** Ngân sách gọi AI tính phí (OWASP LLM10): vượt trần thì fail-closed, không gọi mô hình. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runIsolated } from '../../lib/server/db';
import { allowVisionCall, aiBudgetConfig, AI_BUDGET_DEFAULTS } from '../../lib/server/aiBudget';
import { resolveSupplierIdentity } from '../../services/supplierIdentityResolver';

function withEnv(vars: Record<string, string>, fn: () => Promise<void> | void) {
  const saved = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  Object.assign(process.env, vars);
  const restore = () => { for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; };
  return Promise.resolve(fn()).finally(restore);
}

test('mặc định: 60 lần đọc ảnh/giờ mỗi người dùng, 60 lần tra cứu/giờ mỗi phiên; trong môi trường test không áp trần trừ khi bật', () => {
  assert.equal(aiBudgetConfig().visionPerUserHour, AI_BUDGET_DEFAULTS.visionPerUserHour);
  assert.equal(aiBudgetConfig().groundingPerSessionHour, 60);
  for (let i = 0; i < 100; i++) assert.equal(allowVisionCall('u-test-unlimited'), true);
});

test('vượt trần đọc ảnh: lần thứ hai bị từ chối (route trả 429, không gọi Vision)', async () => {
  await withEnv({ TAX_REFEREE_FORCE_LIMITS: '1', TAX_REFEREE_PARSE_PER_HOUR: '1' }, () => {
    assert.equal(allowVisionCall('u-budget-1'), true);
    assert.equal(allowVisionCall('u-budget-1'), false);
    assert.equal(allowVisionCall('u-budget-2'), true, 'người dùng khác có ngân sách riêng');
  });
});

test('vượt trần tra cứu có grounding: trả SOURCE_UNAVAILABLE mà không gọi tìm kiếm (fail-closed)', async () => {
  await runIsolated(async () => {
    await withEnv({ TAX_REFEREE_FORCE_LIMITS: '1', TAX_REFEREE_GROUNDING_PER_SESSION_HOUR: '1' }, async () => {
      let calls = 0;
      const search = async () => { calls += 1; return { status: 'NOT_FOUND' as const, sources: [] }; };
      const providers = { exact: async () => null, candidates: async () => [] };
      await resolveSupplierIdentity({ supplierName: 'Công ty TNHH Thử Ngân Sách Một' }, search, providers);
      const second = await resolveSupplierIdentity({ supplierName: 'Công ty TNHH Thử Ngân Sách Hai' }, search, providers);
      assert.equal(calls, 1);
      assert.equal(second.status, 'SOURCE_UNAVAILABLE');
    });
  });
});
