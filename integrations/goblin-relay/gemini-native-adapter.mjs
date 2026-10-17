#!/usr/bin/env node
// integrations/goblin-relay/gemini-native-adapter.mjs - Cầu nối cục bộ: nhận request kiểu Google native (/v1beta/models/<model>:generateContent, như Tax Referee gọi)
// rồi gọi 9Router bằng kiểu OpenAI (/v1/chat/completions) và trả kết quả về dạng native.
// VÌ SAO: đo ngày 2026-10-17, 9Router nhận đường native nhưng LÀM RƠI ẢNH (inlineData) và model bịa ra một hóa đơn khác, không báo lỗi.
// Đường OpenAI (image_url) thì đọc đúng. Adapter chạy không cần cài gì (Node 22), khóa thật chỉ nằm ở đây.
//   GATEWAY_API_KEY=<khóa 9Router> GATEWAY_BASE_URL=https://<máy chủ>/v1 [GATEWAY_MODEL=ag/gemini-3.8-flash-medium] [ADAPTER_TOKEN=<khóa giả tax dùng>] node integrations/goblin-relay/gemini-native-adapter.mjs
//   Rồi trong .env.local của tax: SHOPAIKEY_BASE_URL=http://127.0.0.1:8790/v1  SHOPAIKEY_API_KEY=<ADAPTER_TOKEN>  SHOPAIKEY_MODEL=ag/gemini-3.8-flash-medium
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const KEY = process.env.GATEWAY_API_KEY || '';
const BASE = (process.env.GATEWAY_BASE_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('Thiếu GATEWAY_BASE_URL (địa chỉ cổng AI kiểu OpenAI, dạng https://<máy chủ>/v1)'); process.exit(1); }
const FORCE_MODEL = process.env.GATEWAY_MODEL || '';
const TOKEN = process.env.ADAPTER_TOKEN || '';
const PORT = Number(process.env.ADAPTER_PORT || 8790);
const BIND = process.env.ADAPTER_BIND || '127.0.0.1';
const TIMEOUT_MS = Number(process.env.ADAPTER_TIMEOUT_MS || 90_000);

if (!KEY) {
  console.error('Thiếu GATEWAY_API_KEY');
  process.exit(1);
}
if (BIND === '0.0.0.0' || BIND === '::') {
  console.error('Không bind 0.0.0.0: adapter giữ khóa thật, chỉ nghe 127.0.0.1');
  process.exit(1);
}

const same = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const send = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));
const fail = (res, code, msg) => send(res, code, { error: { code, message: msg } });

/** Google native "contents" -> OpenAI "messages" */
export function toOpenAI(body, model) {
  const messages = [];
  const sys = body.systemInstruction?.parts?.map((p) => p.text || '').join('\n').trim();
  if (sys) messages.push({ role: 'system', content: sys });
  for (const c of body.contents || []) {
    const parts = [];
    for (const p of c.parts || []) {
      if (typeof p.text === 'string') parts.push({ type: 'text', text: p.text });
      else if (p.inlineData?.data) parts.push({ type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType || 'image/jpeg'};base64,${p.inlineData.data}` } });
      else throw new Error('Phần nội dung không hỗ trợ (chỉ text và inlineData)');
    }
    messages.push({ role: c.role === 'model' ? 'assistant' : 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
  }
  const g = body.generationConfig || {};
  const out = { model, messages, stream: false };
  if (g.temperature != null) out.temperature = g.temperature;
  if (g.maxOutputTokens != null) out.max_tokens = g.maxOutputTokens;
  if (g.responseMimeType === 'application/json') out.response_format = { type: 'json_object' };
  return out;
}

/** Trả lời của 9Router (JSON hoặc SSE) -> {text, finish, usage, model} */
export function readCompletion(raw) {
  let text = '';
  let finish = null;
  let usage = null;
  let model = null;
  if (raw.trimStart().startsWith('data:')) {
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
      try {
        const j = JSON.parse(line.slice(5));
        model = j.model || model;
        usage = j.usage || usage;
        const ch = j.choices?.[0];
        text += ch?.delta?.content || ch?.message?.content || '';
        finish = ch?.finish_reason || finish;
      } catch {}
    }
  } else {
    const j = JSON.parse(raw);
    model = j.model;
    usage = j.usage;
    text = j.choices?.[0]?.message?.content || '';
    finish = j.choices?.[0]?.finish_reason;
  }
  return { text, finish, usage, model };
}

export function toNative({ text, finish, usage, model }) {
  const u = usage || {};
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: finish === 'length' ? 'MAX_TOKENS' : 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: u.prompt_tokens ?? 0, candidatesTokenCount: u.completion_tokens ?? 0, totalTokenCount: u.total_tokens ?? 0 },
    modelVersion: model || 'unknown',
  };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && /\/health$/.test(req.url || '')) return send(res, 200, { ok: true });
    const m = /^\/v1(?:beta)?\/models\/([^/:?]+):generateContent/.exec(req.url || '');
    if (req.method !== 'POST' || !m) return fail(res, 404, 'Chỉ hỗ trợ POST /v1beta/models/<model>:generateContent');
    if (TOKEN) {
      const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('key') || '';
      if (!same(given, TOKEN)) return fail(res, 401, 'sai token');
    }
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 25 * 1024 * 1024) return fail(res, 413, 'request quá lớn');
      chunks.push(c);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (body.tools?.length) return fail(res, 400, 'Adapter không hỗ trợ tools/Google Search grounding qua 9Router');
    const model = FORCE_MODEL || decodeURIComponent(m[1]);
    let payload;
    try {
      payload = toOpenAI(body, model);
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(TIMEOUT_MS) });
    const raw = await r.text();
    if (!r.ok) return fail(res, r.status === 401 || r.status === 403 ? 502 : r.status, `Gateway HTTP ${r.status}: ${raw.slice(0, 200).replace(KEY, '[ĐÃ CHE]')}`);
    const out = readCompletion(raw);
    if (!out.text.trim()) return fail(res, 502, 'Gateway không trả nội dung');
    console.log(`🔁 ${model} ok (${out.usage?.prompt_tokens ?? '?'} token vào)`);
    send(res, 200, toNative(out));
  } catch (e) {
    console.error('adapter lỗi:', e.message);
    fail(res, 502, `Adapter lỗi: ${String(e.message).replace(KEY, '[ĐÃ CHE]').slice(0, 200)}`);
  }
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT, BIND, () => console.log(`🔌 Adapter native→OpenAI nghe ${BIND}:${PORT}, gateway ${BASE}${FORCE_MODEL ? `, ép model ${FORCE_MODEL}` : ''}`));
}
