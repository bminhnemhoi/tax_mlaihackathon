import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import Database from 'better-sqlite3';
import { isAppleVisionAvailable } from '../../services/localOcrService';

async function main() {
  const build = path.resolve(process.env.NEXT_BUILD_DIR || '.next');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-referee-capture-'));
  const runtime = path.join(root, 'runtime');
  const port = '3007';
  const origin = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const running = child;
    await new Promise<void>((resolve) => { running.once('exit', () => resolve()); running.kill('SIGTERM'); });
    child = undefined;
  };
  const start = async (enableLocalPreflight = false) => {
    child = spawn(process.execPath, [path.join(build, 'standalone/server.js')], {
      env: {
        ...process.env,
        PORT: port,
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        DOCUMENT_IMAGE_ENGINE: 'local-ocr',
        LOCAL_IMAGE_PREFLIGHT: enableLocalPreflight ? 'true' : 'false',
        LOCAL_OCR_URL: '',
        TAX_REFEREE_DATA_DIR: runtime,
        TAX_REFEREE_DB_PATH: path.join(runtime, 'internal.sqlite')
      },
      stdio: 'ignore'
    });
    for (let i = 0; i < 70; i++) {
      if (child.exitCode !== null) throw new Error('Standalone không khởi động.');
      try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch { /* retry while server starts */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Health timeout khi khởi động standalone.');
  };
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(`${origin}${url}`, init);
    const contentType = response.headers.get('content-type') || '';
    return { response, body: contentType.includes('application/json') ? await response.json() : await response.arrayBuffer() };
  };

  try {
    await start();
    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'ACCOUNTANT' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const authHeaders = { cookie, 'Content-Type': 'application/json' };

    const created = await request('/api/capture-sessions', { method: 'POST', headers: { cookie } });
    assert.equal(created.response.status, 201);
    const { id, captureUrl, expiresAt } = created.body as { id: string; captureUrl: string; expiresAt: string };
    const qr = new URL(captureUrl);
    const token = qr.searchParams.get('token');
    assert.ok(token && Date.parse(expiresAt) > Date.now());
    assert.match(qr.pathname, new RegExp(`/capture/${id}$`));

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=', 'base64');
    const upload = async (activeToken: string, image: Buffer = png, type = 'image/png', filename = 'camera.png') => {
      const form = new FormData();
      form.append('token', activeToken);
      form.append('file', new Blob([image], { type }), filename);
      return request('/api/capture-sessions/upload', { method: 'POST', body: form });
    };

    const invalid = await upload('not-a-real-token');
    assert.equal(invalid.response.status, 404);
    const wrongType = new FormData();
    wrongType.append('token', token!);
    wrongType.append('file', new Blob(['plain text'], { type: 'text/plain' }), 'invoice.txt');
    assert.equal((await request('/api/capture-sessions/upload', { method: 'POST', body: wrongType })).response.status, 415);

    const uploaded = await upload(token!);
    assert.equal(uploaded.response.status, 201);
    const artifactId = (uploaded.body as { artifactId: string }).artifactId;
    const status = await request(`/api/capture-sessions/${id}`, { headers: { cookie } });
    assert.equal((status.body as { status: string }).status, 'UPLOADED');
    assert.equal((await request(`/api/capture-sessions/${id}`)).response.status, 401);

    const artifact = await fetch(`${origin}/api/documents/artifacts/${artifactId}`, { headers: { cookie } });
    assert.equal(artifact.status, 200);
    assert.equal(artifact.headers.get('content-type'), 'image/png');

    const processing = await request(`/api/capture-sessions/${id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'PROCESSING' })
    });
    assert.equal(processing.response.status, 200);
    const parsed = await request('/api/documents/parse', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ artifactId })
    });
    assert.equal(parsed.response.status, 200);
    assert.equal((parsed.body as { artifactId: string }).artifactId, artifactId);
    assert.ok((parsed.body as { invoice: unknown }).invoice);
    const ready = await request(`/api/capture-sessions/${id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'READY' })
    });
    assert.equal(ready.response.status, 200);
    assert.equal(((await request(`/api/capture-sessions/${id}`, { headers: { cookie } })).body as { status: string }).status, 'READY');

    const nextPhoto = await upload(token!);
    assert.equal(nextPhoto.response.status, 201, 'the active QR should accept a follow-up photo after the first one is ready');
    assert.equal(((await request(`/api/capture-sessions/${id}`, { headers: { cookie } })).body as { status: string }).status, 'UPLOADED');
    const nextProcessing = await request(`/api/capture-sessions/${id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'PROCESSING' })
    });
    assert.equal(nextProcessing.response.status, 200);
    const nextReady = await request(`/api/capture-sessions/${id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'READY' })
    });
    assert.equal(nextReady.response.status, 200);

    const failedSession = await request('/api/capture-sessions', { method: 'POST', headers: { cookie } });
    const failedId = (failedSession.body as { id: string }).id;
    const db = new Database(path.join(runtime, 'internal.sqlite'));
    db.prepare('UPDATE capture_sessions SET expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), failedId);
    db.close();
    const failedUrl = new URL((failedSession.body as { captureUrl: string }).captureUrl);
    const expiredUpload = await upload(failedUrl.searchParams.get('token')!);
    assert.equal(expiredUpload.response.status, 410);

    const cancelled = await request(`/api/capture-sessions/${failedId}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(cancelled.response.status, 200);

    const audit = await request(`/api/audit?entityId=${id}`, { headers: { cookie } });
    const events = (audit.body as { events: Array<{ eventType: string }> }).events;
    assert.ok(events.some((event) => event.eventType === 'CAPTURE_SESSION_CREATED'));
    assert.ok(events.some((event) => event.eventType === 'CAPTURE_SESSION_UPLOADED'));
    assert.ok(events.some((event) => event.eventType === 'CAPTURE_SESSION_PROCESSING'));
    assert.ok(events.some((event) => event.eventType === 'CAPTURE_SESSION_READY'));

    console.log('PASS QR capture API: scoped token, image validation, private artifact, OCR handoff, lifecycle, expiry, audit.');

    if (process.platform === 'darwin' && isAppleVisionAvailable()) {
      await stop();
      await start(true);
      const localLogin = await fetch(`${origin}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'ACCOUNTANT' })
      });
      const localCookie = localLogin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
      const candidate = await request('/api/capture-sessions', { method: 'POST', headers: { cookie: localCookie } });
      const candidateId = (candidate.body as { id: string }).id;
      const candidateUrl = new URL((candidate.body as { captureUrl: string }).captureUrl);
      const candidateToken = candidateUrl.searchParams.get('token')!;
      const beforePreflightDb = new Database(path.join(runtime, 'internal.sqlite'));
      const existingArtifactCount = (beforePreflightDb.prepare('SELECT COUNT(*) AS count FROM document_artifacts').get() as { count: number }).count;
      beforePreflightDb.close();
      const nonInvoice = await upload(candidateToken, png);
      assert.equal(nonInvoice.response.status, 422, 'blank image should be rejected by local OCR');
      const preflightDb = new Database(path.join(runtime, 'internal.sqlite'));
      assert.equal((preflightDb.prepare('SELECT status FROM capture_sessions WHERE id=?').get(candidateId) as { status: string }).status, 'WAITING');
      assert.equal((preflightDb.prepare('SELECT COUNT(*) AS count FROM document_artifacts').get() as { count: number }).count, existingArtifactCount);
      preflightDb.close();
      const invoice = await fs.readFile(path.resolve('input-sample/11_real_invoice_photo.jpg'));
      const acceptedInvoice = await upload(candidateToken, invoice, 'image/jpeg', 'invoice.jpg');
      assert.equal(acceptedInvoice.response.status, 201, 'real invoice image should pass local OCR preflight');
      console.log('PASS local Apple Vision preflight: blank photo rejected before artifact/provider processing; real invoice accepted.');
    }
  } finally {
    await stop();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
