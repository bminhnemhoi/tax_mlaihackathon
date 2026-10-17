/**
 * Kênh Gmail: client IMAP giả (không gọi mạng). Nhân viên đã xác thực gửi XML ⇒ máy kiểm và gắn vào lô GMAIL;
 * cùng địa chỉ nhưng không qua SPF/DKIM ⇒ chờ xác nhận người gửi; kéo lại cùng thư không tạo bản trùng.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDatabase, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { listChannelMessages, pullChannel } from '../../services/channels/channelService';
import { topAuthenticationResults, type GmailClient, type InboundMail } from '../../services/channels/gmailChannel';
import { listNotifications, notify } from '../../services/channels/notifier';
import { isAllowedZaloFileUrl, parseZaloUpdates, type ZaloClient } from '../../services/channels/zaloChannel';
import { emailAuthenticated, seedStaffDirectory } from '../../services/staffDirectory';

const fakeGmail = (mails: InboundMail[], seen: number[] = []): GmailClient => ({
  fetchUnseen: async () => mails, markSeen: async (uids) => { seen.push(...uids); }, close: async () => undefined,
});
const AUTH_OK = 'mx.google.com; dkim=pass header.i=@example.com header.s=s1; spf=pass (google.com: domain of minhanh.kd@example.com designates 1.2.3.4) smtp.mailfrom=minhanh.kd@example.com';
const XML = `<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon><TTChung><KHHDon>C26TAA</KHHDon><SHDon>4521</SHDon><NLap>2026-10-05</NLap><HTTToan>Chuyển khoản</HTTToan></TTChung>
<NDHDon><NBan><Ten>Công ty TNHH Văn phòng phẩm Thử</Ten><MST>0312345678</MST><DChi>Quận 1, TP.HCM</DChi></NBan><NMua><Ten>Công ty Mua</Ten><MST>0102030405</MST></NMua>
<DSHHDVu><HHDVu><THHDVu>Giấy in A4</THHDVu><ThTien>2000000</ThTien><TSuat>10%</TSuat></HHDVu></DSHHDVu>
<TToan><TgTCThue>2000000</TgTCThue><TgTThue>200000</TgTThue><TgTTTBSo>2200000</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;
const mail = (over: Partial<InboundMail> = {}): InboundMail => ({
  uid: 7, messageId: '<hd-4521@example.com>', from: 'minhanh.kd@example.com', fromName: 'Nguyễn Minh Anh', subject: 'Hóa đơn giấy in',
  authenticationResults: AUTH_OK, attachments: [{ fileName: 'hd-4521.xml', mime: 'application/xml', content: Buffer.from(XML) }], ...over,
});

test('Gmail: nhân viên đã xác thực gửi XML ⇒ máy kiểm, gắn vào một lô GMAIL kèm người nộp; đánh dấu đã đọc', async () => {
  await runIsolated(async () => {
    const user = switchRole('ACCOUNTANT')!.user; const seen: number[] = [];
    const result = await pullChannel(user, 'GMAIL', { gmail: fakeGmail([mail()], seen) });
    assert.equal(result.counts.PROCESSED, 1, JSON.stringify(listChannelMessages()));
    assert.ok(result.batchId, 'tạo lô');
    const db = getDatabase();
    const batch = db.prepare('SELECT source FROM batches WHERE id=?').get(result.batchId) as { source: string };
    assert.equal(batch.source, 'GMAIL');
    const item = db.prepare('SELECT invoice_id, submitter_staff_id FROM batch_items WHERE batch_id=?').get(result.batchId) as { invoice_id: string; submitter_staff_id: string };
    assert.equal(item.submitter_staff_id, 'STAFF-KD');
    assert.ok(db.prepare('SELECT 1 FROM invoices WHERE id=?').get(item.invoice_id), 'hóa đơn đã được máy kiểm');
    assert.deepEqual(seen, [7]);
    const [message] = listChannelMessages();
    assert.equal(message.senderKind, 'VERIFIED');
    assert.ok(message.size && message.size > 0);
  });
});

test('Gmail: cùng địa chỉ nhân viên nhưng không qua SPF/DKIM ⇒ nghi mạo danh, chờ xác nhận, không xử lý', async () => {
  await runIsolated(async () => {
    const user = switchRole('ACCOUNTANT')!.user;
    const result = await pullChannel(user, 'GMAIL', { gmail: fakeGmail([mail({ authenticationResults: undefined })]) });
    assert.equal(result.counts.NEEDS_SENDER_REVIEW, 1);
    assert.equal(result.counts.PROCESSED, 0);
    assert.equal(result.batchId, null, 'không tạo lô');
    const [message] = listChannelMessages();
    assert.equal(message.senderKind, 'SPOOF_SUSPECT');
    assert.equal(message.invoiceId, null);
    assert.equal((getDatabase().prepare('SELECT COUNT(*) n FROM invoices').get() as { n: number }).n, 0);
  });
});

test('Gmail: kéo lại cùng thư không tạo bản trùng; file sai đuôi bị bỏ qua', async () => {
  await runIsolated(async () => {
    const user = switchRole('ACCOUNTANT')!.user;
    const m = mail({ attachments: [...mail().attachments, { fileName: 'virus.exe', mime: 'application/octet-stream', content: Buffer.from('MZ') }] });
    await pullChannel(user, 'GMAIL', { gmail: fakeGmail([m]) });
    const second = await pullChannel(user, 'GMAIL', { gmail: fakeGmail([m]) });
    assert.equal(second.duplicates, 1);
    assert.equal(second.files, 0);
    assert.equal(listChannelMessages().length, 1);
  });
});

test('Thông báo: thiếu cấu hình ⇒ ghi SKIPPED_NOT_CONFIGURED, kênh gửi lỗi ⇒ FAILED, không bao giờ ném lỗi', async () => {
  await runIsolated(async () => {
    const saved = { to: process.env.GMAIL_NOTIFY_TO, chat: process.env.ZALO_NOTIFY_CHAT_ID };
    delete process.env.GMAIL_NOTIFY_TO; delete process.env.ZALO_NOTIFY_CHAT_ID;
    try {
      const skipped = await notify({ kind: 'TEST', text: 'Lô thử' }, { emailReady: false, zaloReady: false, sendEmail: async () => { throw new Error('không được gọi'); }, sendZalo: async () => { throw new Error('không được gọi'); } });
      assert.deepEqual(skipped.map(r => r.status), ['SKIPPED_NOT_CONFIGURED', 'SKIPPED_NOT_CONFIGURED']);
      const failed = await notify({ kind: 'TEST', text: 'x', to: { zaloChatId: 'chat-1' } }, { emailReady: true, zaloReady: true, sendEmail: async () => undefined, sendZalo: async () => { throw new Error('POST https://bot-api.zaloplatforms.com/botSECRET123/sendMessage 500'); } });
      assert.equal(failed[0].status, 'FAILED');
      assert.ok(!failed[0].error?.includes('SECRET123'), 'lỗi lưu lại không chứa token');
      assert.equal(listNotifications().length, 3);
      // Lượt kéo Gmail có lô: tóm tắt cho KTT + báo người gửi, chạy được khi chưa cấu hình kênh gửi.
      const sent: string[] = [];
      const user = switchRole('ACCOUNTANT')!.user;
      await pullChannel(user, 'GMAIL', { gmail: fakeGmail([mail()]), notifier: { emailReady: true, zaloReady: false, sendEmail: async (to, _s, text) => { sent.push(`${to}|${text}`); }, sendZalo: async () => undefined } });
      assert.ok(sent.some(s => s.startsWith('minhanh.kd@example.com|Hóa đơn hd-4521.xml')), sent.join('\n'));
    } finally {
      if (saved.to !== undefined) process.env.GMAIL_NOTIFY_TO = saved.to;
      if (saved.chat !== undefined) process.env.ZALO_NOTIFY_CHAT_ID = saved.chat;
    }
  });
});

test('Zalo: ảnh từ máy chủ ngoài danh sách cho phép bị từ chối, không tải; ảnh của nhân viên đã đăng ký vào hàng chờ', async () => {
  await runIsolated(async () => {
    const user = switchRole('CHIEF_ACCOUNTANT')!.user;
    seedStaffDirectory(); getDatabase().prepare("UPDATE staff_directory SET zalo_user_id='zalo-kd-1' WHERE id='STAFF-KD'").run();
    const downloaded: string[] = [];
    const zalo: ZaloClient = {
      getUpdates: async () => parseZaloUpdates({ ok: true, result: [
        { event_name: 'message.image.received', message: { message_id: 'm1', from: { id: 'zalo-kd-1', display_name: 'Minh Anh' }, chat: { id: 'c1' }, photo: 'http://169.254.169.254/latest/meta-data' } },
        { event_name: 'message.image.received', message: { message_id: 'm2', from: { id: 'zalo-kd-1' }, chat: { id: 'c1' }, photo: 'https://photo-stal-1.zdn.vn/hd.jpg' } },
        { event_name: 'message.text.received', message: { message_id: 'm3', from: { id: 'zalo-kd-1' }, chat: { id: 'c1' }, text: 'chào' } },
      ] }),
      download: async (url) => { downloaded.push(url); return { content: Buffer.from('fake-jpeg'), mime: 'image/jpeg' }; },
    };
    const result = await pullChannel(user, 'ZALO', { zalo, notifier: { emailReady: false, zaloReady: false, sendEmail: async () => undefined, sendZalo: async () => undefined } });
    assert.equal(result.counts.REJECTED, 1);
    assert.equal(result.counts.QUEUED, 1);
    assert.deepEqual(downloaded, ['https://photo-stal-1.zdn.vn/hd.jpg']);
    assert.equal(isAllowedZaloFileUrl('https://zdn.vn.evil.com/a.jpg'), false);
    assert.equal(isAllowedZaloFileUrl('https://user:pw@photo.zdn.vn/a.jpg'), false);
    assert.equal(isAllowedZaloFileUrl('https://photo.zdn.vn:8443/a.jpg'), false);
  });
});

test('Chống mạo danh: tên miền DKIM/SPF phải khớp trọn vẹn, không nhận miền giả có chứa tên miền nhân viên', () => {
  const from = 'minhanh.kd@example.com';
  assert.equal(emailAuthenticated(from, AUTH_OK), true);
  assert.equal(emailAuthenticated(from, 'mx.google.com; dkim=pass header.i=@mail.example.com'), true, 'miền con hợp lệ');
  assert.equal(emailAuthenticated(from, 'mx.google.com; dkim=pass header.d=example.com.evil.net header.s=x'), false);
  assert.equal(emailAuthenticated(from, 'mx.google.com; spf=pass (evil) smtp.mailfrom=attacker@evilexample.com'), false);
  assert.equal(emailAuthenticated(from, 'mx.google.com; dkim=fail header.i=@example.com; spf=softfail smtp.mailfrom=x@example.com'), false);
});

test('Gmail: chỉ tin header Authentication-Results trên cùng do mx.google.com ghi', () => {
  const forged = 'From: a@example.com\r\nAuthentication-Results: evil.example; dkim=pass header.i=@example.com\r\nSubject: x\r\n\r\nbody';
  assert.equal(topAuthenticationResults(forged), undefined);
  const real = `Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@example.com\r\nAuthentication-Results: evil.example; spf=pass\r\n\r\nbody`;
  assert.match(topAuthenticationResults(real) ?? '', /^mx\.google\.com; dkim=pass/);
});

test('chống mạo danh bằng local-part (example.com@evil.net) và kênh thật không chạy trong phiên demo của người lạ', async () => {
  assert.equal(emailAuthenticated('duclong.ktt@example.com', 'mx.google.com; spf=pass (google.com: domain of example.com@evil.net designates 1.2.3.4 as permitted sender) smtp.mailfrom=example.com@evil.net; dmarc=fail header.from=example.com'), false);
  assert.equal(emailAuthenticated('duclong.ktt@example.com', 'mx.google.com; dkim=pass header.i=example.com@evil.net header.s=s1 header.b=abc'), false);
  assert.equal(emailAuthenticated('duclong.ktt@example.com', 'mx.google.com; dkim=pass header.i=@example.com header.s=s1; spf=pass smtp.mailfrom=bounce@example.com'), true);
  assert.equal(emailAuthenticated('duclong.ktt@example.com', 'mx.google.com; spf=pass smtp.mailfrom=noreply@mail.example.com'), true);
  await runIsolated(async () => {
    const user = switchRole('ACCOUNTANT')!.user;
    // Phiên demo không bật kênh thật ⇒ kênh MÔ PHỎNG: không gọi Gmail thật, vẫn chạy đúng nhận diện người gửi và chống mạo danh.
    const gmail = await pullChannel(user, 'GMAIL');
    assert.equal(gmail.simulated, true);
    assert.ok(gmail.counts.PROCESSED >= 2 && gmail.counts.NEEDS_SENDER_REVIEW === 2, JSON.stringify(gmail.counts));
    const kinds = listChannelMessages().filter(m => m.channel === 'GMAIL').map(m => m.senderKind).sort();
    assert.ok(kinds.includes('SPOOF_SUSPECT') && kinds.includes('UNKNOWN'), kinds.join());
    assert.ok(listNotifications().length > 0 && listNotifications().every(n => n.status === 'SIMULATED' || n.status === 'SKIPPED_NOT_CONFIGURED'));
    const zalo = await pullChannel(user, 'ZALO');
    assert.deepEqual([zalo.simulated, zalo.counts.QUEUED, zalo.counts.NEEDS_SENDER_REVIEW], [true, 1, 1]);
    assert.equal((await pullChannel(user, 'GMAIL')).files, 0, 'kéo lại hộp thư mô phỏng không tạo bản trùng');
  });
});

