import { getDatabase } from '@/lib/server/db';
import { DuplicateInfo, InvoiceInput } from '@/lib/schemas';

/**
 * Chuẩn hóa số hóa đơn để so trùng: bỏ khoảng trắng/gạch, viết hoa; số toàn chữ số thì bỏ số 0 đầu (XML ghi "123", ảnh
 * hoặc người nhập ghi "0000123" là CÙNG một hóa đơn). Chữ O/I/L lẫn trong dãy số (lỗi đọc ảnh) được đọc là 0/1.
 * Khớp tuyệt đối chuỗi thô bỏ sót trùng — đúng điểm yếu mà Coupa/AppZen nêu với cách khớp "NCC + số HĐ" thô.
 */
export function normalizeInvoiceNumber(value: string): string {
  const compact = String(value || '').normalize('NFC').toUpperCase().replace(/[\s\-_.\/]/g, '');
  const ocr = compact.replace(/O/g, '0').replace(/[IL|]/g, '1');
  const digits = /\d/.test(compact) && /^\d+$/.test(ocr) ? ocr : compact;
  return /^\d+$/.test(digits) ? digits.replace(/^0+(?=\d)/, '') : digits;
}
const normalizeSeries = (value?: string | null) => String(value || '').trim().toUpperCase();

/**
 * Kiểm tra hóa đơn trùng: cùng MST bên bán + cùng ký hiệu + cùng số hóa đơn (sau chuẩn hóa).
 */
export function checkDuplicateInvoice(invoice: InvoiceInput): DuplicateInfo {
  try {
    const db = getDatabase();

    // 1. Lấy hồ sơ cùng MST bên bán rồi so số/ký hiệu đã chuẩn hóa (không so chuỗi thô trong SQL).
    const wantedNumber = normalizeInvoiceNumber(invoice.invoiceNumber), wantedSeries = normalizeSeries(invoice.invoiceSeries);
    const candidates = db.prepare(`
      SELECT id, invoice_number, invoice_date, payload_json, created_at, COALESCE(json_extract(payload_json, '$.invoiceSeries'), '') AS series
      FROM invoices
      WHERE supplier_tax_code = ? AND id != ?
      ORDER BY datetime(created_at) ASC
    `).all(invoice.supplierTaxCode, invoice.id) as Array<{
      id: string;
      invoice_number: string;
      invoice_date: string;
      payload_json: string;
      created_at: string;
      series: string;
    }>;
    const existing = candidates.find(row => normalizeInvoiceNumber(row.invoice_number) === wantedNumber && normalizeSeries(row.series) === wantedSeries);

    if (existing) {
      let originalTotal = 0;
      try {
        const parsed = JSON.parse(existing.payload_json);
        originalTotal = parsed.totalAmount || 0;
      } catch {
        // ignore JSON parse error
      }

      const sameAmount = Math.abs(originalTotal - invoice.totalAmount) < 1;
      const reason = sameAmount
        ? `Trùng lặp 100% số hóa đơn ${invoice.invoiceNumber} và số tiền (${invoice.totalAmount.toLocaleString('vi-VN')}₫) với chứng từ gốc mã [${existing.id}] đã tiếp nhận ngày ${existing.created_at.slice(0, 10)}.`
        : `Trùng số hóa đơn ${invoice.invoiceNumber} của cùng nhà cung cấp (MST: ${invoice.supplierTaxCode}) đã tiếp nhận ngày ${existing.created_at.slice(0, 10)}.`;
      const differentSpelling = existing.invoice_number !== invoice.invoiceNumber ? ` Hồ sơ gốc ghi số "${existing.invoice_number}" — cùng một số sau khi bỏ số 0 đầu/ký tự phân cách.` : '';

      return {
        isDuplicate: true,
        originalInvoiceId: existing.id,
        originalInvoiceNumber: existing.invoice_number,
        firstSeenAt: existing.created_at,
        duplicateReason: reason + differentSpelling
      };
    }

    return {
      isDuplicate: false
    };
  } catch (err) {
    console.warn('Lỗi kiểm tra trùng lặp CSDL:', err);
    throw new Error('Không thể xác minh trùng lặp; dừng xử lý để kiểm tra database.');
  }
}
