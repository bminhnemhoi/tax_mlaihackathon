import sharp from 'sharp';

export type InvoiceImageScreening = {
  decision: 'PASS' | 'UNCERTAIN' | 'REJECT';
  reason?: 'INVALID_IMAGE' | 'TOO_SMALL' | 'BLANK_IMAGE' | 'CLEAR_NON_DOCUMENT';
  signals: { textRows: number; glyphs: number; paperFraction: number; colorFraction: number; edgeFraction: number; paragraphLayout: boolean; alignedValueRows: number };
};

/** Bounded pixel analysis, not OCR or a semantic invoice classifier. */
export async function screenInvoiceImage(buffer: Buffer): Promise<InvoiceImageScreening> {
  const empty = { textRows: 0, glyphs: 0, paperFraction: 0, colorFraction: 0, edgeFraction: 0, paragraphLayout: false, alignedValueRows: 0 };
  try {
    const image = sharp(buffer, { limitInputPixels: 80_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) return { decision: 'REJECT', reason: 'INVALID_IMAGE', signals: empty };
    if (Math.min(metadata.width, metadata.height) < 32 || metadata.width * metadata.height < 4096) return { decision: 'REJECT', reason: 'TOO_SMALL', signals: empty };
    const { data, info } = await image.rotate().flatten({ background: '#fff' }).toColourspace('srgb')
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = info;
    const n = w * h;
    const grey = new Float32Array(n);
    let total = 0, squares = 0, paper = 0, colors = 0, edges = 0;
    for (let i = 0; i < n; i++) {
      const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
      const value = .299 * r + .587 * g + .114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      grey[i] = value; total += value; squares += value * value;
      if (value > 160 && chroma < 45) paper++;
      if (chroma > 65) colors++;
    }
    // Integral-image adaptive contrast keeps shadowed paper and thermal
    // receipts eligible without having to read their words.
    const stride = w + 1;
    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += grey[y * w + x]; integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row; }
    }
    const mask = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (Math.abs(grey[i] - grey[i - 1]) + Math.abs(grey[i] - grey[i - w]) > 55) edges++;
      const x0 = Math.max(0, x - 6), x1 = Math.min(w, x + 7), y0 = Math.max(0, y - 6), y1 = Math.min(h, y + 7);
      const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
      mask[i] = grey[i] < mean - 18 ? 1 : 0;
    }
    const queue = new Int32Array(n);
    const glyphRows: Array<{ y: number; count: number; left: number; right: number; centers: number[] }> = [];
    let glyphs = 0;
    for (let i = 0; i < n; i++) {
      if (!mask[i]) continue;
      let head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0;
      queue[0] = i; mask[i] = 0;
      while (head < tail) {
        const p = queue[head++], x = p % w, y = Math.floor(p / w);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (const q of [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
          if (q >= 0 && q < n && mask[q]) { mask[q] = 0; queue[tail++] = q; }
        }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (tail < 3 || tail > 550 || bh < 2 || bh > 24 || bw < 2 || bw > 100 || bw / bh > 12 || tail / (bw * bh) < .06) continue;
      glyphs++;
      const center = (minY + maxY) / 2;
      const row = glyphRows.find(row => Math.abs(row.y - center) <= 3);
      if (row) { row.count++; row.left = Math.min(row.left, minX); row.right = Math.max(row.right, maxX); row.centers.push((minX + maxX) / 2); }
      else glyphRows.push({ y: center, count: 1, left: minX, right: maxX, centers: [(minX + maxX) / 2] });
    }
    const readableRows = glyphRows.filter(row => row.count >= 4 && row.right - row.left >= 35);
    // A receipt/invoice often places short amounts in a repeated right-hand
    // column. Ordinary paragraphs instead run across the page as uniform lines.
    const rightValueRows = readableRows.filter(row => row.count <= 16 && row.left > w * .55 && row.right > w * .72);
    const alignedValueRows = rightValueRows.filter(row => rightValueRows.filter(other =>
      Math.abs(other.right - row.right) < w * .055).length >= 3).length;
    const wideRows = readableRows.filter(row => (row.right - row.left) / w > .52);
    const startsClustered = wideRows.length >= 7 &&
      (Math.max(...wideRows.map(row => row.left)) - Math.min(...wideRows.map(row => row.left))) / w < .055;
    const paragraphLayout = readableRows.length >= 9 && wideRows.length / readableRows.length >= .68 && startsClustered && alignedValueRows < 3;
    const signals = { textRows: readableRows.length,
      glyphs, paperFraction: paper / n, colorFraction: colors / n, edgeFraction: edges / n,
      paragraphLayout, alignedValueRows };
    const variance = squares / n - (total / n) ** 2;
    if (variance < 25 && signals.edgeFraction < .0005) return { decision: 'REJECT', reason: 'BLANK_IMAGE', signals };
    // Reject only strong colorful-scene evidence. Blur, dark paper, rotated
    // text and uncertain document-like images go to Vision for confirmation.
    const noPageSurface = signals.paperFraction < .055;
    const photographicScene = noPageSurface && signals.colorFraction > .28 && signals.edgeFraction > .12;
    if (paragraphLayout || photographicScene || (!signals.textRows && glyphs <= 6 && noPageSurface
      && signals.colorFraction > .5 && signals.edgeFraction > .055)) {
      return { decision: 'REJECT', reason: 'CLEAR_NON_DOCUMENT', signals };
    }
    if (signals.textRows >= 3 && glyphs >= 15 && signals.paperFraction > .1) return { decision: 'PASS', signals };
    return { decision: 'UNCERTAIN', signals };
  } catch { return { decision: 'REJECT', reason: 'INVALID_IMAGE', signals: empty }; }
}

export function imageScreeningMessage(result: InvoiceImageScreening): string {
  if (result.reason === 'INVALID_IMAGE') return 'Ảnh không đọc được. Hãy chọn hoặc chụp lại.';
  if (result.reason === 'TOO_SMALL') return 'Ảnh quá nhỏ để đọc. Hãy chụp rõ hơn.';
  if (result.reason === 'BLANK_IMAGE') return 'Ảnh chưa có nội dung đọc được. Hãy chụp lại.';
  return 'Ảnh chưa giống chứng từ. Hãy chụp rõ hóa đơn.';
}

/**
 * Fast, conservative screening for OCR text that clearly does not look like an
 * invoice. This is intentionally provider-independent so the capture route can
 * reject obvious non-documents before any paid Vision request is made.
 */
export function getNonInvoiceReason(fullText: string, totalLines: number): string | null {
  const normalized = fullText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = normalized.match(/[a-z0-9]{2,}/g) || [];

  if (totalLines < 1 || words.length < 6) return 'NO_READABLE_TEXT';
  if (totalLines < 3) return null;

  const invoiceClues = [
    /hoa don|invoice|receipt|e invoice/,
    /mst|ma so thue|tax code|vat|thue/,
    /tong|total|amount|thanh toan|tien hang|tien thue/,
    /don gia|thanh tien|quantity|qty|unit price/
  ];
  const hasInvoiceClue = invoiceClues.some((pattern) => pattern.test(normalized));

  // Long, readable prose without any invoice-specific anchors is very likely
  // a page/document unrelated to an invoice. Ambiguous or short OCR stays
  // fail-open so low-quality real receipts are not discarded.
  if (!hasInvoiceClue && totalLines >= 6 && words.length >= 18) return 'NO_INVOICE_CLUES';
  return null;
}
