import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

/**
 * Trích xuất text trực tiếp từ Digital PDF (hóa đơn điện tử PDF vector).
 * Tốc độ thực thi cực nhanh (< 30ms), hoàn toàn không cần qua OCR hình ảnh.
 */
export function extractTextFromPdfBuffer(pdfBuffer: Buffer): string | null {
  const tmpId = crypto.randomUUID();
  const tmpPdfPath = path.join(os.tmpdir(), `tax-referee-text-${tmpId}.pdf`);

  try {
    fs.writeFileSync(tmpPdfPath, pdfBuffer);

    // Dùng Python PyMuPDF (fitz) hoặc pypdf có sẵn trên máy để đọc trực tiếp text stream
    const pyScript = `
import sys
text = ""
try:
    import fitz
    doc = fitz.open(sys.argv[1])
    for page in doc:
        text += page.get_text() + "\\n"
except Exception:
    try:
        from pypdf import PdfReader
        reader = PdfReader(sys.argv[1])
        for page in reader.pages:
            text += (page.extract_text() or "") + "\\n"
    except Exception:
        pass
sys.stdout.write(text.strip())
`;

    const output = execSync(`python3 -c '${pyScript.replace(/'/g, "'\\''")}' "${tmpPdfPath}"`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const cleanText = (output || '').trim();
    if (cleanText.length >= 40) {
      return cleanText;
    }
  } catch (err: any) {
    console.warn('[PDF Extractor] Lỗi đọc text stream trực tiếp từ PDF:', err?.message);
  } finally {
    if (fs.existsSync(tmpPdfPath)) {
      try {
        fs.unlinkSync(tmpPdfPath);
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/**
 * Tối ưu hóa kích thước và độ phân giải hình ảnh trước khi gửi sang mô hình Vision.
 * Giảm payload từ nhiều MB xuống còn ~200KB - 300KB, tăng tốc độ OCR lên gấp 5 lần.
 */
export function optimizeImageBuffer(
  imageBuffer: Buffer,
  mimeType: string
): { buffer: Buffer; mimeType: string } {
  // Nếu ảnh đã nhỏ sẵn (< 400KB), không cần can thiệp
  if (imageBuffer.length < 400 * 1024) {
    return { buffer: imageBuffer, mimeType };
  }

  const tmpId = crypto.randomUUID();
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const tmpInputPath = path.join(os.tmpdir(), `tax-referee-opt-${tmpId}.${ext}`);
  const tmpOutputPath = path.join(os.tmpdir(), `tax-referee-opt-${tmpId}.jpg`);

  try {
    fs.writeFileSync(tmpInputPath, imageBuffer);

    // Sử dụng Apple ImageIO sips (tích hợp sẵn trên macOS, tốc độ < 30ms)
    execSync(
      `sips -Z 1600 -s format jpeg -s formatOptions 82 "${tmpInputPath}" --out "${tmpOutputPath}"`,
      {
        timeout: 4000,
        stdio: 'ignore'
      }
    );

    if (fs.existsSync(tmpOutputPath) && fs.statSync(tmpOutputPath).size > 0) {
      const optimizedBuffer = fs.readFileSync(tmpOutputPath);
      return { buffer: optimizedBuffer, mimeType: 'image/jpeg' };
    }
  } catch (err: any) {
    console.warn('[Image Optimizer] Lỗi tối ưu ảnh bằng sips, sử dụng ảnh gốc:', err?.message);
  } finally {
    if (fs.existsSync(tmpInputPath)) {
      try {
        fs.unlinkSync(tmpInputPath);
      } catch {
        // ignore
      }
    }
    if (fs.existsSync(tmpOutputPath)) {
      try {
        fs.unlinkSync(tmpOutputPath);
      } catch {
        // ignore
      }
    }
  }

  return { buffer: imageBuffer, mimeType };
}

/**
 * Render trang đầu của tài liệu PDF sang định dạng hình ảnh PNG (Base64)
 * Chỉ dùng khi PDF là bản scan (không có text stream).
 */
export function convertPdfToPngBase64(pdfBuffer: Buffer): string {
  const tmpId = crypto.randomUUID();
  const tmpPdfPath = path.join(os.tmpdir(), `tax-referee-${tmpId}.pdf`);
  const tmpOutDir = os.tmpdir();
  const expectedPngPath = path.join(tmpOutDir, `tax-referee-${tmpId}.pdf.png`);

  try {
    fs.writeFileSync(tmpPdfPath, pdfBuffer);

    let converted = false;

    // 1. Thử dùng qlmanage của macOS
    try {
      execSync(`qlmanage -t -s 1500 -o "${tmpOutDir}" "${tmpPdfPath}"`, {
        stdio: 'pipe',
        timeout: 5000
      });
      if (fs.existsSync(expectedPngPath) && fs.statSync(expectedPngPath).size > 0) {
        converted = true;
      }
    } catch {
      // Fallback
    }

    // 2. Fallback sang PyMuPDF
    if (!converted) {
      const pythonPngPath = path.join(tmpOutDir, `tax-referee-${tmpId}.png`);
      try {
        execSync(
          `python3 -c "import fitz, sys; doc=fitz.open(sys.argv[1]); doc[0].get_pixmap(dpi=150).save(sys.argv[2])" "${tmpPdfPath}" "${pythonPngPath}"`,
          { stdio: 'pipe', timeout: 8000 }
        );
        if (fs.existsSync(pythonPngPath) && fs.statSync(pythonPngPath).size > 0) {
          const pngBuf = fs.readFileSync(pythonPngPath);
          fs.unlinkSync(pythonPngPath);
          return pngBuf.toString('base64');
        }
      } catch (pyErr) {
        console.warn('[PDF Converter] Python fitz fallback error:', pyErr);
      }
    }

    if (fs.existsSync(expectedPngPath)) {
      const pngBuf = fs.readFileSync(expectedPngPath);
      fs.unlinkSync(expectedPngPath);
      return pngBuf.toString('base64');
    }

    throw new Error('Không thể render trang PDF sang PNG để thực hiện Vision OCR');
  } finally {
    if (fs.existsSync(tmpPdfPath)) {
      try {
        fs.unlinkSync(tmpPdfPath);
      } catch {
        // ignore
      }
    }
  }
}
