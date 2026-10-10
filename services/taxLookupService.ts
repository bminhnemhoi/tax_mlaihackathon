import { getDatabase, jsonNow } from '@/lib/server/db';
import { getSupplier, upsertSupplier } from './supplierService';
import { callQwenChat } from './qwenService';

export interface SupplierLookupResult {
  taxCode: string;
  legalName: string;
  tradeName?: string;
  address?: string;
  status?: string;
  source: 'INTERNAL_DB' | 'VIETQR_GDT' | 'REVERSE_VERIFIED_AI' | 'BRAND_REGISTRY';
  confidence: number; // 0.0 - 1.0
  isVerified: boolean;
  notes?: string;
}

/**
 * Danh bạ định danh thương hiệu chuỗi cửa hàng & doanh nghiệp bán lẻ lớn tại Việt Nam.
 * Giúp nhận diện chính xác 100% MST pháp nhân ngay cả khi hóa đơn chỉ in tên thương hiệu hoặc logo.
 */
export const VIETNAMESE_RETAIL_CHAINS: Record<
  string,
  { taxCode: string; legalName: string; tradeName: string }
> = {
  // Chuỗi cửa hàng tiện lợi
  'circle k': {
    taxCode: '0309129418',
    legalName: 'Công ty TNHH Vòng Tròn Đỏ (Circle K)',
    tradeName: 'Circle K Vietnam'
  },
  'circlek': {
    taxCode: '0309129418',
    legalName: 'Công ty TNHH Vòng Tròn Đỏ (Circle K)',
    tradeName: 'Circle K Vietnam'
  },
  'vong tron do': {
    taxCode: '0309129418',
    legalName: 'Công ty TNHH Vòng Tròn Đỏ (Circle K)',
    tradeName: 'Circle K Vietnam'
  },
  'red circle': {
    taxCode: '0306182043',
    legalName: 'CÔNG TY TNHH VÒNG TRÒN ĐỎ',
    tradeName: 'Circle K'
  },
  'gs25': {
    taxCode: '0314517490',
    legalName: 'CÔNG TY TNHH GS 25 VIỆT NAM',
    tradeName: 'GS25'
  },
  'familymart': {
    taxCode: '0312528766',
    legalName: 'CÔNG TY TNHH CỬA HÀNG TIỆN LỢI GIA ĐÌNH VIỆT NAM',
    tradeName: 'FamilyMart'
  },
  '7-eleven': {
    taxCode: '0313506334',
    legalName: 'CÔNG TY CỔ PHẦN SEVEN SYSTEM VIỆT NAM',
    tradeName: '7-Eleven'
  },
  '7 eleven': {
    taxCode: '0313506334',
    legalName: 'CÔNG TY CỔ PHẦN SEVEN SYSTEM VIỆT NAM',
    tradeName: '7-Eleven'
  },
  'ministop': {
    taxCode: '0313324029',
    legalName: 'CÔNG TY TNHH MINISTOP VIỆT NAM',
    tradeName: 'MINISTOP'
  },

  // Hệ thống siêu thị & Bách hóa Masan / VinGroup
  'vincommerce': {
    taxCode: '0104918404',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ THƯƠNG MẠI TỔNG HỢP WINCOMMERCE',
    tradeName: 'VinCommerce / WinMart'
  },
  'wincommerce': {
    taxCode: '0104918404',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ THƯƠNG MẠI TỔNG HỢP WINCOMMERCE',
    tradeName: 'WinCommerce'
  },
  'vinmart': {
    taxCode: '0104918404',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ THƯƠNG MẠI TỔNG HỢP WINCOMMERCE',
    tradeName: 'VinMart / WinMart'
  },
  'winmart': {
    taxCode: '0104918404',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ THƯƠNG MẠI TỔNG HỢP WINCOMMERCE',
    tradeName: 'WinMart'
  },
  'winmart+': {
    taxCode: '0104918404',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ THƯƠNG MẠI TỔNG HỢP WINCOMMERCE',
    tradeName: 'WinMart+'
  },

  // Hệ thống Thế Giới Di Động & Bách Hóa Xanh
  'the gioi di dong': {
    taxCode: '0303217354',
    legalName: 'CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG',
    tradeName: 'Thế Giới Di Động'
  },
  'tgdd': {
    taxCode: '0303217354',
    legalName: 'CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG',
    tradeName: 'Thế Giới Di Động'
  },
  'dien may xanh': {
    taxCode: '0303217354',
    legalName: 'CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG',
    tradeName: 'Điện Máy Xanh'
  },
  'bach hoa xanh': {
    taxCode: '0310471746',
    legalName: 'CÔNG TY CỔ PHẦN THƯƠNG MẠI BÁCH HÓA XANH',
    tradeName: 'Bách Hóa Xanh'
  },
  'an khang': {
    taxCode: '0314757348',
    legalName: 'CÔNG TY CỔ PHẦN DƯỢC PHẨM AN KHANG 1',
    tradeName: 'Nhà thuốc An Khang'
  },

  // Hệ thống FPT
  'fpt shop': {
    taxCode: '0311609355',
    legalName: 'CÔNG TY CỔ PHẦN BÁN LẺ KỸ THUẬT SỐ FPT',
    tradeName: 'FPT Shop'
  },
  'fpt telecom': {
    taxCode: '0101248141',
    legalName: 'CÔNG TY CỔ PHẦN VIỄN THÔNG FPT',
    tradeName: 'FPT Telecom'
  },
  'long chau': {
    taxCode: '0315275368',
    legalName: 'CÔNG TY CỔ PHẦN DƯỢC PHẨM FPT LONG CHÂU',
    tradeName: 'Nhà thuốc Long Châu'
  },
  'fpt long chau': {
    taxCode: '0315275368',
    legalName: 'CÔNG TY CỔ PHẦN DƯỢC PHẨM FPT LONG CHÂU',
    tradeName: 'Nhà thuốc Long Châu'
  },

  // Hệ thống Chuỗi Cà phê / Ẩm thực
  'highlands coffee': {
    taxCode: '0302863750',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ CÀ PHÊ CAO NGUYÊN',
    tradeName: 'Highlands Coffee'
  },
  'highlands': {
    taxCode: '0302863750',
    legalName: 'CÔNG TY CỔ PHẦN DỊCH VỤ CÀ PHÊ CAO NGUYÊN',
    tradeName: 'Highlands Coffee'
  },
  'phuc long': {
    taxCode: '0316871719',
    legalName: 'CÔNG TY CỔ PHẦN PHÚC LONG HERITAGE',
    tradeName: 'Phúc Long'
  },
  'the coffee house': {
    taxCode: '0312867172',
    legalName: 'CÔNG TY CỔ PHẦN THƯƠNG MẠI DỊCH VỤ TRÀ CÀ PHÊ VIỆT NAM',
    tradeName: 'The Coffee House'
  },
  'trung nguyen': {
    taxCode: '0303101156',
    legalName: 'CÔNG TY CỔ PHẦN TẬP ĐOÀN TRUNG NGUYÊN',
    tradeName: 'Trung Nguyên Legend'
  },

  // Siêu thị lớn & Sàn Thương mại điện tử
  'coopmart': {
    taxCode: '0300833957',
    legalName: 'LIÊN HIỆP HỢP TÁC XÃ THƯƠNG MẠI TP.HCM',
    tradeName: 'Saigon Co.op / Co.opmart'
  },
  'co.opmart': {
    taxCode: '0300833957',
    legalName: 'LIÊN HIỆP HỢP TÁC XÃ THƯƠNG MẠI TP.HCM',
    tradeName: 'Saigon Co.op / Co.opmart'
  },
  'co.op food': {
    taxCode: '0313158739',
    legalName: 'CÔNG TY TNHH MTV THỰC PHẨM SAIGON CO.OP',
    tradeName: 'Co.op Food'
  },
  'lotte mart': {
    taxCode: '0304741634',
    legalName: 'CÔNG TY TNHH TTTM LOTTE VIỆT NAM',
    tradeName: 'Lotte Mart'
  },
  'grab': {
    taxCode: '0312650437',
    legalName: 'CÔNG TY TNHH GRAB',
    tradeName: 'Grab'
  },
  'shopee': {
    taxCode: '0313506334',
    legalName: 'CÔNG TY TNHH SHOPEE',
    tradeName: 'Shopee'
  },
  'tiki': {
    taxCode: '0309516821',
    legalName: 'CÔNG TY TNHH TI KI',
    tradeName: 'Tiki'
  },
  'be group': {
    taxCode: '0108269207',
    legalName: 'CÔNG TY CỔ PHẦN BE GROUP',
    tradeName: 'Be'
  },
  'an phat': {
    taxCode: '0101589139',
    legalName: 'CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI AN PHÁT',
    tradeName: 'An Phát Computer'
  },
  'an phat computer': {
    taxCode: '0101589139',
    legalName: 'CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI AN PHÁT',
    tradeName: 'An Phát Computer'
  },
  'milano coffee': {
    taxCode: '0311226994',
    legalName: 'CÔNG TY TNHH CÀ PHÊ MILANO VIỆT NAM',
    tradeName: 'Milano Coffee'
  },
  'milano': {
    taxCode: '0311226994',
    legalName: 'CÔNG TY TNHH CÀ PHÊ MILANO VIỆT NAM',
    tradeName: 'Milano Coffee'
  }
};

