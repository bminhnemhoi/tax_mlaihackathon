import type { ActionOption, InvoiceInput, RiskGroup, RuleFinding, SystemPolicyConfig } from '@/lib/schemas';
import { RISK_GROUP_LABELS, groupOf } from '@/lib/riskTaxonomy';

/**
 * Câu hỏi chuyển tiếp "trả lời trong một câu": mỗi ý nêu lý do bằng số liệu cụ thể và hai đáp án có hệ quả rõ
 * (₫ thuế được khấu trừ hay bị loại), để người xử lý quyết định ngay mà không phải mở lại chứng từ gốc.
 * Toàn bộ là template tất định; AI không tham gia tạo số liệu.
 */
export const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n))}₫`;
/** 2026-10-05 → 05/10/2026 */
export const viDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
const TOLERANCE = 10;

type Option = ActionOption;
const option = (id: 'A' | 'B', label: string, actionDescription: string, resultingAction: Option['resultingAction']): Option => ({ id, label, actionDescription, resultingAction });

export interface ConcreteIssue { reason: string; ask: string; options?: [Option, Option] }
export interface QuestionContext { config?: Partial<SystemPolicyConfig>; nonCashThreshold: number; dailyTotal?: number; kttLimit: number }

export function concreteIssue(finding: Pick<RuleFinding, 'ruleId' | 'flaggedReason'>, inv: InvoiceInput, ctx: QuestionContext): ConcreteIssue | null {
  const tax = vnd(inv.taxAmount), total = vnd(inv.totalAmount), item = `“${inv.itemName}”`;
  switch (finding.ruleId) {
    case 'RULE_DATA_QUALITY': {
      const expectedTax = Math.round(inv.preTaxAmount * inv.taxRate / 100);
      const expectedTotal = inv.preTaxAmount + inv.taxAmount;
      if (Math.abs(inv.taxAmount - expectedTax) > TOLERANCE) {
        return {
          reason: `Tiền thuế in trên hóa đơn ${tax} lệch ${inv.taxRate}% × ${vnd(inv.preTaxAmount)} = ${vnd(expectedTax)}.`,
          ask: 'Tiền thuế đúng là bao nhiêu?',
          options: [option('A', `${vnd(expectedTax)} (đúng thuế suất) — sửa và đánh giá lại`, 'Xác nhận số thuế tính lại từ tiền hàng × thuế suất, ghi nguồn và đánh giá lại.', 'CONFIRM_CORRECTED_DATA'),
            option('B', `${tax} như in — yêu cầu NCC lập biên bản điều chỉnh`, 'Giữ hồ sơ, chưa khấu trừ thuế cho đến khi bên bán điều chỉnh hóa đơn.', 'REQUEST_INFORMATION')]
        };
      }
      if (Math.abs(inv.totalAmount - expectedTotal) > TOLERANCE) {
        return {
          reason: `Tổng thanh toán in trên hóa đơn ${total} lệch tiền hàng + thuế = ${vnd(inv.preTaxAmount)} + ${tax} = ${vnd(expectedTotal)}.`,
          ask: 'Tổng thanh toán đúng là bao nhiêu?',
          options: [option('A', `${vnd(expectedTotal)} (= tiền hàng + thuế) — sửa và đánh giá lại`, 'Xác nhận tổng tính lại, ghi nguồn và đánh giá lại toàn bộ quy tắc.', 'CONFIRM_CORRECTED_DATA'),
            option('B', `${total} như in — yêu cầu NCC lập biên bản điều chỉnh`, 'Giữ hồ sơ, chưa khấu trừ thuế cho đến khi bên bán điều chỉnh hóa đơn.', 'REQUEST_INFORMATION')]
        };
      }
      return null;
    }
    case 'RULE_IMAGE_BLURRY':
      return {
        reason: `Ảnh hóa đơn mờ; hệ thống đọc được tổng ${total} (thuế ${tax}) nhưng chưa chắc chắn.`,
        ask: `Tổng thanh toán trên chứng từ có đúng ${total} không?`,
        options: [option('A', `Đúng ${total} — xác nhận và đánh giá lại`, 'Ghi nhận giá trị đã đối chiếu bằng mắt kèm nguồn, rồi đánh giá lại.', 'CONFIRM_CORRECTED_DATA'),
          option('B', 'Không rõ / sai — gửi lại ảnh rõ hoặc XML gốc', 'Giữ hồ sơ, chưa khấu trừ thuế cho đến khi có chứng từ đọc được.', 'REQUEST_INFORMATION')]
      };
    case 'STATUTORY_LAW_48_CASH_PAYMENT':
      return {
        reason: `Hóa đơn ${total} (≥ ngưỡng ${vnd(ctx.nonCashThreshold)}) ghi thanh toán tiền mặt; theo SOP Điều 1.2 phải có chứng từ không dùng tiền mặt mới được khấu trừ.`,
        ask: 'Khoản này thực tế được thanh toán thế nào?',
        options: [option('A', `Đã chuyển khoản qua ngân hàng — bổ sung UNC để khấu trừ ${tax}`, 'Tạm giữ, bổ sung ủy nhiệm chi rồi đánh giá lại.', 'REQUEST_INFORMATION'),
          option('B', `Trả tiền mặt thật — loại ${tax} VAT khỏi khấu trừ`, 'Không ghi nhận thuế được khấu trừ; lưu lý do.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'STATUTORY_SAME_DAY_CASH_5M':
      return {
        reason: `Các hóa đơn cùng ngày ${viDate(inv.invoiceDate)} từ ${inv.supplierName} cộng lại ${vnd(ctx.dailyTotal || inv.totalAmount)} (≥ ${vnd(ctx.nonCashThreshold)}) và đang trả tiền mặt.`,
        ask: 'Cụm hóa đơn này được thanh toán thế nào?',
        options: [option('A', 'Đã chuyển khoản — bổ sung UNC cho cả cụm', 'Tạm giữ cụm hóa đơn, bổ sung ủy nhiệm chi rồi đánh giá lại.', 'REQUEST_INFORMATION'),
          option('B', `Trả tiền mặt thật — loại ${tax} VAT của hóa đơn này`, 'Không ghi nhận thuế được khấu trừ; lưu lý do.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'STATUTORY_RES_204_VAT_8_EXCLUDED': {
      const correct = Math.round(inv.preTaxAmount * 0.1);
      return {
        reason: `${item} thuộc nhóm không được giảm thuế (viễn thông/CNTT/tài chính… theo NQ 204/2025/QH15) nhưng hóa đơn áp 8% (thuế ${tax}; đúng phải là 10% = ${vnd(correct)}).`,
        ask: 'Xử lý thế nào?',
        options: [option('A', 'Yêu cầu NCC xuất lại hóa đơn 10%', 'Giữ hồ sơ, chưa khấu trừ cho đến khi có hóa đơn đúng thuế suất.', 'REQUEST_SUPPLIER_REISSUE'),
          option('B', `Không khấu trừ ${tax} trên hóa đơn sai thuế suất`, 'Ghi nhận chi phí nội bộ, loại phần thuế sai.', 'REJECT_TAX_DEDUCTION')]
      };
    }
    case 'RULE_SCOPE_VAT8_PERIOD':
      return {
        reason: `Hóa đơn ngày ${viDate(inv.invoiceDate)} áp thuế suất 8% nhưng ngày này nằm ngoài thời gian giảm thuế GTGT đã cấu hình (NQ 204/2025/QH15: 01/07/2025–31/12/2026).`,
        ask: 'Xử lý thế nào?',
        options: [option('A', 'Yêu cầu NCC xuất lại hóa đơn 10%', 'Giữ hồ sơ, chưa khấu trừ cho đến khi có hóa đơn đúng thuế suất.', 'REQUEST_SUPPLIER_REISSUE'),
          option('B', `Không khấu trừ ${tax} trên hóa đơn sai thuế suất`, 'Ghi nhận chi phí nội bộ, loại phần thuế sai.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'RULE_BUYER_TAX_CODE_MISMATCH':
      return {
        reason: `MST người mua trên hóa đơn là ${inv.buyerTaxCode}, khác MST công ty ${ctx.config?.companyTaxCode}; hóa đơn không đúng tên người mua thì không được khấu trừ.`,
        ask: 'Xử lý thế nào?',
        options: [option('A', `Yêu cầu NCC hủy và xuất lại đúng MST ${ctx.config?.companyTaxCode}`, 'Giữ hồ sơ, chưa khấu trừ cho đến khi có hóa đơn đúng tên.', 'REQUEST_INFORMATION'),
          option('B', `Loại toàn bộ ${tax} VAT — hóa đơn không phải của công ty`, 'Không kê khai khấu trừ, không tính chi phí được trừ.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'INTERNAL_POLICY_GUEST_ENTERTAINMENT':
      return {
        reason: `${item} (${total}) có đồ uống có cồn/giải trí — nằm ngoài nhóm chi được tự duyệt (SOP Điều 2.1).`,
        ask: 'Mục đích khoản chi là gì?',
        options: [option('A', `Tiếp khách đối tác theo quy chế — duyệt, khấu trừ ${tax}`, 'Xác nhận khoản chi phục vụ SXKD theo quy chế tiếp khách, kèm danh sách khách mời.', 'ACCEPT_WITH_DOCS'),
          option('B', `Chi cá nhân/ngoài quy chế — loại ${tax} VAT`, 'Ghi nhận chi phí nội bộ, không khấu trừ thuế.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'RULE_SCOPE_NOT_COVERED':
      return {
        reason: `${item} (${total}) là ${finding.flaggedReason.match(/nhóm “([^”]+)”/)?.[1] || 'khoản chi'} — SOP không có quy tắc tự duyệt cho loại chi này.`,
        ask: 'Khoản này có phục vụ trực tiếp sản xuất kinh doanh không?',
        options: [option('A', `Có hợp đồng/chứng từ phục vụ SXKD — duyệt, khấu trừ ${tax}`, 'Người có thẩm quyền xác nhận kèm hợp đồng/chứng từ chứng minh.', 'ACCEPT_WITH_DOCS'),
          option('B', `Không phục vụ SXKD — loại ${tax} VAT, chỉ ghi nhận chi phí`, 'Không kê khai khấu trừ; lưu lý do.', 'REJECT_TAX_DEDUCTION')]
      };
    case 'AUTHORITY_EXCEED_KTT_LIMIT':
      if (inv.isAdjustment) return null;
      return {
        reason: `Tổng thanh toán ${total} ≥ hạn mức tự duyệt của Kế toán trưởng ${vnd(ctx.kttLimit)} (SOP Điều 3.3).`,
        ask: `CFO có phê duyệt khoản chi ${item} của ${inv.supplierName} không?`,
        options: [option('A', `CFO phê duyệt chi ${total} — khấu trừ ${tax}`, 'Phê duyệt trong thẩm quyền CFO; chỉ hoàn tất khi mọi phát hiện khác đã được giải quyết.', 'ACCEPT_WITH_DOCS'),
          option('B', 'Tạm dừng để thẩm tra hợp đồng', 'Giữ hồ sơ, chưa duyệt thuế cho đến khi thẩm tra xong điều khoản hợp đồng.', 'REQUEST_INFORMATION')]
      };
    case 'RULE_DUPLICATE_INVOICE':
      return {
        reason: `Trùng với hóa đơn đã tiếp nhận (cùng MST ${inv.supplierTaxCode} + ký hiệu + số ${inv.invoiceNumber}).`,
        ask: 'Đây là bản trùng hay hóa đơn thay thế?',
        options: [option('A', 'Bản trùng — từ chối, không kê khai lần hai', 'Hủy tiếp nhận bản trùng để tránh kê khai trùng thuế.', 'REJECT_TAX_DEDUCTION'),
          option('B', 'Hóa đơn thay thế — bổ sung biên bản và số HĐ gốc rồi đánh giá lại', 'Giữ hồ sơ chờ biên bản thay thế và tham chiếu hóa đơn gốc.', 'REQUEST_INFORMATION')]
      };
    case 'RULE_MISSING_MANIFEST':
      return {
        reason: `${item} (${total}) là hóa đơn tổng hợp nhưng chưa có bảng kê chi tiết (SOP Điều 2.1).`,
        ask: 'Đã có bảng kê chi tiết chưa?',
        options: [option('A', 'Có — đính kèm bảng kê rồi đánh giá lại', 'Bổ sung bảng kê và đánh giá lại.', 'REQUEST_INFORMATION'),
          option('B', `Không có — chưa khấu trừ ${tax}`, 'Không đưa vào kê khai khấu trừ kỳ này.', 'REJECT_TAX_DEDUCTION')]
      };
    default:
      return null;
  }
}

const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: 'Số hóa đơn', invoiceDate: 'Ngày lập', supplierName: 'Tên bên bán', supplierTaxCode: 'MST bên bán', itemName: 'Nội dung hàng hóa',
  preTaxAmount: 'Tiền trước thuế', taxRate: 'Thuế suất', taxAmount: 'Tiền thuế', totalAmount: 'Tổng thanh toán', buyerTaxCode: 'MST bên mua',
  invoiceSeries: 'Ký hiệu hóa đơn', taxAuthorityCode: 'Mã CQT', signingDate: 'Ngày ký', items: 'Chi tiết dòng hàng', isAdjustment: 'Hóa đơn điều chỉnh',
  originalInvoiceRef: 'Số hóa đơn gốc', sellerSuspensionDate: 'Ngày đóng MST bên bán'
};

export interface FieldAsk { field: string; ask: string; answers: [string, string] }

/** Câu hỏi đóng cho một dữ kiện chưa xác minh/còn thiếu, kèm giá trị ứng viên khi tính được từ dữ liệu khác. */
export function fieldAsk(field: string, inv: InvoiceInput, ctx: { missing: boolean; nonCashThreshold: number; rawTaxRate?: unknown; sourceValue?: unknown }): FieldAsk {
  const total = vnd(inv.totalAmount), tax = vnd(inv.taxAmount);
  const computedTotal = inv.preTaxAmount + inv.taxAmount;
  const expectedTax = Math.round(inv.preTaxAmount * inv.taxRate / 100);
  const label = FIELD_LABELS[field] || field;
  const show = (v: unknown) => typeof v === 'number' ? (field === 'taxRate' ? `${v}%` : vnd(v)) : String(v);
  if (ctx.sourceValue !== undefined) {
    const submitted = (inv as unknown as Record<string, unknown>)[field];
    return { field, ask: `${label} trên chứng từ gốc là ${show(ctx.sourceValue)}, nhưng hồ sơ gửi lên ghi ${show(submitted)}. Giá trị đúng là?`, answers: [`${show(ctx.sourceValue)} theo chứng từ gốc`, `${show(submitted)} (đã sửa, kèm bằng chứng)`] };
  }
  switch (field) {
    case 'paymentMethod':
      return { field, ask: `Hóa đơn ${total} được thanh toán bằng hình thức nào?`, answers: ['Chuyển khoản qua ngân hàng (có UNC)', Math.abs(inv.totalAmount) >= ctx.nonCashThreshold ? `Tiền mặt → không được khấu trừ ${tax} VAT` : `Tiền mặt (dưới ngưỡng ${vnd(ctx.nonCashThreshold)}, vẫn hợp lệ)`] };
    case 'sellerStatus':
      return { field, ask: `MST bên bán ${inv.supplierTaxCode} (${inv.supplierName}) tại ngày ${viDate(inv.invoiceDate)} đang ở trạng thái nào?`, answers: ['Đang hoạt động', 'Đã đóng/tạm ngừng → chưa khấu trừ'] };
    case 'hasBankSlip':
      return { field, ask: `Đã có ủy nhiệm chi/chứng từ chuyển khoản cho khoản ${total} chưa?`, answers: ['Có UNC — đính kèm', `Chưa có → tạm chưa khấu trừ ${tax}`] };
    case 'hasItemManifest':
      return { field, ask: `“${inv.itemName}” là hóa đơn tổng hợp — đã có bảng kê chi tiết chưa?`, answers: ['Có bảng kê — đính kèm', 'Chưa có → tạm treo hồ sơ'] };
    case 'taxRate':
      if (ctx.rawTaxRate !== undefined) return { field, ask: `Thuế suất ghi trên hóa đơn là ${String(ctx.rawTaxRate)}% — không thuộc các mức 0/5/8/10% của Luật Thuế GTGT. Thuế suất đúng là?`, answers: ['10% (yêu cầu NCC xuất lại nếu sai)', '8% (chỉ khi thuộc diện giảm thuế)'] };
      break;
    case 'totalAmount':
      if (!ctx.missing && Math.abs(computedTotal - inv.totalAmount) > TOLERANCE)
        return { field, ask: `Tổng thanh toán đọc được ${total} nhưng tiền hàng + thuế = ${vnd(computedTotal)}. Số đúng là?`, answers: [vnd(computedTotal), `${total} như in`] };
      if (ctx.missing && inv.preTaxAmount > 0)
        return { field, ask: `Hóa đơn chưa có tổng thanh toán; tiền hàng ${vnd(inv.preTaxAmount)} + thuế ${tax} = ${vnd(computedTotal)}. Tổng đúng là?`, answers: [vnd(computedTotal), 'Số khác — nhập từ hóa đơn'] };
      break;
    case 'taxAmount':
      if (!ctx.missing && Math.abs(expectedTax - inv.taxAmount) > TOLERANCE)
        return { field, ask: `Tiền thuế đọc được ${tax} nhưng ${inv.taxRate}% × ${vnd(inv.preTaxAmount)} = ${vnd(expectedTax)}. Số đúng là?`, answers: [vnd(expectedTax), `${tax} như in`] };
      break;
  }
  if (ctx.missing) return { field, ask: `${label}: hóa đơn chưa có dữ liệu.`, answers: ['Nhập giá trị từ hóa đơn rồi đánh giá lại', 'Yêu cầu người nộp bổ sung chứng từ'] };
  const raw = (inv as unknown as Record<string, unknown>)[field];
  const shown = typeof raw === 'number' ? (field === 'taxRate' ? `${raw}%` : vnd(raw)) : Array.isArray(raw) ? `${raw.length} dòng` : String(raw);
  return { field, ask: `${label} đọc được là ${shown} — đúng không?`, answers: [`Đúng ${shown}`, 'Sai — ghi giá trị đúng'] };
}

export interface QuestionItem { n: number; ruleIds: string[]; riskGroup: RiskGroup; text: string; answers: [string, string] }

/** Ghép câu hỏi tổng: một dòng ngữ cảnh + các ý đánh số; mỗi ý có đáp án A/B, trả lời một lần kiểu "1A, 2B". */
export function composeQuestion(inv: InvoiceInput, role: 'CFO' | 'Kế toán trưởng', items: Array<Omit<QuestionItem, 'n'>>, taxAtStake: number): { question: string; items: QuestionItem[] } {
  const numbered = items.map((item, index) => ({ ...item, n: index + 1 }));
  const header = `Hóa đơn ${inv.invoiceNumber} · ${inv.supplierName} · ${vnd(inv.totalAmount)}${taxAtStake > 0 ? ` (VAT chờ quyết định ${vnd(taxAtStake)})` : ''}. ${role} trả lời`;
  const render = (item: QuestionItem) => `[${RISK_GROUP_LABELS[item.riskGroup]}] ${item.text} A: ${item.answers[0]}; hoặc B: ${item.answers[1]}?`;
  if (numbered.length === 1) return { question: `${header}: ${render(numbered[0])}`, items: numbered };
  return { question: `${header} ${numbered.length} ý:\n${numbered.map(item => `${item.n}. ${render(item)}`).join('\n')}\nTrả lời một lần, ví dụ: "${numbered.map(item => `${item.n}A`).join(', ')}".`, items: numbered };
}

export function issueItem(finding: Pick<RuleFinding, 'ruleId' | 'kind' | 'flaggedReason' | 'actionableQuestion' | 'sopClause' | 'options'>): Omit<QuestionItem, 'n'> {
  const generic = /\s*(?:KTT(?:\/CFO)?|CFO|Kế toán trưởng)?\s*(?:xử lý thế nào|quyết định thế nào|phê duyệt chiến lược xử lý|quyết định|phê duyệt ghi nhận|xác nhận)\?\s*$/i;
  const ask = (finding.actionableQuestion || '').replace(generic, '').trim();
  const reason = finding.flaggedReason.trim().replace(/\.?$/, '.');
  const clause = finding.sopClause && !reason.includes(finding.sopClause) ? ` (Căn cứ: ${finding.sopClause})` : '';
  const text = ask && !reason.includes(ask) ? `${reason}${clause} ${ask}` : `${reason}${clause}`;
  const options = finding.options || [];
  return { ruleIds: [finding.ruleId], riskGroup: groupOf(finding.ruleId, finding.kind), text, answers: [options[0]?.label || 'Đồng ý', options[1]?.label || 'Không đồng ý'] };
}
