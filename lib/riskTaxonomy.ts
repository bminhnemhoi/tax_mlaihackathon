import type { RiskGroup, RuleFinding, RuleKind } from './schemas';

/**
 * Bảng phân loại duy nhất cho ba kiểu dừng của Đề A.
 * - UNCERTAIN_INFO: chưa xác định được thông tin thực tế (dữ liệu thiếu, mờ, mâu thuẫn).
 * - OUT_OF_POLICY: nằm ngoài phạm vi quy định (vi phạm điều kiện khấu trừ hoặc SOP không bao phủ khoản chi).
 * - EXCEED_AUTHORITY: vượt thẩm quyền, cần người có quyền cao hơn phê duyệt.
 *
 * `humanAcceptable`: người có thẩm quyền được phép chấp nhận phát hiện này kèm chứng từ (không phải ngõ cụt).
 * `triggerFields`: dữ kiện làm phát sinh phát hiện — nếu dữ kiện đó còn chưa xác minh thì không được kết luận
 * "vi phạm" hay "vượt quyền" trên dữ liệu nghi vấn; nhóm chính khi đó là UNCERTAIN_INFO.
 */
export interface RuleTaxonomy { group: RiskGroup; humanAcceptable: boolean; triggerFields: string[] }

export const RULE_CATALOG: Record<string, RuleTaxonomy> = {
  RULE_SOURCE_REVIEW: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: [] },
  RULE_SOURCE_CONFLICT: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: [] },
  RULE_DATA_QUALITY: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['invoiceDate', 'preTaxAmount', 'taxRate', 'taxAmount', 'totalAmount'] },
  RULE_IMAGE_BLURRY: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['isImageBlurry'] },
  RULE_LINE_ITEM_MISMATCH: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['items', 'preTaxAmount', 'taxAmount'] },
  RULE_MCCQT_INVALID: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['invoiceSeries', 'taxAuthorityCode'] },
  RULE_SERIES_YEAR_MISMATCH: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['invoiceSeries', 'invoiceDate'] },
  RULE_SIGNING_DELAY: { group: 'UNCERTAIN_INFO', humanAcceptable: true, triggerFields: ['invoiceDate', 'signingDate'] },
  RULE_SELLER_SUSPENDED: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['sellerStatus'] },
  RULE_SELLER_CLOSURE_DATE_UNKNOWN: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['sellerStatus', 'sellerSuspensionDate'] },
  RULE_SELLER_CLOSED_BEFORE: { group: 'UNCERTAIN_INFO', humanAcceptable: true, triggerFields: ['sellerStatus', 'sellerSuspensionDate', 'invoiceDate'] },
  RULE_MISSING_MANIFEST: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['hasItemManifest'] },
  RULE_ADJUSTMENT_NO_ORIGINAL: { group: 'UNCERTAIN_INFO', humanAcceptable: false, triggerFields: ['originalInvoiceRef'] },
  RULE_DUPLICATE_INVOICE: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['supplierTaxCode', 'invoiceNumber', 'invoiceSeries'] },
  RULE_BUYER_TAX_CODE_MISMATCH: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['buyerTaxCode'] },
  RULE_HIGH_RISK_SUPPLIER: { group: 'OUT_OF_POLICY', humanAcceptable: true, triggerFields: ['supplierTaxCode'] },
  STATUTORY_DECREE_254_CLOSED_SELLER: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['sellerStatus', 'sellerSuspensionDate', 'invoiceDate'] },
  STATUTORY_LAW_48_CASH_PAYMENT: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['totalAmount', 'paymentMethod'] },
  STATUTORY_SAME_DAY_CASH_5M: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['totalAmount', 'paymentMethod', 'invoiceDate'] },
  STATUTORY_RES_204_VAT_8_EXCLUDED: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['itemName', 'items', 'taxRate'] },
  RULE_SCOPE_VAT8_PERIOD: { group: 'OUT_OF_POLICY', humanAcceptable: false, triggerFields: ['taxRate', 'invoiceDate'] },
  RULE_SCOPE_NOT_COVERED: { group: 'OUT_OF_POLICY', humanAcceptable: true, triggerFields: ['itemName', 'items'] },
  INTERNAL_POLICY_GUEST_ENTERTAINMENT: { group: 'OUT_OF_POLICY', humanAcceptable: true, triggerFields: ['itemName', 'items'] },
  AUTHORITY_EXCEED_KTT_LIMIT: { group: 'EXCEED_AUTHORITY', humanAcceptable: true, triggerFields: ['totalAmount'] },
  AUTHORITY_K_FACTOR_RED: { group: 'EXCEED_AUTHORITY', humanAcceptable: true, triggerFields: ['preTaxAmount'] }
};

