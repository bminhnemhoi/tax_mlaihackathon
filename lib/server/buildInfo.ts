import fs from 'node:fs';
import path from 'node:path';

let fileCommit: string | null | undefined;
/** Commit đang chạy: biến môi trường của nền tảng triển khai, hoặc file .git-commit do script đóng gói ghi (Hostinger). */
export function runningCommit(): string | undefined {
  const fromEnv = process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.SOURCE_COMMIT;
  if (fromEnv) return fromEnv;
  if (fileCommit === undefined) {
    fileCommit = null;
    for (const candidate of [path.join(process.cwd(), '.git-commit'), path.join(process.cwd(), '..', '..', '.git-commit')]) {
      try { const value = fs.readFileSync(candidate, 'utf8').trim(); if (/^[0-9a-f]{7,40}$/.test(value)) { fileCommit = value; break; } } catch { /* chưa đóng gói */ }
    }
    // Nền tảng deploy bằng git clone (hPanel Git): đọc commit từ .git của thư mục chạy hoặc thư mục cha.
    if (!fileCommit) fileCommit = commitFromGitDir() ?? null;
  }
  return fileCommit || undefined;
}
function commitFromGitDir(): string | undefined {
  for (const dir of [process.cwd(), path.join(process.cwd(), '..'), path.join(process.cwd(), '..', '..'), path.join(process.cwd(), '..', '..', '..')]) {
    try {
      const gitDir = path.join(dir, '.git'), head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
      if (/^[0-9a-f]{40}$/.test(head)) return head;
      const ref = head.startsWith('ref: ') ? head.slice(5).trim() : '';
      if (!ref || ref.includes('..')) continue;
      try { const value = fs.readFileSync(path.join(gitDir, ref), 'utf8').trim(); if (/^[0-9a-f]{40}$/.test(value)) return value; } catch { /* ref đã đóng gói */ }
      const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8').split(/\r?\n/).find(line => line.endsWith(` ${ref}`));
      if (packed && /^[0-9a-f]{40}/.test(packed)) return packed.slice(0, 40);
    } catch { /* không có .git */ }
  }
  return undefined;
}
export const startedAt = new Date().toISOString();
