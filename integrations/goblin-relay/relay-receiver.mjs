#!/usr/bin/env node
// integrations/goblin-relay/relay-receiver.mjs - Chạy trên MÁY NHẬN (vd máy chạy Tax Referee) để nhận file Goblin gửi sang. Không cần cài thêm gì (Node 22).
//   RELAY_TOKEN=<token dài, khớp RELAY_TAX_TOKEN trên VPS> RELAY_BIND=<IP Tailscale của máy này> node integrations/goblin-relay/relay-receiver.mjs
// Biến môi trường:
//   RELAY_TOKEN   (bắt buộc)  token Bearer; phải khớp RELAY_<ĐÍCH>_TOKEN của Goblin
//   RELAY_BIND    mặc định 127.0.0.1 (chỉ máy này); đặt IP Tailscale để Goblin trên VPS gọi tới được. KHÔNG đặt 0.0.0.0
//   RELAY_PORT    mặc định 8787
//   RELAY_INBOX   thư mục lưu file, mặc định ./relay-inbox
//   RELAY_MAX_MB  mặc định 15
//   TAX_BASE_URL  (tùy chọn) vd http://127.0.0.1:3100 : chuyển tiếp mỗi file vào POST /api/documents/parse của Tax Referee và trả TÓM TẮT về cho Goblin
//   TAX_EVALUATE  1 = sau khi đọc xong thì đẩy tiếp vào thẩm định (POST /api/evaluate) để hóa đơn HIỆN TRONG HỘP THẨM ĐỊNH của tax, giống bấm "Thẩm định" trên giao diện
//   TAX_AUTH      demo (mặc định: mở phiên demo riêng, không cần mật khẩu) | password (cần TAX_EMAIL + TAX_PASSWORD) | none
//   TAX_AUTH_HEADER (tùy chọn) vd "Authorization: Bearer ..." : tự cấp header, bỏ qua TAX_AUTH
//   TAX_PARSE_URL (cũ) URL đầy đủ của route parse, dùng thay TAX_BASE_URL nếu cần
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, basename } from 'node:path';

const TOKEN = process.env.RELAY_TOKEN || '';
const BIND = process.env.RELAY_BIND || '127.0.0.1';
const PORT = Number(process.env.RELAY_PORT || 8787);
const INBOX = process.env.RELAY_INBOX || './relay-inbox';
const MAX = (Number(process.env.RELAY_MAX_MB) || 15) * 1024 * 1024;
const TAX_BASE = (process.env.TAX_BASE_URL || '').replace(/\/+$/, '');
const TAX_URL = process.env.TAX_PARSE_URL || (TAX_BASE ? `${TAX_BASE}/api/documents/parse` : '');
const TAX_AUTH_HEADER = process.env.TAX_AUTH_HEADER || '';
const TAX_AUTH = (process.env.TAX_AUTH || 'demo').toLowerCase();
const TAX_EVALUATE = /^(1|true|yes)$/i.test(process.env.TAX_EVALUATE || '');
const TAX_ORIGIN = TAX_BASE || (TAX_URL ? new URL(TAX_URL).origin : '');

