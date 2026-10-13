/** Pure Vietnamese tax-code validation shared by browser and server code. */
export const TAX_CODE_FORMAT_REGEX = /^(?:\d{10}(?:-\d{3})?|\d{12})$/;

/** Normalize only code shape; checksum verification is handled separately. */
export function normalizeTaxCodeFormat(taxCode: string): string | null {
  const clean = taxCode.trim().replace(/\s+/g, '');
  if (/^\d{12}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{10})(?:-?(\d{3}))?$/);
  if (!match) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

export function validateTaxCode(taxCode: string): { isValid: boolean; normalized: string; reason?: string } {
  if (!taxCode) return { isValid: false, normalized: '', reason: 'Mã số thuế trống' };
  const clean = taxCode.trim().replace(/\s+/g, '');
  // From 2025, a household business representative's 12-digit personal
  // identifier is used as that household business's MST. It has no MST
  // modulo-11 checksum; registry verification is still required to trust it.
  if (/^\d{12}$/.test(clean)) return { isValid: true, normalized: clean };
  const match = clean.match(/^(\d{10})(?:-?(\d{3}))?$/);
  if (!match) return { isValid: false, normalized: clean, reason: 'MST phải gồm 10, 12 hoặc 13 chữ số' };

  const digits = match[1].split('').map(Number);
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  const sum = digits.slice(0, 9).reduce((total, digit, index) => total + digit * weights[index], 0);
  const expected = 10 - (sum % 11);
  const checksumPassed = digits[9] === expected || (expected === 10 && digits[9] === 0);
  return {
    isValid: checksumPassed,
    normalized: match[2] ? `${match[1]}-${match[2]}` : match[1],
    reason: checksumPassed ? undefined : 'Cảnh báo: Số kiểm tra Modulo 11 không trùng khớp chuẩn TCT'
  };
}
