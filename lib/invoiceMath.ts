import type { InvoiceInput } from '@/lib/schemas';

/** Dung sai làm tròn khi đối chiếu số tiền trên hóa đơn (₫). */
export const AMOUNT_TOLERANCE_VND = 10;

type TaxInputs = Pick<InvoiceInput, 'preTaxAmount' | 'taxRate' | 'items'>;

/**
 * Tổng thuế theo từng dòng khi hóa đơn có từ hai thuế suất (VD văn phòng phẩm 8% + cước viễn thông 10%), với điều kiện
 * mỗi dòng tự khớp số học và tổng tiền hàng các dòng khớp tiền hàng đầu hóa đơn. Không đủ điều kiện thì trả null.
 */
export function multiRateLineTax(inv: TaxInputs): number | null {
  const lines = inv.items ?? [];
  if (lines.length < 2 || new Set(lines.map(line => line.taxRate)).size < 2) return null;
  const linesConsistent = lines.every(line => Math.abs(line.taxAmount - Math.round(line.amount * line.taxRate / 100)) <= AMOUNT_TOLERANCE_VND);
  const sumAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  if (!linesConsistent || Math.abs(sumAmount - inv.preTaxAmount) > AMOUNT_TOLERANCE_VND * lines.length) return null;
  return lines.reduce((sum, line) => sum + line.taxAmount, 0);
}

/**
 * Tiền thuế kỳ vọng ở phần tổng của hóa đơn: hóa đơn nhiều thuế suất hợp lệ thì bằng tổng thuế từng dòng, còn lại là
 * tiền hàng × thuế suất. Nguồn duy nhất cho engine (RULE_DATA_QUALITY), câu hỏi chuyển tiếp và hệ quả đáp án.
 */
export function expectedHeaderTax(inv: TaxInputs): number {
  return multiRateLineTax(inv) ?? Math.round(inv.preTaxAmount * inv.taxRate / 100);
}
