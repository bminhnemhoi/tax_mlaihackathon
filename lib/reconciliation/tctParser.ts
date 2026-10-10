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

function requiredAmount(value: unknown): number {
  const number = numberValue(value);
  if (number === undefined) throw new Error('Thiếu số tiền trong bảng kê TCT.');
  return number;
}

function parseTaxRate(value?: unknown): 0 | 5 | 8 | 10 {
  if (value === undefined || value === null || String(value).trim()==='') throw new Error('Thiếu thuế suất trong bảng kê TCT.');
  const str = String(value).trim().toUpperCase();
  if (str.includes('KCT') || str.includes('KKKNT') || str.includes('KHONG') || str.includes('MIEN')) return 0;
  const num = numberValue(str);
  if (num === undefined) throw new Error('Thuế suất không hợp lệ.');
  if ([0,5,8,10].includes(num)) return num as 0|5|8|10;
  throw new Error('Thuế suất không được hỗ trợ.');
}

function normalizeDate(raw?: string): string {
  if (!raw) throw new Error('Thiếu ngày hóa đơn trong bảng kê TCT.');
  const trimmed = raw.trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(trimmed)) && new Date(trimmed).toISOString().slice(0,10)===trimmed) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return normalizeDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  throw new Error('Ngày hóa đơn không hợp lệ.');
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

      if (!Array.isArray(list)) throw new Error('Bảng kê phải chứa danh sách hóa đơn.');
      for (const item of list) {
        if (!item || typeof item !== 'object') throw new Error('Dòng bảng kê không hợp lệ.');
        const series = String(item.khhdon || item.invoiceSeries || item.series || item.kh || '').trim().toUpperCase() || '';
        if (!series) throw new Error('Thiếu ký hiệu hóa đơn TCT.');
        const template = item.khmshdon || item.invoiceTemplate || item.template || undefined;
        let invNum = String(item.shdon || item.invoiceNumber || item.number || item.so || item.invNum || '').trim();
        if (invNum) invNum = invNum.padStart(7, '0');
        else throw new Error('Thiếu số hóa đơn TCT.');

        const invDate = normalizeDate(item.tdlap || item.ngaylap || item.invoiceDate || item.date);
        let mst = String(item.nbmst || item.supplierTaxCode || item.sellerTaxCode || item.mst || item.taxCode || '').replace(/[^0-9-]/g, '').trim();
        if (mst.replace(/-/g, '').length === 10) mst = mst.replace(/-/g, '');
        if (!mst) throw new Error('Thiếu MST người bán TCT.');

        const name = String(item.nbten || item.supplierName || item.ten || item.sellerName || 'Chưa xác minh').trim();
        const preTax = requiredAmount(item.tgtcthue ?? item.preTaxAmount ?? item.tienhang);
        const rate = parseTaxRate(item.tsuat ?? item.taxRate ?? item.thuesuat);
        const tax = requiredAmount(item.tgtthue ?? item.taxAmount ?? item.tienthue);
        const total = requiredAmount(item.tgtttbso ?? item.totalAmount ?? item.tongtien);
        const mccqt = item.mccqt || item.taxAuthorityCode || undefined;
        const status = parseTctStatus(item.tthdon || item.tctStatus || item.status || item.trangthai);

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
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'JSON bảng kê không hợp lệ.');
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
    if (rawCols.length < 4) throw new Error('Dòng bảng kê thiếu cột bắt buộc.');

    const series = (colIdx.series !== -1 ? rawCols[colIdx.series] : rawCols[0]) || '';
    let invNum = (colIdx.number !== -1 ? rawCols[colIdx.number] : rawCols[1]) || '';
    if (!series || !invNum) throw new Error('Thiếu ký hiệu hoặc số hóa đơn TCT.');
    invNum = invNum.padStart(7, '0');

    const invDate = normalizeDate(colIdx.date !== -1 ? rawCols[colIdx.date] : rawCols[2]);
    let mst = (colIdx.mst !== -1 ? rawCols[colIdx.mst] : rawCols[3]) || '';
    mst = mst.replace(/[^0-9-]/g, '').trim();
    if (mst.replace(/-/g, '').length === 10) mst = mst.replace(/-/g, '');

    const name = (colIdx.name !== -1 ? rawCols[colIdx.name] : rawCols[4]) || 'Chưa xác minh';
    const preTax = requiredAmount(colIdx.preTax !== -1 ? rawCols[colIdx.preTax] : rawCols[5]);
    const rate = parseTaxRate(colIdx.taxRate !== -1 ? rawCols[colIdx.taxRate] : rawCols[6]);
    const tax = requiredAmount(colIdx.tax !== -1 ? rawCols[colIdx.tax] : rawCols[7]);
    const total = requiredAmount(colIdx.total !== -1 ? rawCols[colIdx.total] : rawCols[8]);
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