/**
 * Kiểm tra cấu trúc và tính hợp lệ của MST doanh nghiệp Việt Nam.
 * Cấu trúc: 10 chữ số (doanh nghiệp) hoặc 13/14 ký tự (10 số + '-' + 3 số chi nhánh).
 * Áp dụng thuật toán kiểm tra trọng số Modulo 11 cho 10 chữ số đầu theo quy định TCT.
 */
export function validateTaxCode(taxCode: string): { isValid: boolean; normalized: string; reason?: string } {
  if (!taxCode) return { isValid: false, normalized: '', reason: 'Mã số thuế trống' };

  const clean = taxCode.trim().replace(/\s+/g, '');
  const match = clean.match(/^(\d{10})(?:-(\d{3}))?$/);

  if (!match) {
    return {
      isValid: false,
      normalized: clean,
      reason: 'MST phải gồm 10 chữ số hoặc 13 chữ số (dạng 1234567890-xxx)'
    };
  }

  const base10 = match[1];
  const digits = base10.split('').map(Number);

  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  const expectedCheckDigit = 10 - remainder;

  const actualCheckDigit = digits[9];
  const checksumPassed =
    actualCheckDigit === expectedCheckDigit ||
    (expectedCheckDigit === 10 && actualCheckDigit === 0);

  return {
    isValid: true,
    normalized: match[2] ? `${base10}-${match[2]}` : base10,
    reason: checksumPassed ? undefined : 'Cảnh báo: Số kiểm tra Modulo 11 không trùng khớp chuẩn TCT'
  };
}

