import { InvoiceInput } from './schemas';
import { validateTaxCode } from '@/services/taxLookupService';

export interface MathValidationResult {
  isBalanced: boolean;
  notes: string[];
  taxCodeCheck: {
    isValid: boolean;
    checksumPassed: boolean;
    reason?: string;
  };
  reconciledAmounts: {
    preTaxAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    taxRate?: number;
  };
}

export interface MathValidationOptions {
  /** Fields that came from weak/ambiguous OCR and must not be treated as facts. */
  untrustedFields?: Iterable<string>;
  sourceType?: string;
}

/**
 * Kiểm định đẳng thức toán học bất biến & Checksum MST cho hóa đơn:
 * 1. Tiền hàng trước thuế + Tiền thuế GTGT = Tổng tiền thanh toán (Dung sai làm tròn 1.000 VNĐ)
 * 2. Tổng thành tiền các dòng chi tiết = Tiền hàng trước thuế
 * 3. Checksum Modulo 11 Mã số thuế theo chuẩn Tổng cục Thuế
 */
export function validateInvoiceMathematics(invoice: Partial<InvoiceInput>, options: MathValidationOptions = {}): MathValidationResult {
  const notes: string[] = [];
  const untrusted = new Set(options.untrustedFields || []);
  const trusted = (field: string) => !untrusted.has(field);
  const preTax = invoice.preTaxAmount;
  const tax = invoice.taxAmount ?? 0;
  const total = invoice.totalAmount;
  const rate = invoice.taxRate ?? 0;

  // 1. Kiểm tra Checksum MST Modulo 11 (Chỉ cảnh báo khi vi phạm)
  let taxCodeCheck = { isValid: false, checksumPassed: false, reason: undefined as string | undefined };
  if (invoice.supplierTaxCode) {
    const check = validateTaxCode(invoice.supplierTaxCode);
    taxCodeCheck = {
      isValid: check.isValid,
      checksumPassed: !check.reason,
      reason: check.reason
    };
    if (check.reason) {
      notes.push(`⚠️ ${check.reason}`);
    }
  }

  // 2. Kiểm định đẳng thức: Tiền trước thuế + Tiền thuế = Tổng tiền thanh toán
  let isBalanced = false;
  let recPreTax = preTax;
  let recTax = tax;
  let recTotal = total;

  if (total !== undefined && preTax !== undefined && tax !== undefined &&
      trusted('preTaxAmount') && trusted('taxAmount') && trusted('totalAmount')) {
    const calcTotal = preTax + tax;
    const diff = Math.abs(calcTotal - total);

    if (diff <= 1000) {
      isBalanced = true;
      const itemCountStr = Array.isArray(invoice.items) && invoice.items.length > 0 ? `, ${invoice.items.length} món chi tiết` : '';
      notes.push(`✅ Số liệu khớp hoàn toàn (Tổng thanh toán: ${total.toLocaleString('vi-VN')} VNĐ${itemCountStr}).`);
    } else {
      notes.push(`⚠️ Lệch số học (${diff.toLocaleString('vi-VN')} VNĐ): Tiền hàng (${preTax.toLocaleString('vi-VN')}) + VAT (${tax.toLocaleString('vi-VN')}) != Tổng thanh toán (${total.toLocaleString('vi-VN')}).`);
    }
  } else if (total !== undefined && preTax === undefined && rate !== undefined &&
             options.sourceType !== 'IMAGE' && trusted('totalAmount') && trusted('taxRate')) {
    recPreTax = Math.round(total / (1 + rate / 100));
    recTax = total - recPreTax;
    isBalanced = true;
    notes.push(`✅ Số liệu khớp hoàn toàn (Tổng thanh toán: ${total.toLocaleString('vi-VN')} VNĐ).`);
  } else if (total !== undefined && (untrusted.has('totalAmount') || untrusted.has('preTaxAmount') || untrusted.has('taxAmount'))) {
    notes.push('⚠️ Không xác nhận số học: một hoặc nhiều số tiền nằm trên vùng OCR chưa đủ tin cậy.');
  } else if (options.sourceType === 'IMAGE' && total !== undefined && (preTax === undefined || tax === undefined)) {
    notes.push('⚠️ Chưa đủ các dòng tiền in trên ảnh để xác nhận phép cộng; không tự suy ra số còn thiếu.');
  }

  return {
    isBalanced,
    notes,
    taxCodeCheck,
    reconciledAmounts: {
      preTaxAmount: recPreTax,
      taxAmount: recTax,
      totalAmount: recTotal,
      taxRate: rate
    }
  };
}
