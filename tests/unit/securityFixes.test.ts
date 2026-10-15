import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { demoExists, runIsolated, withRequestDatabase } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { clientIp } from '../../lib/server/rateLimit';
import { seedDemoCases } from '../../services/demoSeed';
import { applyWorkflowAction, readRecord } from '../../services/workflowService';
import { middleware } from '../../middleware';

test('thao tác hồ sơ: tên sự kiện không do client đặt; KTT không duyệt/từ chối thay CFO; tiếp tục sau khi dừng trả về trạng thái chờ', async () => {
  await runIsolated(async () => {
    switchRole('ACCOUNTANT'); await seedDemoCases();
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    let rec = readRecord('MAU-0009004');
    assert.throws(() => applyWorkflowAction('MAU-0009004', ktt, { action: 'ROUTINE_AUTO_APPROVED', targetStatus: 'REJECTED', reason: 'Giả tên sự kiện audit', revision: rec.revision, evaluationId: rec.evaluation_id }), /Thao tác không hợp lệ/);
    assert.throws(() => applyWorkflowAction('MAU-0009004', ktt, { action: 'OVERRIDE', targetStatus: 'REJECTED', reason: 'KTT từ chối thay CFO', revision: rec.revision, evaluationId: rec.evaluation_id }), /CFO/);
    rec = readRecord('MAU-0009002');
    applyWorkflowAction('MAU-0009002', ktt, { action: 'PAUSE', reason: 'Tạm dừng để kiểm tra', revision: rec.revision, evaluationId: rec.evaluation_id });
    rec = readRecord('MAU-0009002');
    applyWorkflowAction('MAU-0009002', ktt, { action: 'RESUME', reason: 'Tiếp tục xử lý hồ sơ', revision: rec.revision, evaluationId: rec.evaluation_id });
    assert.equal(readRecord('MAU-0009002').status, 'WAITING_CHIEF_ACCOUNTANT', 'ca đang chờ trả lời vẫn trả lời được sau khi tiếp tục');
  });
});

test('cookie demo tự đặt (UUID bất kỳ) không tạo database mới', async () => {
  const fake = crypto.randomUUID();
  const request = new NextRequest('http://localhost/api/auth/me', { headers: { cookie: `tax_referee_demo=${fake}` } });
  await withRequestDatabase(request, async () => null);
  assert.equal(demoExists(fake), false);
});

test('giới hạn tần suất dùng IP do proxy ghi (phần tử cuối X-Forwarded-For), không dùng phần tử client tự đặt', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9');
});

test('chống CSRF: POST từ trang khác bị chặn, cùng trang và gọi từ máy chủ thì cho qua', () => {
  const post = (headers: Record<string, string>, path = '/api/system/automation') => middleware(new NextRequest(`https://app.example.com${path}`, { method: 'POST', headers: { host: 'app.example.com', ...headers } }));
  assert.equal(post({ 'sec-fetch-site': 'cross-site' }).status, 403);
  assert.equal(post({ 'sec-fetch-site': 'same-site', origin: 'https://evil.example.com' }).status, 403);
  assert.equal(post({ origin: 'https://evil.example.com' }).status, 403);
  assert.notEqual(post({ 'sec-fetch-site': 'same-origin', origin: 'https://app.example.com' }).status, 403);
  assert.notEqual(post({}).status, 403);
  assert.notEqual(post({ 'sec-fetch-site': 'cross-site' }, '/api/webhooks/legal-update').status, 403);
});
