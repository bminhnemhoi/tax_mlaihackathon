/**
 * Căn cứ pháp lý theo NGÀY LẬP hóa đơn (phiên bản hóa theo hiệu lực). Một quy tắc không đổi, nhưng văn bản viện dẫn
 * và danh mục loại trừ thay theo kỳ: hóa đơn tháng 3/2025 và tháng 10/2026 không cùng căn cứ.
 * Nguồn đã đối chiếu 15/10/2026: NQ 204/2025/QH15 Điều 1 khoản 1 (nguyên văn "(trừ than)", "(trừ xăng)"); NĐ 174/2025/NĐ-CP;
 * TT 32/2025/TT-BTC thay TT 78/2021 từ 01/6/2025; NĐ 254/2026/NĐ-CP thay NĐ 123/2020 và NĐ 70/2025, TT 91/2026/TT-BTC thay
 * TT 32/2025 từ 01/7/2026; khoản 3 Điều 26 NĐ 181/2025/NĐ-CP (mua nhiều lần trong ngày). Xem docs/research/nghien-cuu-lien-quan.md.
 */

export interface VatReductionPeriod { from: string; to: string; basis: string; decree: string; nq204: boolean }

/** Các kỳ giảm thuế GTGT 10% → 8%. Ngoài các kỳ này (VD 01/2023–06/2023), hóa đơn 8% là sai thuế suất. */
export const VAT_REDUCTION_PERIODS: VatReductionPeriod[] = [
  { from: '2022-02-01', to: '2022-12-31', basis: 'Nghị quyết 43/2022/QH15 & Nghị định 15/2022/NĐ-CP', decree: '15/2022/NĐ-CP', nq204: false },
  { from: '2023-07-01', to: '2023-12-31', basis: 'Nghị quyết 101/2023/QH15 & Nghị định 44/2023/NĐ-CP', decree: '44/2023/NĐ-CP', nq204: false },
  { from: '2024-01-01', to: '2024-06-30', basis: 'Nghị quyết 110/2023/QH15 & Nghị định 94/2023/NĐ-CP', decree: '94/2023/NĐ-CP', nq204: false },
  { from: '2024-07-01', to: '2024-12-31', basis: 'Nghị quyết 142/2024/QH15 & Nghị định 72/2024/NĐ-CP', decree: '72/2024/NĐ-CP', nq204: false },
  { from: '2025-01-01', to: '2025-06-30', basis: 'Nghị quyết 174/2024/QH15 & Nghị định 180/2024/NĐ-CP', decree: '180/2024/NĐ-CP', nq204: false },
  { from: '2025-07-01', to: '2026-12-31', basis: 'Nghị quyết 204/2025/QH15 & Nghị định 174/2025/NĐ-CP', decree: '174/2025/NĐ-CP', nq204: true },
];

export function vatReductionAt(invoiceDate: string): VatReductionPeriod | null {
  return VAT_REDUCTION_PERIODS.find(p => invoiceDate >= p.from && invoiceDate <= p.to) ?? null;
}

/** Luôn bị loại khỏi diện giảm 8% ở mọi kỳ: viễn thông, kim loại, hàng chịu TTĐB (trừ xăng), khai khoáng (trừ than). */
// Viễn thông nhận diện theo cụm "dịch vụ" (cước, gói, thuê bao, data, sim), không theo chữ "INTERNET"/"4G"/"5G" đứng riêng —
// "quảng cáo trên Internet", "điện thoại 5G" không phải dịch vụ viễn thông.
export const VAT8_EXCLUDED_ALWAYS = ['CƯỚC INTERNET', 'DỊCH VỤ INTERNET', 'THUÊ BAO INTERNET', 'GÓI INTERNET', 'INTERNET CÁP QUANG', 'CÁP QUANG', 'CƯỚC DI ĐỘNG', 'THUÊ BAO DI ĐỘNG', 'CƯỚC ĐIỆN THOẠI',
  'CƯỚC 4G', 'CƯỚC 5G', 'GÓI 4G', 'GÓI 5G', 'DATA 4G', 'DATA 5G', 'SIM 4G', 'SIM 5G', 'GÓI CƯỚC', 'CƯỚC VIỄN THÔNG',
  'THÉP', 'SẮT THÉP', 'ỐNG ĐỒNG', 'DÂY ĐỒNG', 'ĐỒNG THAU', 'NHÔM', 'INOX', 'BIA', 'RƯỢU', 'THUỐC LÁ', 'Ô TÔ', 'QUẶNG'];

/**
 * Bị loại trước 01/7/2025 (NQ 43/2022 … NQ 174/2024: CNTT, than cốc, dầu mỏ tinh chế, hóa chất, mọi hàng chịu TTĐB) nhưng
 * ĐƯỢC giảm 8% từ 01/7/2025 theo NQ 204/2025 + NĐ 174/2025 (xăng, nhiên liệu dầu, than các khâu, hóa chất, hàng hóa/dịch vụ CNTT).
 */
export const VAT8_EXCLUDED_BEFORE_NQ204 = ['CÔNG NGHỆ THÔNG TIN', 'PHẦN MỀM', 'MÁY TÍNH', 'LAPTOP', 'ĐIỆN THOẠI', 'ĐIỆN THOẠI DI ĐỘNG',
  'XĂNG', 'XĂNG DẦU', 'DẦU DIESEL', 'DẦU DO', 'DẦU MAZUT', 'NHIÊN LIỆU', 'THAN ĐÁ', 'THAN CỐC', 'HÓA CHẤT'];

/** Cụm từ loại trừ áp dụng cho ngày lập: danh mục cấu hình + cụm cố định, bỏ các nhóm NQ 204/2025 đã cho giảm 8%. */
export function vat8ExcludedPhrases(invoiceDate: string, configured: string[]): string[] {
  const all = [...configured, ...VAT8_EXCLUDED_ALWAYS, ...VAT8_EXCLUDED_BEFORE_NQ204];
  if (!vatReductionAt(invoiceDate)?.nq204) return all;
  const lifted = new Set(VAT8_EXCLUDED_BEFORE_NQ204);
  return all.filter(phrase => !lifted.has(phrase));
}

export function vat8Basis(invoiceDate: string): string {
  return vatReductionAt(invoiceDate)?.basis ?? 'Nghị quyết giảm thuế GTGT của kỳ lập hóa đơn';
}

/** Văn bản về hóa đơn điện tử có hiệu lực tại ngày lập (không ghi số điều cho văn bản mới khi chưa đối chiếu nguyên văn). */
export function invoiceFrameworkAt(invoiceDate: string): { decree: string; circular: string; legacy: boolean } {
  if (invoiceDate >= '2026-07-01') return { decree: 'Nghị định 254/2026/NĐ-CP', circular: 'Thông tư 91/2026/TT-BTC', legacy: false };
  if (invoiceDate >= '2025-06-01') return { decree: 'Nghị định 123/2020/NĐ-CP (sửa đổi bởi Nghị định 70/2025/NĐ-CP)', circular: 'Thông tư 32/2025/TT-BTC', legacy: false };
  return { decree: 'Nghị định 123/2020/NĐ-CP', circular: 'Thông tư 78/2021/TT-BTC', legacy: true };
}
