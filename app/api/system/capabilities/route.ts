import { NextResponse } from 'next/server';
import { getActivePolicy } from '@/lib/server/db';
import { runningCommit } from '@/lib/server/buildInfo';
import { auditHead } from '@/lib/server/audit';
import { aiRuntimeInfo, configWarnings } from '@/lib/server/runtimeInfo';
import { CAPABILITIES, PRINCIPALS } from '@/lib/capabilities';
import { VISION_ALLOWED_KEYS } from '@/services/geminiService';

export const dynamic = 'force-dynamic';

/** Bảng định danh và quyền (công khai, không chứa bí mật) kèm phiên bản mã đang chạy — dữ liệu của trang /trust. */
export async function GET() {
  const policy = getActivePolicy(), audit = auditHead(), commit = runningCommit() || 'unknown';
  return NextResponse.json({ principals: PRINCIPALS, capabilities: CAPABILITIES, visionAllowedKeys: VISION_ALLOWED_KEYS, commit, policyVersion: policy.version, policyHash: policy.contentHash,
    audit: { events: audit.count, headHash: audit.headHash, hmac: audit.keyed }, ai: aiRuntimeInfo(), warnings: configWarnings(audit.keyed, commit) }, { headers: { 'Cache-Control': 'no-store' } });
}
