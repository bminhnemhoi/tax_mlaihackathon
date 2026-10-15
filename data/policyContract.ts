import type { PolicyRule, SystemPolicyConfig } from '@/lib/schemas';
import { groupOf } from '@/lib/riskTaxonomy';
export const POLICY_CONTRACT_VERSION='referee-contract-2026-10-16';
export interface PolicyRuleContract {
  id:string;label:string;clause:string;condition:string;requiredFields:string[];group:'UNCERTAIN_INFO'|'OUT_OF_POLICY'|'EXCEED_AUTHORITY';
  recipient:string;actions:string;testTags:string[];source?:{code:string;url:string;effectiveFrom:string};
  legalVerification:'INTERNAL_POLICY'|'DOCUMENT_CONFIRMED_RULE_PENDING'|'UNVERIFIED';
}

// This registry documents implemented checks. Editing prose does not execute a new rule.
const checks = [
  ['RULE_SOURCE_REVIEW', 'Xác minh dữ liệu nguồn', 'Dữ liệu đầu vào', 'Mỗi trường nghi vấn cần xác nhận riêng và nguồn bằng chứng.'],
  ['RULE_DATA_QUALITY', 'Ngày và số tiền nhất quán', 'Điều 1.1', 'Ngày hợp lệ; số tiền lệch quá 10 ₫ so với tổng/thuế suất, dữ kiện áp dụng chưa biết, ảnh mờ hoặc số âm chưa là điều chỉnh đều dừng. Phương thức thanh toán chỉ bắt buộc khi tổng (gộp cùng NCC trong ngày) đạt ngưỡng không dùng tiền mặt; trạng thái MST bên bán bắt buộc từ ngưỡng trọng yếu (mặc định 20 triệu).'],
  ['RULE_IMAGE_BLURRY', 'Ảnh chưa đọc rõ', 'Dữ liệu đầu vào', 'Ảnh mờ chưa xác minh luôn dừng tự động hóa.'],
  ['RULE_DUPLICATE_INVOICE', 'Không ghi nhận trùng', 'Điều 1.1', 'Đối chiếu định danh hóa đơn và chứng từ đã nhận.'],
  ['RULE_LINE_ITEM_MISMATCH', 'Đối chiếu dòng hàng', 'Điều 1.1', 'Dòng lệch số lượng × đơn giá trừ giảm giá quá 1.000 ₫, thuế dòng lệch quá 1 ₫ hoặc tổng dòng lệch header quá 2.000 ₫ cần xác minh.'],
  ['RULE_BUYER_TAX_CODE_MISMATCH', 'MST người mua', 'Điều 1.1', 'Đối chiếu với MST doanh nghiệp đang được cấu hình.'],
  ['RULE_MCCQT_INVALID', 'Mã cơ quan thuế', 'Điều 1.1', 'Ký tự thứ hai của ký hiệu là C và strictMccqtCheck bật: mã CQT thiếu hoặc khác 34 ký tự cần đối chiếu theo profile.'],
  ['RULE_SERIES_YEAR_MISMATCH', 'Năm ký hiệu', 'Điều 1.1', 'Đối chiếu năm ký hiệu và ngày lập khi bật kiểm tra.'],
  ['RULE_SIGNING_DELAY', 'Ngày ký', 'Điều 1.1', 'Ngày ký trước ngày lập hoặc chậm hơn 30 ngày cần xác minh theo profile nội bộ.'],
  ['RULE_SELLER_SUSPENDED', 'Bên bán tạm ngừng', 'Điều 2.2', 'Chuyển người phụ trách xác minh trạng thái bên bán.'],
  ['RULE_HIGH_RISK_SUPPLIER', 'Nhà cung cấp có cảnh báo', 'Điều 2.2', 'Xác minh hồ sơ nhà cung cấp có cảnh báo.'],
  ['RULE_SELLER_CLOSURE_DATE_UNKNOWN', 'Chưa rõ ngày đóng MST', 'Điều 2.2', 'CLOSED thiếu ngày đóng không được tự duyệt.'],
  ['STATUTORY_DECREE_254_CLOSED_SELLER', 'Ngày lập sau ngày đóng MST', 'Điều 2.2', 'Chặn tự duyệt theo quy tắc đang triển khai.'],
  ['RULE_SELLER_CLOSED_BEFORE', 'Ngày lập trước ngày đóng MST', 'Điều 2.2', 'Cần chứng minh giao dịch và đánh giá lại.'],
  ['STATUTORY_LAW_48_CASH_PAYMENT', 'Điều kiện thanh toán', 'Điều 1.2', 'Đối chiếu số tiền, ngày, hình thức và bằng chứng thanh toán.'],
  ['STATUTORY_SAME_DAY_CASH_5M', 'Gộp mua trong ngày', 'Điều 1.2', 'Gộp hóa đơn mua dương, không phải điều chỉnh, không bị từ chối, cùng MST/ngày và không đếm trùng. Tổng đạt ngưỡng theo ngày và còn tiền mặt cần chuyển tiếp.'],
  ['STATUTORY_RES_204_VAT_8_EXCLUDED', 'Thuế suất nhóm loại trừ', 'Điều 1.3', 'Tên hàng hoặc dòng hàng khớp danh mục cấu hình/cước Internet và dùng thuế suất 8%: chuyển người phụ trách đối chiếu ngành hàng và quy định.'],
  ['INTERNAL_POLICY_GUEST_ENTERTAINMENT', 'Mục đích chi tiếp khách', 'Điều 2.1', 'Đồ uống có cồn, karaoke, massage, thuốc lá nằm ngoài nhóm chi được tự duyệt: hỏi mục đích; tiền lệ CFO chỉ áp dụng đúng NCC, mục đích, hạn mức và thời hạn.'],
  ['RULE_SCOPE_NOT_COVERED', 'Khoản chi ngoài phạm vi SOP', 'Điều 2.3', 'Tài trợ, từ thiện, ủng hộ, tiền phạt, quà biếu, chi phí cá nhân, vàng/ngoại tệ/cổ phiếu/trái phiếu: SOP không có quy tắc tự duyệt nên luôn chuyển người có thẩm quyền, dù số liệu hợp lệ.'],
  ['RULE_SCOPE_VAT8_PERIOD', 'Thuế suất 8% ngoài thời gian giảm thuế', 'Điều 1.3', 'Thuế suất 8% trên hóa đơn lập sau 31/12/2026 (hết NQ 204/2025/QH15) hoặc trước 01/02/2022 cần xuất lại 10% hoặc loại phần thuế.'],
  ['RULE_MISSING_MANIFEST', 'Bảng kê chi tiết', 'Điều 2.1', 'Tư vấn, tiếp khách, ăn uống, hội nghị, tổng hợp, dịch vụ/hàng hóa khác chưa có chi tiết dòng hàng: bảng kê thiếu cần xác minh.'],
  ['AUTHORITY_EXCEED_KTT_LIMIT', 'Hạn mức thẩm quyền', 'Điều 3.3', 'Trị tuyệt đối tổng tiền đạt hoặc vượt trần cần CFO.'],
  ['AUTHORITY_SPLIT_PURCHASE', 'Tách nhỏ hóa đơn', 'Điều 3.3', 'Hóa đơn dưới trần nhưng cộng các hóa đơn mua dương cùng bên bán trong ngày mà mỗi tờ đều dưới trần (không tính hóa đơn bị từ chối, không đếm trùng) đạt trần: cần CFO xác nhận giao dịch độc lập.'],
  ['AUTHORITY_K_FACTOR_RED', 'Lô hàng lớn và cảnh báo K', 'Điều 4.3', 'Mua không phải điều chỉnh có trị tuyệt đối tiền trước thuế ≥ 1 tỷ, K sau mua < .95 hoặc > 1.35 cần CFO. K = doanh số / (tồn đầu + mua đã duyệt + mua mới). Đây là ngưỡng nội bộ.'],
  ['RULE_ADJUSTMENT_NO_ORIGINAL', 'Hóa đơn điều chỉnh', 'Điều 1.4', 'Cần tham chiếu hóa đơn gốc.']
] as const;

