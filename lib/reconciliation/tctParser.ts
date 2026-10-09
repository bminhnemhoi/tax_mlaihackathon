import { TctInvoice, TctInvoiceSchema } from '@/lib/schemas';

function numberValue(value?: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  const cleaned = str.replace(/%/g, '').trim();
  const normalized = cleaned.replace(/[^0-9,.-]/g, '');
  if (normalized.includes('.') && normalized.includes(',')) {
    const vnParsed = Number(normalized.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(vnParsed) ? vnParsed : undefined;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ''));
  }
  if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/,/g, ''));
  }
  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTaxRate(value?: unknown): 0 | 5 | 8 | 10 {
  if (value === undefined || value === null) return 10;
  const str = String(value).trim().toUpperCase();
  if (str.includes('KCT') || str.includes('KKKNT') || str.includes('KHONG') || str.includes('MIEN')) return 0;
  const num = numberValue(str);
  if (num === undefined) return 10;
  if (num === 0 || num <= 2) return 0;
  if (num >= 4 && num <= 6) return 5;
  if (num >= 7 && num <= 9) return 8;
  return 10;
}

function normalizeDate(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const trimmed = raw.trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

function parseTctStatus(val?: string): 'NEW' | 'ADJUSTED' | 'REPLACED' | 'CANCELLED' {
  if (!val) return 'NEW';
  const upper = val.toUpperCase();
  if (upper.includes('HỦY') || upper.includes('CANCEL')) return 'CANCELLED';
  if (upper.includes('ĐIỀU CHỈNH') || upper.includes('ADJUST')) return 'ADJUSTED';
  if (upper.includes('THAY THẾ') || upper.includes('REPLACE')) return 'REPLACED';
  return 'NEW';
}

export function parseTctExport(content: string, defaultTaxPeriod: string = '2026-Q1'): TctInvoice[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // 1. Thử parse dạng JSON nếu bắt đầu bằng '[' hoặc '{'
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : (data.items || data.invoices || data.data || []);
      const results: TctInvoice[] = [];

      for (const item of list) {
        const series = String(item.khhdon || item.invoiceSeries || item.series || item.kh || '').trim().toUpperCase() || '1C26TBB';
        const template = item.khmshdon || item.invoiceTemplate || item.template || undefined;
        let invNum = String(item.shdon || item.invoiceNumber || item.so || item.invNum || '').trim();
        if (invNum) invNum = invNum.padStart(7, '0');
        else invNum = '0000001';

        const invDate = normalizeDate(item.tdlap || item.ngaylap || item.invoiceDate || item.date);
        let mst = String(item.nbmst || item.supplierTaxCode || item.mst || item.taxCode || '').replace(/[^0-9-]/g, '').trim();
        if (mst.replace(/-/g, '').length === 10) mst = mst.replace(/-/g, '');
        if (!mst) mst = '0100109106';

        const name = String(item.nbten || item.supplierName || item.ten || item.sellerName || 'Nhà cung cấp Cổng TCT').trim();
        const preTax = numberValue(item.tgtcthue || item.preTaxAmount || item.tienhang) || 0;
        const rate = parseTaxRate(item.tsuat || item.taxRate || item.thuesuat);
        const tax = numberValue(item.tgtthue || item.taxAmount || item.tienthue) ?? Math.round((preTax * rate) / 100);
        const total = numberValue(item.tgtttbso || item.totalAmount || item.tongtien) ?? (preTax + tax);
        const mccqt = item.mccqt || item.taxAuthorityCode || undefined;
        const status = parseTctStatus(item.tthdon || item.tctStatus || item.trangthai);

        const id = `TCT-${series}-${invNum}-${mst}`;
        results.push(
          TctInvoiceSchema.parse({
            id,
            taxPeriod: item.taxPeriod || defaultTaxPeriod,
            invoiceSeries: series,
            invoiceTemplate: template,
            invoiceNumber: invNum,
            invoiceDate: invDate,
            supplierTaxCode: mst,
            supplierName: name,
            buyerTaxCode: item.nmmst || item.buyerTaxCode || undefined,
            preTaxAmount: preTax,
            taxRate: rate,
            taxAmount: tax,
            totalAmount: total,
            taxAuthorityCode: mccqt,
            tctStatus: status,
            importedAt: new Date().toISOString()
          })
        );
      }
      return results;
    } catch {
      // Tiếp tục thử định dạng CSV
    }
  }

  // 2. Parse định dạng CSV / Bảng kê phân tách dấu phẩy hoặc tab
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const results: TctInvoice[] = [];

  // Kiểm tra header để xác định vị trí cột
  const header = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const colIdx = {
    series: header.findIndex(h => h.includes('ký hiệu') || h.includes('ky hieu') || h.includes('khhdon') || h.includes('series')),
    number: header.findIndex(h => h.includes('số hóa đơn') || h.includes('so hoa don') || h.includes('shdon') || h.includes('số hđ')),
    date: header.findIndex(h => h.includes('ngày lập') || h.includes('ngay lap') || h.includes('ngay')),
    mst: header.findIndex(h => h.includes('mst người bán') || h.includes('mst') || h.includes('mã số thuế')),
    name: header.findIndex(h => h.includes('tên người bán') || h.includes('người bán') || h.includes('ten nban')),
    preTax: header.findIndex(h => h.includes('tiền chưa thuế') || h.includes('chưa thuế') || h.includes('tgtcthue') || h.includes('thành tiền')),
    taxRate: header.findIndex(h => h.includes('thuế suất') || h.includes('tsuat')),
    tax: header.findIndex(h => h.includes('tiền thuế') || h.includes('tgtthue')),
    total: header.findIndex(h => h.includes('tổng tiền') || h.includes('thanh toán') || h.includes('tgtttbso')),
    mccqt: header.findIndex(h => h.includes('mccqt') || h.includes('mã cqt')),
    status: header.findIndex(h => h.includes('trạng thái') || h.includes('tthdon'))
  };

  const startIndex = colIdx.number !== -1 ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length < 4) continue;

    const series = (colIdx.series !== -1 ? rawCols[colIdx.series] : rawCols[0]) || '1C26TBB';
    let invNum = (colIdx.number !== -1 ? rawCols[colIdx.number] : rawCols[1]) || '0000001';
    invNum = invNum.padStart(7, '0');

    const invDate = normalizeDate(colIdx.date !== -1 ? rawCols[colIdx.date] : rawCols[2]);
    let mst = (colIdx.mst !== -1 ? rawCols[colIdx.mst] : rawCols[3]) || '0100109106';
    mst = mst.replace(/[^0-9-]/g, '').trim();
    if (mst.replace(/-/g, '').length === 10) mst = mst.replace(/-/g, '');

    const name = (colIdx.name !== -1 ? rawCols[colIdx.name] : rawCols[4]) || 'Nhà cung cấp Cổng TCT';
    const preTax = numberValue(colIdx.preTax !== -1 ? rawCols[colIdx.preTax] : rawCols[5]) || 0;
    const rate = parseTaxRate(colIdx.taxRate !== -1 ? rawCols[colIdx.taxRate] : rawCols[6]);
    const tax = numberValue(colIdx.tax !== -1 ? rawCols[colIdx.tax] : rawCols[7]) ?? Math.round((preTax * rate) / 100);
    const total = numberValue(colIdx.total !== -1 ? rawCols[colIdx.total] : rawCols[8]) ?? (preTax + tax);
    const mccqt = colIdx.mccqt !== -1 ? rawCols[colIdx.mccqt] : undefined;
    const status = parseTctStatus(colIdx.status !== -1 ? rawCols[colIdx.status] : undefined);

    const id = `TCT-${series}-${invNum}-${mst}`;
    results.push(
      TctInvoiceSchema.parse({
        id,
        taxPeriod: defaultTaxPeriod,
        invoiceSeries: series.toUpperCase(),
        invoiceNumber: invNum,
        invoiceDate: invDate,
        supplierTaxCode: mst,
        supplierName: name,
        preTaxAmount: preTax,
        taxRate: rate,
        taxAmount: tax,
        totalAmount: total,
        taxAuthorityCode: mccqt,
        tctStatus: status,
        importedAt: new Date().toISOString()
      })
    );
  }

  return results;
}
