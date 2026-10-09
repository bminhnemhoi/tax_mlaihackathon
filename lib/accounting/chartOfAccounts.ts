/**
 * HỆ THỐNG DANH MỤC TÀI KHOẢN KẾ TOÁN VIỆT NAM (CHART OF ACCOUNTS)
 * Chuẩn hóa theo Thông tư 200/2014/TT-BTC (Doanh nghiệp lớn) & Thông tư 133/2016/TT-BTC (SME)
 */

export interface AccountDefinition {
  code: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  regime: 'TT200' | 'TT133' | 'BOTH';
  level: number; // 1: TK cấp 1 (3 số), 2: TK cấp 2 (4 số)
  parentCode?: string;
  description?: string;
}

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // --- TÀI SẢN NGẮN HẠN (TIỀN & TƯƠNG ĐƯƠNG TIỀN) ---
  { code: '111', name: 'Tiền mặt', category: 'ASSET', regime: 'BOTH', level: 1 },
  { code: '1111', name: 'Tiền Việt Nam', category: 'ASSET', regime: 'BOTH', level: 2, parentCode: '111' },
  { code: '112', name: 'Tiền gửi ngân hàng', category: 'ASSET', regime: 'BOTH', level: 1 },
  { code: '1121', name: 'Tiền Việt Nam gửi ngân hàng', category: 'ASSET', regime: 'BOTH', level: 2, parentCode: '112' },

  // --- THUẾ ĐƯỢC KHẤU TRỪ ---
  { code: '133', name: 'Thuế GTGT được khấu trừ', category: 'ASSET', regime: 'BOTH', level: 1 },
  { code: '1331', name: 'Thuế GTGT đầu vào được khấu trừ của hàng hóa, dịch vụ', category: 'ASSET', regime: 'BOTH', level: 2, parentCode: '133' },
  { code: '1332', name: 'Thuế GTGT được khấu trừ của tài sản cố định', category: 'ASSET', regime: 'BOTH', level: 2, parentCode: '133' },

  // --- HÀNG TỒN KHO & VẬT TƯ ---
  { code: '152', name: 'Nguyên liệu, vật liệu', category: 'ASSET', regime: 'BOTH', level: 1, description: 'Sắt thép, gỗ, cát, vải, linh kiện sản xuất' },
  { code: '153', name: 'Công cụ, dụng cụ', category: 'ASSET', regime: 'BOTH', level: 1, description: 'Máy in, thiết bị văn phòng, bàn ghế, đồ bảo hộ' },
  { code: '156', name: 'Hàng hóa', category: 'ASSET', regime: 'BOTH', level: 1 },
  { code: '1561', name: 'Giá mua hàng hóa', category: 'ASSET', regime: 'BOTH', level: 2, parentCode: '156', description: 'Hàng hóa mua về để thương mại bán lại' },

  // --- TÀI SẢN CỐ ĐỊNH & CHI PHÍ TRẢ TRƯỚC ---
  { code: '211', name: 'Tài sản cố định hữu hình', category: 'ASSET', regime: 'BOTH', level: 1, description: 'Ô tô, máy móc lớn, nhà xưởng có giá trị >= 30 triệu' },
  { code: '242', name: 'Chi phí trả trước', category: 'ASSET', regime: 'BOTH', level: 1, description: 'Bản quyền phần mềm dài hạn, tiền thuê văn phòng nhiều kỳ' },

  // --- NỢ PHẢI TRẢ ---
  { code: '331', name: 'Phải trả cho người bán', category: 'LIABILITY', regime: 'BOTH', level: 1, description: 'Công nợ mua hàng bên bán' },
  { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', category: 'LIABILITY', regime: 'BOTH', level: 1 },
  { code: '33311', name: 'Thuế GTGT đầu ra phải nộp', category: 'LIABILITY', regime: 'BOTH', level: 2, parentCode: '333' },

  // --- CHI PHÍ SXKD & QUẢN LÝ — THÔNG TƯ 200 (DOANH NGHIỆP LỚN) ---
  { code: '641', name: 'Chi phí bán hàng (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 1 },
  { code: '6411', name: 'Chi phí nhân viên bán hàng', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '641' },
  { code: '6417', name: 'Chi phí dịch vụ mua ngoài bán hàng', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '641' },
  { code: '642', name: 'Chi phí quản lý doanh nghiệp (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 1 },
  { code: '6421', name: 'Chi phí nhân viên quản lý (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '642' },
  { code: '6422', name: 'Chi phí vật liệu quản lý (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '642' },
  { code: '6423', name: 'Chi phí đồ dùng văn phòng (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '642', description: 'Văn phòng phẩm, giấy in, bút mực' },
  { code: '6427', name: 'Chi phí dịch vụ mua ngoài (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '642', description: 'Cước internet, viễn thông, điện thoại, phần mềm' },
  { code: '6428', name: 'Chi phí bằng tiền khác (TT 200)', category: 'EXPENSE', regime: 'TT200', level: 2, parentCode: '642', description: 'Tiếp khách, ăn uống, quà tặng hội nghị' },

  // --- CHI PHÍ SXKD & QUẢN LÝ — THÔNG TƯ 133 (DOANH NGHIỆP NHỎ VÀ VỪA - SME) ---
  { code: '6421', name: 'Chi phí bán hàng (TT 133)', category: 'EXPENSE', regime: 'TT133', level: 1, description: 'Chi phí bán hàng gộp chung của SME' },
  { code: '6422', name: 'Chi phí quản lý doanh nghiệp (TT 133)', category: 'EXPENSE', regime: 'TT133', level: 1, description: 'Chi phí quản lý gộp chung của SME' },

  // --- CHI PHÍ KHÁC ---
  { code: '811', name: 'Chi phí khác', category: 'EXPENSE', regime: 'BOTH', level: 1, description: 'Thuế GTGT không được khấu trừ, chi phí không phục vụ SXKD' }
];

export function getAccount(code: string, regime: 'CIRCULAR_99_200' | 'CIRCULAR_133' = 'CIRCULAR_99_200'): AccountDefinition | undefined {
  const targetRegime = regime === 'CIRCULAR_99_200' ? 'TT200' : 'TT133';
  return CHART_OF_ACCOUNTS.find(
    acc => acc.code === code && (acc.regime === 'BOTH' || acc.regime === targetRegime)
  );
}

export function listAccounts(
  regime: 'CIRCULAR_99_200' | 'CIRCULAR_133' = 'CIRCULAR_99_200',
  category?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
): AccountDefinition[] {
  const targetRegime = regime === 'CIRCULAR_99_200' ? 'TT200' : 'TT133';
  return CHART_OF_ACCOUNTS.filter(acc => {
    const matchRegime = acc.regime === 'BOTH' || acc.regime === targetRegime;
    const matchCategory = category ? acc.category === category : true;
    return matchRegime && matchCategory;
  });
}
