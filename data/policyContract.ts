import type { PolicyRule, SystemPolicyConfig } from '@/lib/schemas';

// This registry documents implemented checks. Editing prose does not execute a new rule.
const checks = [
  ['RULE_SOURCE_REVIEW', 'Xác minh dữ liệu nguồn', 'Dữ liệu đầu vào', 'Mỗi trường nghi vấn cần xác nhận riêng và nguồn bằng chứng.'],
  ['RULE_DATA_QUALITY', 'Ngày và số tiền nhất quán', 'Điều 1.1', 'Ngày hợp lệ; tiền trước thuế + thuế khớp tổng và thuế suất.'],
  ['RULE_IMAGE_BLURRY', 'Ảnh chưa đọc rõ', 'Dữ liệu đầu vào', 'Ảnh mờ chưa xác minh luôn dừng tự động hóa.'],
  ['RULE_DUPLICATE_INVOICE', 'Không ghi nhận trùng', 'Điều 1.1', 'Đối chiếu định danh hóa đơn và chứng từ đã nhận.'],
  ['RULE_LINE_ITEM_MISMATCH', 'Đối chiếu dòng hàng', 'Điều 1.1', 'Các dòng hàng không khớp phần tổng hợp cần xác minh.'],
  ['RULE_BUYER_TAX_CODE_MISMATCH', 'MST người mua', 'Điều 1.1', 'Đối chiếu với MST doanh nghiệp đang được cấu hình.'],
  ['RULE_MCCQT_INVALID', 'Mã cơ quan thuế', 'Điều 1.1', 'Kiểm tra mã khi loại hóa đơn yêu cầu mã CQT.'],
  ['RULE_SERIES_YEAR_MISMATCH', 'Năm ký hiệu', 'Điều 1.1', 'Đối chiếu năm ký hiệu và ngày lập khi bật kiểm tra.'],
  ['RULE_SIGNING_DELAY', 'Ngày ký', 'Điều 1.1', 'Đối chiếu ngày lập và ngày ký.'],
  ['RULE_SELLER_SUSPENDED', 'Bên bán tạm ngừng', 'Điều 2.2', 'Chuyển người phụ trách xác minh trạng thái bên bán.'],
  ['RULE_HIGH_RISK_SUPPLIER', 'Nhà cung cấp có cảnh báo', 'Điều 2.2', 'Xác minh hồ sơ nhà cung cấp có cảnh báo.'],
  ['RULE_SELLER_CLOSURE_DATE_UNKNOWN', 'Chưa rõ ngày đóng MST', 'Điều 2.2', 'CLOSED thiếu ngày đóng không được tự duyệt.'],
  ['STATUTORY_DECREE_254_CLOSED_SELLER', 'Ngày lập sau ngày đóng MST', 'Điều 2.2', 'Chặn tự duyệt theo quy tắc đang triển khai.'],
  ['RULE_SELLER_CLOSED_BEFORE', 'Ngày lập trước ngày đóng MST', 'Điều 2.2', 'Cần chứng minh giao dịch và đánh giá lại.'],
  ['STATUTORY_LAW_48_CASH_PAYMENT', 'Điều kiện thanh toán', 'Điều 1.2', 'Đối chiếu số tiền, ngày, hình thức và bằng chứng thanh toán.'],
  ['STATUTORY_SAME_DAY_CASH_5M', 'Gộp mua trong ngày', 'Điều 1.2', 'Đối chiếu các giao dịch cùng nhà cung cấp trong ngày.'],
  ['STATUTORY_RES_204_VAT_8_EXCLUDED', 'Thuế suất nhóm loại trừ', 'Điều 1.3', 'Kiểm tra danh mục loại trừ trong engine.'],
  ['INTERNAL_POLICY_GUEST_ENTERTAINMENT', 'Mục đích chi tiếp khách', 'Điều 2.1', 'Làm rõ mục đích; tiền lệ CFO chỉ áp dụng đúng NCC, mục đích, hạn mức và thời hạn.'],
  ['RULE_MISSING_MANIFEST', 'Bảng kê chi tiết', 'Điều 2.1', 'Bổ sung bảng kê khi loại chi phí cần hồ sơ chi tiết.'],
  ['AUTHORITY_EXCEED_KTT_LIMIT', 'Hạn mức thẩm quyền', 'Điều 3.3', 'Trị tuyệt đối tổng tiền đạt hoặc vượt trần cần CFO.'],
  ['AUTHORITY_K_FACTOR_RED', 'Lô hàng lớn và cảnh báo K', 'Điều 4.3', 'Lô hàng lớn chạm vùng đỏ cần CFO; không tự trì hoãn kê khai.'],
  ['RULE_ADJUSTMENT_NO_ORIGINAL', 'Hóa đơn điều chỉnh', 'Điều 1.4', 'Cần tham chiếu hóa đơn gốc.']
] as const;

export function implementedPolicyRules(config: SystemPolicyConfig): PolicyRule[] {
  return checks.map(([id, label, clause, description], priority) => ({
    id, label, clause, sourceDocumentCode: 'TAX-SOP-2026', effectiveFrom: '2025-07-01',
    enabled: true, priority, parameters: { description,
      ...(id === 'AUTHORITY_EXCEED_KTT_LIMIT' ? { kttApprovalLimit: config.kttApprovalLimit } : {}),
      ...(id === 'STATUTORY_LAW_48_CASH_PAYMENT' ? { nonCashThreshold: config.nonCashThreshold } : {}) }
  }));
}

export function executablePolicySummary(config: SystemPolicyConfig): string {
  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
  return `Quy trình kiểm tra và chuyển tiếp hóa đơn\n\n` +
    `Đầu vào: XML, PDF, ảnh hoặc nhập tay; số hóa đơn, ngày, MST/tên bên bán, nội dung và các số tiền cần được xác minh.\n` +
    `Thường quy: đầy đủ dữ liệu, không còn phát hiện và dưới trần ${money(config.kttApprovalLimit)} → tự duyệt, tạo chứng từ nội bộ và audit. ERP chỉ xuất payload.\n` +
    `Chưa rõ thông tin → Kế toán trưởng xác minh từng trường và ghi nguồn. Ngoài quy định → làm rõ/bổ sung hoặc từ chối. Vượt quyền → CFO quyết định; không bỏ qua ràng buộc dữ liệu hoặc luật định.\n` +
    `Mọi hóa đơn có trị tuyệt đối tổng tiền ≥ ${money(config.kttApprovalLimit)} cần CFO. Ngưỡng thanh toán cấu hình: ${money(config.nonCashThreshold)}.\n` +
    `Chi tiếp khách/đồ uống có cồn cần làm rõ mục đích. Tiền lệ chỉ áp dụng quy chế nội bộ trong phạm vi CFO đã cấp, không giải tỏa dữ liệu nghi vấn, luật định hoặc thẩm quyền.\n` +
    `Dừng, bổ sung, đánh giá lại và hoàn tác đều lưu lý do, người thực hiện, revision và trạng thái trước/sau.\n` +
    `Mô tả các quy tắc đang chạy, không phải xác nhận pháp lý. Sửa văn bản không tự tạo hoặc thay đổi rule TypeScript; thay tham số cần qua kiểm tra và ban hành policy.\n\n` +
    implementedPolicyRules(config).map(r => `${r.clause} · ${r.id}: ${r.label}. ${r.parameters.description}`).join('\n');
}
