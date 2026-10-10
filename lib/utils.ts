import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  // Preserve fractional tax amounts printed on retail receipts (for example
  // 658.67) while keeping whole VND amounts compact as before.
  const formatted = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: Number.isInteger(absAmount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(absAmount) + ' ₫';
  return isNegative ? `-${formatted}` : formatted;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return isoString;
  }
}

export function parseNumberValue(value?: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  const cleaned = str.replace(/%/g, '').trim();
  const normalized = cleaned.replace(/[^0-9,.-]/g, '');
  if (!/[0-9]/.test(normalized)) return undefined;
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

export function parseTaxRateString(value?: unknown): 0 | 5 | 8 | 10 | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim().toUpperCase();
  if (!str) return undefined;
  if (
    str.includes('KCT') ||
    str.includes('KKKNT') ||
    str.includes('KHONG CHIU THUE') ||
    str.includes('KHÔNG CHỊU THUẾ') ||
    str.includes('MIEN') ||
    str.includes('MIỄN')
  ) {
    return 0;
  }
  const num = parseNumberValue(str);
  if (num === undefined) return undefined;
  if (num === 0 || num <= 2) return 0;
  if (num >= 4 && num <= 6) return 5;
  if (num >= 7 && num <= 9) return 8;
  if (num >= 9.5 && num <= 11) return 10;
  return [0, 5, 8, 10].includes(num as any) ? (num as 0 | 5 | 8 | 10) : undefined;
}
