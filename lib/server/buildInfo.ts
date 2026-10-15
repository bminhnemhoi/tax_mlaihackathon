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
  }
  return fileCommit || undefined;
}
export const startedAt = new Date().toISOString();
