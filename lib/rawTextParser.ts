import { InvoiceInput } from './schemas';
import { parseNumberValue } from './utils';
import { validateTaxCode } from '@/services/taxLookupService';

type InvoiceParty = 'supplier' | 'buyer';

function normalizePartyText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function invoicePartyInLine(value: string): InvoiceParty | undefined {
  const text = normalizePartyText(value);
  const supplier = /\b(?:seller|supplier|vendor|ben ban|nguoi ban|don vi ban|nha cung cap|ten ben ban)\b/.test(text);
  const buyer = /\b(?:buyer|customer|ben mua|nguoi mua|don vi mua|ten ben mua|ten khach hang)\b/.test(text);
  if (supplier === buyer) return undefined;
  return supplier ? 'supplier' : 'buyer';
}

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

  const cleanText = text.replace(/\r/g, '').replace(/^([^\n:]+?)\s*\/\s*[^\n:]+:/gm, '$1:').trim();

  // 1. Seller/buyer MST: preserve party context across OCR text lines.
  // A generic "Mã số thuế" under a buyer heading must never become seller MST.
  const mstPattern = '(?:[0-9]{12}|[0-9]{10}(?:-?[0-9]{3})?)';
  const lines = cleanText.split('\n');
  const firstBuyerSectionIndex = lines.findIndex((line) => invoicePartyInLine(line) === 'buyer');
  const hasBuyerSection = firstBuyerSectionIndex >= 0;
  let currentParty: InvoiceParty | undefined;
  const unassignedTaxCodes: Array<{ code: string; lineIndex: number }> = [];
  const unassignedBusinessCodes: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const explicitParty = invoicePartyInLine(line);
    if (explicitParty) currentParty = explicitParty;
    const normalizedLine = normalizePartyText(line);
    const labeledMst = normalizedLine.match(new RegExp(`\\b(?:ma so thue|mst|tax code|tax id|ma thue)(?:\\s+(?:(?:ben|nguoi|don vi)\\s+)?(?:ban|mua|seller|buyer))?\\s*[:：.\\-]?\\s*(${mstPattern})(?![0-9])`, 'i'));
    const role = explicitParty || currentParty;
    if (labeledMst) {
      const code = labeledMst[1];
      if (role === 'buyer' && !invoice.buyerTaxCode) {
        invoice.buyerTaxCode = code;
        extractedFields.push('buyerTaxCode');
      } else if (role === 'supplier' && !invoice.supplierTaxCode) {
        invoice.supplierTaxCode = code;
        extractedFields.push('supplierTaxCode');
      } else if (!role) {
        unassignedTaxCodes.push({ code, lineIndex });
      }
    }
    if (!role) {
      for (const match of line.matchAll(/\b([0-9]{10}(?:-?[0-9]{3})?)\b/g)) {
        if (validateTaxCode(match[1]).isValid && !validateTaxCode(match[1]).reason) unassignedBusinessCodes.push(match[1]);
      }
    }
  }
  // A lone generic MST is safe when no buyer section exists. If both parties
  // are present, a generic code before the buyer block may be used only when a
  // clear seller-name/header line precedes it; otherwise the role is unknown.
  if (!invoice.supplierTaxCode) {
    const beforeBuyer = unassignedTaxCodes.filter((entry) =>
      !hasBuyerSection || entry.lineIndex < firstBuyerSectionIndex
    );
    const candidates = [...new Set(beforeBuyer.map((entry) => entry.code))];
    const sellerNameAnchor = lines.slice(0, hasBuyerSection ? firstBuyerSectionIndex : lines.length)
      .some((line) => /\b(?:seller|supplier|vendor|ben ban|nguoi ban|don vi ban|nha cung cap|cong ty|cty|tnhh|company)\b/i.test(normalizePartyText(line)));
    if (candidates.length === 1 && (!hasBuyerSection || sellerNameAnchor)) {
      invoice.supplierTaxCode = candidates[0];
      extractedFields.push('supplierTaxCode');
    } else if (!hasBuyerSection) {
      const bareCandidates = [...new Set(unassignedBusinessCodes)];
      if (bareCandidates.length === 1) {
        invoice.supplierTaxCode = bareCandidates[0];
        extractedFields.push('supplierTaxCode');
      }
    }
  }

  // 2. Số hóa đơn
  const invNumberMatch =
    cleanText.match(/(?:Số HĐ|Số hoá đơn|Số hóa đơn|HĐ số|HD số|Hóa đơn số|Invoice number|Invoice no|Inv no|Số chứng từ|Số)[\s:.-]+([A-Za-z0-9_-]+)/i);
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
  const firstBuyerSection = lines.findIndex((line) => invoicePartyInLine(line) === 'buyer');
  const supplierNameSource = lines.filter((line, index) => {
    const party = invoicePartyInLine(line);
    return party === 'supplier' || firstBuyerSection < 0 || index < firstBuyerSection;
  }).join('\n');
  const supplierMatch =
    supplierNameSource.match(/(?:Seller|Đơn vị bán|Bên bán|Người bán|Nhà cung cấp|Cung cấp|Công ty|Cty|Doanh nghiệp)[ \t:.-]+([^\n,;]{4,100})/i) ||
    supplierNameSource.match(/(?:Công ty [^\n,;]{4,100}|Cty [^\n,;]{4,100}|TNHH [^\n,;]{4,100}|CP [^\n,;]{4,100})/i);
  if (supplierMatch) {
    const rawName = (supplierMatch[1] || supplierMatch[0]).trim();
    // Bỏ các từ khóa thừa nếu có
    invoice.supplierName = rawName.replace(/^[\s:.-]+/, '').trim();
    extractedFields.push('supplierName');
  }
  const buyerSection = cleanText.search(/(?:Bên\s*mua|Người\s*mua|Buyer\s*(?:name|tax|address)?)/i);
  const supplierAddressMatch = Array.from(cleanText.matchAll(/(?:Địa\s*chỉ|D\s*\/\s*C|Address)[\s:.-]+([^\n;]{8,180})/gi))
    .find((match) => {
      const index = match.index || 0;
      const lineStart = cleanText.lastIndexOf('\n', index) + 1;
      const lineEnd = cleanText.indexOf('\n', index);
      const line = cleanText.slice(lineStart, lineEnd < 0 ? cleanText.length : lineEnd);
      return !/(?:bên\s*mua|người\s*mua|buyer)/i.test(line) && (buyerSection < 0 || index < buyerSection);
    });
  if (supplierAddressMatch) {
    invoice.supplierAddress = supplierAddressMatch[1].trim();
    extractedFields.push('supplierAddress');
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
    cleanText.match(/(?:Item|Tên hàng hóa|Hàng hóa|Mặt hàng|Nội dung|Dịch vụ|Diễn giải)[\s:.-]+([^\n,;]{3,150})/i);
  if (itemMatch) {
    invoice.itemName = itemMatch[1].trim();
    extractedFields.push('itemName');
  }

  // 6. Số tiền: Tổng tiền & Tiền thuế
  // Tìm tổng tiền
  const totalMatch =
    cleanText.match(/(?:Total amount|Total|Tổng cộng|Tổng tiền|Tổng thanh toán|Thành tiền|Giá trị thanh toán|Số tiền)[\s:.-]+([0-9.,]+(?:\s*(?:triệu|tr|đ|vnđ|vnd))?)/i);
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
  const preTaxMatch = cleanText.match(/(?:Pre-tax|Subtotal|Tiền trước thuế|Cộng tiền hàng|Trước thuế)[\s:.-]+([0-9.,]+)/i);
  if (preTaxMatch) {
    const num = parseNumberValue(preTaxMatch[1]);
    if (num && num > 0) {
      invoice.preTaxAmount = num;
      extractedFields.push('preTaxAmount');
    }
  }

  // Tìm thuế suất
  const rateMatch = cleanText.match(/(?:Tax rate|VAT rate|Thuế suất|VAT|Thuế)[\s:.-]+([0-9]{1,2})\s*%/i);
  if (rateMatch) {
    const r = parseInt(rateMatch[1], 10);
    if ([0, 5, 8, 10].includes(r)) {
      invoice.taxRate = r as any;
      extractedFields.push('taxRate');
    }
  }

  // Tính thuế nếu chưa có
  const taxMatch = cleanText.match(/(?:Tax amount|VAT amount|Tiền thuế GTGT|Thuế GTGT|Tiền thuế)[\s:.-]+([0-9.,]+)/i);
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
  const paymentUnknown = /(?:payment|hình thức thanh toán|thanh toán)[\s:.-]+(?:UNKNOWN|chưa xác định|không xác định)/i.test(cleanText);
  if (!paymentUnknown && /tiền\s*mặt|tm\b|cash/i.test(cleanText)) {
    invoice.paymentMethod = 'CASH';
    invoice.hasBankSlip = false;
    extractedFields.push('paymentMethod');
  } else if (!paymentUnknown && /chuyển\s*khoản|ck\b|ngân\s*hàng|bank/i.test(cleanText)) {
    invoice.paymentMethod = 'BANK_TRANSFER';
    extractedFields.push('paymentMethod');
    if (/ủy\s*nhiệm\s*chi|sao\s*kê|biên\s*lai\s*(?:chuyển\s*khoản|ngân\s*hàng)|chứng\s*từ\s*thanh\s*toán/i.test(cleanText)) {
      invoice.hasBankSlip = true;
      extractedFields.push('hasBankSlip');
    }
  }

  if (/không\s+có\s+(?:bảng\s+kê|danh\s+sách\s+hàng)|thiếu\s+bảng\s+kê/i.test(cleanText)) {
    invoice.hasItemManifest = false;
    extractedFields.push('hasItemManifest');
  } else if (/(?:có\s+)?bảng\s+kê\s+(?:chi\s+tiết\s+)?(?:hàng\s+hóa|hàng\s+hoá|dịch\s+vụ)/i.test(cleanText)) {
    invoice.hasItemManifest = true;
    extractedFields.push('hasItemManifest');
  }

  // Độ tin cậy tính trên số lượng trường quan trọng bóc tách được (tối đa 6 trường)
  const keyFields = ['supplierTaxCode', 'supplierName', 'invoiceNumber', 'invoiceDate', 'totalAmount', 'itemName'];
  const matchedKeyCount = keyFields.filter(f => extractedFields.includes(f)).length;
  const confidence = Number((matchedKeyCount / keyFields.length).toFixed(2));

  return { invoice, confidence, extractedFields };
}
