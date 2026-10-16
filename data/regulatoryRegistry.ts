/**
 * DANH MỤC VĂN BẢN QUY PHẠM PHÁP LUẬT & QUẢN LÝ PHIÊN BẢN THEO THỜI GIAN (TEMPORAL LEGAL REGISTRY)
 * Đồng bộ Khung Pháp lý Thuế Hiện hành (Niên độ 2025 - 2026)
 * Đảm bảo Context AI đối chiếu đúng Luật, Nghị định, Thông tư có hiệu lực tại thời điểm xuất hóa đơn.
 *
 * Đối chiếu ngày 17/10/2026: mọi officialUrl trên vanban.chinhphu.vn đã mở đúng văn bản; trích dẫn "nguyên văn" chỉ giữ
 * những câu đã đối chiếu với bản PDF chính thức (bản quét, đọc bằng OCR — có thể lệch vài ký tự). Văn bản hoặc nội dung chưa
 * đối chiếu được ghi rõ "chưa đối chiếu nguyên văn"; engine không dựa vào chúng để kết luận.
 */

import { LegalCitation } from '@/lib/schemas';

export interface RegulatoryDocument {
  id: string;
  code: string; // Số ký hiệu văn bản (ví dụ: 48/2024/QH15)
  title: string; // Tên văn bản
  issuer: 'CHÍNH PHỦ' | 'BỘ TÀI CHÍNH' | 'TỔNG CỤC THUẾ' | 'QUỐC HỘI';
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD (nếu có hạn định)
  status: 'ACTIVE' | 'EXTENDED' | 'EXPIRED';
  keyRules: string[];
  summary: string;
  officialUrl?: string;
}

const UNVERIFIED = 'Nguồn thứ cấp — chưa đối chiếu nguyên văn; engine không dùng văn bản này để kết luận.';

