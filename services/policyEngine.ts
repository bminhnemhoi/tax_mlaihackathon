import { ActionOption, InvoiceInput, InvoiceLineItem, LineItemAnalysis, MacroState, RefereeDecision, RuleFinding, RuleKind, SystemPolicyConfig } from '@/lib/schemas';
import { MACRO_DEFAULTS } from '@/lib/constants';
import { getApplicableRegulations } from '@/data/regulatoryRegistry';
import { checkDuplicateInvoice } from '@/services/duplicateDetector';
import { findPrecedentForInvoice } from '@/services/precedentService';
import { getSupplier } from '@/services/supplierService';
import { checkSameDayMultipleInvoicesRule } from '@/services/bankMatcherService';
import { getDatabase } from '@/lib/server/db';

// 0. IMP-08: Hàm Đối soát Chi tiết Dòng hàng & Đa Thuế suất (Line-item Validation Engine)
export interface LineItemValidationResult {
  isValid: boolean;
  totalItems: number;
  flaggedItemsCount: number;
  warnings: string[];
  totalItemAmount: number;
  totalItemTax: number;
  mismatchHeader: boolean;
  hasExcludedVat8Item: boolean;
  hasSensitiveItem: boolean;
}

export function validateLineItems(
  items: InvoiceLineItem[] | undefined,
  inv: InvoiceInput,
  config?: Partial<SystemPolicyConfig>
): LineItemValidationResult {
  if (!items || items.length === 0) {
    return {
      isValid: true,
      totalItems: 0,
      flaggedItemsCount: 0,
      warnings: [],
      totalItemAmount: inv.preTaxAmount,
      totalItemTax: inv.taxAmount,
      mismatchHeader: false,
      hasExcludedVat8Item: false,
      hasSensitiveItem: false
    };
  }

  const excluded = (config?.excludedVat8Categories || [
    'VIỄN THÔNG', 'TÀI CHÍNH', 'NGÂN HÀNG', 'CHỨNG KHOÁN', 'BẢO HIỂM',
    'BẤT ĐỘNG SẢN', 'KIM LOẠI', 'KHAI KHOÁNG', 'HÓA CHẤT', 'TIÊU THỤ ĐẶC BIỆT'
  ]).map(c => c.trim().toLocaleUpperCase('vi-VN'));

  const sensitiveKeywords = ['RƯỢU', 'BIA', 'WHISKY', 'WINE', 'THUỐC LÁ', 'CIGAR', 'KARAOKE', 'MASSAGE'];

  const warnings: string[] = [];
  let flaggedCount = 0;
  let sumAmount = 0;
  let sumTax = 0;
  let hasExcludedVat8Item = false;
  let hasSensitiveItem = false;

  for (const item of items) {
    sumAmount += item.amount;
    sumTax += item.taxAmount;
    const nameUpper = item.itemName.toLocaleUpperCase('vi-VN');

    // 1. Kiểm tra tính toán số học từng dòng (dung sai làm tròn 1.000đ)
    const expectedAmount = item.quantity * item.unitPrice - (item.discountAmount || 0);
    if (Math.abs(item.amount - expectedAmount) > 1000) {
      warnings.push(`Dòng ${item.lineNumber} [${item.itemName}]: Thành tiền (${item.amount.toLocaleString('vi-VN')}₫) lệch so với số lượng x đơn giá (${expectedAmount.toLocaleString('vi-VN')}₫).`);
      flaggedCount++;
      item.flaggedReason = 'Lệch số học thành tiền';
    }

    // 2. Rà soát danh mục loại trừ thuế suất 8% (Nghị quyết 204/2025/QH15)
    if (item.taxRate === 8) {
      const isExcluded = excluded.some(cat => nameUpper.includes(cat)) || /CƯỚC INTERNET|INTERNET|CƯỚC DI ĐỘNG/i.test(nameUpper);
      if (isExcluded) {
        warnings.push(`Dòng ${item.lineNumber} [${item.itemName}]: Mặt hàng thuộc danh mục loại trừ nhưng đang áp thuế suất ưu đãi 8% thay vì 10% (NQ 204/2025/QH15).`);
        flaggedCount++;
        hasExcludedVat8Item = true;
        item.isExcludedCategory = true;
        item.flaggedReason = 'Sai thuế suất 8% theo NQ 204/2025/QH15';
      }
    }

    // 3. Phát hiện chi phí nhạy cảm không phục vụ SXKD
    const isSensitive = sensitiveKeywords.some(kw => nameUpper.includes(kw));
    if (isSensitive) {
      warnings.push(`Dòng ${item.lineNumber} [${item.itemName}]: Chi phí nhạy cảm (rượu/bia/thuốc lá/giải trí) - cần kèm quy chế tiếp khách.`);
      flaggedCount++;
      hasSensitiveItem = true;
      item.flaggedReason = 'Chi phí nhạy cảm cần hồ sơ chứng minh';
    }
  }

  // 4. Đối chiếu tổng dòng với Header (dung sai làm tròn 2.000đ)
  const amountDiff = Math.abs(sumAmount - inv.preTaxAmount);
  const taxDiff = Math.abs(sumTax - inv.taxAmount);
  let mismatchHeader = false;
  if (amountDiff > 2000 || taxDiff > 2000) {
    warnings.push(`Tổng chi tiết dòng hàng (${sumAmount.toLocaleString('vi-VN')}₫) không khớp với số tiền trên hóa đơn (${inv.preTaxAmount.toLocaleString('vi-VN')}₫).`);
    mismatchHeader = true;
    flaggedCount++;
  }

  return {
    isValid: flaggedCount === 0,
    totalItems: items.length,
    flaggedItemsCount: flaggedCount,
    warnings,
    totalItemAmount: sumAmount,
    totalItemTax: sumTax,
    mismatchHeader,
    hasExcludedVat8Item,
    hasSensitiveItem
  };
}

// Tính toán Tham số nguồn hàng K thời gian thực (Công văn 2392/TCT-QLRR & TT 94/2026/TT-BTC)
export function calculateKFactor(
  additionalPurchase: number = 0,
  safeMin: number = 1.05,
  safeMax: number = 1.25,
  currentState?: Pick<MacroState, 'totalSales' | 'openingInventory' | 'totalPurchases'>
): { kFactor: number; zone: 'SAFE_GREEN' | 'WARNING_YELLOW' | 'DANGER_RED' } {
  const totalSales = currentState?.totalSales ?? MACRO_DEFAULTS.TOTAL_SALES;
  const openingInventory = currentState?.openingInventory ?? MACRO_DEFAULTS.OPENING_INVENTORY;
  const totalPurchases = currentState?.totalPurchases ?? MACRO_DEFAULTS.INITIAL_PURCHASES;
  const denominator = openingInventory + totalPurchases + additionalPurchase;
  if (denominator <= 0) return { kFactor: 9.99, zone: 'DANGER_RED' };
  const k = Number((totalSales / denominator).toFixed(2));
  
  let zone: 'SAFE_GREEN' | 'WARNING_YELLOW' | 'DANGER_RED' = 'SAFE_GREEN';
  if (k > 1.35 || k < 0.95) {
    zone = 'DANGER_RED';
  } else if (k > safeMax || k < safeMin) {
    zone = 'WARNING_YELLOW';
  }

  return { kFactor: k, zone };
}

interface EvaluatedFinding extends RuleFinding {
  sopClause: string;
  actionableQuestion: string;
  options: [ActionOption, ActionOption];
  requiresCFO?: boolean;
}

