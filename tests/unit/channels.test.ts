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

test('Gmail: chỉ tin header Authentication-Results trên cùng do mx.google.com ghi', () => {
  const forged = 'From: a@example.com\r\nAuthentication-Results: evil.example; dkim=pass header.i=@example.com\r\nSubject: x\r\n\r\nbody';
  assert.equal(topAuthenticationResults(forged), undefined);
  const real = `Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@example.com\r\nAuthentication-Results: evil.example; spf=pass\r\n\r\nbody`;
  assert.match(topAuthenticationResults(real) ?? '', /^mx\.google\.com; dkim=pass/);
});