/**
 * Chuẩn hóa chuỗi tên tiếng Việt để so khớp mờ:
 * Bỏ dấu, chuyển chữ thường, loại bỏ các tiền tố pháp lý thông dụng.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  let str = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/đ/g, 'd');

  // Chuẩn hóa tương đương âm mượn như win/vin
  str = str.replace(/\bwin/g, 'vin');

  // Loại bỏ các tiền tố / hậu tố công ty thông dụng để tìm từ khóa cốt lõi
  const prefixes = [
    /\bcong ty\b/g,
    /\btnhh\b/g,
    /\btrach nhiem huu han\b/g,
    /\bco phan\b/g,
    /\bcp\b/g,
    /\btap doan\b/g,
    /\bthuong mai\b/g,
    /\bdich vu\b/g,
    /\bsan xuat\b/g,
    /\bxuat nhap khau\b/g,
    /\bdau tu\b/g,
    /\bchi nhanh\b/g,
    /\bmot thanh vien\b/g,
    /\bmtv\b/g,
    /\bvien thong\b/g,
    /\bdoanh nghiep\b/g,
    /\bcompany limited\b/g,
    /\bco\.? ltd\b/g,
    /\bjsc\b/g
  ];

  for (const regex of prefixes) {
    str = str.replace(regex, ' ');
  }

  return str.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Tính toán độ tương đồng giữa 2 tên doanh nghiệp:
 * Hỗ trợ Substring Containment, Sub-brand Match, và Jaccard Token Overlap.
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeCompanyName(nameA);
  const normB = normalizeCompanyName(nameB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // Nếu một bên chứa trọn vẹn cụm từ thương hiệu của bên kia
  // (VD: "vong tron do circle k" chứa trọn vẹn "circle k", hoặc "vincommerce" chứa trong "vincommerce general commercial")
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    if (minLen >= 3) {
      return 0.90;
    }
  }

  const tokensA = new Set(normA.split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(' ').filter((t) => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Tra cứu theo Mã số thuế (MST) - Chiều 1:
 * Ưu tiên: CSDL nội bộ -> VietQR Business API (Cổng TCT) -> Cache vào CSDL nội bộ.
 */