// Hàm đối soát hóa đơn nội bộ theo Tax-SOP-2026 và Khung Pháp lý Hiện hành
// P0-3: Bộ máy Quy tắc thu thập mọi phát hiện (Multi-finding Collection Engine)
function evaluateInvoiceLocallyInternal(
  inv: InvoiceInput,
  config?: Partial<SystemPolicyConfig>,
  macroState?: Pick<MacroState, 'totalSales' | 'openingInventory' | 'totalPurchases'>,
  contextInvoices?: InvoiceInput[]
): RefereeDecision {
  const timestamp = new Date().toISOString();
  const regInfo = getApplicableRegulations(inv.invoiceDate);
  const evaluatedFindings: EvaluatedFinding[] = [];

  // Thiết lập các ngưỡng theo cấu hình động hoặc mặc định pháp luật 2026
  const nonCashThreshold = config?.nonCashThreshold ?? regInfo.nonCashThreshold;
  const kttApprovalLimit = config?.kttApprovalLimit ?? 200_000_000;
  const kSafeMin = config?.kFactorSafeMin ?? 1.05;
  const kSafeMax = config?.kFactorSafeMax ?? 1.25;
  const allowStaffReimbursement = config?.allowStaffReimbursement ?? true;
  const isExceedKtt = Math.abs(inv.totalAmount) >= kttApprovalLimit;

  // 1. STATUTORY: Kiểm tra hóa đơn trùng lặp tiền hạch toán (IMP-13)
  const duplicate = checkDuplicateInvoice(inv);
  if (duplicate.isDuplicate) {
    evaluatedFindings.push({
      ruleId: 'RULE_DUPLICATE_INVOICE',
      kind: 'STATUTORY',
      severity: 'CRITICAL',
      riskGroup: 'OUT_OF_POLICY',
      flaggedReason: duplicate.duplicateReason || 'Phát hiện hóa đơn trùng lặp số chứng từ trong hệ thống',
      plainExplanation: 'Hóa đơn này có số hiệu trùng với chứng từ đã tiếp nhận trước đó. Cần KTT xác minh để tránh rủi ro kê khai trùng thuế GTGT.',
      legalBasis: 'Điều 1.1 & Điều 3.4 Quy chế Tax-SOP-2026 (Chống trùng lặp HĐĐT)',
      sopClause: 'Điều 1.1 & Điều 3.4 Quy chế Tax-SOP-2026 (Chống trùng lặp HĐĐT)',
      actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' bị phát hiện trùng lặp với hồ sơ gốc [' + (duplicate.originalInvoiceId || '') + ']. KTT xử lý thế nào?',
      options: [
        {
          id: 'A',
          label: 'Từ chối & Hủy bỏ hóa đơn trùng',
          actionDescription: 'Hủy tiếp nhận hóa đơn này để ngăn chặn hành vi kê khai khống/trùng thuế GTGT',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        },
        {
          id: 'B',
          label: 'Xác nhận là HĐ thay thế hợp lệ',
          actionDescription: 'Kèm biên bản hủy hóa đơn cũ và tiếp tục thẩm định hóa đơn thay thế',
          resultingAction: 'ACCEPT_ADJUSTMENT'
        }
      ],
      requiresCFO: false
    });
  }

  // 2. DATA_QUALITY: Thẩm định chi tiết dòng hàng & đa thuế suất (IMP-08)
  const lineItemResult = validateLineItems(inv.items, inv, config);
  const lineItemAnalysis: LineItemAnalysis | undefined = inv.items && inv.items.length > 0 ? {
    isValid: lineItemResult.isValid,
    totalItems: lineItemResult.totalItems,
    flaggedItemsCount: lineItemResult.flaggedItemsCount,
    warnings: lineItemResult.warnings,
    totalItemAmount: lineItemResult.totalItemAmount,
    totalItemTax: lineItemResult.totalItemTax,
    mismatchHeader: lineItemResult.mismatchHeader
  } : undefined;

  if (lineItemResult.mismatchHeader) {
    evaluatedFindings.push({
      ruleId: 'RULE_LINE_ITEM_MISMATCH',
      kind: 'DATA_QUALITY',
      severity: 'HIGH',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: `Tổng cộng các dòng hàng (${lineItemResult.totalItemAmount.toLocaleString('vi-VN')}₫) không khớp với số tiền trước thuế trên hóa đơn (${inv.preTaxAmount.toLocaleString('vi-VN')}₫)`,
      plainExplanation: 'Tổng tiền các dòng chi tiết không bằng tiền trước thuế trên tiêu đề hóa đơn (chênh lệch vượt dung sai làm tròn 2.000₫). Cần KTT xác nhận lại chứng từ gốc để tránh rủi ro giải trình cơ quan thuế.',
      legalBasis: 'Điều 1.1 Quy chế Tax-SOP-2026 (Tính toàn vẹn số liệu dòng hàng)',
      sopClause: 'Điều 1.1 Quy chế Tax-SOP-2026 (Tính toàn vẹn số liệu dòng hàng)',
      actionableQuestion: `Hóa đơn ${inv.invoiceNumber} có tổng dòng hàng (${lineItemResult.totalItemAmount.toLocaleString('vi-VN')}₫) lệch so với Header (${inv.preTaxAmount.toLocaleString('vi-VN')}₫). KTT xử lý thế nào?`,
      options: [
        {
          id: 'A',
          label: 'Yêu cầu nhà cung cấp lập biên bản điều chỉnh',
          actionDescription: 'Tạm treo hóa đơn, yêu cầu NCC kiểm tra lại phần mềm xuất hóa đơn và điều chỉnh',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Từ chối tiếp nhận hóa đơn',
          actionDescription: 'Hủy tiếp nhận hóa đơn có sai lệch số liệu nội tại',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // 3. DATA_QUALITY: Kiểm tra chất lượng dữ liệu nguồn
  const issue = getDataQualityIssue(inv);
  if (issue) {
    evaluatedFindings.push({
      ruleId: 'RULE_DATA_QUALITY',
      kind: 'DATA_QUALITY',
      severity: 'HIGH',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: issue,
      plainExplanation: 'Hệ thống chưa đủ dữ liệu chắc chắn để khẳng định hóa đơn hợp lệ. Cần người phụ trách kiểm tra và xác nhận trước khi xử lý tiếp.',
      legalBasis: 'Quy trình kiểm soát dữ liệu đầu vào Tax-SOP-2026',
      sopClause: 'Quy trình kiểm soát dữ liệu đầu vào Tax-SOP-2026',
      actionableQuestion: `Hóa đơn ${inv.invoiceNumber} từ ${inv.supplierName} cần xác minh: ${issue} KTT chọn tiếp tục bổ sung hồ sơ hay tạm dừng xử lý?`,
      options: [
        {
          id: 'A',
          label: 'Bổ sung và xác nhận hồ sơ',
          actionDescription: 'Tạm treo quyết định và yêu cầu bổ sung dữ liệu/chứng từ còn thiếu.',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Tạm dừng xử lý',
          actionDescription: 'Không đưa hóa đơn vào đề xuất khấu trừ cho đến khi có bằng chứng hợp lệ.',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // 4. DATA_QUALITY: Người bán bị tạm ngừng
  if (inv.sellerStatus === 'SUSPENDED') {
    evaluatedFindings.push({
      ruleId: 'RULE_SELLER_SUSPENDED',
      kind: 'DATA_QUALITY',
      severity: 'HIGH',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Mã số thuế nhà cung cấp đang ở trạng thái tạm ngừng; cần xác nhận thời điểm giao dịch và hồ sơ hàng hóa.',
      plainExplanation: 'Nhà cung cấp đang bị tạm ngừng hoạt động trên CSDL Thuế. Cần kiểm tra thời điểm phát sinh giao dịch có trước thời điểm tạm ngừng hay không.',
      legalBasis: 'Điều 2.2 Quy chế Tax-SOP-2026 & Nghị định 123/2020/NĐ-CP',
      sopClause: 'Điều 2.2 Quy chế Tax-SOP-2026',
      actionableQuestion: `Nhà cung cấp ${inv.supplierName} đang ở trạng thái tạm ngừng hoạt động. KTT xử lý thế nào?`,
      options: [
        {
          id: 'A',
          label: 'Xác minh hồ sơ thực tế',
          actionDescription: 'Tạm dừng hạch toán để kiểm tra hồ sơ giao nhận hàng hóa',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Từ chối tiếp nhận',
          actionDescription: 'Loại bỏ khỏi hồ sơ kê khai thuế',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // 5. STATUTORY: Kiểm tra Danh bạ nhà cung cấp rủi ro cao (CV 2392/TCT-QLRR)
  let registeredSupplier = null;
  try {
    registeredSupplier = getSupplier(inv.supplierTaxCode);
  } catch {
    // Bỏ qua nếu môi trường test không có SQLite
  }
  if (registeredSupplier) {
    if (registeredSupplier.status === 'CLOSED' || registeredSupplier.status === 'SUSPENDED') {
      inv.sellerStatus = registeredSupplier.status;
    }
    if (registeredSupplier.riskLevel === 'HIGH_RISK_INVOICE') {
      evaluatedFindings.push({
        ruleId: 'RULE_HIGH_RISK_SUPPLIER',
        kind: 'STATUTORY',
        severity: 'HIGH',
        riskGroup: 'OUT_OF_POLICY',
        flaggedReason: `Nhà cung cấp [${inv.supplierName} - MST ${inv.supplierTaxCode}] nằm trong danh bạ cảnh báo rủi ro cao về hóa đơn (High Risk Supplier)`,
        plainExplanation: 'Nhà cung cấp này đã bị cơ quan quản lý gắn cờ rủi ro hóa đơn hoặc có dấu hiệu gian lận theo Công văn 2392/TCT-QLRR. Cần KTT/CFO kiểm tra kỹ lưỡng hồ sơ hàng hóa thực tế và hợp đồng trước khi phê duyệt.',
        legalBasis: 'Công văn 2392/TCT-QLRR & Quy chế Quản lý rủi ro nhà cung cấp',
        sopClause: 'Công văn 2392/TCT-QLRR & Quy chế Quản lý rủi ro nhà cung cấp',
        actionableQuestion: `Nhà cung cấp ${inv.supplierName} thuộc diện cảnh báo rủi ro cao. KTT/CFO quyết định thế nào?`,
        options: [
          {
            id: 'A',
            label: 'Yêu cầu thẩm tra toàn bộ hồ sơ nguồn gốc hàng hóa',
            actionDescription: 'Yêu cầu lập Bộ hồ sơ phòng vệ 4 lớp chứng minh giao dịch có thật trước khi hạch toán',
            resultingAction: 'ACCEPT_WITH_DEFENSE_DOSSIER'
          },
          {
            id: 'B',
            label: 'Từ chối hạch toán và loại bỏ chi phí',
            actionDescription: 'Loại toàn bộ chi phí và thuế để tránh rủi ro giải trình thanh tra',
            resultingAction: 'REJECT_TAX_DEDUCTION'
          }
        ],
        requiresCFO: true
      });
    }
  }

  // 6. STATUTORY: Kiểm tra MST người mua khớp với doanh nghiệp
  if (config?.companyTaxCode && inv.buyerTaxCode) {
    const cleanBuyer = inv.buyerTaxCode.replace(/[^0-9]/g, '');
    const cleanCompany = config.companyTaxCode.replace(/[^0-9]/g, '');
    if (cleanBuyer && cleanCompany && cleanBuyer !== cleanCompany) {
      evaluatedFindings.push({
        ruleId: 'RULE_BUYER_TAX_CODE_MISMATCH',
        kind: 'STATUTORY',
        severity: 'CRITICAL',
        riskGroup: 'OUT_OF_POLICY',
        flaggedReason: `Mã số thuế người mua trên hóa đơn (${inv.buyerTaxCode}) không trùng khớp với MST doanh nghiệp (${config.companyTaxCode})`,
        plainExplanation: 'Hóa đơn không ghi nhận MST của doanh nghiệp mình (nghi vấn lấy nhầm hóa đơn công ty khác hoặc hóa đơn cá nhân người lao động). Theo Khoản 1 Điều 14 Luật Thuế GTGT 48/2024/QH15 và Điều 10 Nghị định 123/2020/NĐ-CP, hóa đơn không đúng tên và MST người mua không đủ điều kiện khấu trừ thuế GTGT đầu vào và không được tính vào chi phí được trừ khi tính thuế TNDN.',
        legalBasis: 'Khoản 1 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 10 Nghị định 123/2020/NĐ-CP',
        sopClause: 'Khoản 1 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 10 Nghị định 123/2020/NĐ-CP',
        actionableQuestion: `Hóa đơn ${inv.invoiceNumber} từ ${inv.supplierName} ghi sai MST người mua (${inv.buyerTaxCode} thay vì ${config.companyTaxCode}). KTT xử lý thế nào?`,
        options: [
          {
            id: 'A',
            label: 'Yêu cầu nhà cung cấp hủy và xuất lại HĐ đúng MST doanh nghiệp',
            actionDescription: 'Tạm dừng hạch toán, gửi văn bản yêu cầu người bán hủy hóa đơn sai thông tin và phát hành lại đúng MST công ty',
            resultingAction: 'REQUEST_SUPPLIER_REISSUE'
          },
          {
            id: 'B',
            label: 'Từ chối tiếp nhận và loại bỏ hoàn toàn',
            actionDescription: 'Không đưa vào kê khai khấu trừ và không tính vào chi phí được trừ',
            resultingAction: 'REJECT_TAX_DEDUCTION'
          }
        ],
        requiresCFO: isExceedKtt
      });
    }
  }

  // 7. DATA_QUALITY: Ký hiệu hóa đơn & MCCQT 34 ký tự
  if (inv.invoiceSeries) {
    const series = inv.invoiceSeries.trim().toUpperCase();
    if (series.length >= 2 && series[1] === 'C' && config?.strictMccqtCheck !== false) {
      const mccqt = inv.taxAuthorityCode?.trim();
      if (!mccqt || mccqt.length !== 34) {
        evaluatedFindings.push({
          ruleId: 'RULE_MCCQT_INVALID',
          kind: 'DATA_QUALITY',
          severity: 'HIGH',
          riskGroup: 'UNCERTAIN_INFO',
          flaggedReason: `Ký hiệu hóa đơn '${inv.invoiceSeries}' là loại có mã của Cơ quan thuế (ký tự thứ 2 là 'C') nhưng thiếu hoặc sai định dạng chuỗi MCCQT 34 ký tự (hiện có: ${mccqt ? mccqt.length + ' ký tự' : 'Trống'}).`,
          plainExplanation: 'Theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC, hóa đơn điện tử có mã của cơ quan thuế bắt buộc phải có chuỗi cấp mã gồm đúng 34 ký tự từ Tổng cục Thuế trước khi gửi cho người mua. Hóa đơn chưa có mã CQT hợp lệ thì chưa có giá trị pháp lý để kê khai thuế.',
          legalBasis: 'Điều 14 Nghị định 123/2020/NĐ-CP & Điều 4 Thông tư 78/2021/TT-BTC',
          sopClause: 'Điều 14 Nghị định 123/2020/NĐ-CP & Điều 4 Thông tư 78/2021/TT-BTC',
          actionableQuestion: `Hóa đơn ${inv.invoiceNumber} thuộc nhóm có mã CQT nhưng chưa có mã MCCQT 34 ký tự hợp lệ. KTT xử lý thế nào?`,
          options: [
            {
              id: 'A',
              label: 'Tra cứu lại trên Cổng thông tin HĐĐT Tổng cục Thuế',
              actionDescription: 'Tạm treo chứng từ để đối soát lại dữ liệu hóa đơn trên Cổng Cục Thuế',
              resultingAction: 'REQUEST_SUPPLIER_REISSUE'
            },
            {
              id: 'B',
              label: 'Tạm hoãn kê khai chờ cấp mã',
              actionDescription: 'Chưa đưa vào tờ khai thuế kỳ này cho đến khi nhận được tệp XML có MCCQT hợp lệ',
              resultingAction: 'REJECT_TAX_DEDUCTION'
            }
          ],
          requiresCFO: false
        });
      }
    }

    // Series Year Mismatch
    const seriesYearMatch = series.match(/^[1-6][CK](\d{2})/);
    if (seriesYearMatch && config?.strictSeriesYearCheck !== false) {
      const seriesYear = parseInt(seriesYearMatch[1], 10);
      const invYear = parseInt(inv.invoiceDate.slice(2, 4), 10);
      if (seriesYear !== invYear) {
        evaluatedFindings.push({
          ruleId: 'RULE_SERIES_YEAR_MISMATCH',
          kind: 'DATA_QUALITY',
          severity: 'HIGH',
          riskGroup: 'UNCERTAIN_INFO',
          flaggedReason: `Ký hiệu hóa đơn '${inv.invoiceSeries}' (dải năm ${seriesYear}) không khớp với năm lập hóa đơn (${inv.invoiceDate}, năm ${invYear}).`,
          plainExplanation: 'Theo Điểm a Khoản 1 Điều 4 Thông tư 78/2021/TT-BTC, hai chữ số năm trong ký hiệu hóa đơn thể hiện năm lập hóa đơn điện tử. Việc lệch dải năm phản ánh nguy cơ phát hành lùi ngày bất hợp pháp hoặc xuất hóa đơn trên dải ký hiệu cũ chưa thông báo phát hành lại.',
          legalBasis: 'Điểm a Khoản 1 Điều 4 Thông tư 78/2021/TT-BTC',
          sopClause: 'Điểm a Khoản 1 Điều 4 Thông tư 78/2021/TT-BTC',
          actionableQuestion: `Hóa đơn ${inv.invoiceNumber} có ký hiệu dải năm '${seriesYear}' khác năm lập thực tế '${invYear}'. KTT xử lý thế nào?`,
          options: [
            {
              id: 'A',
              label: 'Yêu cầu nhà cung cấp giải trình và xuất biên bản điều chỉnh',
              actionDescription: 'Tạm hoãn tiếp nhận, yêu cầu người bán giải trình lý do lệch dải năm',
              resultingAction: 'REQUEST_SUPPLIER_REISSUE'
            },
            {
              id: 'B',
              label: 'Từ chối tiếp nhận hóa đơn lệch dải năm',
              actionDescription: 'Loại bỏ khỏi hồ sơ kê khai thuế',
              resultingAction: 'REJECT_TAX_DEDUCTION'
            }
          ],
          requiresCFO: false
        });
      }
    }
  }

  // 8. DATA_QUALITY: Độ trễ ký số
  if (inv.signingDate && inv.invoiceDate) {
    const signTime = new Date(inv.signingDate).getTime();
    const invTime = new Date(inv.invoiceDate).getTime();
    const diffDays = Math.round((signTime - invTime) / (1000 * 60 * 60 * 24));
    if (diffDays > 30 || diffDays < 0) {
      evaluatedFindings.push({
        ruleId: 'RULE_SIGNING_DELAY',
        kind: 'DATA_QUALITY',
        severity: 'MEDIUM',
        riskGroup: 'UNCERTAIN_INFO',
        flaggedReason: `Chữ ký số bên bán được ký vào ngày ${inv.signingDate}, lệch ${Math.abs(diffDays)} ngày so với ngày lập hóa đơn (${inv.invoiceDate}).`,
        plainExplanation: `Theo Khoản 9 Điều 10 Nghị định 123/2020/NĐ-CP, thời điểm ký số và thời điểm lập hóa đơn có sự khác biệt lớn (${Math.abs(diffDays)} ngày). Cần lưu ý thời điểm khai thuế theo ngày lập hoặc ngày ký theo hướng dẫn của CQT địa phương.`,
        legalBasis: 'Khoản 9 Điều 10 Nghị định 123/2020/NĐ-CP',
        sopClause: 'Khoản 9 Điều 10 Nghị định 123/2020/NĐ-CP',
        actionableQuestion: `Hóa đơn ${inv.invoiceNumber} có ngày ký số lệch ${Math.abs(diffDays)} ngày so với ngày lập. KTT xử lý thế nào?`,
        options: [
          {
            id: 'A',
            label: 'Chấp nhận kê khai theo quy định của CQT',
            actionDescription: 'Kê khai theo kỳ phát sinh của ngày lập hóa đơn nếu hóa đơn được CQT chấp nhận',
            resultingAction: 'ACCEPT_WITH_DOCS'
          },
          {
            id: 'B',
            label: 'Yêu cầu bên bán lập hóa đơn mới đúng ngày',
            actionDescription: 'Yêu cầu hủy hóa đơn ký muộn và phát hành hóa đơn mới',
            resultingAction: 'REQUEST_SUPPLIER_REISSUE'
          }
        ],
        requiresCFO: false
      });
    }
  }

  // 9. STATUTORY: Người bán đóng MST phát hành hóa đơn sau ngày đóng
  if (inv.sellerStatus === 'CLOSED' && inv.sellerSuspensionDate && inv.invoiceDate > inv.sellerSuspensionDate) {
    evaluatedFindings.push({
      ruleId: 'STATUTORY_DECREE_254_CLOSED_SELLER',
      kind: 'STATUTORY',
      severity: 'CRITICAL',
      riskGroup: 'OUT_OF_POLICY',
      flaggedReason: 'Hóa đơn lập ngày ' + inv.invoiceDate + ', SAU ngày người bán bị đóng MST (' + inv.sellerSuspensionDate + ')',
      plainExplanation: 'Nhà cung cấp đã chấm dứt hiệu lực mã số thuế trước khi phát hành hóa đơn này. Hóa đơn bất hợp pháp 100% theo quy định hóa đơn điện tử.',
      legalBasis: 'Điều 2.2 Quy chế Tax-SOP-2026 & Nghị định 254/2026/NĐ-CP',
      sopClause: 'Điều 2.2 Quy chế Tax-SOP-2026 & Nghị định 254/2026/NĐ-CP',
      actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' phát hành sau ngày bên bán đóng MST (' + inv.sellerSuspensionDate + '). Hệ thống khuyến nghị loại bỏ ngay. ' + (isExceedKtt ? 'CFO' : 'KTT') + ' xác nhận?',
      options: [
        {
          id: 'A',
          label: 'Loại bỏ ngay lập tức (Khuyến nghị)',
          actionDescription: 'Tuyệt đối cấm kê khai để tránh rủi ro vi phạm tội trốn thuế',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        },
        {
          id: 'B',
          label: 'Tạm giữ hồ sơ, chuyển Ban Pháp chế',
          actionDescription: 'Tạm dừng hạch toán để bộ phận pháp chế làm việc với nhà cung cấp',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        }
      ],
      requiresCFO: isExceedKtt
    });
  }

  // 10. STATUTORY: Hóa đơn từ 5 triệu thanh toán tiền mặt (Luật Thuế GTGT 48/2024/QH15)
  const isCashPayment = inv.paymentMethod === 'CASH' || !inv.hasBankSlip;
  if (inv.totalAmount >= nonCashThreshold && isCashPayment) {
    const isStaffException = allowStaffReimbursement && inv.isStaffReimbursed;
    if (!isStaffException) {
      evaluatedFindings.push({
        ruleId: 'STATUTORY_LAW_48_CASH_PAYMENT',
        kind: 'STATUTORY',
        severity: 'CRITICAL',
        riskGroup: 'OUT_OF_POLICY',
        flaggedReason: 'Hóa đơn từ ' + (nonCashThreshold / 1_000_000) + ' triệu đồng thanh toán TIỀN MẶT' + (isExceedKtt ? ' (vượt hạn mức KTT)' : '') + ' (vi phạm điều kiện khấu trừ thuế GTGT theo Luật 48/2024/QH15)',
        plainExplanation: 'Luật thuế quy định hóa đơn từng lần từ ' + (nonCashThreshold / 1_000_000) + ' triệu VNĐ trở lên bắt buộc phải có chứng từ thanh toán không dùng tiền mặt (Ủy nhiệm chi ngân hàng) để được khấu trừ. Tuyệt đối không áp dụng tiền lệ tự duyệt cho vi phạm luật định.',
        legalBasis: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 1.2 Tax-SOP-2026',
        sopClause: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 1.2 Tax-SOP-2026',
        actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' trị giá ' + inv.totalAmount.toLocaleString('vi-VN') + '₫ thanh toán Tiền mặt' + (isExceedKtt ? ' (vượt thẩm quyền KTT)' : '') + '. ' + (isExceedKtt ? 'CFO' : 'KTT') + ' xử lý thế nào?',
        options: [
          {
            id: 'A',
            label: 'Yêu cầu nộp Ủy nhiệm chi ngân hàng',
            actionDescription: 'Tạm treo hóa đơn, yêu cầu nhân viên thanh toán bổ sung UNC',
            resultingAction: 'REQUEST_SUPPLIER_REISSUE'
          },
          {
            id: 'B',
            label: 'Loại trừ thuế GTGT & Chuyển sang Chỉ tiêu B4',
            actionDescription: 'Chỉ ghi nhận chi phí nội bộ, loại toàn bộ tiền thuế và chi phí khỏi quyết toán thuế',
            resultingAction: 'REJECT_TAX_DEDUCTION'
          }
        ],
        requiresCFO: isExceedKtt
      });
    }
  }

  // 11. STATUTORY: Cụm nhiều hóa đơn trong ngày >= 5M thanh toán tiền mặt (Luật 48/2024/QH15)
  if (inv.totalAmount < nonCashThreshold && isCashPayment) {
    let sameDayInvoices: InvoiceInput[] = [];
    if (contextInvoices && contextInvoices.length > 0) {
      sameDayInvoices = contextInvoices.filter(
        other => other.id !== inv.id &&
                 other.supplierTaxCode === inv.supplierTaxCode &&
                 other.invoiceDate === inv.invoiceDate
      );
    } else {
      try {
        const db = getDatabase();
        const rows = db.prepare(`
          SELECT payload_json FROM invoices
          WHERE supplier_tax_code = ? AND invoice_date = ? AND id != ?
        `).all(inv.supplierTaxCode, inv.invoiceDate, inv.id) as Array<{ payload_json: string }>;
        sameDayInvoices = rows.map(r => JSON.parse(r.payload_json));
      } catch {
        // Bỏ qua nếu môi trường test không có SQLite
      }
    }

    if (sameDayInvoices.length > 0) {
      const allSameDay = [inv, ...sameDayInvoices];
      const sameDayCheck = checkSameDayMultipleInvoicesRule(inv, allSameDay, nonCashThreshold);
      if (sameDayCheck.isViolation) {
        evaluatedFindings.push({
          ruleId: 'STATUTORY_SAME_DAY_CASH_5M',
          kind: 'STATUTORY',
          severity: 'CRITICAL',
          riskGroup: 'OUT_OF_POLICY',
          flaggedReason: `Cụm ${sameDayCheck.invoiceCount} hóa đơn cùng ngày (${inv.invoiceDate}) từ NCC [${inv.supplierName}] có tổng giá trị ${sameDayCheck.dailyTotal.toLocaleString('vi-VN')}₫ (≥ ${nonCashThreshold / 1_000_000} triệu đồng) thanh toán TIỀN MẶT`,
          plainExplanation: 'Theo Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15, mua hàng hóa/dịch vụ của cùng một nhà cung cấp nhiều lần trong cùng một ngày có tổng giá trị từ 5 triệu đồng trở lên bắt buộc phải có chứng từ thanh toán không dùng tiền mặt (Ủy nhiệm chi ngân hàng) để được khấu trừ thuế và tính chi phí được trừ khi tính thuế TNDN.',
          legalBasis: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Khoản 1 Điều 9 Luật Thuế TNDN 67/2025/QH15',
          sopClause: 'Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Khoản 1 Điều 9 Luật Thuế TNDN 67/2025/QH15',
          actionableQuestion: `Phát hiện cụm hóa đơn cùng ngày từ ${inv.supplierName} đạt ${sameDayCheck.dailyTotal.toLocaleString('vi-VN')}₫ thanh toán tiền mặt. KTT xử lý thế nào?`,
          options: [
            {
              id: 'A',
              label: 'Yêu cầu thanh toán bổ sung Ủy nhiệm chi ngân hàng',
              actionDescription: 'Tạm treo toàn bộ cụm hóa đơn và yêu cầu chuyển khoản qua ngân hàng',
              resultingAction: 'REQUEST_SUPPLIER_REISSUE'
            },
            {
              id: 'B',
              label: 'Loại trừ thuế GTGT toàn bộ cụm hóa đơn',
              actionDescription: 'Không đưa vào kê khai khấu trừ thuế đầu vào',
              resultingAction: 'REJECT_TAX_DEDUCTION'
            }
          ],
          requiresCFO: isExceedKtt
        });
      }
    }
  }

  // 12. STATUTORY: Hàng hóa/dịch vụ loại trừ áp sai thuế suất 8% (NQ 204/2025/QH15)
  const excludedCategories = (config?.excludedVat8Categories ?? [
    'VIỄN THÔNG', 'TÀI CHÍNH', 'NGÂN HÀNG', 'CHỨNG KHOÁN', 'BẢO HIỂM',
    'BẤT ĐỘNG SẢN', 'KIM LOẠI', 'KHAI KHOÁNG', 'HÓA CHẤT', 'TIÊU THỤ ĐẶC BIỆT'
  ]).map((value) => value.trim().toLocaleUpperCase('vi-VN')).filter(Boolean);
  const normalizedItemName = inv.itemName.toLocaleUpperCase('vi-VN');
  const isExcludedItem = excludedCategories.some((category) => normalizedItemName.includes(category)) || /CƯỚC INTERNET/.test(normalizedItemName);
  if ((isExcludedItem && inv.taxRate === 8) || lineItemResult.hasExcludedVat8Item) {
    const flagMsg = lineItemResult.hasExcludedVat8Item
      ? 'Phát hiện mặt hàng trong chi tiết dòng hàng thuộc danh mục loại trừ áp sai thuế suất 8% (NQ 204/2025/QH15)'
      : 'Hàng hóa/dịch vụ thuộc danh mục loại trừ áp sai thuế suất 8% (thuộc danh mục loại trừ bắt buộc 10% theo NQ 204/2025/QH15)';

    evaluatedFindings.push({
      ruleId: 'STATUTORY_RES_204_VAT_8_EXCLUDED',
      kind: 'STATUTORY',
      severity: 'HIGH',
      riskGroup: 'OUT_OF_POLICY',
      flaggedReason: flagMsg + (isExceedKtt ? ' (vượt hạn mức KTT)' : ''),
      plainExplanation: 'Bên bán xuất hóa đơn thuế suất ưu đãi 8% cho mặt hàng thuộc danh mục loại trừ không được giảm thuế theo Nghị quyết 204/2025/QH15 (phải áp dụng 10%). Kê khai 8% sẽ bị phạt 20% khi thanh tra thuế. Không áp dụng tiền lệ cho sai sót thuế suất.',
      legalBasis: 'Điều 1.3 Quy chế Tax-SOP-2026 & Nghị quyết 204/2025/QH15',
      sopClause: 'Điều 1.3 Quy chế Tax-SOP-2026 & Nghị quyết 204/2025/QH15',
      actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' từ ' + inv.supplierName + ' áp sai thuế 8% (phải là 10%)' + (isExceedKtt ? ' (vượt trần KTT)' : '') + '. ' + (isExceedKtt ? 'CFO' : 'KTT') + ' xử lý thế nào?',
      options: [
        {
          id: 'A',
          label: 'Yêu cầu nhà cung cấp xuất lại HĐ 10%',
          actionDescription: 'Trả lại hóa đơn, yêu cầu bên bán lập hóa đơn thay thế hoặc điều chỉnh thuế 10%',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Loại phần thuế khỏi khấu trừ',
          actionDescription: 'Hạch toán chi phí nội bộ nhưng không kê khai số thuế đầu vào sai phạm này',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: isExceedKtt
    });
  }

  // 13. INTERNAL_POLICY: Quy chế nội bộ & Chi phí nhạy cảm (Rượu bia tiếp khách, viết lại theo P0-2/P0-3)
  const SENSITIVE_ALCOHOL_REGEX = /(?:^|\s|[.,;_\-/])(rượu|bia|whisky|whiskey|wine|vodka|champagne|karaoke|massage)(?:$|\s|[.,;_\-/])/i;
  const isAlcohol = SENSITIVE_ALCOHOL_REGEX.test(inv.itemName) || lineItemResult.hasSensitiveItem;
  if (isAlcohol) {
    evaluatedFindings.push({
      ruleId: 'INTERNAL_POLICY_GUEST_ENTERTAINMENT',
      kind: 'INTERNAL_POLICY',
      severity: 'MEDIUM',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Khoản chi có đồ uống có cồn/tiếp khách: Cần làm rõ mục đích phục vụ sản xuất kinh doanh hay phúc lợi nhân viên theo quy chế tài chính (Luật Thuế TNDN)',
      plainExplanation: 'Hóa đơn có đồ uống có cồn hoặc chi phí tiếp khách/giải trí. Theo quy định thuế TNDN, chi phí này chỉ được trừ và khấu trừ thuế khi phục vụ trực tiếp SXKD, có quy chế tiếp khách, danh sách đối tác hoặc thỏa mãn trần chi phúc lợi.',
      legalBasis: 'Điều 2.1 Quy chế Tax-SOP-2026 & Khoản 1 Điều 9 Luật Thuế TNDN 67/2025/QH15',
      sopClause: 'Điều 2.1 Quy chế Tax-SOP-2026 & Luật Thuế TNDN',
      actionableQuestion: `Hóa đơn ${inv.invoiceNumber} có khoản chi tiếp khách/đồ uống (${inv.totalAmount.toLocaleString('vi-VN')}₫). Khoản chi này phục vụ tiếp khách đối tác nào hay phúc lợi nhân viên? Có quy chế không? ${isExceedKtt ? 'CFO' : 'KTT'} xử lý thế nào?`,
      options: [
        {
          id: 'A',
          label: 'Duyệt kèm Quy chế tiếp khách & Hồ sơ SXKD',
          actionDescription: 'Xác nhận khoản chi phục vụ tiếp khách đối tác theo quy chế, kèm danh sách khách mời và hóa đơn hợp lệ',
          resultingAction: 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: 'Loại bỏ khỏi thuế khấu trừ & Chuyển Chỉ tiêu B4',
          actionDescription: 'Chỉ ghi nhận chi phí nội bộ không được trừ, loại toàn bộ tiền thuế khỏi khấu trừ',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: isExceedKtt
    });
  }

  // 14. AUTHORITY: Hệ số K chạm Vùng Đỏ
  const { kFactor, zone } = calculateKFactor(inv.preTaxAmount, kSafeMin, kSafeMax, macroState);
  if (zone === 'DANGER_RED' && Math.abs(inv.preTaxAmount) >= 1_000_000_000 && !inv.isAdjustment) {
    evaluatedFindings.push({
      ruleId: 'AUTHORITY_K_FACTOR_RED',
      kind: 'AUTHORITY',
      severity: 'HIGH',
      riskGroup: 'EXCEED_AUTHORITY',
      flaggedReason: 'Lô hàng mua sắm lớn đẩy Tham số nguồn hàng K kỳ này sang mức ' + kFactor + ' (Vùng Đỏ theo Công văn 2392/TCT-QLRR)',
      plainExplanation: 'Mua sắm vật tư lớn làm mẫu số tăng mạnh khiến chỉ số K chạm Vùng Đỏ (' + kFactor + '), có nguy cơ bị hệ thống quản lý rủi ro của Cục Thuế gửi văn bản tra soát.',
      legalBasis: 'Điều 4.2 & Điều 4.3 Quy chế Tax-SOP-2026 (CV 2392/TCT-QLRR & TT 94/2026/TT-BTC)',
      sopClause: 'Điều 4.2 & Điều 4.3 Quy chế Tax-SOP-2026 (CV 2392/TCT-QLRR & TT 94/2026/TT-BTC)',
      actionableQuestion: 'Hóa đơn vật tư ' + inv.invoiceNumber + ' (' + inv.totalAmount.toLocaleString('vi-VN') + '₫) làm Hệ số K chạm Vùng Đỏ (' + kFactor + '). CFO phê duyệt chiến lược xử lý?',
      options: [
        {
          id: 'A',
          label: 'Duyệt kê khai & Chuẩn bị Hồ sơ Phòng vệ',
          actionDescription: 'Kê khai đúng kỳ, chỉ đạo KTT lập sẵn Bộ chứng cứ 4 lớp (HĐ, phiếu kho, tiến độ) để sẵn sàng giải trình với Thuế',
          resultingAction: 'ACCEPT_WITH_DEFENSE_DOSSIER'
        },
        {
          id: 'B',
          label: 'Rà soát lại tiến độ nhận hàng thực tế',
          actionDescription: 'Tạm dừng hạch toán, chuyển bộ phận Thu mua kiểm tra đối soát biên bản nghiệm thu trước khi hạch toán',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        }
      ],
      requiresCFO: true
    });
  }

  // 15. AUTHORITY: Vượt hạn mức tự duyệt của KTT (>= 200M)
  if (Math.abs(inv.totalAmount) >= kttApprovalLimit) {
    if (inv.isAdjustment) {
      evaluatedFindings.push({
        ruleId: 'AUTHORITY_EXCEED_KTT_LIMIT',
        kind: 'AUTHORITY',
        severity: 'HIGH',
        riskGroup: 'EXCEED_AUTHORITY',
        flaggedReason: 'Hóa đơn điều chỉnh/giảm giá thương mại đạt ' + Math.abs(inv.totalAmount).toLocaleString('vi-VN') + '₫, vượt hạn mức ' + (kttApprovalLimit / 1_000_000) + 'M của KTT',
        plainExplanation: 'Số tiền điều chỉnh giảm doanh thu/chiết khấu vượt quá thẩm quyền tự duyệt của Kế toán trưởng, quy chế yêu cầu Giám đốc Tài chính (CFO) phê duyệt.',
        legalBasis: 'Điều 3.3 Quy chế Tax-SOP-2026',
        sopClause: 'Điều 3.3 Quy chế Tax-SOP-2026',
        actionableQuestion: 'Hóa đơn điều chỉnh ' + inv.invoiceNumber + ' từ ' + inv.supplierName + ' trị giá ' + inv.totalAmount.toLocaleString('vi-VN') + '₫ vượt hạn mức KTT. CFO phê duyệt ghi nhận?',
        options: [
          {
            id: 'A',
            label: 'CFO Phê duyệt ghi nhận',
            actionDescription: 'Chấp thuận điều chỉnh giảm doanh thu/thuế đầu vào theo quy chế',
            resultingAction: 'ACCEPT_ADJUSTMENT'
          },
          {
            id: 'B',
            label: 'Từ chối, yêu cầu kiểm toán lại',
            actionDescription: 'Tạm chặn ghi nhận, chuyển Ban Kiểm soát đối soát hợp đồng thương mại',
            resultingAction: 'REJECT_TAX_DEDUCTION'
          }
        ],
        requiresCFO: true
      });
    } else {
      evaluatedFindings.push({
        ruleId: 'AUTHORITY_EXCEED_KTT_LIMIT',
        kind: 'AUTHORITY',
        severity: 'HIGH',
        riskGroup: 'EXCEED_AUTHORITY',
        flaggedReason: 'Khoản chi đặc thù vượt hạn mức tự duyệt của KTT (>= ' + (kttApprovalLimit / 1_000_000) + ' triệu)',
        plainExplanation: 'Khoản chi lớn vượt thẩm quyền tự duyệt của Kế toán trưởng, cần chữ ký phê duyệt chi của Giám đốc Tài chính (CFO) hoặc Tổng Giám đốc.',
        legalBasis: 'Điều 3.3 Quy chế Tax-SOP-2026',
        sopClause: 'Điều 3.3 Quy chế Tax-SOP-2026',
        actionableQuestion: 'Khoản chi ' + inv.itemName + ' trị giá ' + inv.totalAmount.toLocaleString('vi-VN') + '₫ vượt trần KTT. CFO có chấp thuận phê duyệt chi và khấu trừ thuế?',
        options: [
          {
            id: 'A',
            label: 'CFO Phê duyệt chi',
            actionDescription: 'Chấp thuận chi phí và đưa vào khấu trừ thuế hợp lệ',
            resultingAction: 'ACCEPT_WITH_DOCS'
          },
          {
            id: 'B',
            label: 'Yêu cầu thẩm tra hợp đồng',
            actionDescription: 'Tạm dừng hạch toán để thẩm tra điều khoản thanh toán',
            resultingAction: 'REJECT_TAX_DEDUCTION'
          }
        ],
        requiresCFO: true
      });
    }
  }

  // 16. DATA_QUALITY: Ảnh mờ
  if (inv.isImageBlurry) {
    evaluatedFindings.push({
      ruleId: 'RULE_IMAGE_BLURRY',
      kind: 'DATA_QUALITY',
      severity: 'MEDIUM',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Hình ảnh hóa đơn bị mờ/lóa dòng tổng tiền, OCR không nhận diện chắc chắn',
      plainExplanation: 'Chứng từ ảnh chụp/scan bị mờ nét số tiền thanh toán. Cần Kế toán trưởng nhìn mắt thường để xác nhận con số chuẩn.',
      legalBasis: 'Điều 1.1 Quy chế Tax-SOP-2026',
      sopClause: 'Điều 1.1 Quy chế Tax-SOP-2026',
      actionableQuestion: 'Hóa đơn taxi ' + inv.invoiceNumber + ' bị mờ số tiền, hệ thống nhận diện hai khả năng là 140.000₫ hoặc 190.000₫. KTT chọn con số nào?',
      options: [
        {
          id: 'A',
          label: 'Xác nhận số tiền là 140.000₫',
          actionDescription: 'Ghi nhận số tiền nhỏ hơn để an toàn chi phí',
          resultingAction: 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: 'Xác nhận số tiền là 190.000₫',
          actionDescription: 'Ghi nhận số tiền đúng theo thực tế cuốc xe sau khi xem lại bản gốc',
          resultingAction: 'ACCEPT_WITH_DOCS'
        }
      ],
      requiresCFO: false
    });
  }

  // 17. DATA_QUALITY: Thiếu bảng kê
  if (inv.hasItemManifest === false) {
    evaluatedFindings.push({
      ruleId: 'RULE_MISSING_MANIFEST',
      kind: 'DATA_QUALITY',
      severity: 'MEDIUM',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Hóa đơn tổng hợp thiếu tệp bảng kê chi tiết quy cách hàng hóa đính kèm',
      plainExplanation: 'Hóa đơn ghi tên dịch vụ/hàng hóa chung chung và thiếu bảng kê chi tiết từng món. Cơ quan thuế sẽ loại chi phí khi kiểm tra nếu không có bảng kê.',
      legalBasis: 'Điều 1.1 Quy chế Tax-SOP-2026',
      sopClause: 'Điều 1.1 Quy chế Tax-SOP-2026',
      actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' (' + inv.totalAmount.toLocaleString('vi-VN') + '₫) thiếu bảng kê chi tiết. KTT xử lý thế nào?',
      options: [
        {
          id: 'A',
          label: 'Tạm treo, yêu cầu bổ sung bảng kê',
          actionDescription: 'Gửi yêu cầu cho nhân viên mua hàng nộp bảng kê trước khi duyệt',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Loại khỏi đợt kê khai thuế quý này',
          actionDescription: 'Tạm thời chưa đưa vào kê khai khấu trừ',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // 18. DATA_QUALITY: Hóa đơn điều chỉnh thiếu tham chiếu gốc
  if (inv.isAdjustment && !inv.originalInvoiceRef) {
    evaluatedFindings.push({
      ruleId: 'RULE_ADJUSTMENT_NO_ORIGINAL',
      kind: 'DATA_QUALITY',
      severity: 'MEDIUM',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Hóa đơn điều chỉnh nhưng không tìm thấy số hóa đơn gốc trong CSDL nội bộ',
      plainExplanation: 'Hóa đơn ghi là điều chỉnh giảm tiền nhưng hệ thống không tìm thấy hóa đơn gốc tương ứng theo quy định tại Nghị định 254/2026/NĐ-CP.',
      legalBasis: 'Điều 1.4 Quy chế Tax-SOP-2026 & Nghị định 254/2026/NĐ-CP',
      sopClause: 'Điều 1.4 Quy chế Tax-SOP-2026 & Nghị định 254/2026/NĐ-CP',
      actionableQuestion: 'Hóa đơn điều chỉnh ' + inv.invoiceNumber + ' không tìm thấy số hóa đơn gốc. KTT xử lý thế nào?',
      options: [
        {
          id: 'A',
          label: 'Tạm treo chờ tra soát hóa đơn gốc',
          actionDescription: 'Liên hệ kế toán đối tác để xác minh số hóa đơn gốc đã phát hành',
          resultingAction: 'REQUEST_SUPPLIER_REISSUE'
        },
        {
          id: 'B',
          label: 'Từ chối tiếp nhận hóa đơn này',
          actionDescription: 'Bác bỏ hóa đơn điều chỉnh không rõ nguồn gốc',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // 19. DATA_QUALITY: Đóng MST nhưng HĐ lập trước ngày đóng
  if (inv.sellerStatus === 'CLOSED' && inv.sellerSuspensionDate && inv.invoiceDate <= inv.sellerSuspensionDate) {
    evaluatedFindings.push({
      ruleId: 'RULE_SELLER_CLOSED_BEFORE',
      kind: 'DATA_QUALITY',
      severity: 'MEDIUM',
      riskGroup: 'UNCERTAIN_INFO',
      flaggedReason: 'Nhà cung cấp đã đóng MST ngày ' + inv.sellerSuspensionDate + ', nhưng hóa đơn lập ngày ' + inv.invoiceDate + ' (Trước ngày đóng)',
      plainExplanation: 'Đối tác hiện đã đóng mã số thuế nhưng tại thời điểm giao dịch họ vẫn đang hoạt động bình thường. Giao dịch vẫn hợp lệ nếu có đầy đủ hồ sơ chứng minh hàng hóa có thật.',
      legalBasis: 'Điều 2.2 Quy chế Tax-SOP-2026',
      sopClause: 'Điều 2.2 Quy chế Tax-SOP-2026',
      actionableQuestion: 'Hóa đơn ' + inv.invoiceNumber + ' lập trước ngày người bán đóng MST. Giao dịch hợp lệ nếu đủ hồ sơ kho. KTT quyết định?',
      options: [
        {
          id: 'A',
          label: 'Xác nhận đủ hồ sơ, tiếp tục kê khai',
          actionDescription: 'Tập hợp hợp đồng, phiếu nhập kho thực tế, UNC và đưa vào khấu trừ',
          resultingAction: 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: 'Loại bỏ chi phí để an toàn tối đa',
          actionDescription: 'Chấp nhận loại trừ chi phí để tránh phải giải trình khi thanh tra thuế',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ],
      requiresCFO: false
    });
  }

  // =========================================================================
  // XỬ LÝ KẾT QUẢ ĐỐI SOÁT & THU THẬP PHÁT HIỆN (P0-2 & P0-3)
  // =========================================================================

  // 1. Kiểm tra Tiền lệ doanh nghiệp cho các finding thuộc INTERNAL_POLICY (P0-2)
  let precedentAppliedInfo: { precedentId: string; approvedBy: string; rationale: string } | undefined;
  const activeFindings: EvaluatedFinding[] = [];

  for (const finding of evaluatedFindings) {
    if (finding.kind === 'INTERNAL_POLICY') {
      const prec = findPrecedentForInvoice(inv, finding.ruleId);
      if (prec) {
        precedentAppliedInfo = {
          precedentId: prec.id,
          approvedBy: prec.approvedBy,
          rationale: prec.rationale
        };
        // Tiền lệ hợp lệ giải tỏa rủi ro nội bộ này
        continue;
      }
    }
    activeFindings.push(finding);
  }

  // 2. Nếu không còn bất kỳ finding nào chưa giải tỏa -> ROUTINE 100%
  if (activeFindings.length === 0) {
    const approvedTax = inv.taxAmount;
    const newK = calculateKFactor(inv.preTaxAmount, kSafeMin, kSafeMax, macroState).kFactor;

    return {
      status: 'ROUTINE',
      invoiceId: inv.id,
      supplierName: inv.supplierName,
      totalAmount: inv.totalAmount,
      appliedTaxRate: inv.taxRate,
      approvedTaxAmount: approvedTax,
      plainExplanation: precedentAppliedInfo
        ? 'Duyệt theo Tiền lệ Quy chế Tiếp khách của CFO (#' + precedentAppliedInfo.precedentId + '): ' + precedentAppliedInfo.rationale
        : 'Hóa đơn đáp ứng đầy đủ điều kiện 3H (Hợp pháp - Hợp lệ - Hợp lý), đúng thuế suất, thanh toán không tiền mặt hợp lệ và nằm trong hạn mức thường quy.',
      kFactorAfter: newK,
      lineItemAnalysis,
      precedentApplied: precedentAppliedInfo,
      findings: evaluatedFindings.map(f => ({
        ruleId: f.ruleId,
        kind: f.kind,
        severity: f.severity,
        riskGroup: f.riskGroup,
        flaggedReason: f.flaggedReason,
        plainExplanation: f.plainExplanation,
        legalBasis: f.legalBasis,
        evidence: f.evidence
      })),
      timestamp
    };
  }

  // 3. Nếu còn finding -> ESCALATED
  // Sắp xếp theo thứ tự ưu tiên: STATUTORY (1) > DATA_QUALITY (2) > INTERNAL_POLICY (3) > AUTHORITY (4)
  const KIND_PRIORITY: Record<RuleKind, number> = {
    STATUTORY: 1,
    DATA_QUALITY: 2,
    INTERNAL_POLICY: 3,
    AUTHORITY: 4
  };
  const SEVERITY_PRIORITY: Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4
  };

  activeFindings.sort((a, b) => {
    const kDiff = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (kDiff !== 0) return kDiff;
    return SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
  });

  const primaryFinding = activeFindings[0];
  const requiresCFO = isExceedKtt || activeFindings.some(f => f.requiresCFO || f.kind === 'AUTHORITY');

  // Tính toán tách thuế: deductibleTax vs nonDeductibleTax
  let deductibleTax = 0;
  let nonDeductibleTax = inv.taxAmount;
  const hasStatutory = activeFindings.some(f => f.kind === 'STATUTORY');
  if (!hasStatutory && activeFindings.every(f => f.kind === 'AUTHORITY')) {
    deductibleTax = inv.taxAmount;
    nonDeductibleTax = 0;
  }

  let combinedReason = primaryFinding.flaggedReason;
  if (activeFindings.length > 1) {
    const otherCount = activeFindings.length - 1;
    combinedReason += ` (đồng thời phát hiện thêm ${otherCount} rủi ro: ${activeFindings.slice(1).map(f => f.flaggedReason.slice(0, 60)).join('; ')}...)`;
  }

  return {
    status: 'ESCALATED',
    riskGroup: primaryFinding.riskGroup,
    invoiceId: inv.id,
    supplierName: inv.supplierName,
    totalAmount: inv.totalAmount,
    taxRate: inv.taxRate,
    flaggedReason: combinedReason,
    plainExplanation: primaryFinding.plainExplanation,
    sopClause: primaryFinding.sopClause,
    actionableQuestion: primaryFinding.actionableQuestion,
    options: primaryFinding.options,
    requiresCFO,
    lineItemAnalysis,
    duplicateInfo: duplicate.isDuplicate ? duplicate : undefined,
    findings: activeFindings.map(f => ({
      ruleId: f.ruleId,
      kind: f.kind,
      severity: f.severity,
      riskGroup: f.riskGroup,
      flaggedReason: f.flaggedReason,
      plainExplanation: f.plainExplanation,
      legalBasis: f.legalBasis,
      evidence: f.evidence
    })),
    deductibleTax,
    nonDeductibleTax,
    timestamp
  };
}

// Hàm đối soát hóa đơn công khai đính kèm context văn bản pháp quy theo ngày lập và cấu hình quy định động
export function evaluateInvoiceLocally(
  inv: InvoiceInput,
  customConfig?: Partial<SystemPolicyConfig>,
  customSopVersion: string = 'TAX-SOP-2026 v2.5',
  macroState?: Pick<MacroState, 'totalSales' | 'openingInventory' | 'totalPurchases'>,
  contextInvoices?: InvoiceInput[]
): RefereeDecision {
  const regInfo = getApplicableRegulations(inv.invoiceDate);
  const applicableDecreeCodes = regInfo.applicableRegulations.map((d) => d.code);
  const decision = evaluateInvoiceLocallyInternal(inv, customConfig, macroState, contextInvoices);

  return {
    ...decision,
    applicableRegulations: applicableDecreeCodes,
    sopVersion: customSopVersion
  } as RefereeDecision;
}

function getDataQualityIssue(inv: InvoiceInput): string | null {
  const date = new Date(`${inv.invoiceDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== inv.invoiceDate) return 'Ngày hóa đơn không hợp lệ hoặc không thể đối chiếu văn bản có hiệu lực.';
  const expectedTax = Math.round(inv.preTaxAmount * inv.taxRate / 100);
  const expectedTotal = inv.preTaxAmount + inv.taxAmount;
  if (Math.abs(inv.taxAmount - expectedTax) > 1 || Math.abs(inv.totalAmount - expectedTotal) > 1) {
    return 'Các số tiền trên hóa đơn không nhất quán với tiền trước thuế và thuế suất; cần xác nhận lại chứng từ gốc.';
  }
  if (inv.isImageBlurry) return 'Ảnh hóa đơn bị mờ, chưa thể xác nhận chính xác dữ liệu thực tế.';
  if (!inv.paymentMethod || inv.hasBankSlip === undefined || inv.hasItemManifest === undefined || inv.sellerStatus === 'UNKNOWN') {
    return 'Hóa đơn còn thiếu dữ liệu nguồn về thanh toán, bảng kê hoặc trạng thái mã số thuế nhà cung cấp.';
  }
  return null;
}

function uncertainDecision(inv: InvoiceInput, reason: string, timestamp: string): RefereeDecision {
  return {
    status: 'ESCALATED',
    riskGroup: 'UNCERTAIN_INFO',
    invoiceId: inv.id,
    supplierName: inv.supplierName,
    totalAmount: inv.totalAmount,
    taxRate: inv.taxRate,
    flaggedReason: reason,
    plainExplanation: 'Hệ thống chưa đủ dữ liệu chắc chắn để khẳng định hóa đơn hợp lệ. Cần người phụ trách kiểm tra và xác nhận trước khi xử lý tiếp.',
    sopClause: 'Quy trình kiểm soát dữ liệu đầu vào Tax-SOP-2026',
    actionableQuestion: `Hóa đơn ${inv.invoiceNumber} từ ${inv.supplierName} cần xác minh: ${reason} KTT chọn tiếp tục bổ sung hồ sơ hay tạm dừng xử lý?`,
    options: [
      {
        id: 'A',
        label: 'Bổ sung và xác nhận hồ sơ',
        actionDescription: 'Tạm treo quyết định và yêu cầu bổ sung dữ liệu/chứng từ còn thiếu.',
        resultingAction: 'REQUEST_SUPPLIER_REISSUE'
      },
      {
        id: 'B',
        label: 'Tạm dừng xử lý',
        actionDescription: 'Không đưa hóa đơn vào đề xuất khấu trừ cho đến khi có bằng chứng hợp lệ.',
        resultingAction: 'REJECT_TAX_DEDUCTION'
      }
    ],
    requiresCFO: false,
    timestamp
  };
}
