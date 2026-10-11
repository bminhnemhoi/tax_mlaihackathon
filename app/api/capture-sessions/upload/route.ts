import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NextRequest, NextResponse } from 'next/server';
import { appendAuditEvent } from '@/lib/server/audit';
import { assertArtifactCapacity, ArtifactQuotaError } from '@/lib/server/artifactQuota';
import { artifactRoot, getDatabase, jsonNow, withDemoDatabase, withRequestDatabase } from '@/lib/server/db';
import { isAppleVisionAvailable, runAppleVisionOcr } from '@/services/localOcrService';
import { getNonInvoiceReason } from '@/services/invoiceImagePreflight';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function imageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

async function handlePOST(request: NextRequest) {
  let createdPath: string | null = null;
  try {
    const form = await request.formData();
    const token = String(form.get('token') || '');
    const file = form.get('file');
    if (!token || token.length > 128) return NextResponse.json({ error: 'Liên kết chụp không hợp lệ.' }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: 'Chưa chọn ảnh hóa đơn.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Ảnh vượt quá 15 MB.' }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = imageExtension(buffer);
    if (!extension || !['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'].includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ nhận ảnh PNG, JPG hoặc WEBP.' }, { status: 415 });
    }

    const db = getDatabase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const now = jsonNow();
    const activeSession = db.prepare('SELECT id,status,expires_at FROM capture_sessions WHERE token_hash=?').get(tokenHash) as { id: string; status: string; expires_at: string } | undefined;
    if (!activeSession) return NextResponse.json({ error: 'Liên kết chụp không hợp lệ.' }, { status: 404 });
    if (['WAITING', 'READY'].includes(activeSession.status) && Date.parse(activeSession.expires_at) <= Date.now()) {
      return NextResponse.json({ error: 'Mã QR đã hết hạn. Hãy tạo mã mới trên laptop.' }, { status: 410 });
    }

    // On macOS, Apple Vision screens the photo locally in fast mode before it
    // is stored or passed to the extraction model. No external AI API is called
    // for an obvious non-invoice image. Other hosts safely keep the old flow.
    if (['WAITING', 'READY'].includes(activeSession.status) && process.env.LOCAL_IMAGE_PREFLIGHT !== 'false'
      && process.platform === 'darwin' && isAppleVisionAvailable()) {
      const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-referee-preflight-'));
      const tempImage = path.join(tempDirectory, `capture${extension}`);
      try {
        fs.writeFileSync(tempImage, buffer, { mode: 0o600 });
        const localOcr = await runAppleVisionOcr(tempImage, 'fast');
        if (localOcr.success && getNonInvoiceReason(localOcr.fullText, localOcr.totalLines)) {
          return NextResponse.json({ error: 'Ảnh chưa có dấu hiệu của hóa đơn. Hãy chụp rõ hóa đơn hoặc chọn ảnh khác.' }, { status: 422 });
        }
      } finally {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
      }
    }

    const result = db.transaction(() => {
      const session = db.prepare('SELECT id,owner_user_id,status,expires_at,artifact_id FROM capture_sessions WHERE token_hash=?').get(tokenHash) as Record<string, unknown> | undefined;
      if (!session) throw Object.assign(new Error('Liên kết chụp không hợp lệ.'), { status: 404 });
      const status = String(session.status);
      if (status === 'UPLOADED' && session.artifact_id) {
        const existing = db.prepare('SELECT content_hash FROM document_artifacts WHERE id=?').get(String(session.artifact_id)) as { content_hash: string } | undefined;
        if (existing?.content_hash === contentHash) return { id: String(session.id), artifactId: String(session.artifact_id), duplicate: true };
        throw Object.assign(new Error('Ảnh trước đang được xử lý. Hãy thử lại sau vài giây.'), { status: 409 });
      }
      if (!['WAITING', 'READY'].includes(status)) throw Object.assign(new Error('Phiên chụp không còn hoạt động.'), { status: 410 });
      if (Date.parse(String(session.expires_at)) <= Date.now()) {
        throw Object.assign(new Error('Mã QR đã hết hạn. Hãy tạo mã mới trên laptop.'), { status: 410 });
      }

      const prior = db.prepare('SELECT id FROM document_artifacts WHERE content_hash=?').get(contentHash) as { id: string } | undefined;
      const artifactId = prior?.id || crypto.randomUUID();
      if (!prior) {
        assertArtifactCapacity(buffer.byteLength);
        const directory = artifactRoot();
        fs.mkdirSync(directory, { recursive: true });
        createdPath = path.join(directory, `${artifactId}${extension}`);
        fs.writeFileSync(createdPath, buffer, { flag: 'wx', mode: 0o600 });
        const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
        db.prepare(`INSERT INTO document_artifacts
          (id,invoice_id,revision,original_file_name,source_type,mime_type,storage_path,content_hash,byte_size,signature_status,uploaded_by,created_at)
          VALUES (?, ?, 1, ?, 'IMAGE', ?, ?, ?, ?, 'NOT_APPLICABLE', ?, ?)`)
          .run(artifactId, `pending:${artifactId}`, `hoa-don-${artifactId.slice(0, 8)}${extension}`, mimeType, createdPath, contentHash, buffer.byteLength, session.owner_user_id, now);
      }
      db.prepare("UPDATE capture_sessions SET status='UPLOADED',artifact_id=?,updated_at=?,uploaded_at=? WHERE id=? AND status IN ('WAITING','READY')")
        .run(artifactId, now, now, session.id);
      appendAuditEvent({ eventType: 'CAPTURE_SESSION_UPLOADED', entityId: String(session.id), actorId: String(session.owner_user_id), payload: { artifactId, contentHash, byteSize: buffer.byteLength, source: 'QR_PHONE' } });
      return { id: String(session.id), artifactId, duplicate: false };
    })();

    return NextResponse.json({ ...result, status: 'UPLOADED' }, { status: result.duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (createdPath && fs.existsSync(createdPath)) {
      try { fs.unlinkSync(createdPath); } catch { /* preserve the primary upload error */ }
    }
    const status = error instanceof ArtifactQuotaError ? 413 : Number((error as { status?: number })?.status) || 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể tải ảnh lên.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  const demoId = request.nextUrl.searchParams.get('demo');
  if (demoId && !/^[a-f0-9-]{36}$/i.test(demoId)) return NextResponse.json({ error: 'Phiên demo không hợp lệ.' }, { status: 400 });
  if (demoId) return withDemoDatabase(demoId, () => handlePOST(request));
  return withRequestDatabase(request, () => handlePOST(request));
}