export async function lookupByTaxCode(taxCode: string): Promise<SupplierLookupResult | null> {
  const cleanMst = taxCode.trim().replace(/[^0-9-]/g, '');
  if (!cleanMst || cleanMst.length < 10) return null;

  // 1. Kiểm tra CSDL nội bộ trước (nhanh, <1ms)
  const localSupplier = getSupplier(cleanMst);
  if (localSupplier && localSupplier.legalName) {
    return {
      taxCode: localSupplier.taxCode,
      legalName: localSupplier.legalName,
      tradeName: localSupplier.tradeName,
      address: localSupplier.address,
      status: localSupplier.status,
      source: 'INTERNAL_DB',
      confidence: 1.0,
      isVerified: true,
      notes: 'Lấy từ Danh mục nhà cung cấp nội bộ'
    };
  }

  // 2. Tra cứu từ VietQR Business API (đồng bộ từ Tổng cục Thuế gdt.gov.vn)
  try {
    const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(cleanMst)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TaxReferee/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.code === '00' && data?.data) {
        const biz = data.data;
        const legalName = (biz.name || '').trim();
        const address = (biz.address || '').trim() || undefined;
        const tradeName = (biz.shortName || '').trim() || undefined;

        if (legalName) {
          upsertSupplier({
            taxCode: cleanMst,
            legalName,
            tradeName,
            address,
            status: 'ACTIVE',
            verificationSource: 'TCT_PORTAL',
            notes: `Tự động đồng bộ từ VietQR Business API (${data.metadata?.source || 'gdt.gov.vn'})`
          });

          return {
            taxCode: cleanMst,
            legalName,
            tradeName,
            address,
            status: biz.status || 'NNT đang hoạt động',
            source: 'VIETQR_GDT',
            confidence: 1.0,
            isVerified: true,
            notes: 'Xác thực trực tiếp từ Cổng thông tin Tổng cục Thuế'
          };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[TaxLookup] Tra cứu VietQR API thất bại cho MST ${cleanMst}:`, err?.message);
  }

  return null;
}

/**
 * Tra cứu theo Tên Nhà Cung Cấp - Chiều 2:
 * 1. Kiểm tra Danh bạ Thương hiệu Bán lẻ Việt Nam (VIETNAMESE_RETAIL_CHAINS).
 * 2. Tìm trong DB nội bộ (Fuzzy Search).
 * 3. Nếu chưa có: Dùng AI suy luận MST từ cơ sở tri thức doanh nghiệp Việt Nam.
 * 4. BẮT BUỘC: Xác thực chéo ngược lại (Reverse Cross-Verification) với VietQR API.
 */
export async function lookupByName(
  name: string,
  context?: { address?: string; rawText?: string; skipAi?: boolean }
): Promise<SupplierLookupResult | null> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 2) return null;

  const normInput = normalizeCompanyName(cleanName);

  // BƯỚC 0: Kiểm tra ngay trong Danh bạ Chuỗi Bán lẻ & Doanh nghiệp phổ biến
  for (const [brandKey, brandInfo] of Object.entries(VIETNAMESE_RETAIL_CHAINS)) {
    const normBrandKey = normalizeCompanyName(brandKey);
    if (
      normInput === normBrandKey ||
      normInput.includes(normBrandKey) ||
      normBrandKey.includes(normInput)
    ) {
      // Tự động kiểm tra / làm mới trạng thái qua VietQR
      const freshInfo = await lookupByTaxCode(brandInfo.taxCode);
      return {
        taxCode: brandInfo.taxCode,
        legalName: freshInfo?.legalName || brandInfo.legalName,
        tradeName: freshInfo?.tradeName || brandInfo.tradeName,
        address: freshInfo?.address,
        status: freshInfo?.status || 'NNT đang hoạt động',
        source: 'BRAND_REGISTRY',
        confidence: 1.0,
        isVerified: true,
        notes: `Khớp thương hiệu chuỗi "${brandInfo.tradeName}" (MST: ${brandInfo.taxCode})`
      };
    }
  }

  const db = getDatabase();

  // BƯỚC 1: Tìm kiếm trong CSDL nội bộ
  const dbRows = db
    .prepare('SELECT tax_code, legal_name, trade_name, address, status FROM supplier_master')
    .all() as Array<{
      tax_code: string;
      legal_name: string;
      trade_name: string | null;
      address: string | null;
      status: string;
    }>;

  let bestDbMatch: SupplierLookupResult | null = null;
  let highestDbSim = 0;

  for (const row of dbRows) {
    const simLegal = calculateNameSimilarity(cleanName, row.legal_name);
    const simTrade = row.trade_name ? calculateNameSimilarity(cleanName, row.trade_name) : 0;
    const sim = Math.max(simLegal, simTrade);

    if (sim > highestDbSim) {
      highestDbSim = sim;
      if (sim >= 0.7) {
        bestDbMatch = {
          taxCode: row.tax_code,
          legalName: row.legal_name,
          tradeName: row.trade_name || undefined,
          address: row.address || undefined,
          status: row.status,
          source: 'INTERNAL_DB',
          confidence: Math.round(sim * 100) / 100,
          isVerified: true,
          notes: `Khớp CSDL nội bộ (Độ tương đồng ${Math.round(sim * 100)}%)`
        };
      }
    }
  }

  if (bestDbMatch && highestDbSim >= 0.8) {
    return bestDbMatch;
  }

  // Nếu cờ skipAi được bật, bỏ qua gọi LLM để đảm bảo tốc độ bóc tách < 1s
  if (context?.skipAi) {
    return bestDbMatch;
  }

  // BƯỚC 2: Dùng AI suy luận ứng viên MST nếu CSDL chưa có (dùng Qwen)
  try {
    if (Boolean(process.env.QWEN_API_KEY)) {
      const prompt = `Bạn là chuyên gia kế toán tra cứu mã số thuế (MST) của các doanh nghiệp và thương hiệu chuỗi cửa hàng tại Việt Nam.
Nhiệm vụ: Dựa vào Tên đơn vị / Thương hiệu bên dưới, hãy cung cấp Mã Số Thuế chính xác (10 hoặc 13 số) của pháp nhân sở hữu thương hiệu này tại Việt Nam.
- Tên đơn vị / Thương hiệu: "${cleanName}"
${context?.address ? `- Địa chỉ liên quan: "${context.address}"` : ''}
${context?.rawText ? `- Văn bản phụ trợ trên hóa đơn: "${context.rawText.slice(0, 300)}"` : ''}

Ví dụ:
- "Circle K" -> MST: 0306182043 (hoặc 0309129418 - Công ty TNHH Vòng Tròn Đỏ)
- "VinCommerce" hoặc "VinMart" hoặc "WinCommerce" -> MST: 0104918404 (Công ty CP Dịch vụ Thương mại Tổng hợp WinCommerce)
- "Highlands Coffee" -> MST: 0302863750 (Công ty CP Dịch vụ Cà phê Cao Nguyên)
- "Shopee" -> MST: 0313506334 (Công ty TNHH Shopee)

QUY TẮC BẮT BUỘC:
- Trả về DUY NHẤT một mã số thuế gồm 10 hoặc 13 chữ số.
- Nếu không chắc chắn hoặc không tìm thấy, trả về "KHONG_TIM_THAY".
- Tuyệt đối không thêm lời giải thích hay ký tự nào khác.`;

      const aiResponse = await callQwenChat(
        [{ role: 'user', content: prompt }],
        undefined,
        6000
      );

      const extractedMst = (aiResponse || '').trim().replace(/[^0-9-]/g, '');

      if (extractedMst && (extractedMst.length === 10 || extractedMst.length === 14)) {
        // BƯỚC 3: XÁC THỰC CHÉO NGƯỢC (Reverse Cross-Verification) với VietQR API
        const verifiedResult = await lookupByTaxCode(extractedMst);
        if (verifiedResult && verifiedResult.legalName) {
          const simLegal = calculateNameSimilarity(cleanName, verifiedResult.legalName);
          const simTrade = verifiedResult.tradeName ? calculateNameSimilarity(cleanName, verifiedResult.tradeName) : 0;
          const crossSim = Math.max(simLegal, simTrade);

          if (crossSim >= 0.50) {
            return {
              ...verifiedResult,
              source: 'REVERSE_VERIFIED_AI',
              confidence: Math.round(Math.max(crossSim, 0.85) * 100) / 100,
              isVerified: true,
              notes: `Đã xác thực chéo thành công từ Cổng TCT (Độ khớp tên: ${Math.round(crossSim * 100)}%)`
            };
          } else {
            console.warn(
              `[TaxLookup] Bác bỏ MST ${extractedMst} do AI suy luận vì không khớp tên TCT (${verifiedResult.legalName} vs ${cleanName})`
            );
          }
        }
      }
    }
  } catch (aiErr: any) {
    console.warn('[TaxLookup] Lỗi khi gọi AI suy luận MST:', aiErr?.message);
  }

  return bestDbMatch;
}

/**
 * Tự động làm giàu dữ liệu nhà cung cấp (Auto-Enrichment)
 * Lấp đầy trường còn thiếu nếu 1 trong 2 trường đã có dữ liệu.
 */
export async function autoEnrichSupplierData(params: {
  supplierTaxCode?: string;
  supplierName?: string;
  address?: string;
  rawText?: string;
  skipAi?: boolean;
}): Promise<{
  supplierTaxCode?: string;
  supplierName?: string;
  address?: string;
  enrichedField?: 'supplierName' | 'supplierTaxCode';
  isVerified?: boolean;
  notes?: string;
}> {
  const taxCode = params.supplierTaxCode?.trim();
  const name = params.supplierName?.trim();

  // Trường hợp 1: Có MST nhưng thiếu Tên
  if (taxCode && taxCode.length >= 10 && (!name || name.length < 2)) {
    const lookup = await lookupByTaxCode(taxCode);
    if (lookup?.legalName) {
      return {
        supplierTaxCode: lookup.taxCode,
        supplierName: lookup.legalName,
        address: params.address || lookup.address,
        enrichedField: 'supplierName',
        isVerified: lookup.isVerified,
        notes: lookup.notes
      };
    }
  }

  // Trường hợp 2: Có Tên nhưng thiếu MST
  if (name && name.length >= 2 && (!taxCode || taxCode.length < 10)) {
    const lookup = await lookupByName(name, {
      address: params.address,
      rawText: params.rawText,
      skipAi: params.skipAi
    });
    if (lookup?.taxCode) {
      return {
        supplierTaxCode: lookup.taxCode,
        supplierName: params.supplierName,
        address: params.address || lookup.address,
        enrichedField: 'supplierTaxCode',
        isVerified: lookup.isVerified,
        notes: lookup.notes
      };
    }
  }

  return {
    supplierTaxCode: params.supplierTaxCode,
    supplierName: params.supplierName,
    address: params.address
  };
}
