import type { InvoiceInput } from '@/lib/schemas';
import { challengeCases } from './challengeCases';

/** Hóa đơn thường quy làm nền: mỗi đầu dò chỉ đổi đúng các trường để kích hoạt một quy tắc. */
export const RULE_PROBE_BASE: InvoiceInput = { ...challengeCases[0].invoice, id: 'CORE', invoiceNumber: 'CORE', invoiceDate: '2026-08-15' };

/**
 * Đầu dò từng quy tắc (dùng chung cho test-referee-core và unit test phân loại).
 * Quy tắc cần ngữ cảnh database (trùng hóa đơn, tiền mặt cộng dồn trong ngày, nguồn chưa xác minh) được thử riêng.
 */
export const RULE_PROBES: Record<string, Partial<InvoiceInput>> = {
  RULE_DATA_QUALITY: { totalAmount: 1_100_500 },
  RULE_IMAGE_BLURRY: { isImageBlurry: true },
  RULE_LINE_ITEM_MISMATCH: { items: [{ lineNumber: 1, itemName: 'Giấy', quantity: 1, unitPrice: 800_000, amount: 800_000, taxRate: 10, taxAmount: 80_000 }] },
  RULE_BUYER_TAX_CODE_MISMATCH: { buyerTaxCode: '0203456789' },
  RULE_MCCQT_INVALID: { invoiceSeries: '1C26TBB' },
  RULE_SERIES_YEAR_MISMATCH: { invoiceSeries: '1K25TBB' },
  RULE_SIGNING_DELAY: { signingDate: '2026-09-19' },
  RULE_SELLER_SUSPENDED: { sellerStatus: 'SUSPENDED' },
  RULE_SELLER_CLOSURE_DATE_UNKNOWN: { sellerStatus: 'CLOSED' },
  STATUTORY_DECREE_254_CLOSED_SELLER: { sellerStatus: 'CLOSED', sellerSuspensionDate: '2026-08-01' },
  RULE_SELLER_CLOSED_BEFORE: { sellerStatus: 'CLOSED', sellerSuspensionDate: '2026-09-01' },
  STATUTORY_LAW_48_CASH_PAYMENT: { totalAmount: 11_000_000, preTaxAmount: 10_000_000, taxAmount: 1_000_000, paymentMethod: 'CASH', hasBankSlip: false },
  STATUTORY_RES_204_VAT_8_EXCLUDED: { itemName: 'Cước viễn thông', taxRate: 8, preTaxAmount: 1_000_000, taxAmount: 80_000, totalAmount: 1_080_000 },
  INTERNAL_POLICY_GUEST_ENTERTAINMENT: { itemName: 'Chi tiếp khách rượu bia' },
  RULE_SCOPE_NOT_COVERED: { itemName: 'Tài trợ giải chạy từ thiện' },
  RULE_SCOPE_VAT8_PERIOD: { invoiceDate: '2027-01-05', taxRate: 8, preTaxAmount: 1_000_000, taxAmount: 80_000, totalAmount: 1_080_000 },
  RULE_MISSING_MANIFEST: { itemName: 'Dịch vụ tư vấn tổng hợp', hasItemManifest: false },
  AUTHORITY_EXCEED_KTT_LIMIT: { totalAmount: 220_000_000, preTaxAmount: 200_000_000, taxAmount: 20_000_000 },
  AUTHORITY_K_FACTOR_RED: { totalAmount: 11_000_000_000, preTaxAmount: 10_000_000_000, taxAmount: 1_000_000_000 },
  RULE_ADJUSTMENT_NO_ORIGINAL: { isAdjustment: true }
};
