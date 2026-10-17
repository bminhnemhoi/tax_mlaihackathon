#!/usr/bin/env node
// integrations/goblin-relay/relay-kit-check.mjs - Tự kiểm tra máy demo đã sẵn sàng nhận hóa đơn từ Goblin chưa. In ✅/❌ từng mục, KHÔNG in bí mật.
//   node relay-kit-check.mjs        (chạy khi receiver đang chạy bằng relay-kit-start.mjs)
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './relay-kit-start.mjs';

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(process.env.KIT_ENV || join(here, 'relay-kit.env'));
loadEnvFile(join(process.cwd(), 'relay-kit.env'));
const env = process.env;

const BINS = ['tailscale', 'C:\\Program Files\\Tailscale\\tailscale.exe', '/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale'];
function tailscaleStatus() {
  for (const bin of process.env.TAILSCALE_BIN ? [process.env.TAILSCALE_BIN] : BINS) {
    try {
      return JSON.parse(execFileSync(bin, ['status', '--json'], { encoding: 'utf-8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }));
    } catch {}
  }
  return null;
}
const get = async (url, ms = 6000) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return r.status;
  } catch {
    return 0;
  }
};

const results = [];
const check = (ok, label, hint = '') => {
  results.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${label}${!ok && hint ? `\n   → ${hint}` : ''}`);
};

check(+process.versions.node.split('.')[0] >= 22, `Node ${process.version} (cần >= 22)`, 'Cài Node 22 trở lên (https://nodejs.org)');
check((env.RELAY_TOKEN || '').length >= 16, 'RELAY_TOKEN đã đặt (>= 16 ký tự)', 'Điền RELAY_TOKEN trong relay-kit.env (phải giống RELAY_TAX_TOKEN trên VPS)');

const ts = tailscaleStatus();
const running = ts?.BackendState === 'Running';
const ips = (ts?.Self?.TailscaleIPs || []).filter((x) => /^100\./.test(x));
check(!!ts, 'Tailscale đã cài', 'Cài Tailscale (https://tailscale.com/download)');
check(running, `Tailscale đang chạy (trạng thái: ${ts?.BackendState || 'không rõ'})`, 'Chạy: tailscale up (hoặc tailscale up --auth-key=<khóa>)');
const ip = ips[0] || '';
const dns = String(ts?.Self?.DNSName || '').replace(/\.$/, '');
check(!!ip, `Có IP Tailscale${ip ? `: ${ip}${dns ? ` (${dns})` : ''}` : ''}`, 'Chưa được cấp IP: đăng nhập/nhập khóa Tailscale trước');

const bind = env.RELAY_BIND && env.RELAY_BIND !== 'auto' ? env.RELAY_BIND : ip || '127.0.0.1';
const port = env.RELAY_PORT || '8787';
const recv = await get(`http://${bind}:${port}/`);
check(recv === 405, `Receiver đang nghe ${bind}:${port} (GET trả 405 là đúng)`, `Chưa chạy hoặc sai địa chỉ: chạy node relay-kit-start.mjs (mã nhận được: ${recv || 'không kết nối'})`);

const taxBase = (env.TAX_BASE_URL || '').replace(/\/+$/, '');
if (taxBase) {
  const h = await get(`${taxBase}/api/health`);
  check(h === 200, `Tax Referee trả lời tại ${taxBase}`, 'Bật Tax Referee (npm run dev hoặc npm start) rồi kiểm tra lại cổng trong TAX_BASE_URL');
} else {
  console.log('ℹ️ Chưa đặt TAX_BASE_URL: receiver chỉ lưu file vào inbox, không chuyển vào tax.');
}
if (env.GATEWAY_API_KEY) {
  const a = await get(`http://127.0.0.1:${env.ADAPTER_PORT || '8790'}/health`);
  check(a === 200, 'Adapter 9Router đang chạy', 'Chạy lại node relay-kit-start.mjs');
}

if (ip && running) {
  console.log(`\nĐiền trên VPS (.env của Goblin), rồi restart goblin:\n  RELAY_TAX_URL=http://${dns || ip}:${port}/inbox\n  (hoặc dùng IP: http://${ip}:${port}/inbox)\n  RELAY_TAX_TOKEN=<đúng giá trị RELAY_TOKEN trong relay-kit.env>`);
}
const bad = results.filter((x) => !x).length;
console.log(bad ? `\n${bad} mục chưa đạt.` : '\nTất cả đạt. Từ VPS thử: curl -s -o /dev/null -w "%{http_code}" http://<địa chỉ trên>:' + port + '/  (phải ra 405).');
process.exit(bad ? 1 : 0);