export const GOVERNMENT_REGULATORY_REGISTRY: RegulatoryDocument[] = [
  // --- KHUNG PHÁP LUẬT 2025 - 2026 HIỆN HÀNH ---
  {
    id: 'LUAT-48-2024',
    code: '48/2024/QH15',
    title: 'Luật Thuế Giá trị gia tăng số 48/2024/QH15',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2025-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212476',
    keyRules: [
      'Điểm b khoản 2 Điều 14: có chứng từ thanh toán không dùng tiền mặt đối với hàng hóa, dịch vụ mua vào, trừ một số trường hợp đặc thù theo quy định của Chính phủ — ngưỡng 5 triệu đồng do Điều 26 Nghị định 181/2025/NĐ-CP quy định',
      'Điểm a khoản 2 Điều 14: điều kiện về hóa đơn giá trị gia tăng để khấu trừ thuế GTGT đầu vào'
    ],
    summary: 'Luật Thuế GTGT hiện hành: nêu nguyên tắc khấu trừ và chứng từ thanh toán không dùng tiền mặt; ngưỡng cụ thể nằm ở Nghị định 181/2025/NĐ-CP.'
  },
  {
    id: 'ND-181-2025',
    code: '181/2025/NĐ-CP',
    title: 'Nghị định quy định chi tiết một số điều và biện pháp thi hành Luật Thuế giá trị gia tăng',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2025-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214336',
    keyRules: [
      'Điều 26: phải có chứng từ thanh toán không dùng tiền mặt đối với hàng hóa, dịch vụ mua vào (bao gồm cả hàng hóa nhập khẩu) từ 05 triệu đồng trở lên đã bao gồm thuế GTGT',
      'Khoản 3 Điều 26: mua của một người nộp thuế có giá trị dưới 05 triệu đồng nhưng mua nhiều lần trong cùng một ngày có tổng giá trị từ 05 triệu đồng trở lên thì chỉ được khấu trừ đối với trường hợp có chứng từ thanh toán không dùng tiền mặt',
      'Khoản 1 Điều 26: không tính chứng từ bên mua nộp tiền mặt vào tài khoản của bên bán',
      'Điểm g khoản 2 Điều 26 (sửa đổi bởi Nghị định 144/2026/NĐ-CP, hiệu lực 20/6/2026): hàng mua trả chậm, trả góp từ 05 triệu đồng chưa có chứng từ thanh toán do chưa đến thời điểm thanh toán theo hợp đồng vẫn được khấu trừ'
    ],
    summary: 'Ngưỡng 5 triệu đồng (đã gồm thuế GTGT) và quy tắc mua nhiều lần trong ngày cho điều kiện khấu trừ thuế GTGT đầu vào từ 01/7/2025.'
  },
  {
    id: 'NQ-204-2025',
    code: '204/2025/QH15',
    title: 'Nghị quyết Quốc hội về giảm thuế giá trị gia tăng (kèm NĐ 174/2025/NĐ-CP)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-12-31',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214209',
    keyRules: [
      'Tiếp tục giảm 2% thuế suất thuế GTGT (từ 10% xuống 8%) áp dụng đến hết ngày 31/12/2026',
      'DANH MỤC LOẠI TRỪ (giữ 10%), theo nguyên văn Điều 1 khoản 1: viễn thông, hoạt động tài chính, ngân hàng, chứng khoán, bảo hiểm, kinh doanh bất động sản, sản phẩm kim loại, sản phẩm khai khoáng (trừ than), sản phẩm hàng hóa và dịch vụ chịu thuế tiêu thụ đặc biệt (trừ xăng)',
      'So với NQ 174/2024: than cốc, dầu mỏ tinh chế, sản phẩm hóa chất và hàng hóa/dịch vụ công nghệ thông tin KHÔNG còn bị loại trừ; xăng, nhiên liệu dầu, than ở mọi khâu được giảm 8% (Phụ lục NĐ 174/2025/NĐ-CP, docid 214310)'
    ],
    summary: 'Chính sách giảm thuế GTGT 8% và danh mục ngành nghề loại trừ áp dụng từ 01/7/2025 đến 31/12/2026.'
  },
  {
    id: 'ND-123-2020',
    code: '123/2020/NĐ-CP',
    title: 'Nghị định quy định về hóa đơn, chứng từ (sửa đổi bởi NĐ 70/2025/NĐ-CP từ 01/6/2025; thay bằng NĐ 254/2026/NĐ-CP từ 01/7/2026)',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2022-07-01',
    effectiveTo: '2026-06-30',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201365',
    keyRules: [
      'Điểm a khoản 2 Điều 3: hóa đơn điện tử có mã của cơ quan thuế được cơ quan thuế cấp mã trước khi gửi cho người mua; mã gồm số giao dịch duy nhất và chuỗi ký tự do cơ quan thuế mã hóa (độ dài 34 ký tự theo đặc tả kỹ thuật của cơ quan thuế — nguồn thứ cấp)',
      'Điều 10: nội dung hóa đơn — khoản 5 tên, địa chỉ, mã số thuế người mua; khoản 10 mã của cơ quan thuế đối với hóa đơn có mã',
      'Thời điểm ký số khác thời điểm lập hóa đơn thì thời điểm khai thuế là thời điểm lập hóa đơn (Điều 10)',
      'Điều 16 (sửa đổi bởi NĐ 70/2025/NĐ-CP): ngừng sử dụng hóa đơn điện tử khi chấm dứt hiệu lực mã số thuế hoặc tạm ngừng kinh doanh'
    ],
    summary: 'Nghị định nền tảng về hóa đơn điện tử áp dụng cho hóa đơn lập trước 01/7/2026.'
  },
  {
    id: 'TT-78-2021',
    code: '78/2021/TT-BTC',
    title: 'Thông tư hướng dẫn thực hiện Nghị định số 123/2020/NĐ-CP về hóa đơn, chứng từ (thay bằng TT 32/2025/TT-BTC từ 01/6/2025)',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2022-07-01',
    effectiveTo: '2025-05-31',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204200',
    keyRules: [
      'Điểm a khoản 1 Điều 4: ký hiệu mẫu số hóa đơn là một chữ số tự nhiên từ 1 đến 6 phản ánh loại hóa đơn',
      'Điểm b khoản 1 Điều 4: ký hiệu hóa đơn gồm 6 ký tự — C (có mã) hoặc K (không mã), hai chữ số cuối của năm lập hóa đơn, một chữ cái thể hiện loại hóa đơn, hai ký tự do người bán tự xác định'
    ],
    summary: 'Hướng dẫn cấu trúc ký hiệu mẫu số và ký hiệu hóa đơn điện tử (áp dụng cho hóa đơn lập trước 01/6/2025).'
  },
  {
    id: 'TT-32-2025',
    code: '32/2025/TT-BTC',
    title: 'Thông tư hướng dẫn Luật Quản lý thuế, NĐ 123/2020 và NĐ 70/2025 về hóa đơn, chứng từ (thay TT 78/2021; thay bằng TT 91/2026/TT-BTC từ 01/7/2026)',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2025-06-01',
    effectiveTo: '2026-06-30',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=213855',
    keyRules: [
      'Điểm b khoản 1 Điều 5: hai chữ số năm trong ký hiệu hóa đơn thể hiện năm lập hóa đơn',
      'Hướng dẫn hóa đơn điện tử có sai sót và hóa đơn khởi tạo từ máy tính tiền (điều khoản cụ thể chưa đối chiếu nguyên văn)'
    ],
    summary: 'Thông tư hướng dẫn hóa đơn điện tử áp dụng từ 01/6/2025 đến 30/6/2026.'
  },
  {
    id: 'ND-254-2026',
    code: '254/2026/NĐ-CP',
    title: 'Nghị định quy định về hóa đơn, chứng từ điện tử (thay NĐ 123/2020 và NĐ 70/2025; kèm TT 91/2026/TT-BTC, docid 219006)',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2026-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?docid=218689&pageid=27160',
    keyRules: [
      'Thay thế Nghị định 123/2020/NĐ-CP và Nghị định 70/2025/NĐ-CP về hóa đơn, chứng từ điện tử từ 01/7/2026',
      'Hướng dẫn chi tiết tại Thông tư 91/2026/TT-BTC; ký hiệu hóa đơn theo Điều 4 và Phụ lục I Thông tư 91/2026/TT-BTC',
      'Các nội dung cụ thể khác của Nghị định chưa đối chiếu nguyên văn trong bộ quy tắc này; engine chỉ viện dẫn số hiệu văn bản'
    ],
    summary: 'Khung pháp lý về hóa đơn điện tử áp dụng cho hóa đơn lập từ 01/7/2026.'
  },
  {
    id: 'TT-89-2026',
    code: '89/2026/TT-BTC',
    title: 'Thông tư hướng dẫn về mẫu biểu hồ sơ khai thuế GTGT (chưa đối chiếu nguyên văn)',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2026-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://mof.gov.vn',
    keyRules: [
      'Chỉ tiêu [21] trên Tờ khai 01/GTGT: Tích chọn (x) khi không phát sinh hoạt động mua bán trong kỳ',
      'Chỉ tiêu [22]: Thuế GTGT còn được khấu trừ kỳ trước chuyển sang (khớp đúng Chỉ tiêu [43] kỳ trước)',
      'Chỉ tiêu [25]: Tổng số thuế GTGT đầu vào ĐƯỢC KHẤU TRỪ trong kỳ (đáp ứng điều kiện không tiền mặt >= 5M)',
      'Chỉ tiêu [30] & [31]: Doanh thu và thuế GTGT đầu ra áp dụng thuế suất ưu đãi giảm 8%',
      'Chỉ tiêu [32] & [33]: Doanh thu và thuế GTGT đầu ra áp dụng thuế suất chuẩn 10%'
    ],
    summary: 'Biểu mẫu Tờ khai thuế GTGT 01/GTGT dùng cho tính năng mở rộng (beta). ' + UNVERIFIED
  },
  {
    id: 'LUAT-67-2025',
    code: '67/2025/QH15',
    title: 'Luật Thuế Thu nhập doanh nghiệp số 67/2025/QH15 (kèm NĐ 320/2025/NĐ-CP) (chưa đối chiếu nguyên văn)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    keyRules: [
      'Áp dụng thuế suất TNDN phân tầng linh hoạt: 15% (Doanh thu năm <= 3 tỷ đồng - DN siêu nhỏ); 17% (Doanh thu năm từ trên 3 đến 50 tỷ đồng - SME); 20% (Doanh thu năm trên 50 tỷ đồng - phổ thông)',
      'Ngưỡng chi phí được trừ: Khoản chi mua hàng hóa, dịch vụ từ 5 triệu đồng trở lên phải có chứng từ thanh toán không dùng tiền mặt',
      'Quy tắc tạm nộp thuế TNDN theo quý: Tổng 4 quý phải đạt tối thiểu 80% số thuế quyết toán năm'
    ],
    summary: 'Thuế TNDN — ngoài phạm vi quyết định khấu trừ GTGT của Đề A. ' + UNVERIFIED
  },
  {
    id: 'LUAT-109-2025',
    code: '109/2025/QH15',
    title: 'Luật Thuế Thu nhập cá nhân số 109/2025/QH15 & NQ 110/2025/UBTVQH15 (kèm TT 87/2026/TT-BTC) (chưa đối chiếu nguyên văn)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn',
    keyRules: [
      'Mức giảm trừ gia cảnh hiện hành: Bản thân 15.500.000 VNĐ/tháng (186 triệu/năm); Người phụ thuộc 6.200.000 VNĐ/tháng (74.4 triệu/năm)',
      'Biểu thuế lũy tiến từng phần rút gọn 5 bậc: 5%, 10%, 20%, 30%, 35%',
      'Khấu trừ thuế thu nhập vãng lai/thời vụ: Khấu trừ 10% tại nguồn cho mỗi lần chi trả từ 5.000.000 VNĐ trở lên'
    ],
    summary: 'Thuế TNCN — ngoài phạm vi quyết định khấu trừ GTGT của Đề A. ' + UNVERIFIED
  },
  {
    id: 'CV-2392-TCT',
    code: '2392/TCT-QLRR',
    title: 'Công văn Tổng cục Thuế về quản trị rủi ro hóa đơn điện tử và Tham số nguồn hàng K (chưa đối chiếu nguyên văn)',
    issuer: 'TỔNG CỤC THUẾ',
    effectiveFrom: '2023-06-20',
    status: 'ACTIVE',
    officialUrl: 'https://www.gdt.gov.vn',
    keyRules: [
      'Áp dụng thuật toán giám sát rủi ro gian lận hóa đơn qua Tham số K = Doanh thu bán ra / (Tồn kho đầu kỳ + Mua vào trong kỳ)',
      'Bản chất: Tham số K là tín hiệu cảnh báo rủi ro nội bộ (heuristic), không phải tỷ số pháp lý bắt buộc',
      'Ngưỡng vùng đỏ trong engine (K < 0,95 hoặc K > 1,35) là ngưỡng nội bộ Điều 4.3 Tax-SOP-2026'
    ],
    summary: 'Heuristic giám sát tương quan Xuất - Nhập - Tồn kho. ' + UNVERIFIED
  },
  {
    id: 'ND-255-2026',
    code: '255/2026/NĐ-CP',
    title: 'Nghị định quy định về quản lý thuế đối với doanh nghiệp có giao dịch liên kết (chưa đối chiếu nguyên văn)',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2026-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn',
    keyRules: [
      'Khống chế trần chi phí lãi vay được trừ khi tính thuế TNDN ở mức 30% EBITDA',
      'Phần chi phí lãi vay vượt mức 30% EBITDA được chuyển sang kỳ tính thuế tiếp theo trong thời hạn tối đa 5 năm'
    ],
    summary: 'Giao dịch liên kết — ngoài phạm vi quyết định khấu trừ GTGT của Đề A. ' + UNVERIFIED
  },

  // --- VĂN BẢN LỊCH SỬ PHỤC VỤ ĐỐI SOÁT HỒI TỐ (HISTORICAL / LEGACY) ---
  {
    id: 'TT-219-2013',
    code: '219/2013/TT-BTC',
    title: 'Thông tư hướng dẫn thi hành Luật Thuế giá trị gia tăng (Khung cũ trước 01/07/2025; VBHN 01/VBHN-BTC)',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2014-01-01',
    effectiveTo: '2025-06-30',
    status: 'EXPIRED',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=209521',
    keyRules: [
      'Khoản 2 Điều 15: hàng hóa, dịch vụ mua vào từ hai mươi triệu đồng trở lên phải có chứng từ thanh toán không dùng tiền mặt',
      'Khoản 5 Điều 15: mua của một nhà cung cấp có giá trị dưới hai mươi triệu đồng nhưng mua nhiều lần trong cùng một ngày có tổng giá trị từ hai mươi triệu đồng trở lên thì chỉ được khấu trừ đối với trường hợp có chứng từ thanh toán qua ngân hàng',
      'Áp dụng cho các hóa đơn phát sinh trước ngày 01/07/2025'
    ],
    summary: 'Khung pháp lý cũ với ngưỡng thanh toán không dùng tiền mặt 20 triệu đồng (hết hiệu lực từ 01/07/2025).'
  }
];

