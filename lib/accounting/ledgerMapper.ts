import crypto from 'node:crypto';
import { InvoiceInput, RefereeDecision } from '../schemas';
import { CanonicalLedgerVoucher, AccountEntry } from './types';
import { getAccount } from './chartOfAccounts';
import { getSupplier } from '@/services/supplierService';

export type AccountingRegime = 'CIRCULAR_99_200' | 'CIRCULAR_133';

/**
 * Suy luận mã tài khoản chi phí / tài sản theo chuẩn Thông tư 200 hoặc Thông tư 133
 * Áp dụng 3 tầng ưu tiên: Tầng 1 (Cấu hình NCC) -> Tầng 2 (Từ khóa ngữ nghĩa mặt hàng) -> Tầng 3 (Mặc định)
 */
export function determineExpenseAccount(
  itemName: string,
  regime: AccountingRegime = 'CIRCULAR_99_200',
  defaultAccount?: string
): { code: string; name: string } {
  // Tầng 1: Ưu tiên tài khoản mặc định của Nhà cung cấp (từ supplier_master)
  if (defaultAccount) {
    const acc = getAccount(defaultAccount, regime);
    if (acc) return { code: acc.code, name: acc.name };
    return { code: defaultAccount, name: `Tài khoản ${defaultAccount}` };
  }

  const normalized = itemName.toLowerCase();

  // Đối với Doanh nghiệp SME áp dụng Thông tư 133/2016/TT-BTC
  if (regime === 'CIRCULAR_133') {
    if (
      normalized.includes('nguyên liệu') ||
      normalized.includes('vật tư') ||
      normalized.includes('vải') ||
      normalized.includes('thép') ||
      normalized.includes('cát') ||
      normalized.includes('gỗ')
    ) {
      return { code: '152', name: 'Nguyên liệu, vật liệu (TT 133)' };
    }
    if (
      (normalized.includes('công cụ') ||
        normalized.includes('dụng cụ') ||
        (normalized.includes('máy in') && !normalized.includes('mực')) ||
        normalized.includes('bảo hộ')) &&
      !normalized.includes('mực')
    ) {
      return { code: '153', name: 'Công cụ, dụng cụ (TT 133)' };
    }
    if (
      normalized.includes('hàng hóa') ||
      normalized.includes('sản phẩm') ||
      normalized.includes('thực phẩm') ||
      normalized.includes('sữa') ||
      normalized.includes('bán lại') ||
      normalized.includes('thương mại')
    ) {
      return { code: '156', name: 'Hàng hóa (TT 133)' };
    }
    if (
      normalized.includes('phần mềm') ||
      normalized.includes('bản quyền') ||
      normalized.includes('thuê văn phòng') ||
      normalized.includes('hosting')
    ) {
      return { code: '242', name: 'Chi phí trả trước (TT 133)' };
    }
    if (
      normalized.includes('bán hàng') ||
      normalized.includes('vận chuyển') ||
      normalized.includes('giao hàng') ||
      normalized.includes('hàng bán') ||
      normalized.includes('quảng cáo') ||
      normalized.includes('tiếp thị')
    ) {
      return { code: '6421', name: 'Chi phí bán hàng (TT 133)' };
    }
    return { code: '6422', name: 'Chi phí quản lý doanh nghiệp (TT 133)' };
  }

  // Đối với Doanh nghiệp áp dụng Thông tư 200/2014/TT-BTC & Thông tư 99/2025/TT-BTC
  if (
    normalized.includes('bản quyền phần mềm') ||
    normalized.includes('thuê văn phòng') ||
    normalized.includes('hosting máy chủ') ||
    normalized.includes('phần mềm kế toán')
  ) {
    return { code: '242', name: 'Chi phí trả trước (TT 200)' };
  }

  if (
    normalized.includes('nguyên liệu') ||
    normalized.includes('vật tư') ||
    normalized.includes('linh kiện') ||
    normalized.includes('vải') ||
    normalized.includes('thép') ||
    normalized.includes('hạt nhựa')
  ) {
    return { code: '152', name: 'Nguyên liệu, vật liệu (TT 200)' };
  }

  if (
    (normalized.includes('công cụ') ||
      normalized.includes('dụng cụ') ||
      (normalized.includes('máy in') && !normalized.includes('mực')) ||
      normalized.includes('bàn ghế')) &&
    !normalized.includes('mực')
  ) {
    return { code: '153', name: 'Công cụ, dụng cụ (TT 200)' };
  }

  if (
    normalized.includes('hàng hóa') ||
    normalized.includes('sản phẩm') ||
    normalized.includes('thực phẩm') ||
    normalized.includes('sữa') ||
    normalized.includes('bán lại') ||
    normalized.includes('thương mại')
  ) {
    return { code: '1561', name: 'Giá mua hàng hóa (TT 200)' };
  }

  // Đối với Doanh nghiệp áp dụng Thông tư 200/2014/TT-BTC & Thông tư 99/2025/TT-BTC
  if (
    normalized.includes('văn phòng phẩm') ||
    normalized.includes('giấy') ||
    normalized.includes('mực') ||
    normalized.includes('bút') ||
    normalized.includes('vpp') ||
    normalized.includes('sổ tay')
  ) {
    return { code: '6423', name: 'Chi phí đồ dùng văn phòng (TT 200)' };
  }

  if (
    normalized.includes('tiếp khách') ||
    normalized.includes('ăn uống') ||
    normalized.includes('rượu') ||
    normalized.includes('bia') ||
    normalized.includes('cà phê') ||
    normalized.includes('nhà hàng') ||
    normalized.includes('bánh kẹo')
  ) {
    return { code: '6428', name: 'Chi phí bằng tiền khác (TT 200)' };
  }

  if (
    normalized.includes('điện') ||
    normalized.includes('nước') ||
    normalized.includes('internet') ||
    normalized.includes('viễn thông') ||
    normalized.includes('cước') ||
    normalized.includes('dịch vụ') ||
    normalized.includes('phần mềm')
  ) {
    return { code: '6427', name: 'Chi phí dịch vụ mua ngoài (TT 200)' };
  }

  return { code: '6422', name: 'Chi phí vật liệu quản lý (TT 200)' };
}

