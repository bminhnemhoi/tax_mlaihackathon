import { InvoiceInput } from './schemas';
import { parseNumberValue } from './utils';
import { validateTaxCode } from '@/services/taxLookupService';

/**
 * Bóc tách nhanh dữ liệu hóa đơn từ đoạn văn bản thô (Email, Tin nhắn, Ghi chú kế toán)
 * Sử dụng bộ phân tích quy tắc Heuristic tiếng Việt tất định (Deterministic Text Extractor)
 */
export function parseInvoiceFromRawText(text: string): {
  invoice: Partial<InvoiceInput>;
  confidence: number;
  extractedFields: string[];
} {
  const invoice: Partial<InvoiceInput> = {};
  const extractedFields: string[] = [];

  if (!text || typeof text !== 'string') {
    return { invoice, confidence: 0, extractedFields };
  }

  const cleanText = text.replace(/\r/g, '').trim();

  // 1. Mã số thuế người bán (MST: 10 chữ số hoặc 13 chữ số có gạch nối)
  const explicitMstMatch = cleanText.match(/(?:MST|Mã số thuế|Tax code|Tax ID|Mã thuế)[\s:.-]+([0-9]{10}(?:-[0-9]{3})?)/i);
  if (explicitMstMatch) {
    invoice.supplierTaxCode = explicitMstMatch[1];
    extractedFields.push('supplierTaxCode');
  } else {
    // Chỉ nhận dãy 10 số độc lập khi vượt qua kiểm tra Modulo 11 chuẩn Tổng cục Thuế (tránh nhận nhầm số tiền bảng kê)
    const candidates = Array.from(cleanText.matchAll(/\b([0-9]{10}(?:-[0-9]{3})?)\b/g));
    for (const cand of candidates) {
      const check = validateTaxCode(cand[1]);
      if (check.isValid && !check.reason) {
        invoice.supplierTaxCode = cand[1];
        extractedFields.push('supplierTaxCode');
        break;
      }
    }
  }

  // 2. Số hóa đơn
  const invNumberMatch =
    cleanText.match(/(?:Số HĐ|Số hoá đơn|Số hóa đơn|HĐ số|HD số|Hóa đơn số|Invoice no|Inv no|Số chứng từ|Số)[\s:.-]+([A-Za-z0-9_-]+)/i);
  if (invNumberMatch) {
    invoice.invoiceNumber = invNumberMatch[1];
    extractedFields.push('invoiceNumber');
  } else {
    // Tìm dãy số 7-8 chữ số độc lập
    const standaloneNum = cleanText.match(/\b(00[0-9]{5,6}|[0-9]{7,8})\b/);
    if (standaloneNum) {
      invoice.invoiceNumber = standaloneNum[1];
      extractedFields.push('invoiceNumber');
    }
  }

  // 3. Tên nhà cung cấp / Bên bán
  const supplierMatch =
    cleanText.match(/(?:Đơn vị bán|Bên bán|Người bán|Nhà cung cấp|Cung cấp|Công ty|Cty|Doanh nghiệp)[\s:.-]+([^\n,;]{4,100})/i) ||
    cleanText.match(/(?:Công ty [^\n,;]{4,100}|Cty [^\n,;]{4,100}|TNHH [^\n,;]{4,100}|CP [^\n,;]{4,100})/i);
  if (supplierMatch) {
    const rawName = (supplierMatch[1] || supplierMatch[0]).trim();
    // Bỏ các từ khóa thừa nếu có
    invoice.supplierName = rawName.replace(/^[\s:.-]+/, '').trim();
    extractedFields.push('supplierName');
  }

  // 4. Ngày hóa đơn (hỗ trợ DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
  const dateMatch =
    cleanText.match(/(?:Ngày lập|Ngày HĐ|Ngày xuất|Ngày chứng từ|Ngày)[\s:.-]+([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{4})/i) ||
    cleanText.match(/\b([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{4})\b/) ||
    cleanText.match(/\b([0-9]{4}-[0-9]{2}-[0-9]{2})\b/);
  if (dateMatch) {
    const dStr = dateMatch[1];
    if (dStr.includes('/') || dStr.includes('.')) {
      const parts = dStr.split(/[\/\.]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        invoice.invoiceDate = `${year}-${month}-${day}`;
        extractedFields.push('invoiceDate');
      }
    } else {
      invoice.invoiceDate = dStr;
      extractedFields.push('invoiceDate');
    }
  }

  // 5. Mặt hàng / Dịch vụ
  const itemMatch =
    cleanText.match(/(?:Tên hàng hóa|Hàng hóa|Mặt hàng|Nội dung|Dịch vụ|Diễn giải)[\s:.-]+([^\n,;]{3,150})/i);
  if (itemMatch) {
    invoice.itemName = itemMatch[1].trim();
    extractedFields.push('itemName');
  }

  // 6. Số tiền: Tổng tiền & Tiền thuế
  // Tìm tổng tiền
  const totalMatch =
    cleanText.match(/(?:Tổng cộng|Tổng tiền|Tổng thanh toán|Thành tiền|Giá trị thanh toán|Số tiền)[\s:.-]+([0-9.,]+(?:\s*(?:triệu|tr|đ|vnđ|vnd))?)/i);
  if (totalMatch) {
    const rawVal = totalMatch[1].toLowerCase();
    let num: number | undefined;
    if (rawVal.includes('triệu') || rawVal.includes('tr')) {
      const base = parseFloat(rawVal.replace(/[^0-9.]/g, ''));
      if (!isNaN(base)) num = Math.round(base * 1_000_000);
    } else {
      num = parseNumberValue(rawVal);
    }
    if (num && num > 0) {
      invoice.totalAmount = num;
      extractedFields.push('totalAmount');
    }
  }

  // Tìm tiền trước thuế hoặc tính ngược
  const preTaxMatch = cleanText.match(/(?:Tiền trước thuế|Cộng tiền hàng|Trước thuế)[\s:.-]+([0-9.,]+)/i);
  if (preTaxMatch) {
    const num = parseNumberValue(preTaxMatch[1]);
    if (num && num > 0) {
      invoice.preTaxAmount = num;
      extractedFields.push('preTaxAmount');
    }
  }

  // Tìm thuế suất
  const rateMatch = cleanText.match(/(?:Thuế suất|VAT|Thuế)[\s:.-]+([0-9]{1,2})\s*%/i);
  if (rateMatch) {
    const r = parseInt(rateMatch[1], 10);
    if ([0, 5, 8, 10].includes(r)) {
      invoice.taxRate = r as any;
      extractedFields.push('taxRate');
    }
  }

  // Tính thuế nếu chưa có
  const taxMatch = cleanText.match(/(?:Tiền thuế GTGT|Thuế GTGT|Tiền thuế)[\s:.-]+([0-9.,]+)/i);
  if (taxMatch) {
    const num = parseNumberValue(taxMatch[1]);
    if (num && num > 0) {
      invoice.taxAmount = num;
      extractedFields.push('taxAmount');
    }
  }

  // Suy diễn số học nếu thiếu 1 trong 3 trường tiền
  if (invoice.totalAmount && !invoice.preTaxAmount && invoice.taxRate !== undefined) {
    invoice.preTaxAmount = Math.round(invoice.totalAmount / (1 + invoice.taxRate / 100));
    invoice.taxAmount = invoice.totalAmount - invoice.preTaxAmount;
  } else if (invoice.preTaxAmount && !invoice.totalAmount && invoice.taxRate !== undefined) {
    invoice.taxAmount = Math.round(invoice.preTaxAmount * (invoice.taxRate / 100));
    invoice.totalAmount = invoice.preTaxAmount + invoice.taxAmount;
  } else if (invoice.totalAmount && invoice.taxAmount && !invoice.preTaxAmount) {
    invoice.preTaxAmount = invoice.totalAmount - invoice.taxAmount;
  }

  // 7. Hình thức thanh toán (Tiền mặt vs Chuyển khoản)
  if (/tiền\s*mặt|tm\b|cash/i.test(cleanText)) {
    invoice.paymentMethod = 'CASH';
    invoice.hasBankSlip = false;
    extractedFields.push('paymentMethod');
  } else if (/chuyển\s*khoản|ck\b|ngân\s*hàng|bank/i.test(cleanText)) {
    invoice.paymentMethod = 'BANK_TRANSFER';
    invoice.hasBankSlip = true;
    extractedFields.push('paymentMethod');
  } else {
    invoice.paymentMethod = 'BANK_TRANSFER';
    invoice.hasBankSlip = true;
  }

  // Độ tin cậy tính trên số lượng trường quan trọng bóc tách được (tối đa 6 trường)
  const keyFields = ['supplierTaxCode', 'supplierName', 'invoiceNumber', 'invoiceDate', 'totalAmount', 'itemName'];
  const matchedKeyCount = keyFields.filter(f => extractedFields.includes(f)).length;
  const confidence = Number((matchedKeyCount / keyFields.length).toFixed(2));

  return { invoice, confidence, extractedFields };
}
