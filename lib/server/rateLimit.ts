/** Giới hạn tần suất đơn giản trong bộ nhớ (một tiến trình, đủ cho máy chủ đơn của demo). */
const buckets = new Map<string, number[]>();

export function allowRate(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= limit) { buckets.set(key, recent); return false; }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some(t => now - t < windowMs)) buckets.delete(k);
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip')?.trim() || 'local';
}