if (TOKEN.length < 16) {
  console.error('Thiếu RELAY_TOKEN (>= 16 ký tự). Tạo bằng: openssl rand -hex 24');
  process.exit(1);
}
if (BIND === '0.0.0.0' || BIND === '::') {
  console.error('Không bind 0.0.0.0: đặt RELAY_BIND là IP Tailscale hoặc 127.0.0.1');
  process.exit(1);
}
mkdirSync(INBOX, { recursive: true });

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const clean = (n) => (basename(String(n).replace(/\\/g, '/')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(-120) || 'file');
// ---- Tax Referee: đăng nhập tự động (cookie phiên), đăng nhập lại khi hết hạn, tóm tắt kết quả ----
let taxCookie = '';
async function taxLogin() {
  if (TAX_AUTH === 'none') return '';
  const path = TAX_AUTH === 'password' ? '/api/auth/login' : '/api/demo/session';
  const body = TAX_AUTH === 'password' ? { email: process.env.TAX_EMAIL || '', password: process.env.TAX_PASSWORD || '' } : {};
  const r = await fetch(TAX_ORIGIN + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`đăng nhập tax thất bại (HTTP ${r.status})`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !/=\s*$/.test(c)).join('; ');
}
async function taxPost(data, name, type) {
  const call = async () => {
    const fd = new FormData();
    fd.set('file', new Blob([data], { type: type || 'application/octet-stream' }), name);
    const headers = {};
    if (TAX_AUTH_HEADER) {
      const i = TAX_AUTH_HEADER.indexOf(':');
      headers[TAX_AUTH_HEADER.slice(0, i).trim()] = TAX_AUTH_HEADER.slice(i + 1).trim();
    } else if (taxCookie) headers.cookie = taxCookie;
    return fetch(TAX_URL, { method: 'POST', body: fd, headers, signal: AbortSignal.timeout(90_000) });
  };
  if (!taxCookie && !TAX_AUTH_HEADER) taxCookie = await taxLogin();
  let r = await call();
  if (r.status === 401 && !TAX_AUTH_HEADER) {
    taxCookie = await taxLogin(); // phiên hết hạn (8 giờ) -> đăng nhập lại một lần
    r = await call();
  }
  return r;
}
/** Đẩy hóa đơn đã đọc vào thẩm định như nút "Thẩm định" trên giao diện (hiện trong hộp thẩm định của tài khoản đang đăng nhập) */
async function taxEvaluate(parsed) {
  const invoice = { ...parsed.invoice, sourceArtifactId: parsed.artifactId, sourceHash: parsed.sourceHash, id: `ZALO-${Date.now()}` };
  for (const f of ['invoiceNumber', 'invoiceDate', 'supplierTaxCode', 'supplierName', 'itemName']) if (!String(invoice[f] || '').trim()) delete invoice[f];
  const body = JSON.stringify({ invoice, sourceUncertainFields: parsed.uncertainFields || [], mode: TAX_AUTH === 'demo' ? 'DEMO' : 'PRODUCTION', demo: TAX_AUTH === 'demo' });
  const headers = { 'content-type': 'application/json' };
  if (TAX_AUTH_HEADER) {
    const i = TAX_AUTH_HEADER.indexOf(':');
    headers[TAX_AUTH_HEADER.slice(0, i).trim()] = TAX_AUTH_HEADER.slice(i + 1).trim();
  } else if (taxCookie) headers.cookie = taxCookie;
  const r = await fetch(`${TAX_ORIGIN}/api/evaluate`, { method: 'POST', headers, body, signal: AbortSignal.timeout(60_000) });
  return { status: r.status, text: await r.text() };
}
/** Câu xác nhận ngắn cho Goblin: chỉ nói ĐÃ ĐƯA vào Tax Referee (mọi xử lý tiếp theo làm trên web), không diễn giải quyết định */
function briefConfirm(parsed, ev) {
  const i = parsed.invoice || {};
  let dec = {};
  try {
    dec = JSON.parse(ev.text).decision || {};
  } catch {}
  const no = [i.invoiceSeries, i.invoiceNumber].filter(Boolean).join('');
  const kind = dec.status === 'ROUTINE' ? 'Tax xếp là ca thường quy.' : dec.status ? 'Tax chuyển cấp trên xem xét.' : '';
  return `Đã đưa vào hộp thẩm định của Tax Referee: HĐ ${no}, bên bán ${i.supplierName || 'chưa rõ'}, tổng ${vnd(i.totalAmount)}. ${kind} Xử lý tiếp trên web.`.replace(/\s+/g, ' ').slice(0, 300);
}
function evalSummary(status, text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    return ` Chưa đưa được vào thẩm định (HTTP ${status}).`;
  }
  if (status >= 400 || d.error) return ` Chưa đưa được vào thẩm định: ${String(d.error || 'lỗi').slice(0, 120)}.`;
  const dec = d.decision || {};
  if (dec.status === 'ROUTINE') {
    const held = d.workflow?.autoApproved === false;
    return ` Đã đưa vào hộp thẩm định: ${held ? 'ca thường quy, chờ Kế toán trưởng duyệt tay' : `ca thường quy, tự duyệt${dec.approvedTaxAmount ? ` (thuế được khấu trừ ${vnd(dec.approvedTaxAmount)})` : ''}`}.`;
  }
  return ` Đã đưa vào hộp thẩm định: cần cấp trên quyết${dec.actionableQuestion ? `: ${String(dec.actionableQuestion).slice(0, 220)}` : ''}.`;
}
const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;
function taxSummary(status, text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    return `Tax trả HTTP ${status}, không đọc được nội dung.`;
  }
  if (status >= 400 || d.error) return `Tax không đọc được file (HTTP ${status}): ${String(d.error || 'lỗi không rõ').slice(0, 200)}`;
  if (d.documentType === 'NOT_INVOICE') return 'Tax xem xong: ảnh/file này KHÔNG phải hóa đơn nên không đưa vào thẩm định.';
  const i = d.invoice || {};
  const who = i.supplierName ? `${i.supplierName}${i.supplierTaxCode ? ` (MST ${i.supplierTaxCode})` : ''}` : 'chưa rõ bên bán';
  const no = [i.invoiceSeries, i.invoiceNumber].filter(Boolean).join('') || 'chưa rõ số';
  const money = i.totalAmount != null ? `, tổng ${vnd(i.totalAmount)}${i.taxRate != null ? ` (thuế ${i.taxRate}%)` : ''}` : '';
  const uncertain = Array.isArray(d.uncertainFields) && d.uncertainFields.length ? ` Cần kiểm tra: ${d.uncertainFields.slice(0, 4).join(', ')}.` : '';
  const warn = Array.isArray(d.warnings) && d.warnings.find((w) => /⚠|cảnh báo/i.test(w));
  return `Tax đọc được (${d.sourceType || '?'}): HĐ ${no}${i.invoiceDate ? ` ngày ${i.invoiceDate}` : ''}, bên bán ${who}${money}.${uncertain}${warn ? ` ${String(warn).slice(0, 120)}` : ''}${d.needsReview ? ' Cần kế toán xem lại.' : ''}`.slice(0, 480);
}

