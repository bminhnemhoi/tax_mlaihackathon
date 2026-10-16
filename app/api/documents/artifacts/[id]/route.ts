import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import { requireRequestUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Tên file chỉ gồm ASCII in được (bỏ dấu tiếng Việt), không có ký tự làm vỡ header. */
function asciiFileName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]|["\\]/g, '_');
}

async function handleGET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireRequestUser(request);
    const { id } = await context.params;
    const artifact = getDatabase().prepare(`
      SELECT original_file_name, mime_type, storage_path, content_hash
      FROM document_artifacts
      WHERE id = ?
    `).get(id) as { original_file_name: string; mime_type: string; storage_path: string; content_hash: string } | undefined;
    if (!artifact || !fs.existsSync(artifact.storage_path)) {
      return NextResponse.json({ error: 'Không tìm thấy chứng từ gốc' }, { status: 404 });
    }

    const body = fs.readFileSync(artifact.storage_path);
    // Chứng từ do người dùng tải lên không bao giờ được trình duyệt chạy như trang web (HTML/SVG có script):
    // chỉ ảnh raster và PDF hiển thị trực tiếp; mọi loại khác (XML…) trả về dạng văn bản thuần trong sandbox.
    const viewable = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(artifact.mime_type);
    const contentType = viewable ? artifact.mime_type : 'text/plain; charset=utf-8';
    return new NextResponse(body as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        ...(artifact.mime_type === 'application/pdf' ? {} : { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
        'Content-Length': String(body.byteLength),
        // Tên file tiếng Việt vượt Latin-1 làm header lỗi (500): filename ASCII dự phòng + filename* UTF-8 (RFC 6266/5987).
        'Content-Disposition': `inline; filename="${asciiFileName(artifact.original_file_name)}"; filename*=UTF-8''${encodeURIComponent(artifact.original_file_name)}`,
        'X-Content-SHA256': artifact.content_hash,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    return NextResponse.json({ error: 'Không thể tải chứng từ gốc' }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
