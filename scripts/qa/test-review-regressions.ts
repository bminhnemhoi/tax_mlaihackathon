import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { getUserFromToken, switchRole } from '../../lib/server/auth';
import { POST as internalLogin } from '../../app/api/auth/login/route';
import { POST as changeRole } from '../../app/api/auth/switch/route';
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
  const roleLogin = (role: string) => internalLogin(new NextRequest('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'tax_referee_demo=12345678-1234-1234-1234-123456789abc' },
    body: JSON.stringify({ role })
  }));
  // Mặc định: workspace nội bộ không cho chọn vai trò không mật khẩu (nếu không ai cũng thành CFO và tự duyệt).
  delete process.env.TAX_REFEREE_ALLOW_INTERNAL_ROLE_LOGIN;
  for (const role of ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO']) assert.equal((await roleLogin(role)).status, 403);
  console.log('PASS Workspace nội bộ từ chối đăng nhập chỉ bằng vai trò');
  process.env.TAX_REFEREE_ALLOW_INTERNAL_ROLE_LOGIN = '1';
  try {
    for (const role of ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO']) {
      const response = await roleLogin(role);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).user.role, role);
      const token = response.cookies.get('tax_referee_session')!.value;
      assert.equal(getUserFromToken(token)?.role, role, 'Role login must create an internal session despite a demo cookie');
      assert.equal(response.cookies.get('tax_referee_demo')?.value, '');
      assert.equal((await changeRole(request('/api/auth/switch', token, { role: 'CFO' }))).status, 403, 'Không được đổi vai trò trên workspace nội bộ');
    }
  } finally { delete process.env.TAX_REFEREE_ALLOW_INTERNAL_ROLE_LOGIN; }
  assert.equal((await internalLogin(request('/api/auth/login', '', { role: 'ADMIN' }))).status, 400);
  assert.equal((await changeRole(request('/api/auth/switch', '', { role: 'CFO' }))).status, 401);
  console.log('PASS Cờ vận hành bật đăng nhập vai trò nội bộ nhưng vẫn cấm đổi vai trò; từ chối role sai/phiên thiếu');
  const demoId = '12345678-1234-4234-8234-123456789abc';
  const demoRequest = (path: string, token: string, body?: unknown) => new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { cookie: `tax_referee_session=${token}; tax_referee_demo=${demoId}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {})
  });
  const opened = await openDemo(demoRequest('/api/demo/session', '', {}));
  assert.equal(opened.status, 200);
  const demoUser = (await opened.json()).user;
  assert.equal(demoUser.role, 'ACCOUNTANT', 'Demo mặc định vào vai Kế toán viên');
  const demoToken = opened.cookies.get('tax_referee_session')!.value;
  const promoted = await changeRole(demoRequest('/api/auth/switch', demoToken, { role: 'CFO' }));
  assert.equal(promoted.status, 200);
  assert.equal((await promoted.json()).user.role, 'CFO');
  const asCfo = await openDemo(demoRequest('/api/demo/session', '', { role: 'CFO' }));
  assert.equal((await asCfo.json()).user.role, 'CFO');
  console.log('PASS Demo riêng: mặc định Kế toán viên, chọn/đổi vai trò mô phỏng trong database của phiên');
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