/** Thứ tự ưu tiên nhóm chính: vi phạm/ngoài quy định trước, rồi vượt quyền, rồi thiếu thông tin. */
export const GROUP_PRECEDENCE: RiskGroup[] = ['OUT_OF_POLICY', 'EXCEED_AUTHORITY', 'UNCERTAIN_INFO'];

export const RISK_GROUP_LABELS: Record<RiskGroup, string> = {
  UNCERTAIN_INFO: 'Chưa rõ thông tin',
  OUT_OF_POLICY: 'Ngoài quy định',
  EXCEED_AUTHORITY: 'Vượt thẩm quyền'
};

const SEVERITY_RANK: Record<RuleFinding['severity'], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function taxonomyOf(ruleId: string, kind?: RuleKind): RuleTaxonomy {
  return RULE_CATALOG[ruleId] ?? {
    group: kind === 'AUTHORITY' ? 'EXCEED_AUTHORITY' : kind === 'STATUTORY' ? 'OUT_OF_POLICY' : 'UNCERTAIN_INFO',
    humanAcceptable: kind === 'AUTHORITY' || kind === 'INTERNAL_POLICY',
    triggerFields: []
  };
}

export function groupOf(ruleId: string, kind?: RuleKind): RiskGroup {
  return taxonomyOf(ruleId, kind).group;
}

/** Phát hiện này dựa trên dữ kiện còn chưa xác minh → không được dùng làm nhóm chính. */
function dependsOnUnverified(finding: Pick<RuleFinding, 'ruleId' | 'kind'>, unresolved: ReadonlySet<string>): boolean {
  const taxonomy = taxonomyOf(finding.ruleId, finding.kind);
  return taxonomy.group !== 'UNCERTAIN_INFO' && taxonomy.triggerFields.some(field => unresolved.has(field));
}

/** Sắp xếp phát hiện: nhóm theo GROUP_PRECEDENCE, phát hiện dựa trên dữ kiện chưa xác minh xếp sau cùng, rồi mức độ. */
export function orderFindings<T extends Pick<RuleFinding, 'ruleId' | 'kind' | 'severity'>>(findings: T[], unresolved: Iterable<string> = []): T[] {
  const pending = new Set(unresolved);
  const rank = (f: T) => dependsOnUnverified(f, pending) ? GROUP_PRECEDENCE.length : GROUP_PRECEDENCE.indexOf(groupOf(f.ruleId, f.kind));
  return [...findings].sort((a, b) => rank(a) - rank(b) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Các nhóm còn mở, theo thứ tự ưu tiên; nhóm đầu tiên là nhóm chính. */
export function riskGroupsOf(findings: Array<Pick<RuleFinding, 'ruleId' | 'kind' | 'severity'>>, unresolved: Iterable<string> = []): RiskGroup[] {
  return [...new Set(orderFindings(findings, unresolved).map(f => groupOf(f.ruleId, f.kind)))];
}

/** Có phát hiện nào người có thẩm quyền không được tự chấp nhận (phải sửa dữ liệu/bằng chứng rồi đánh giá lại)? */
export function hasNonAcceptableFinding(findings: Array<Pick<RuleFinding, 'ruleId' | 'kind'>>): boolean {
  return findings.some(f => !taxonomyOf(f.ruleId, f.kind).humanAcceptable);
}
