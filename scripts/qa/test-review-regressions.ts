import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { getUserFromToken, switchRole } from '../../lib/server/auth';
import { POST as openDemo } from '../../app/api/demo/session/route';
import { POST as evaluate } from '../../app/api/evaluate/route';
import { GET as inbox } from '../../app/api/inbox/route';
import { challengeCases, demoCompanyTaxCode } from '../../data/verification/challengeCases';

function request(path: string, token: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: `tax_referee_session=${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function checkSession(demo: boolean) {
  const session = switchRole('CFO')!;
  const before = getDatabase().prepare('SELECT COUNT(*) n FROM sessions').get();
  const response = await openDemo(request('/api/demo/session', session.token, { preserveExisting: true }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.demo, demo);
  assert.equal(data.user.role, 'CFO');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(getUserFromToken(session.token)?.role, 'CFO');
  assert.deepEqual(getDatabase().prepare('SELECT COUNT(*) n FROM sessions').get(), before);
  console.log(`PASS Verify giữ phiên CFO ${demo ? 'demo' : 'nội bộ'}`);
}

async function main() {
  // Run with TAX_REFEREE_DB_PATH=:memory: so the internal-session check cannot touch user data.
  assert.equal(process.env.TAX_REFEREE_DB_PATH, ':memory:');
  await checkSession(false);
  await runIsolated(async () => {
    await checkSession(true);
    const db = getDatabase();
    const policy = getActivePolicy();
    policy.config.companyTaxCode = demoCompanyTaxCode;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const session = switchRole('CFO')!;
    const invoice = { ...challengeCases[0].invoice, id: 'REVISION', invoiceNumber: 'REVISION' };
    const first = await evaluate(request('/api/evaluate', session.token, { invoice, forceLocalOnly: true }));
    assert.equal(first.status, 200);
    const initial = await first.json();
    const revised = { ...invoice, itemName: 'Giấy in văn phòng đã đối chiếu' };
    const stale = await evaluate(request('/api/evaluate', session.token, { invoice: revised, forceLocalOnly: true }));
    assert.equal(stale.status, 409);
    const second = await evaluate(request('/api/evaluate', session.token, {
      invoice: revised, expectedRevision: initial.workflow.revision, forceLocalOnly: true
    }));
    assert.equal(second.status, 200);
    assert.equal((await second.json()).workflow.revision, initial.workflow.revision + 1);
    console.log('PASS Gửi lại hồ sơ với revision hiện hành; revision thiếu vẫn bị chặn');

    for (const fixture of [challengeCases[0], challengeCases[3]]) {
      for (const engine of ['GEMINI_AI', 'JEV_AND_GEMINI_AI']) {
        const id = `HISTORY-${fixture.id}-${engine}`;
        const response = await evaluate(request('/api/evaluate', session.token, {
          invoice: { ...fixture.invoice, id, invoiceNumber: id }, forceLocalOnly: true
        }));
        assert.equal(response.status, 200);
        const result = await response.json();
        db.prepare('UPDATE evaluations SET decision_json=? WHERE id=?')
          .run(JSON.stringify({ ...result.decision, engineUsed: engine }), result.workflow.evaluationId);
      }
    }
    const response = await inbox(request('/api/inbox', session.token));
    assert.equal(response.status, 200);
    const data = await response.json();
    const historical = data.items.filter((item: any) => item.id.startsWith('HISTORY-'));
    assert.equal(historical.length, 4);
    assert.ok(historical.every((item: any) => item.decision.engineUsed.includes('GEMINI')));
    console.log('PASS Inbox đọc cả ROUTINE và ESCALATED từ hai engine Gemini cũ');
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