const fields:Record<string,string[]>={
  RULE_SOURCE_REVIEW:['sourceUncertainFields','confirmations'],RULE_DATA_QUALITY:['invoiceDate','preTaxAmount','taxRate','taxAmount','totalAmount'],
  RULE_IMAGE_BLURRY:['isImageBlurry'],RULE_DUPLICATE_INVOICE:['supplierTaxCode','invoiceNumber','invoiceSeries','history'],RULE_LINE_ITEM_MISMATCH:['items','preTaxAmount','taxAmount'],
  RULE_BUYER_TAX_CODE_MISMATCH:['buyerTaxCode','companyTaxCode'],RULE_MCCQT_INVALID:['invoiceSeries','taxAuthorityCode'],RULE_SERIES_YEAR_MISMATCH:['invoiceSeries','invoiceDate'],RULE_SIGNING_DELAY:['invoiceDate','signingDate'],
  RULE_SELLER_SUSPENDED:['sellerStatus'],RULE_HIGH_RISK_SUPPLIER:['supplierTaxCode','supplierRisk'],RULE_SELLER_CLOSURE_DATE_UNKNOWN:['sellerStatus','sellerSuspensionDate'],
  STATUTORY_DECREE_254_CLOSED_SELLER:['sellerStatus','sellerSuspensionDate','invoiceDate'],RULE_SELLER_CLOSED_BEFORE:['sellerStatus','sellerSuspensionDate','invoiceDate'],
  STATUTORY_LAW_48_CASH_PAYMENT:['totalAmount','invoiceDate','paymentMethod','isStaffReimbursed','hasBankSlip'],STATUTORY_SAME_DAY_CASH_5M:['history','supplierTaxCode','invoiceDate','totalAmount','paymentMethod'],
  STATUTORY_RES_204_VAT_8_EXCLUDED:['itemName','items','taxRate'],INTERNAL_POLICY_GUEST_ENTERTAINMENT:['itemName','items','precedent'],RULE_SCOPE_NOT_COVERED:['itemName','items','precedent'],RULE_SCOPE_VAT8_PERIOD:['taxRate','invoiceDate'],RULE_MISSING_MANIFEST:['itemName','items','hasItemManifest'],
  AUTHORITY_EXCEED_KTT_LIMIT:['totalAmount','kttApprovalLimit'],AUTHORITY_SPLIT_PURCHASE:['history','supplierTaxCode','invoiceDate','totalAmount','kttApprovalLimit'],AUTHORITY_K_FACTOR_RED:['preTaxAmount','macroState','isAdjustment'],RULE_ADJUSTMENT_NO_ORIGINAL:['isAdjustment','originalInvoiceRef'],
};
const officialSources={
  payment:{code:'181/2025/NĐ-CP',url:'https://vanban.chinhphu.vn/?docid=214336&pageid=27160',effectiveFrom:'2025-07-01'},
  vat:{code:'174/2025/NĐ-CP',url:'https://vanban.chinhphu.vn/?docid=214310&pageid=27160',effectiveFrom:'2025-07-01'},
  invoice:{code:'254/2026/NĐ-CP',url:'https://vanban.chinhphu.vn/?docid=218689&pageid=27160',effectiveFrom:'2026-07-01'},
  earlierInvoice:{code:'70/2025/NĐ-CP',url:'https://vanban.chinhphu.vn/?docid=213179&pageid=27160',effectiveFrom:'2025-06-01'},
};
export function ruleContract(id:string,invoiceDate?:string):PolicyRuleContract {
  const check=checks.find(row=>row[0]===id);
  const source=id.includes('CASH')?(invoiceDate && invoiceDate<'2025-07-01'?undefined:officialSources.payment):id.includes('VAT_8')||id==='RULE_SCOPE_VAT8_PERIOD'?officialSources.vat:
    /CLOSED_SELLER|BUYER_TAX|ADJUSTMENT|MCCQT|SERIES|SIGNING/.test(id)?invoiceDate && invoiceDate<'2026-07-01'?(invoiceDate>='2025-06-01'?officialSources.earlierInvoice:undefined):officialSources.invoice:undefined;
  // Nhóm lấy từ bảng phân loại duy nhất (lib/riskTaxonomy) — SOP, engine và workflow không thể lệch nhau.
  const group=groupOf(id);
  return {id,label:check?.[1]||id,clause:check?.[2]||'Dữ liệu đầu vào',condition:check?.[3]||'Xác minh dữ kiện trước khi tiếp tục.',requiredFields:fields[id]||[],
    group,recipient:id.startsWith('AUTHORITY_')||id==='RULE_HIGH_RISK_SUPPLIER'?'CFO':'KTT; CFO nếu đồng thời vượt quyền',
    actions:id.startsWith('AUTHORITY_')?'Phê duyệt trong phạm vi quyền / yêu cầu rà soát':id.includes('CASH')||id.includes('VAT_8')?'Bổ sung/điều chỉnh chứng từ / chưa ghi nhận thuế':'Xác minh/bổ sung / giữ hoặc từ chối hồ sơ',
    testTags:[`MATRIX-${id}`],source,
    legalVerification:source?'DOCUMENT_CONFIRMED_RULE_PENDING' as const:/^AUTHORITY_|^INTERNAL_POLICY_|^RULE_SCOPE_NOT_COVERED|DUPLICATE|SOURCE|DATA_QUALITY|IMAGE|LINE_ITEM|MANIFEST|SELLER_/.test(id)?'INTERNAL_POLICY' as const:'UNVERIFIED' as const};
}
export function policyRuleMatrix(config:SystemPolicyConfig):Array<PolicyRule & PolicyRuleContract> {
  return implementedPolicyRules(config).map(rule=>({...rule,...ruleContract(rule.id)}));
}

