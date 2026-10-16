#!/usr/bin/env node
// PreToolUse guard: chặn thao tác làm lộ bí mật hoặc phá lịch sử git (bằng chứng chấm thi).
// Đọc JSON từ stdin (tool_name, tool_input); exit 2 + stderr = chặn và báo lý do cho Claude.
let raw = '';
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const tool = input.tool_name || '';
  const args = input.tool_input || {};
  const block = reason => { process.stderr.write(`Bị chặn bởi .claude/hooks/guard.mjs: ${reason}\n`); process.exit(2); };

  // File bí mật: tên file (phần sau dấu / hoặc \) là env_* hoặc .env, .env.local… — riêng .env.example được phép.
  const isSecretName = name => {
    const base = String(name).split(/[\\/]/).pop().replace(/^["'`]+|["'`;,)]+$/g, '');
    return /^env_[\w.-]+$/i.test(base) || (/^\.env(\.[\w-]+)*$/i.test(base) && base.toLowerCase() !== '.env.example');
  };
  const tokens = text => String(text || '').split(/[\s"'`|&;<>()=]+/).filter(Boolean);
  const noVerify = new RegExp('\\s--no' + '-verify\\b');

  if (['Read', 'Edit', 'Write', 'NotebookEdit'].includes(tool) && isSecretName(args.file_path || args.notebook_path || '')) {
    block('không đọc/ghi file bí mật (env_*, .env*). Chỉ được nhắc tên biến.');
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(args.command || '');
    if (tokens(cmd).some(isSecretName)) block('lệnh chạm file bí mật (env_*, .env*). Chỉ được nhắc tên biến, không đọc giá trị.');
    if (/git\s+push\b[^\n]*(\s--force\b|\s-f\b|--force-with-lease)/i.test(cmd)) block('không force-push: lịch sử commit là bằng chứng chấm thi.');
    if (noVerify.test(cmd)) block('không bỏ qua hook git.');
    if (/git\s+rebase\s+-i\b|git\s+reset\s+--hard\s+origin/i.test(cmd)) block('không viết lại lịch sử git.');
    if (/gh\s+pr\s+merge\b[^\n]*--squash/i.test(cmd)) block('không squash merge.');
  }
  process.exit(0);
});