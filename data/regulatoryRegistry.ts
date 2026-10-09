/**
 * DANH MỤC VĂN BẢN QUY PHẠM PHÁP LUẬT & QUẢN LÝ PHIÊN BẢN THEO THỜI GIAN (TEMPORAL LEGAL REGISTRY)
 * Đồng bộ Khung Pháp lý Thuế Hiện hành (Niên độ 2025 - 2026)
 * Đảm bảo Context AI đối chiếu đúng Luật, Nghị định, Thông tư có hiệu lực tại thời điểm xuất hóa đơn.
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

export const GOVERNMENT_REGULATORY_REGISTRY: RegulatoryDocument[] = [
  // --- KHUNG PHÁP LUẬT 2025 - 2026 HIỆN HÀNH ---
  {
    id: 'LUAT-48-2024',
    code: '48/2024/QH15',
    title: 'Luật Thuế Giá trị gia tăng số 48/2024/QH15',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2025-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212450',
    keyRules: [
      'Ngưỡng thanh toán không dùng tiền mặt bắt buộc: Hàng hóa, dịch vụ mua vào từng lần từ 5.000.000 VNĐ trở lên (đã bao gồm VAT) phải có chứng từ thanh toán không dùng tiền mặt để được khấu trừ thuế GTGT',
      'Chấp nhận các phương thức thanh toán không tiền mặt hợp lệ: Ủy nhiệm chi ngân hàng, thẻ doanh nghiệp, ví điện tử định danh doanh nghiệp, bù trừ công nợ hợp pháp, và hoàn ứng nhân viên có ủy quyền theo quy chế',
      'Hóa đơn dưới 5 triệu mua nhiều lần trong cùng ngày của cùng một nhà cung cấp có tổng giá trị từ 5 triệu trở lên bắt buộc phải chuyển khoản qua ngân hàng',
      'Điều kiện khấu trừ: Phải có hóa đơn GTGT hợp pháp ghi nhận đúng tên, địa chỉ, mã số thuế người mua'
    ],
    summary: 'Quy định then chốt bãi bỏ ngưỡng 20 triệu cũ, áp dụng ngưỡng 5 triệu đồng cho điều kiện khấu trừ thuế GTGT đầu vào.'
  },
  {
    id: 'NQ-204-2025',
    code: '204/2025/QH15',
    title: 'Nghị quyết Quốc hội về giảm thuế giá trị gia tăng (kèm NĐ 174/2025/NĐ-CP)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-12-31',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=213890',
    keyRules: [
      'Tiếp tục giảm 2% thuế suất thuế GTGT (từ 10% xuống 8%) áp dụng đến hết ngày 31/12/2026',
      'DANH MỤC LOẠI TRỪ BẮT BUỘC 10%: Viễn thông, Hoạt động tài chính, Ngân hàng, Chứng khoán, Bảo hiểm, Kinh doanh bất động sản, Kim loại, Sản phẩm khai khoáng, Hóa chất, Hàng hóa chịu thuế Tiêu thụ đặc biệt',
      'Dịch vụ phần mềm thuộc đối tượng không chịu thuế GTGT; dịch vụ CNTT thông thường không mặc nhiên bị loại khỏi 8% (phải đối chiếu theo mã ngành cấp 7 và mã sản phẩm VCPA)'
    ],
    summary: 'Chính sách giảm thuế GTGT 8% và danh mục ngành nghề loại trừ nghiêm ngặt áp dụng suốt niên độ 2025 - 2026.'
  },
  {
    id: 'ND-123-2020',
    code: '123/2020/NĐ-CP',
    title: 'Nghị định quy định về hóa đơn, chứng từ điện tử',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2022-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201509',
    keyRules: [
      'Hóa đơn điện tử có mã của cơ quan thuế bắt buộc phải có chuỗi mã xác thực MCCQT 34 ký tự hợp lệ trước khi gửi cho người mua',
      'Hóa đơn phải phản ánh đúng tên, địa chỉ, mã số thuế của bên bán và bên mua',
      'Thời điểm ký số và thời điểm lập hóa đơn: Trường hợp thời điểm ký số khác thời điểm lập hóa đơn thì thời điểm khai thuế là thời điểm lập hóa đơn nếu hóa đơn đáp ứng tính hợp pháp'
    ],
    summary: 'Nghị định nền tảng của Chính phủ quy định toàn diện về chế độ quản lý và sử dụng hóa đơn điện tử tại Việt Nam.'
  },
  {
    id: 'TT-78-2021',
    code: '78/2021/TT-BTC',
    title: 'Thông tư hướng dẫn thực hiện Nghị định số 123/2020/NĐ-CP về hóa đơn, chứng từ',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2022-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204090',
    keyRules: [
      'Quy chuẩn cấu trúc ký hiệu hóa đơn 6 ký tự: Ký tự 1 (loại HĐ), ký tự 2 (C: có mã, K: không mã), 2 ký tự 3-4 (năm phát hành), ký tự 5 (loại hình), 2 ký tự cuối (quản lý nội bộ)',
      'Hai chữ số năm trên ký hiệu hóa đơn phải tương ứng với năm phát hành hóa đơn',
      'Xử lý hóa đơn điện tử sai sót: Lập hóa đơn điều chỉnh hoặc hóa đơn thay thế và gửi mẫu 04/SS-HĐĐT cho cơ quan thuế'
    ],
    summary: 'Thông tư hướng dẫn chi tiết về cấu trúc ký hiệu, mã cơ quan thuế và xử lý sai sót hóa đơn điện tử.'
  },
  {
    id: 'ND-254-2026',
    code: '254/2026/NĐ-CP',
    title: 'Nghị định quy định về hóa đơn, chứng từ điện tử nâng cao (kèm TT 91/2026/TT-BTC)',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2026-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn',
    keyRules: [
      'Bắt buộc lưu trữ và đối soát dữ liệu hóa đơn điện tử gốc định dạng XML có chữ ký số CA hợp lệ',
      'Hóa đơn điều chỉnh/thay thế bắt buộc phải ghi rõ thông tin tham chiếu Số hóa đơn, Ký hiệu, Ngày lập của hóa đơn gốc',
      'Cơ chế xử lý sai sót: Trường hợp sai tên hoặc địa chỉ người mua nhưng ĐÚNG MÃ SỐ THUẾ thì gửi Mẫu 04/SS-HĐĐT cho Cục Thuế, hóa đơn vẫn được khấu trừ bình thường, không phải hủy bỏ',
      'Hóa đơn xuất sau thời điểm bên bán bị cơ quan thuế thông báo đóng MST hoặc bỏ trốn là hóa đơn bất hợp pháp 100%'
    ],
    summary: 'Khung pháp lý cao nhất về hóa đơn điện tử thế hệ mới và cơ chế xử lý sai sót chứng từ điện tử.'
  },
  {
    id: 'TT-89-2026',
    code: '89/2026/TT-BTC',
    title: 'Thông tư hướng dẫn về mẫu biểu hồ sơ khai thuế GTGT',
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
    summary: 'Quy chuẩn biểu mẫu Tờ khai thuế GTGT 01/GTGT mới nhất của Bộ Tài chính.'
  },
  {
    id: 'LUAT-67-2025',
    code: '67/2025/QH15',
    title: 'Luật Thuế Thu nhập doanh nghiệp số 67/2025/QH15 (kèm NĐ 320/2025/NĐ-CP)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214020',
    keyRules: [
      'Áp dụng thuế suất TNDN phân tầng linh hoạt: 15% (Doanh thu năm <= 3 tỷ đồng - DN siêu nhỏ); 17% (Doanh thu năm từ trên 3 đến 50 tỷ đồng - SME); 20% (Doanh thu năm trên 50 tỷ đồng - phổ thông)',
      'Ngưỡng chi phí được trừ: Khoản chi mua hàng hóa, dịch vụ từ 5 triệu đồng trở lên phải có chứng từ thanh toán không dùng tiền mặt',
      'Quy tắc tạm nộp thuế TNDN theo quý: Tổng 4 quý phải đạt tối thiểu 80% số thuế quyết toán năm'
    ],
    summary: 'Thuế suất TNDN phân tầng nuôi dưỡng SME và đồng bộ ngưỡng thanh toán 5 triệu đồng vào chi phí được trừ.'
  },
  {
    id: 'LUAT-109-2025',
    code: '109/2025/QH15',
    title: 'Luật Thuế Thu nhập cá nhân số 109/2025/QH15 & NQ 110/2025/UBTVQH15 (kèm TT 87/2026/TT-BTC)',
    issuer: 'QUỐC HỘI',
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn',
    keyRules: [
      'Mức giảm trừ gia cảnh hiện hành: Bản thân 15.500.000 VNĐ/tháng (186 triệu/năm); Người phụ thuộc 6.200.000 VNĐ/tháng (74.4 triệu/năm)',
      'Biểu thuế lũy tiến từng phần rút gọn 5 bậc: 5%, 10%, 20%, 30%, 35%',
      'Khấu trừ thuế thu nhập vãng lai/thời vụ: Khấu trừ 10% tại nguồn cho mỗi lần chi trả từ 5.000.000 VNĐ trở lên'
    ],
    summary: 'Quy định về thuế TNCN mới, mức giảm trừ gia cảnh nâng cao và ngưỡng khấu trừ vãng lai 5 triệu đồng.'
  },
  {
    id: 'CV-2392-TCT',
    code: '2392/TCT-QLRR',
    title: 'Công văn Tổng cục Thuế về quản trị rủi ro hóa đơn điện tử và Tham số nguồn hàng K (kèm TT 94/2026/TT-BTC)',
    issuer: 'TỔNG CỤC THUẾ',
    effectiveFrom: '2023-06-20',
    status: 'ACTIVE',
    officialUrl: 'https://www.gdt.gov.vn',
    keyRules: [
      'Áp dụng thuật toán giám sát rủi ro gian lận hóa đơn qua Tham số K = Doanh thu bán ra / (Tồn kho đầu kỳ + Mua vào trong kỳ)',
      'Bản chất pháp lý: Tham số K là Tín hiệu Cảnh báo Rủi ro Nội bộ (Heuristic Risk Indicator) của Cơ quan Thuế, không phải tỷ số pháp lý bắt buộc trên BCTC',
      'Dải ngưỡng tham khảo: 1.05 <= K <= 1.25 (Vùng Xanh - An toàn); K < 0.95 hoặc K > 1.35 (Vùng Đỏ - Rủi ro cao)',
      'Hành động chuẩn mực khi K chạm Vùng Đỏ: Không được trì hoãn kê khai hợp pháp; KTT và CFO phải chủ động chuẩn bị Bộ Hồ sơ Phòng vệ Nguồn hàng (Tax Defense Dossier) để sẵn sàng giải trình'
    ],
    summary: 'Hệ thống Heuristic giám sát rủi ro tương quan Xuất - Nhập - Tồn kho của ngành Thuế.'
  },
  {
    id: 'ND-255-2026',
    code: '255/2026/NĐ-CP',
    title: 'Nghị định quy định về quản lý thuế đối với doanh nghiệp có giao dịch liên kết',
    issuer: 'CHÍNH PHỦ',
    effectiveFrom: '2026-07-01',
    status: 'ACTIVE',
    officialUrl: 'https://vanban.chinhphu.vn',
    keyRules: [
      'Khống chế trần chi phí lãi vay được trừ khi tính thuế TNDN ở mức 30% EBITDA',
      'Phần chi phí lãi vay vượt mức 30% EBITDA được chuyển sang kỳ tính thuế tiếp theo trong thời hạn tối đa 5 năm'
    ],
    summary: 'Trần khống chế chi phí lãi vay 30% EBITDA đối với doanh nghiệp có quan hệ liên kết.'
  },

  // --- VĂN BẢN LỊCH SỬ PHỤC VỤ ĐỐI SOÁT HỒI TỐ (HISTORICAL / LEGACY) ---
  {
    id: 'TT-219-2013',
    code: '219/2013/TT-BTC',
    title: 'Thông tư hướng dẫn thi hành Luật Thuế giá trị gia tăng (Khung cũ trước 01/07/2025)',
    issuer: 'BỘ TÀI CHÍNH',
    effectiveFrom: '2014-01-01',
    effectiveTo: '2025-06-30',
    status: 'EXPIRED',
    officialUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=171954',
    keyRules: [
      'Ngưỡng thanh toán không dùng tiền mặt cũ: Hóa đơn từ 20.000.000 VNĐ trở lên bắt buộc phải có chứng từ ngân hàng',
      'Áp dụng cho các hóa đơn phát sinh trước ngày 01/07/2025'
    ],
    summary: 'Khung pháp lý cũ với ngưỡng thanh toán không dùng tiền mặt 20 triệu đồng (hết hiệu lực từ 01/07/2025).'
  }
];

// --- CĂN CỨ PHÁP LÝ CHUẨN MỰC (LEGAL CITATIONS REGISTRY - MODULE 7) ---
export const LEGAL_CITATIONS_REGISTRY: Record<string, LegalCitation> = {
  'LUAT-48-2024-D14-K2': {
    documentCode: '48/2024/QH15',
    documentTitle: 'Luật Thuế Giá trị gia tăng số 48/2024/QH15',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 14',
    clause: 'Khoản 2',
    effectiveFrom: '2025-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212450',
    exactQuote: 'Hàng hóa, dịch vụ mua vào từng lần theo hóa đơn từ 05 triệu đồng trở lên phải có chứng từ thanh toán không dùng tiền mặt, trừ trường hợp đặc thù theo quy định của Chính phủ.',
    summary: 'Quy định điều kiện khấu trừ thuế GTGT đầu vào bắt buộc phải có chứng từ thanh toán không dùng tiền mặt với hóa đơn từ 5 triệu đồng trở lên.'
  },
  'LUAT-48-2024-D14-K1': {
    documentCode: '48/2024/QH15',
    documentTitle: 'Luật Thuế Giá trị gia tăng số 48/2024/QH15',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 14',
    clause: 'Khoản 1',
    effectiveFrom: '2025-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212450',
    exactQuote: 'Thuế giá trị gia tăng đầu vào của hàng hóa, dịch vụ sử dụng cho sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế giá trị gia tăng được khấu trừ toàn bộ nếu có hóa đơn giá trị gia tăng hợp pháp ghi đúng tên, địa chỉ, mã số thuế người mua.',
    summary: 'Hóa đơn phải ghi nhận chính xác mã số thuế và tên người mua để được khấu trừ thuế GTGT đầu vào.'
  },
  'NQ-204-2025-D1': {
    documentCode: '204/2025/QH15',
    documentTitle: 'Nghị quyết Quốc hội về giảm thuế giá trị gia tăng (kèm NĐ 174/2025/NĐ-CP)',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 1',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-12-31',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=213890',
    exactQuote: 'Giảm 2% thuế suất thuế giá trị gia tăng đối với các nhóm hàng hóa, dịch vụ đang áp dụng mức thuế suất 10% (còn 8%), trừ một số nhóm hàng hóa, dịch vụ: viễn thông, hoạt động tài chính, ngân hàng, chứng khoán, bảo hiểm, kinh doanh bất động sản, kim loại, sản phẩm khai khoáng, hóa chất, hàng hóa chịu thuế tiêu thụ đặc biệt.',
    summary: 'Giảm 2% thuế suất thuế GTGT kèm danh mục loại trừ nghiêm ngặt áp dụng suốt niên độ 2025 - 2026.'
  },
  'LUAT-67-2025-D9-K1': {
    documentCode: '67/2025/QH15',
    documentTitle: 'Luật Thuế Thu nhập doanh nghiệp số 67/2025/QH15',
    issuingAuthority: 'Quốc hội',
    article: 'Điều 9',
    clause: 'Khoản 1',
    point: 'Điểm b',
    effectiveFrom: '2026-01-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=214020',
    exactQuote: 'Khoản chi nếu có hóa đơn mua hàng hóa, dịch vụ từng lần có giá trị từ 05 triệu đồng trở lên (giá đã bao gồm thuế giá trị gia tăng) khi thanh toán phải có chứng từ thanh toán không dùng tiền mặt.',
    summary: 'Đồng bộ điều kiện chi phí được trừ khi tính thuế TNDN với ngưỡng không dùng tiền mặt từ 5 triệu đồng trở lên.'
  },
  'ND-123-2020-D10-K9': {
    documentCode: '123/2020/NĐ-CP',
    documentTitle: 'Nghị định quy định về hóa đơn, chứng từ điện tử',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 10',
    clause: 'Khoản 9',
    effectiveFrom: '2022-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201509',
    exactQuote: 'Thời điểm ký số trên hóa đơn điện tử là thời điểm người bán, người mua sử dụng chữ ký số để ký trên hóa đơn điện tử được hiển thị theo định dạng ngày, tháng, năm của năm dương lịch. Trường hợp thời điểm ký số khác thời điểm lập hóa đơn thì thời điểm khai thuế là thời điểm lập hóa đơn.',
    summary: 'Quy định về thời điểm lập và thời điểm ký số trên hóa đơn điện tử.'
  },
  'ND-123-2020-D14': {
    documentCode: '123/2020/NĐ-CP',
    documentTitle: 'Nghị định quy định về hóa đơn, chứng từ điện tử',
    issuingAuthority: 'Chính phủ',
    article: 'Điều 14',
    effectiveFrom: '2022-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=201509',
    exactQuote: 'Hóa đơn điện tử có mã của cơ quan thuế là hóa đơn điện tử được cơ quan thuế cấp mã trước khi tổ chức, cá nhân bán hàng hóa, cung cấp dịch vụ gửi cho người mua. Mã của cơ quan thuế trên hóa đơn điện tử bao gồm số giao dịch là một dãy số duy nhất do hệ thống của cơ quan thuế tạo ra và một chuỗi ký tự do cơ quan thuế mã hóa.',
    summary: 'Quy định bắt buộc về mã xác thực của cơ quan thuế (MCCQT 34 ký tự) đối với hóa đơn có mã.'
  },
  'TT-78-2021-D4-K1': {
    documentCode: '78/2021/TT-BTC',
    documentTitle: 'Thông tư hướng dẫn thực hiện Nghị định số 123/2020/NĐ-CP về hóa đơn, chứng từ',
    issuingAuthority: 'Bộ Tài chính',
    article: 'Điều 4',
    clause: 'Khoản 1',
    point: 'Điểm a',
    effectiveFrom: '2022-07-01',
    officialSourceUrl: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204090',
    exactQuote: 'Ký hiệu mẫu số hóa đơn điện tử là một ký tự có một chữ số tự nhiên là các số tự nhiên 1, 2, 3, 4, 5, 6 để phản ánh loại hóa đơn điện tử. Ký hiệu hóa đơn điện tử là nhóm gồm 6 ký tự gồm cả chữ viết và chữ số thể hiện các thông tin về loại hóa đơn có mã hay không có mã, năm lập hóa đơn, loại hóa đơn điện tử được sử dụng.',
    summary: 'Quy định cấu trúc ký hiệu hóa đơn 6 ký tự và tính đồng bộ giữa 2 chữ số năm trong ký hiệu và năm phát hành.'
  },
  'CV-2392-TCT-QLRR': {
    documentCode: '2392/TCT-QLRR',
    documentTitle: 'Công văn Tổng cục Thuế về quản trị rủi ro hóa đơn điện tử và Tham số nguồn hàng K',
    issuingAuthority: 'Tổng cục Thuế',
    article: 'Mục 2',
    effectiveFrom: '2023-06-20',
    officialSourceUrl: 'https://www.gdt.gov.vn',
    exactQuote: 'Cơ quan thuế áp dụng chỉ số K = Tổng doanh thu bán ra / (Tồn kho đầu kỳ + Tổng giá trị mua vào trong kỳ) để nhận diện các doanh nghiệp có dấu hiệu phát hành hóa đơn khống hoặc mua bán hóa đơn bất hợp pháp.',
    summary: 'Bộ tiêu chí giám sát hệ số K và quản trị rủi ro hóa đơn gian lận của cơ quan thuế.'
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
  // Trước 01/07/2025: 20 triệu (TT 219/2013); Từ 01/07/2025: 5 triệu (Luật 48/2024/QH15)
  const isLaw48Active = invDate >= new Date('2025-07-01');
  const nonCashThreshold = isLaw48Active ? 5_000_000 : 20_000_000;
  const thresholdLawCode = isLaw48Active ? '48/2024/QH15' : '219/2013/TT-BTC';

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