export function implementedPolicyRules(config: SystemPolicyConfig): PolicyRule[] {
  return checks.map(([id, label, clause, description], priority) => ({
    id, label, clause, sourceDocumentCode: 'TAX-SOP-2026', effectiveFrom: '2025-07-01',
    enabled: id==='RULE_MCCQT_INVALID'?config.strictMccqtCheck:id==='RULE_SERIES_YEAR_MISMATCH'?config.strictSeriesYearCheck:true, priority, parameters: { description,
      requiredFields:fields[id]||[],group:ruleContract(id).group,recipient:ruleContract(id).recipient,actions:ruleContract(id).actions,
      legalVerification:ruleContract(id).legalVerification,sourceUrl:ruleContract(id).source?.url||'',testTags:[`MATRIX-${id}`],
      ...(id === 'AUTHORITY_EXCEED_KTT_LIMIT' ? { kttApprovalLimit: config.kttApprovalLimit } : {}),
      ...(id === 'STATUTORY_LAW_48_CASH_PAYMENT' ? { nonCashThreshold: config.nonCashThreshold } : {}) }
  }));
}

export function executablePolicySummary(config: SystemPolicyConfig): string {
  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
  return `Quy trình kiểm tra và chuyển tiếp hóa đơn\n\n` +
    `Doanh nghiệp áp dụng: ${config.companyName || 'chưa cấu hình'} · MST người mua hợp lệ trên hóa đơn: ${config.companyTaxCode || 'chưa cấu hình'}.\n` +
    `Đầu vào: XML, PDF, ảnh hoặc nhập tay; số hóa đơn, ngày, MST/tên bên bán, nội dung và các số tiền cần được xác minh.\n` +
    `Chứng từ thanh toán chỉ bắt buộc khi quy tắc thanh toán áp dụng; thiếu chứng từ không có nghĩa đã thanh toán tiền mặt. Bảng kê riêng cần cho dịch vụ tổng hợp/tư vấn/tiếp khách không có chi tiết dòng hàng. Phương thức thanh toán chỉ cần khi tổng tiền (cộng các hóa đơn cùng bên bán trong ngày) từ ${money(config.nonCashThreshold)}; trạng thái hoạt động bên bán chỉ cần khi tổng tiền từ ${money(config.sellerStatusMaterialityVnd ?? 20_000_000)} hoặc nguồn tra cứu báo rủi ro. Dưới các ngưỡng này hệ thống không hỏi, để tránh chuyển tiếp thừa.\n` +
    `Thường quy: đầy đủ dữ liệu, không còn phát hiện và dưới trần ${money(config.kttApprovalLimit)} → tự duyệt, tạo chứng từ nội bộ và audit. ERP chỉ xuất payload.\n` +
    `Chưa rõ thông tin → Kế toán trưởng xác minh từng trường và ghi nguồn. Ngoài quy định → làm rõ/bổ sung hoặc từ chối. Vượt quyền → CFO quyết định; không bỏ qua ràng buộc dữ liệu hoặc luật định.\n` +
    `Mọi hóa đơn có trị tuyệt đối tổng tiền ≥ ${money(config.kttApprovalLimit)} cần CFO. Ngưỡng thanh toán cấu hình: ${money(config.nonCashThreshold)} từ ${config.nonCashThresholdEffectiveFrom}; trước mốc cấu hình dùng ngưỡng lịch sử theo ngày hóa đơn.\n` +
    `Chi tiếp khách/đồ uống có cồn cần làm rõ mục đích. Tiền lệ chỉ áp dụng quy chế nội bộ trong phạm vi CFO đã cấp, không giải tỏa dữ liệu nghi vấn, luật định hoặc thẩm quyền.\n` +
    `Dừng, bổ sung, đánh giá lại và hoàn tác đều lưu lý do, người thực hiện, revision và trạng thái trước/sau.\n` +
    `Mô tả các quy tắc đang chạy, không phải xác nhận pháp lý. Sửa văn bản không tự tạo hoặc thay đổi rule TypeScript; thay tham số cần qua kiểm tra và ban hành policy.\n\n` +
    policyRuleMatrix(config).map(r => `${r.clause} · ${r.id}: ${r.label}. ${r.condition} Dữ kiện: ${r.requiredFields.join(', ')}. Nhóm: ${r.group}; người xử lý: ${r.recipient}. ${r.source?'Đã đối chiếu văn bản nguồn; diễn giải điều khoản cần nghiệp vụ xác nhận.':'Quy tắc kiểm soát nội bộ, không khẳng định pháp lý.'}`).join('\n');
}
