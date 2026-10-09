import { InvoiceInput, ReconciliationItem, ReconciliationReport, TctInvoice } from '@/lib/schemas';

function cleanMst(mst?: string): string {
  if (!mst) return '';
  const cleaned = mst.replace(/[^0-9-]/g, '').trim();
  return cleaned.replace(/-/g, '').length === 10 ? cleaned.replace(/-/g, '') : cleaned;
}

function cleanInvoiceNumber(num?: string): string {
  if (!num) return '';
  return num.trim().padStart(7, '0');
}

export function reconcileTctWithSystem(
  tctInvoices: TctInvoice[],
  systemInvoices: InvoiceInput[]
): ReconciliationReport {
  const reconciledAt = new Date().toISOString();
  const items: ReconciliationItem[] = [];

  // Bản đồ hóa đơn nội bộ: key = cleanMst(supplierTaxCode) + '_' + cleanInvoiceNumber(invoiceNumber)
  const systemMap = new Map<string, InvoiceInput>();
  const matchedSystemKeys = new Set<string>();

  for (const inv of systemInvoices) {
    const key = `${cleanMst(inv.supplierTaxCode)}_${cleanInvoiceNumber(inv.invoiceNumber)}`;
    systemMap.set(key, inv);
  }

  // 1. Duyệt qua từng hóa đơn trên Cổng Thuế TCT
  for (const tct of tctInvoices) {
    const key = `${cleanMst(tct.supplierTaxCode)}_${cleanInvoiceNumber(tct.invoiceNumber)}`;
    const sys = systemMap.get(key);

    if (!sys) {
      // Nhóm 2: Có trên Cổng Thuế nhưng hệ thống chưa có tệp XML gốc
      items.push({
        id: `REC-${tct.id}`,
        status: 'MISSING_IN_VAULT',
        invoiceNumber: tct.invoiceNumber,
        invoiceSeries: tct.invoiceSeries,
        supplierTaxCode: tct.supplierTaxCode,
        supplierName: tct.supplierName,
        tctInvoice: tct,
        discrepancyReasons: [
          'Hóa đơn đã được người bán truyền lên Cổng Thuế Tổng cục Thuế nhưng hệ thống chưa lưu trữ tệp XML chứng từ gốc.'
        ],
        recommendedAction: 'Cần tải ngay tệp XML gốc từ Cổng hoadondientu.gdt.gov.vn về lưu trữ vào kho chứng từ để đáp ứng Nghị định 123/2020/NĐ-CP.'
      });
      continue;
    }

    matchedSystemKeys.add(key);

    // Kiểm tra sai lệch số liệu và trạng thái giữa TCT và Hệ thống
    const discrepancies: string[] = [];

    if (tct.tctStatus === 'CANCELLED') {
      discrepancies.push('Hóa đơn đã bị người bán HỦY BỎ trên Cổng Thuế nhưng hệ thống nội bộ vẫn đang ghi nhận.');
    }

    if (Math.abs(tct.preTaxAmount - sys.preTaxAmount) > 2000) {
      discrepancies.push(
        `Lệch tiền trước thuế: Cổng TCT ghi ${tct.preTaxAmount.toLocaleString('vi-VN')}₫, Hệ thống ghi ${sys.preTaxAmount.toLocaleString('vi-VN')}₫.`
      );
    }

    if (tct.taxRate !== sys.taxRate) {
      discrepancies.push(`Lệch thuế suất: Cổng TCT ghi ${tct.taxRate}%, Hệ thống ghi ${sys.taxRate}%.`);
    }

    if (Math.abs(tct.taxAmount - sys.taxAmount) > 2000) {
      discrepancies.push(
        `Lệch tiền thuế GTGT: Cổng TCT ghi ${tct.taxAmount.toLocaleString('vi-VN')}₫, Hệ thống ghi ${sys.taxAmount.toLocaleString('vi-VN')}₫.`
      );
    }

    if (Math.abs(tct.totalAmount - sys.totalAmount) > 2000) {
      discrepancies.push(
        `Lệch tổng tiền thanh toán: Cổng TCT ghi ${tct.totalAmount.toLocaleString('vi-VN')}₫, Hệ thống ghi ${sys.totalAmount.toLocaleString('vi-VN')}₫.`
      );
    }

    if ((tct.tctStatus === 'ADJUSTED' || tct.tctStatus === 'REPLACED') && !sys.isAdjustment) {
      discrepancies.push(`Cổng TCT ghi nhận trạng thái '${tct.tctStatus}' nhưng hệ thống chưa cập nhật cờ hóa đơn điều chỉnh/thay thế.`);
    }

    if (discrepancies.length > 0) {
      // Nhóm 4: Lệch số liệu hoặc trạng thái
      items.push({
        id: `REC-${tct.id}`,
        status: 'DATA_DISCREPANCY',
        invoiceNumber: tct.invoiceNumber,
        invoiceSeries: tct.invoiceSeries,
        supplierTaxCode: tct.supplierTaxCode,
        supplierName: tct.supplierName,
        tctInvoice: tct,
        systemInvoice: sys,
        discrepancyReasons: discrepancies,
        recommendedAction: tct.tctStatus === 'CANCELLED'
          ? 'HỦY KHẤU TRỪ NGAY: Người bán đã hủy hóa đơn trên Cổng Thuế. Không đưa vào hồ sơ khai thuế để tránh rủi ro xử phạt vi phạm hành chính.'
          : 'Liên hệ nhà cung cấp đối soát lại biên bản điều chỉnh/thay thế hoặc cập nhật lại số liệu hạch toán cho khớp đúng với Cổng Thuế.'
      });
    } else {
      // Nhóm 1: Khớp 100%
      items.push({
        id: `REC-${tct.id}`,
        status: 'MATCHED',
        invoiceNumber: tct.invoiceNumber,
        invoiceSeries: tct.invoiceSeries,
        supplierTaxCode: tct.supplierTaxCode,
        supplierName: tct.supplierName,
        tctInvoice: tct,
        systemInvoice: sys,
        discrepancyReasons: [],
        recommendedAction: 'Khớp đúng 100% giữa Cổng Thuế và Kho chứng từ nội bộ. Đủ điều kiện kê khai khấu trừ thuế an toàn.'
      });
    }
  }

  // 2. Duyệt qua các hóa đơn trong hệ thống nhưng KHÔNG CÓ trên Cổng Thuế (Nhóm 3)
  for (const sys of systemInvoices) {
    const key = `${cleanMst(sys.supplierTaxCode)}_${cleanInvoiceNumber(sys.invoiceNumber)}`;
    if (!matchedSystemKeys.has(key)) {
      items.push({
        id: `REC-UNREP-${sys.id}`,
        status: 'UNREPORTED_BY_SELLER',
        invoiceNumber: sys.invoiceNumber,
        invoiceSeries: sys.invoiceSeries || 'CHƯA_XÁC_ĐỊNH',
        supplierTaxCode: sys.supplierTaxCode,
        supplierName: sys.supplierName,
        systemInvoice: sys,
        discrepancyReasons: [
          'Hóa đơn có trong kho chứng từ của doanh nghiệp nhưng HOÀN TOÀN KHÔNG CÓ trên Cổng Thuế Tổng cục Thuế (người bán chưa truyền dữ liệu hoặc hóa đơn giả).'
        ],
        recommendedAction: 'BÁO ĐỘNG ĐỎ (RỦI RO CAO): Tuyệt đối không đưa vào tờ khai thuế GTGT. Yêu cầu bộ phận mua hàng liên hệ người bán tra soát việc truyền dữ liệu lên cơ quan thuế.'
      });
    }
  }

  const matchedCount = items.filter(i => i.status === 'MATCHED').length;
  const missingInVaultCount = items.filter(i => i.status === 'MISSING_IN_VAULT').length;
  const unreportedBySellerCount = items.filter(i => i.status === 'UNREPORTED_BY_SELLER').length;
  const discrepancyCount = items.filter(i => i.status === 'DATA_DISCREPANCY').length;

  return {
    totalTct: tctInvoices.length,
    totalSystem: systemInvoices.length,
    matchedCount,
    missingInVaultCount,
    unreportedBySellerCount,
    discrepancyCount,
    reconciledAt,
    items
  };
}
