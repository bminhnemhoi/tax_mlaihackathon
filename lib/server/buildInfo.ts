/** Commit đang chạy, do nền tảng triển khai cung cấp qua biến môi trường (GIT_COMMIT_SHA khi tự build). */
export function runningCommit(): string | undefined {
  return process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.SOURCE_COMMIT || undefined;
}
export const startedAt = new Date().toISOString();
