import sharp from 'sharp';

/** Deterministic receipt image; tests do not depend on ignored local QA files. */
export async function createInvoiceImageFixture(): Promise<Buffer> {
  const lines = ['HOA DON BAN HANG', 'CONG TY THU NGHIEM', 'MST: 0101234567',
    'Ngay: 12/10/2026', 'So hoa don: 0000123', 'Hang hoa       SL       Thanh tien',
    'Van phong pham  2       100.000', 'Tong thanh toan: 100.000 VND', 'Cam on quy khach'];
  const rows = lines.map((line, index) => `<text x="40" y="${70 + index * 55}">${line}</text>`).join('');
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="760"><rect width="100%" height="100%" fill="white"/><g fill="#171717" font-family="sans-serif" font-size="24">${rows}</g></svg>`)).png().toBuffer();
}