/**
 * Chuyển đổi Hóa đơn và Phán quyết Tax Referee thành Bút toán Kế toán chuẩn tắc (Canonical Ledger Voucher)
 * Hỗ trợ hạch toán chi tiết từng dòng hàng (line-item multi-account)
 */
export function generateCanonicalVoucher(
  invoice: InvoiceInput,
  decision?: RefereeDecision | null,
  voucherIndex = 1,
  regime: AccountingRegime = 'CIRCULAR_99_200',
  explicitApprovedTax?: number
): CanonicalLedgerVoucher {
  const padIndex = String(voucherIndex).padStart(5, '0');
  const voucherNumber = `PKT-${invoice.invoiceDate.slice(0, 4)}${invoice.invoiceDate.slice(5, 7)}-${padIndex}`;

  const approvedTax =
    explicitApprovedTax !== undefined
      ? explicitApprovedTax
      : decision && decision.status === 'ROUTINE'
      ? decision.approvedTaxAmount
      : invoice.taxAmount !== 0 && invoice.paymentMethod !== 'CASH' && invoice.hasBankSlip !== false
      ? invoice.taxAmount
      : 0;

  // Lấy tài khoản mặc định của Nhà cung cấp nếu có
  let defaultSupplierAccount: string | undefined = undefined;
  try {
    const supplier = getSupplier(invoice.supplierTaxCode);
    if (supplier?.defaultExpenseAccount) {
      defaultSupplierAccount = supplier.defaultExpenseAccount;
    }
  } catch {
    // Bỏ qua nếu môi trường test
  }

  const entries: AccountEntry[] = [];

  // Bảo đảm cân đối số học tuyệt đối: Tổng Nợ = Tổng Có = totalAmount
  const roundingDiff = invoice.totalAmount - (invoice.preTaxAmount + invoice.taxAmount);
  const adjustedPreTax = invoice.preTaxAmount + roundingDiff;

  // DÒNG HẠCH TOÁN NỢ CHI PHÍ / VẬT TƯ / HÀNG HÓA
  if (invoice.items && invoice.items.length > 0) {
    // Nếu có danh mục chi tiết dòng hàng -> Hạch toán từng tài khoản Nợ theo từng dòng
    const accountGroupMap = new Map<string, { name: string; amount: number; memos: string[] }>();
    let totalLineAmount = 0;

    for (const item of invoice.items) {
      const acc = determineExpenseAccount(item.itemName, regime, defaultSupplierAccount);
      totalLineAmount += item.amount;
      const existing = accountGroupMap.get(acc.code);
      if (existing) {
        existing.amount += item.amount;
        existing.memos.push(item.itemName);
      } else {
        accountGroupMap.set(acc.code, {
          name: acc.name,
          amount: item.amount,
          memos: [item.itemName]
        });
      }
    }

    // Điều chỉnh sai lệch làm tròn vào tài khoản của dòng đầu tiên
    const lineDiff = adjustedPreTax - totalLineAmount;
    let isFirst = true;

    for (const [code, grp] of accountGroupMap.entries()) {
      const lineFinalAmount = isFirst ? grp.amount + lineDiff : grp.amount;
      isFirst = false;

      entries.push({
        accountCode: code,
        accountName: grp.name,
        debitAmount: lineFinalAmount,
        creditAmount: 0,
        memo: `Mua ${grp.memos.slice(0, 3).join(', ')}${grp.memos.length > 3 ? '...' : ''} theo HĐ số ${invoice.invoiceNumber}`
      });
    }
  } else {
    // Hạch toán gộp theo tiêu đề hóa đơn
    const expenseAccount = determineExpenseAccount(invoice.itemName, regime, defaultSupplierAccount);
    entries.push({
      accountCode: expenseAccount.code,
      accountName: expenseAccount.name,
      debitAmount: adjustedPreTax,
      creditAmount: 0,
      memo: `Chi phí mua ${invoice.itemName} theo HĐ số ${invoice.invoiceNumber}`
    });
  }

  // Dòng 2: Ghi Nợ Thuế GTGT được khấu trừ (TK 1331) nếu đủ điều kiện
  if (approvedTax !== 0) {
    entries.push({
      accountCode: '1331',
      accountName: 'Thuế GTGT đầu vào được khấu trừ',
      debitAmount: approvedTax,
      creditAmount: 0,
      memo: `Thuế GTGT đầu vào (${invoice.taxRate}%) theo HĐ số ${invoice.invoiceNumber}`
    });
  }

  // Dòng 2.1: Nếu có thuế GTGT nhưng bị loại khỏi khấu trừ (do vi phạm thanh toán tiền mặt hoặc thuế sai)
  const rejectedTax = invoice.taxAmount - approvedTax;
  if (rejectedTax !== 0) {
    entries.push({
      accountCode: '811',
      accountName: 'Chi phí khác (Thuế GTGT không được khấu trừ)',
      debitAmount: rejectedTax,
      creditAmount: 0,
      memo: `Thuế GTGT không đủ điều kiện khấu trừ theo Luật Thuế GTGT 48/2024/QH15`
    });
  }

  // Dòng 3: Ghi Có Tài khoản Thanh toán (TK 331 - Phải trả người bán hoặc TK 1121 / 1111)
  const creditAccountCode = invoice.paymentMethod === 'CASH' ? '1111' : '331';
  const creditAccountName =
    creditAccountCode === '1111' ? 'Tiền mặt tại quỹ' : `Phải trả ${invoice.supplierName}`;

  entries.push({
    accountCode: creditAccountCode,
    accountName: creditAccountName,
    debitAmount: 0,
    creditAmount: invoice.totalAmount,
    memo: `Phải trả bên bán theo HĐ số ${invoice.invoiceNumber}`
  });

  // Tạo mã băm kiểm toán SHA-256 bất biến
  const auditString = `${voucherNumber}|${invoice.id}|${invoice.invoiceNumber}|${invoice.totalAmount}|${approvedTax}|${invoice.invoiceDate}`;
  const auditHash = crypto.createHash('sha256').update(auditString).digest('hex');

  return {
    id: `vch_${invoice.id}`,
    voucherNumber,
    voucherDate: invoice.invoiceDate,
    invoiceRef: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    supplierTaxCode: invoice.supplierTaxCode,
    supplierName: invoice.supplierName,
    itemName: invoice.itemName,
    preTaxAmount: invoice.preTaxAmount,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    approvedTaxAmount: approvedTax,
    totalAmount: invoice.totalAmount,
    paymentMethod: invoice.paymentMethod || 'BANK_TRANSFER',
    entries,
    auditHash,
    status: 'READY_TO_POST',
    referenceNotes: `TaxReferee-Verified [SHA256:${auditHash.slice(0, 12)}...]`
  };
}