// --- CĂN CỨ PHÁP LÝ CHUẨN MỰC (LEGAL CITATIONS REGISTRY - MODULE 7) ---
// exactQuote chỉ chứa câu đã đối chiếu với bản PDF chính thức (OCR, có thể lệch vài ký tự); "…" đánh dấu phần lược.
export const LEGAL_CITATIONS_REGISTRY: Record<string, LegalCitation> = {
  'LUAT-48-2024-D14-K2': {
    documentCode: '48/2024/QH15',
    documentTitle: 'Luật Thuế Giá trị gia tăng số 48/2024/QH15',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 14',
    clause: 'Khoản 2',
    point: 'Điểm b',
    effectiveFrom: '2025-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212476',
    exactQuote: 'Có chứng từ thanh toán không dùng tiền mặt đối với hàng hóa, dịch vụ mua vào, trừ một số trường hợp đặc thù theo quy định của Chính phủ',
    summary: 'Nguyên tắc chứng từ thanh toán không dùng tiền mặt để khấu trừ thuế GTGT đầu vào; ngưỡng 5 triệu đồng quy định tại Điều 26 Nghị định 181/2025/NĐ-CP.'
  },
  'ND-181-2025-D26': {
    documentCode: '181/2025/NĐ-CP',
    documentTitle: 'Nghị định quy định chi tiết một số điều và biện pháp thi hành Luật Thuế giá trị gia tăng',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 26',
    effectiveFrom: '2025-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214336',
    exactQuote: 'Cơ sở kinh doanh phải có chứng từ thanh toán không dùng tiền mặt đối với hàng hóa, dịch vụ mua vào (bao gồm cả hàng hóa nhập khẩu) từ 05 triệu đồng trở lên đã bao gồm thuế giá trị gia tăng.',
    summary: 'Ngưỡng 5 triệu đồng (đã gồm thuế GTGT) cho điều kiện chứng từ thanh toán không dùng tiền mặt từ 01/7/2025.'
  },
  'ND-181-2025-D26-K3': {
    documentCode: '181/2025/NĐ-CP',
    documentTitle: 'Nghị định quy định chi tiết một số điều và biện pháp thi hành Luật Thuế giá trị gia tăng',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 26',
    clause: 'Khoản 3',
    effectiveFrom: '2025-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214336',
    exactQuote: 'Trường hợp mua hàng hóa, dịch vụ của một người nộp thuế có giá trị dưới 05 triệu đồng nhưng mua nhiều lần trong cùng một ngày có tổng giá trị từ 05 triệu đồng trở lên thì chỉ được khấu trừ thuế đối với trường hợp có chứng từ thanh toán không dùng tiền mặt.',
    summary: 'Mua nhiều lần trong ngày của cùng một người bán, mỗi lần dưới 5 triệu nhưng tổng từ 5 triệu đồng trở lên.'
  },
  'TT-219-2013-D15-K5': {
    documentCode: '219/2013/TT-BTC',
    documentTitle: 'Thông tư hướng dẫn thi hành Luật Thuế giá trị gia tăng (VBHN 01/VBHN-BTC)',
    issuingAuthority: 'Bộ Tài chính',
    article: 'Điều 15',
    clause: 'Khoản 5',
    effectiveFrom: '2014-01-01',
    effectiveTo: '2025-06-30',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=209521',
    exactQuote: 'Trường hợp mua hàng hóa, dịch vụ của một nhà cung cấp có giá trị dưới hai mươi triệu đồng nhưng mua nhiều lần trong cùng một ngày có tổng giá trị từ hai mươi triệu đồng trở lên thì chỉ được khấu trừ thuế đối với trường hợp có chứng từ thanh toán qua ngân hàng.',
    summary: 'Quy tắc mua nhiều lần trong ngày với ngưỡng 20 triệu đồng, áp dụng cho hóa đơn lập trước 01/7/2025.'
  },
  'NQ-204-2025-D1': {
    documentCode: '204/2025/QH15',
    documentTitle: 'Nghị quyết Quốc hội về giảm thuế giá trị gia tăng (kèm NĐ 174/2025/NĐ-CP)',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 1',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-12-31',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214209',
    exactQuote: 'Giảm 2% thuế suất thuế giá trị gia tăng, áp dụng đối với các nhóm hàng hóa, dịch vụ quy định tại khoản 3 Điều 9 … trừ một số nhóm hàng hóa, dịch vụ sau: viễn thông, hoạt động tài chính, ngân hàng, chứng khoán, bảo hiểm, kinh doanh bất động sản, sản phẩm kim loại, sản phẩm khai khoáng (trừ than), sản phẩm hàng hóa và dịch vụ chịu thuế tiêu thụ đặc biệt (trừ xăng).',
    summary: 'Giảm 2% thuế suất thuế GTGT từ 01/7/2025 đến 31/12/2026; xăng và than được giảm, kim loại/viễn thông/TTĐB khác vẫn 10%.'
  },
  'ND-123-2020-D10-K9': {
    documentCode: '123/2020/NĐ-CP',
    documentTitle: 'Nghị định quy định về hóa đơn, chứng từ',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 10',
    clause: 'Khoản 9',
    effectiveFrom: '2022-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201365',
    exactQuote: 'Thời điểm ký số trên hóa đơn điện tử là thời điểm người bán, người mua sử dụng chữ ký số để ký trên hóa đơn điện tử được hiển thị theo định dạng ngày, tháng, năm của năm dương lịch. Trường hợp thời điểm ký số khác thời điểm lập hóa đơn thì thời điểm khai thuế là thời điểm lập hóa đơn.',
    summary: 'Quy định về thời điểm lập và thời điểm ký số trên hóa đơn điện tử.'
  },
  'ND-123-2020-D3-K2': {
    documentCode: '123/2020/NĐ-CP',
    documentTitle: 'Nghị định quy định về hóa đơn, chứng từ',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 3',
    clause: 'Khoản 2',
    point: 'Điểm a',
    effectiveFrom: '2022-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201365',
    exactQuote: 'Hóa đơn điện tử có mã của cơ quan thuế … Mã của cơ quan thuế trên hóa đơn điện tử bao gồm số giao dịch là một dãy số duy nhất … và một chuỗi ký tự được cơ quan thuế mã hóa …',
    summary: 'Định nghĩa hóa đơn điện tử có mã của cơ quan thuế; mã là nội dung của hóa đơn (khoản 10 Điều 10). Độ dài 34 ký tự theo đặc tả kỹ thuật của cơ quan thuế (nguồn thứ cấp).'
  },
  'TT-78-2021-D4-K1': {
    documentCode: '78/2021/TT-BTC',
    documentTitle: 'Thông tư hướng dẫn thực hiện Nghị định số 123/2020/NĐ-CP về hóa đơn, chứng từ',
    issuingAuthority: 'Bộ Tài chính',
    article: 'Điều 4',
    clause: 'Khoản 1',
    point: 'Điểm a và điểm b',
    effectiveFrom: '2022-07-01',
    effectiveTo: '2025-05-31',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204200',
    exactQuote: 'Ký hiệu mẫu số hóa đơn điện tử là một ký tự có một chữ số tự nhiên là các số tự nhiên 1, 2, 3, 4, 5, 6 để phản ánh loại hóa đơn điện tử. Ký hiệu hóa đơn điện tử là nhóm gồm 6 ký tự gồm cả chữ viết và chữ số thể hiện các thông tin về loại hóa đơn có mã hay không có mã, năm lập hóa đơn, loại hóa đơn điện tử được sử dụng.',
    summary: 'Ký hiệu mẫu số (điểm a) và ký hiệu hóa đơn 6 ký tự, trong đó hai chữ số năm thể hiện năm lập hóa đơn (điểm b).'
  },
  'CV-2392-TCT-QLRR': {
    documentCode: '2392/TCT-QLRR',
    documentTitle: 'Công văn Tổng cục Thuế về quản trị rủi ro hóa đơn điện tử và Tham số nguồn hàng K',
    issuingAuthority: 'Tổng cục Thuế',
    article: 'Mục 2',
    effectiveFrom: '2023-06-20',
    officialSourceUrl: 'https://www.gdt.gov.vn',
    exactQuote: '[Nguồn thứ cấp — chưa đối chiếu nguyên văn] Chỉ số K = Tổng doanh thu bán ra / (Tồn kho đầu kỳ + Tổng giá trị mua vào trong kỳ) dùng để nhận diện dấu hiệu rủi ro hóa đơn.',
    summary: 'Tham khảo về hệ số K; ngưỡng vùng đỏ trong engine là ngưỡng nội bộ Điều 4.3 Tax-SOP-2026.'
  }
};

