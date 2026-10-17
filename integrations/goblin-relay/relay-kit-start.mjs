#!/usr/bin/env node
// integrations/goblin-relay/relay-kit-start.mjs - Khởi động bộ nhận hóa đơn trên MÁY DEMO (Windows/macOS/Linux, chỉ cần Node >= 22):
// receiver (nhận file từ Goblin) + adapter 9Router (tùy chọn, chỉ khi có GATEWAY_API_KEY). Tự dò IP Tailscale để nghe đúng chỗ.
//   node relay-kit-start.mjs            đọc cấu hình từ relay-kit.env cạnh file này (hoặc biến môi trường)
// Cấu hình: xem relay-kit.env.example. Ctrl+C để tắt hết.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Đọc KEY=VALUE (bỏ dòng trống/#, bỏ nháy). Biến môi trường thật luôn thắng file. */
export function loadEnvFile(file, env = process.env) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (env[k] === undefined) env[k] = v;
  }
}

const TAILSCALE_BINS = ['tailscale', 'C:\\Program Files\\Tailscale\\tailscale.exe', '/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale'];

/** IPv4 Tailscale của máy này (100.x.y.z), hoặc null nếu chưa cài/chưa kết nối */
export function tailscaleIPv4() {
  for (const bin of process.env.TAILSCALE_BIN ? [process.env.TAILSCALE_BIN] : TAILSCALE_BINS) {
    try {
      const out = execFileSync(bin, ['ip', '-4'], { encoding: 'utf-8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
      const ip = out.split(/\s+/).find((x) => /^100\.\d+\.\d+\.\d+$/.test(x));
      if (ip) return ip;
    } catch {}
  }
  return null;
}

export function main() {
  loadEnvFile(process.env.KIT_ENV || join(here, 'relay-kit.env'));
  loadEnvFile(join(process.cwd(), 'relay-kit.env'));
  const env = process.env;
  if (+process.versions.node.split('.')[0] < 22) {
    console.error(`Cần Node >= 22 (đang ${process.version}).`);
    process.exit(1);
  }
  if ((env.RELAY_TOKEN || '').length < 16) {
    console.error('Thiếu RELAY_TOKEN (>= 16 ký tự) trong relay-kit.env. Phải GIỐNG RELAY_TAX_TOKEN trên VPS.');
    process.exit(1);
  }
  let bind = (env.RELAY_BIND || 'auto').trim();
  if (bind === 'auto') {
    bind = tailscaleIPv4() || '';
    if (!bind) {
      if (env.KIT_ALLOW_LOCAL === '1') bind = '127.0.0.1';
      else {
        console.error('Tailscale chưa kết nối (không lấy được IP 100.x). Bật Tailscale rồi chạy lại, hoặc đặt KIT_ALLOW_LOCAL=1 để thử cục bộ.');
        process.exit(1);
      }
    }
  }
  const port = env.RELAY_PORT || '8787';
  const inbox = resolve(env.RELAY_INBOX || join(process.cwd(), 'relay-inbox'));
  mkdirSync(inbox, { recursive: true });

  const children = [];
  const run = (name, script, extra) => {
    const child = spawn(process.execPath, [join(here, script)], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    const tag = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
    child.stdout.on('data', tag);
    child.stderr.on('data', tag);
    child.on('exit', (code) => {
      console.error(`[${name}] đã dừng (mã ${code}). Tắt cả bộ.`);
      shutdown(code || 1);
    });
    children.push(child);
  };
  const shutdown = (code = 0) => {
    for (const c of children) try { c.kill(); } catch {}
    setTimeout(() => process.exit(code), 300);
  };
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  run('receiver', 'relay-receiver.mjs', { RELAY_BIND: bind, RELAY_PORT: port, RELAY_INBOX: inbox });
  if (env.GATEWAY_API_KEY) run('adapter', 'gemini-native-adapter.mjs', { ADAPTER_BIND: '127.0.0.1' });
  console.log(`Receiver nghe ${bind}:${port}. Trên VPS đặt: RELAY_TAX_URL=http://${bind}:${port}/inbox  (và RELAY_TAX_TOKEN = RELAY_TOKEN ở đây)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
