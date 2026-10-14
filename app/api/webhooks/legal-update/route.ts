import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { processIncomingLegalUpdate } from '@/services/legal/legalUpdateService';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

/** Khóa chỉ lấy từ biến môi trường (≥ 24 ký tự); không có khóa thì webhook tắt, không dùng khóa mặc định trong mã. */
function secretMatches(candidate: string): boolean {
  const expected = process.env.LEGAL_WEBHOOK_SECRET || '';
  if (expected.length < 24 || !candidate) return false;
  const a = Buffer.from(candidate), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Webhook tiếp nhận thông báo văn bản pháp luật thuế mới theo thời gian thực (Push Event).
 * Dành cho các đối tác LegalTech (Thư Viện Pháp Luật, LuatVietnam) hoặc hệ sinh thái nội bộ.
 */
async function handlePOST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const secretHeader = req.headers.get('x-webhook-secret') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if ((process.env.LEGAL_WEBHOOK_SECRET || '').length < 24) {
      return NextResponse.json({ error: 'Webhook chưa được cấu hình (thiếu LEGAL_WEBHOOK_SECRET).' }, { status: 503 });
    }
    if (!secretMatches(secretHeader) && !secretMatches(bearer)) {
      return NextResponse.json(
        { error: 'Xác thực Webhook không hợp lệ (Unauthorized)' },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!body || !body.code || !body.title || !body.content) {
      return NextResponse.json(
        { error: 'Payload không hợp lệ: thiếu code, title hoặc content' },
        { status: 400 }
      );
    }

    const sourceName = req.headers.get('x-source-name') || 'Đối tác LegalTech B2B (Webhook)';
    const result = await processIncomingLegalUpdate(body, sourceName);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (err) {
    console.error('Lỗi tiếp nhận Webhook pháp lý:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý Webhook nội bộ' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ONLINE',
    service: 'Tax Referee Real-Time Legal Webhook Receiver',
    version: '1.0.0',
    documentation: 'Gửi POST với header Authorization: Bearer <secret> hoặc x-webhook-secret: <secret>'
  });
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
