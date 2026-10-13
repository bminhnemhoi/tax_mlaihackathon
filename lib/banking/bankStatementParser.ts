import { BankTransaction, BankTransactionSchema } from '@/lib/schemas';

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

function normalizeDate(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const trimmed = raw.trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

export function parseBankStatement(content: string, defaultBankCode: string = 'VCB'): BankTransaction[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // 1. Thử parse nếu là JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : (data.transactions || data.items || data.data || []);
      const results: BankTransaction[] = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const date = normalizeDate(item.transactionDate || item.date || item.ngay_gd);
        const refNo = String(item.referenceNo || item.refNo || item.so_but_toan || item.transId || `REF-${date}-${i + 1}`).trim();
        const debit = numberValue(item.debitAmount || item.debit || item.so_tien_ghi_no || item.amount) || 0;
        const credit = numberValue(item.creditAmount || item.credit || item.so_tien_ghi_co) || 0;
        const desc = String(item.description || item.remark || item.noi_dung || 'Chuyển khoản thanh toán tiền hàng').trim();
        const bank = String(item.bankCode || defaultBankCode).trim().toUpperCase();
        const acc = String(item.accountNumber || item.account || '0011001234567').trim();
        const benName = item.beneficiaryName || item.ten_nguoi_nhan || undefined;
        const benAcc = item.beneficiaryAccount || item.tk_nguoi_nhan || undefined;
        const benTax = item.beneficiaryTaxCode || item.mst_nguoi_nhan || undefined;

        const id = `BANK-${bank}-${refNo}`;
        results.push(
          BankTransactionSchema.parse({
            id,
            bankCode: bank,
            accountNumber: acc,
            transactionDate: date,
            referenceNo: refNo,
            debitAmount: debit,
            creditAmount: credit,
            beneficiaryName: benName,
            beneficiaryAccount: benAcc,
            beneficiaryTaxCode: benTax,
            description: desc,
            createdAt: new Date().toISOString()
          })
        );
      }
      return results;
    } catch {
      // Tiếp tục parse CSV
    }
  }

  // 2. Parse dạng CSV / Text bảng kê sao kê ngân hàng
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const results: BankTransaction[] = [];

  const header = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const colIdx = {
    date: header.findIndex(h => h.includes('ngày') || h.includes('date') || h.includes('ngay')),
    ref: header.findIndex(h => h.includes('tham chiếu') || h.includes('ref') || h.includes('bút toán') || h.includes('mã gd')),
    debit: header.findIndex(h => h.includes('ghi nợ') || h.includes('debit') || h.includes('chi ra') || h.includes('số tiền')),
    credit: header.findIndex(h => h.includes('ghi có') || h.includes('credit') || h.includes('tiền vào')),
    beneficiary: header.findIndex(h => h.includes('người nhận') || h.includes('thụ hưởng') || h === 'beneficiaryname' || h.includes('đơn vị nhận')),
    account: header.findIndex(h => h.includes('tài khoản nhận') || h.includes('tk nhận') || h.includes('stk') || h === 'beneficiaryaccount'),
    beneficiaryTax: header.findIndex(h => h === 'beneficiarytaxcode' || h === 'beneficiary_mst' || h === 'mst người nhận'),
    desc: header.findIndex(h => h.includes('nội dung') || h.includes('description') || h.includes('diễn giải') || h.includes('ghi chú'))
  };

  const startIndex = colIdx.date !== -1 ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length < 3) continue;

    const date = normalizeDate(colIdx.date !== -1 ? rawCols[colIdx.date] : rawCols[0]);
    const refNo = (colIdx.ref !== -1 ? rawCols[colIdx.ref] : rawCols[1]) || `TXN-${date}-${i}`;
    const debit = numberValue(colIdx.debit !== -1 ? rawCols[colIdx.debit] : rawCols[2]) || 0;
    const credit = colIdx.credit !== -1 ? (numberValue(rawCols[colIdx.credit]) || 0) : 0;
    const benName = colIdx.beneficiary !== -1 ? rawCols[colIdx.beneficiary] : undefined;
    const benAcc = colIdx.account !== -1 ? rawCols[colIdx.account] : undefined;
    const desc = (colIdx.desc !== -1 ? rawCols[colIdx.desc] : rawCols[rawCols.length - 1]) || 'Thanh toán tiền hàng';

    // Thử trích xuất MST người thụ hưởng từ nội dung nếu có
    let benTax: string | undefined = colIdx.beneficiaryTax !== -1 ? rawCols[colIdx.beneficiaryTax] || undefined : undefined;
    const mstMatch = desc.match(/(?:MST|mst|Mã số thuế)[:\s]*(\d{12}|\d{10}(?:-\d{3})?)/i);
    if (!benTax && mstMatch) benTax = mstMatch[1];

    const id = `BANK-${defaultBankCode}-${refNo.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    results.push(
      BankTransactionSchema.parse({
        id,
        bankCode: defaultBankCode,
        accountNumber: '0011001234567',
        transactionDate: date,
        referenceNo: refNo,
        debitAmount: debit,
        creditAmount: credit,
        beneficiaryName: benName,
        beneficiaryAccount: benAcc,
        beneficiaryTaxCode: benTax,
        description: desc,
        createdAt: new Date().toISOString()
      })
    );
  }

  return results;
}