export function getLegalCitation(key: string): LegalCitation | undefined {
  return LEGAL_CITATIONS_REGISTRY[key];
}

export function listLegalCitations(): LegalCitation[] {
  return Object.values(LEGAL_CITATIONS_REGISTRY);
}

/**
 * Interface kết quả tra cứu quy định pháp luật động
 */
export interface ResolvedTemporalPolicy {
  nonCashThreshold: number;
  thresholdLawCode: string;
  hasVat8Reduction: boolean;
  vatReductionLawCode?: string;
  eInvoiceDecreeCode: string;
  activeDocuments: RegulatoryDocument[];
}

/**
 * Hàm tra cứu văn bản pháp luật có hiệu lực tại thời điểm lập hóa đơn (Temporal Logic)
 */
export function getApplicableRegulations(invoiceDateStr: string): {
  applicableRegulations: RegulatoryDocument[];
  decreeSummary: string;
  hasVatReductionPolicy: boolean;
  nonCashThreshold: number;
  thresholdLawCode: string;
  notes: string[];
} {
  const invDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date();

  // Lọc các văn bản có hiệu lực tại ngày lập hóa đơn
  const activeDocs = GOVERNMENT_REGULATORY_REGISTRY.filter((doc) => {
    const fromDate = new Date(doc.effectiveFrom);
    if (invDate < fromDate) return false;
    if (doc.effectiveTo) {
      const toDate = new Date(doc.effectiveTo);
      toDate.setHours(23, 59, 59, 999);
      if (invDate > toDate) return false;
    }
    return true;
  });

  // Xác định ngưỡng không tiền mặt theo mốc thời gian
  // Trước 01/07/2025: 20 triệu (khoản 2 Điều 15 TT 219/2013); từ 01/07/2025: 5 triệu (Điều 26 NĐ 181/2025, hướng dẫn Luật 48/2024/QH15)
  const isLaw48Active = invDate >= new Date('2025-07-01');
  const nonCashThreshold = isLaw48Active ? 5_000_000 : 20_000_000;
  const thresholdLawCode = isLaw48Active ? '181/2025/NĐ-CP (Điều 26)' : '219/2013/TT-BTC (khoản 2 Điều 15)';

  // Xác định chính sách giảm thuế 8% (NQ 204/2025 áp dụng đến 31/12/2026)
  const hasVatReduction = activeDocs.some((d) => d.id === 'NQ-204-2025');

  const decreeCodes = activeDocs.map((d) => d.code).join(', ');
  const decreeSummary = 'Căn cứ mốc ngày lập hóa đơn (' + (invoiceDateStr || 'Hiện tại') + '): Áp dụng các văn bản có hiệu lực: ' + decreeCodes + '.';

  const notes: string[] = [];
  notes.push('Ngưỡng thanh toán không tiền mặt áp dụng: ' + (nonCashThreshold / 1_000_000) + ' triệu đồng (Căn cứ: ' + thresholdLawCode + ').');
  if (hasVatReduction) {
    notes.push('Kỳ phát sinh thuộc chính sách giảm thuế GTGT 8% theo Nghị quyết 204/2025/QH15 (lưu ý danh mục loại trừ).');
  } else {
    notes.push('Kỳ phát sinh không thuộc diện giảm thuế GTGT 8%.');
  }

  return {
    applicableRegulations: activeDocs,
    decreeSummary,
    hasVatReductionPolicy: hasVatReduction,
    nonCashThreshold,
    thresholdLawCode,
    notes
  };
}
