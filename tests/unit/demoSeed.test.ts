import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { seedDemoCases } from '../../services/demoSeed';
import { checkHandoff } from '../../services/handoffService';

test('phiên demo mới có 4 ca mẫu: 1 tự xử lý + đủ 3 kiểu dừng, câu hỏi hợp lệ; không nạp lại khi đã có dữ liệu', async () => {
  await runIsolated(async () => {
    assert.ok(switchRole('CHIEF_ACCOUNTANT'), 'tạo người dùng mẫu của phiên');
    const decisions = await seedDemoCases();
    assert.deepEqual(decisions.map(d => d.status), ['ROUTINE', 'ESCALATED', 'ESCALATED', 'ESCALATED']);
    const escalated = decisions.filter(d => d.status === 'ESCALATED');
    assert.deepEqual(escalated.map(d => d.status === 'ESCALATED' && d.riskGroup), ['UNCERTAIN_INFO', 'OUT_OF_POLICY', 'EXCEED_AUTHORITY']);
    for (const d of escalated) assert.deepEqual(checkHandoff(d).errors, []);
    const cfoCase = escalated[2];
    assert.ok(cfoCase.status === 'ESCALATED' && cfoCase.requiresCFO);
    assert.match(cfoCase.status === 'ESCALATED' ? cfoCase.actionableQuestion : '', /1A, 2A/);
    assert.deepEqual(await seedDemoCases(), [], 'không nạp trùng');
  });
});