const reply = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));

createServer(async (req, res) => {
  try {
    if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'chỉ nhận POST' });
    const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!safeEqual(given, TOKEN)) return reply(res, 401, { ok: false, error: 'sai token' });
    if (Number(req.headers['content-length'] || 0) > MAX + 4096) return reply(res, 413, { ok: false, error: 'file quá lớn' });

    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX + 4096) return reply(res, 413, { ok: false, error: 'file quá lớn' });
      chunks.push(c);
    }
    const form = await new Request('http://x/', { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) }).formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return reply(res, 400, { ok: false, error: 'thiếu file' });
    const data = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(data).digest('hex');
    if (form.get('sha256') && form.get('sha256') !== sha256) return reply(res, 422, { ok: false, error: 'sha256 không khớp, file hỏng trên đường truyền' });

    let name = clean(form.get('filename') || file.name);
    const same = (n) => createHash('sha256').update(readFileSync(join(INBOX, n))).digest('hex') === sha256;
    if (existsSync(join(INBOX, name)) && !same(name)) name = `${sha256.slice(0, 8)}-${name}`;
    if (!existsSync(join(INBOX, name))) writeFileSync(join(INBOX, name), data, { mode: 0o600 }); // gửi lại y hệt thì không lưu thêm bản trùng
    console.log(`📥 ${name} (${data.length} bytes, ${sha256.slice(0, 12)}…)`);

    let tax;
    if (TAX_URL) {
      try {
        const r = await taxPost(data, name, file.type);
        const text = await r.text();
        tax = { status: r.status, summary: taxSummary(r.status, text) };
        if (TAX_EVALUATE && r.status < 400) {
          try {
            const parsed = JSON.parse(text);
            // Giống giao diện tax: có nhận ra được hóa đơn (số HĐ, bên bán hoặc tổng tiền) là đưa vào thẩm định; trường thiếu thì tax tự hỏi lại trên web
            const inv = parsed.invoice || {};
            const hasCore = Boolean(inv.invoiceNumber || inv.supplierName || inv.totalAmount != null);
            if (parsed.documentType === 'NOT_INVOICE') {
              /* không phải hóa đơn: không thẩm định */
            } else if (!hasCore) {
              tax.summary += ' Tax chưa nhận ra được thông tin hóa đơn nào nên CHƯA vào hộp thẩm định, cần mở web xem lại ảnh.';
            } else {
              const ev = await taxEvaluate(parsed);
              tax.summary = ev.status < 400 ? briefConfirm(parsed, ev) : (tax.summary + evalSummary(ev.status, ev.text)).slice(0, 480);
              tax.evaluated = ev.status < 400;
            }
          } catch (e) {
            tax.summary += ` Chưa đưa được vào thẩm định: ${e.message}.`;
          }
        }
      } catch (e) {
        tax = { error: `không gọi được tax cục bộ: ${e.message}`, summary: `Đã nhận file nhưng không chuyển được vào tax: ${e.message}` };
      }
    }
    // File đã lưu an toàn vào inbox, nhưng tax xử lý hỏng thì KHÔNG báo thành công: để Goblin không ghi sổ "đã gửi" và gửi lại được sau khi sửa
    // (tax lỗi hệ thống/không gọi được -> 502; tax từ chối nội dung file -> 422)
    const failed = tax && (tax.error || tax.status >= 400);
    const code = !failed ? 200 : tax.error || tax.status >= 500 ? 502 : 422;
    reply(res, code, { ok: !failed, ...(tax ? { summary: tax.summary } : {}), saved: name, sha256, ...(tax ? { tax } : {}) });
  } catch (e) {
    console.error(e);
    reply(res, 500, { ok: false, error: 'lỗi nội bộ' });
  }
}).listen(PORT, BIND, () => console.log(`📡 Receiver nghe ${BIND}:${PORT}, lưu vào ${INBOX}${TAX_URL ? `, chuyển tiếp tới ${TAX_URL} (đăng nhập: ${TAX_AUTH_HEADER ? 'header tự cấp' : TAX_AUTH})` : ''}`));
