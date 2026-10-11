import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { getNonInvoiceReason } from '@/services/invoiceImagePreflight';
import { isAppleVisionAvailable, runAppleVisionOcr } from '@/services/localOcrService';

async function main() {
assert.equal(getNonInvoiceReason('', 0), 'NO_READABLE_TEXT');
assert.equal(getNonInvoiceReason('---', 1), 'NO_READABLE_TEXT');
assert.equal(
  getNonInvoiceReason('Hóa đơn giá trị gia tăng\nMã số thuế 0312345678\nTổng thanh toán 1.250.000', 8),
  null
);
assert.equal(
  getNonInvoiceReason('Cửa hàng\nĐơn giá\nThành tiền\nSố lượng\n1.250.000', 7),
  null
);
assert.equal(
  getNonInvoiceReason(('The morning light crossed the mountain and the river. People walked along the forest path. ').repeat(5), 18),
  'NO_INVOICE_CLUES'
);
assert.equal(getNonInvoiceReason('Tên cửa hàng\nTổng cộng 50.000', 2), null, 'short/ambiguous OCR should fail open');

if (process.platform === 'darwin' && isAppleVisionAvailable()) {
  const realInvoice = await runAppleVisionOcr(path.resolve('input-sample/11_real_invoice_photo.jpg'), 'fast');
  assert.equal(realInvoice.success, true);
  assert.equal(getNonInvoiceReason(realInvoice.fullText, realInvoice.totalLines), null, 'real invoice OCR must pass');

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-preflight-qa-'));
  try {
    const text = ['The morning light crossed the mountain and the river.', 'People walked along the forest path.', 'Birds moved between the trees.', 'The road follows the quiet valley.', 'A small house stands beyond the hill.', 'Clouds drift across the sky.'];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800"><rect width="100%" height="100%" fill="white"/>${text.map((line, index) => `<text x="36" y="${90 + index * 72}" font-family="Arial" font-size="32" fill="black">${line}</text>`).join('')}</svg>`;
    const imagePath = path.join(temporaryDirectory, 'non-invoice.jpg');
    await sharp(Buffer.from(svg)).jpeg().toFile(imagePath);
    const nonInvoice = await runAppleVisionOcr(imagePath, 'fast');
    assert.equal(nonInvoice.success, true);
    assert.equal(getNonInvoiceReason(nonInvoice.fullText, nonInvoice.totalLines), 'NO_INVOICE_CLUES');
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

console.log('PASS local image preflight: rejects blank and readable non-invoice text; keeps real invoices and ambiguous OCR.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
