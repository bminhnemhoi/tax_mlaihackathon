# Nghiên cứu liên quan, so sánh và cải tiến — Tax Referee

**Tax Referee** · Fprinciples · MLAI Hackathon 2026 · Track VNG · Đề A "The Escalation Referee"
Ngày lập: 15/10/2026 · Nhánh mã nguồn: `feat/finals-improvements`

Tài liệu này đối chiếu Tax Referee với nghiên cứu học thuật, chuẩn mực, văn bản pháp luật và sản phẩm thương mại liên quan, ghi lại các cải tiến đã làm dựa trên đối chiếu đó, và liệt kê việc còn lại. Mỗi cải tiến gắn với commit và test kiểm chứng được.

---

## 1. Tóm tắt

- **Thiết kế cốt lõi khớp với nghiên cứu.**
  - Máy chỉ tự quyết khi đủ chắc, còn lại chuyển người; đây là "reject option" của Chow 1970.
  - Quy tắc tất định, AI chỉ đọc chứng từ. Bansal và cộng sự (2021) cho thấy một AI có hành vi dễ đoán là đồng đội tốt hơn một AI chính xác hơn chút ít nhưng khó đoán.
  - Câu hỏi chỉ được đặt khi câu trả lời có thể làm đổi quyết định; đây là dạng rời rạc của giá trị kỳ vọng của thông tin (Rao & Daumé III 2018).
- **Nghiên cứu chỉ ra 9 chỗ cần sửa, đã làm cả 9.** Mỗi chỗ là một commit kèm test (mục 7):
  - hậu kiểm ngẫu nhiên ca tự duyệt;
  - neo nhật ký ra ngoài;
  - nguyên tắc bốn mắt khi công bố policy;
  - tách nhỏ hóa đơn;
  - cụm tiền mặt cùng ngày;
  - kiểm thử thuộc tính;
  - căn cứ pháp lý theo ngày;
  - phát hiện trùng sau chuẩn hóa;
  - chọn mẫu hậu kiểm bằng HMAC kèm phân tầng.
- **Phát hiện quan trọng nhất là một lỗi pháp lý thật.** Từ 01/7/2025, NQ 204/2025/QH15 cùng NĐ 174/2025/NĐ-CP cho xăng, nhiên liệu dầu, than, hóa chất và hàng hóa/dịch vụ CNTT được giảm thuế còn 8%. Engine vẫn chặn các nhóm này theo danh mục cũ của NQ 174/2024, nên chuyển tiếp thừa và kết luận sai luật. Lỗi đã được sửa và văn bản viện dẫn nay chọn theo ngày lập hóa đơn.
- **Ranh giới trung thực.** Cơ chế giám sát của con người đã có đủ, nhưng *bằng chứng cơ chế đó hiệu quả* thì chưa có, vì còn chờ dữ liệu người dùng thật (Green 2022). Bảng đối chiếu ở mục 4.3 tách hai cột "cơ chế" và "bằng chứng" vì lý do này.

## 2. Phương pháp

| Bước | Cách làm |
|---|---|
| Phạm vi | Bốn mảng: (1) khi nào máy tự quyết, khi nào chuyển người; (2) giám sát của con người và tin máy quá mức; (3) Document AI và tuân thủ hóa đơn/thuế Việt Nam; (4) nhật ký chống sửa, policy-as-code và kiểm thử. |
| Thu thập | Bốn trợ lý nghiên cứu chạy song song, mỗi trợ lý một mảng: tìm, mở và đọc nguồn, đối chiếu với mã nguồn (chỉ đọc). Tổng cộng 63 nguồn: 33 bài báo/khảo sát, 9 chuẩn mực/khung, 9 văn bản pháp luật, 10 sản phẩm, 2 báo cáo kiểm toán. |
| Kiểm chứng | **Văn bản pháp luật:** đội tự tra lại ngày 15/10/2026 trước khi sửa mã, gồm NQ 204/2025 (đối chiếu nguyên văn Điều 1), NĐ 174/2025, TT 32/2025, NĐ 254/2026, TT 91/2026, khoản 3 Điều 26 NĐ 181/2025 và Luật 134/2025/QH15. **Nguồn học thuật dễ sai:** tra lại Buser và cộng sự 2025, Schemmer và cộng sự 2023. Điểm nào chưa đối chiếu được nguyên văn thì ghi rõ và không đưa vào mã. |
| Áp dụng | Ý cải tiến nào có căn cứ và rủi ro thấp thì làm ngay, mỗi ý một commit kèm test, chạy toàn bộ `npm test` (16 bộ). Ý nào đụng ca bẫy U2 của buổi thử 16/10 thì hoãn. |

Nguồn nào là bản preprint chưa bình duyệt, hoặc chỉ đọc được qua trích đoạn tìm kiếm (trang chặn truy cập tự động), đều được đánh dấu trong mục 10.

## 3. Mảng 1 — Khi nào máy tự quyết, khi nào chuyển người

### 3.1. Nghiên cứu chính

| Nguồn | Ý chính | Liên hệ với Tax Referee |
|---|---|---|
| Chow 1970, *IEEE Trans. Inf. Theory* | Chỉ quyết định khi đủ chắc. Ngưỡng từ chối tối ưu do tỉ lệ chi phí giữa "quyết sai" và "từ chối" quyết định. | Ba kiểu dừng là ba lý do từ chối. Ngưỡng 5 triệu là luật; 20 triệu và 200 triệu là ngưỡng chi phí nội bộ, tức tiền thuế có thể mất so với thời gian của KTT/CFO. |
| Geifman & El-Yaniv 2017, NeurIPS (SGR) | Chọn ngưỡng sao cho *cận trên* của rủi ro ≤ r* với xác suất 1−δ. | `calibrateThreshold` hiện chấp nhận ngưỡng khi "0 bỏ sót" trên tập nhỏ. 0/3 ca dương thì cận trên Wilson 95% vẫn khoảng 56%. Đây là việc còn lại (mục 8). |
| Angelopoulos và cộng sự 2024, ICLR (Conformal Risk Control) | Kiểm soát kỳ vọng của hàm mất mát đơn điệu, ví dụ tỉ lệ bỏ sót, với bảo đảm hữu hạn mẫu. | Có thể dùng mất mát có trọng số theo tiền thuế, để bỏ sót một ca 200 triệu nặng hơn bỏ sót một ca 2 triệu. |
| Madras và cộng sự 2018; Mozannar & Sontag 2020 (học chuyển tiếp) | Quyết định chuyển phải tính đến người nhận phía sau. Học chuyển tiếp cần nhãn chuyên gia không thiên lệch. | Hậu kiểm ngẫu nhiên (đã làm) tạo ra nhãn không thiên lệch cho làn tự duyệt. Lõi quyết định vẫn tất định, không đưa mô hình học vào. |
| Bansal và cộng sự 2021, AAAI | AI chính xác nhất chưa chắc là đồng đội tốt nhất; nên tối ưu tiện ích của cả đội. | Ủng hộ lựa chọn "luật tất định, AI chỉ đọc". Nên báo độ đúng *cuối cùng* sau khi người trả lời, không chỉ độ đúng của engine. |
| Rao & Daumé III 2018, ACL (EVPI); Zhang & Choi 2023; ClariQ 2020 | Câu hỏi tốt là câu mà câu trả lời có khả năng thay đổi kết quả; "không hỏi" cũng là một đáp án hợp lệ. | Ngưỡng trọng yếu (chỉ hỏi phương thức thanh toán từ 5 triệu, trạng thái MST từ 20 triệu) là EVPI rời rạc. Mỗi đáp án A/B đều ghi rõ hệ quả bằng tiền. |
| Xiong và cộng sự 2024, ICLR; Guo và cộng sự 2017, ICML; Kamath và cộng sự 2020, ACL | Mô hình tự khai độ tin cậy thì tự tin quá mức. Từ chối dựa trên "không thấy tín hiệu xấu" thất bại với dữ liệu ngoài miền. | Trường đọc từ ảnh được coi là *chưa xác minh* (đã có). Cờ ảnh mờ do Gemini tự khai vẫn là điểm yếu (mục 8). Nhận diện "ngoài phạm vi" bằng danh sách đen là bài toán ngoài miền; ca U2 được giữ nguyên có chủ đích cho buổi thử. |
| Amazon A2I với Textract (tài liệu AWS) | Ba điều kiện kích hoạt người duyệt: độ tin cậy thấp, thiếu trường quan trọng, và **lấy mẫu ngẫu nhiên "để kiểm toán mô hình"**. Cùng đầu vào thì cùng kết quả lấy mẫu. | Hai điều kiện đầu đã có. Điều kiện thứ ba là hậu kiểm ngẫu nhiên, nay đã làm và chọn mẫu tất định bằng HMAC. |

### 3.2. So sánh

| Thực hành theo nghiên cứu | Tax Referee trước 15/10 | Hiện nay |
|---|---|---|
| Không kết luận trên dữ kiện chưa xác minh | Có: phát hiện dựa trên dữ kiện chưa xác minh bị hạ xuống sau UNCERTAIN_INFO | Giữ nguyên |
| Chỉ hỏi khi câu trả lời đổi quyết định | Có: ngưỡng trọng yếu, số tiền nghi vấn nằm hai phía ngưỡng | Giữ nguyên; kiểm thử thuộc tính xác nhận 40 ca thường quy gõ tay đều không bị hỏi |
| Kiểm toán ngẫu nhiên làn tự động | Chưa có | **Đã có**: hậu kiểm 10%, tầng sát ngưỡng ×3, chọn mẫu HMAC, tỉ lệ đồng thuận người–máy kèm Wilson 95% |
| Ngưỡng có bảo đảm rủi ro | Holdout theo thời gian, nhưng quyết định bằng số đếm | Chưa đổi (backlog ưu tiên 1) |
| Tín hiệu bất định không do mô hình tự khai | Kiểm tra số học tất định | Chưa có đọc kép (backlog) |

## 4. Mảng 2 — Giám sát của con người và tin máy quá mức

### 4.1. Nghiên cứu chính

| Nguồn | Ý chính | Hàm ý |
|---|---|---|
| Parasuraman & Manzey 2010, *Human Factors* | Tâm lý chủ quan (complacency) và thiên lệch tự động hóa (automation bias) xảy ra với cả chuyên gia, tăng khi tải cao; đào tạo không ngăn được. | Không dựa vào "người dùng sẽ tự kiểm lại". Kiểm soát phải nằm sẵn trong thiết kế, ví dụ hậu kiểm ngẫu nhiên. |
| Skitka, Mosier & Burdick 1999/2000, *IJHCS* | Người dùng trợ lý tự động mắc cả lỗi bỏ sót lẫn lỗi làm theo máy. Bắt giải trình về *quy trình* giúp giảm lỗi. | Rủi ro lớn nhất là lỗi bỏ sót (ca U2). Hậu kiểm ghi đích danh người xem lại và lý do. |
| Goddard và cộng sự 2012, *JAMIA* (tổng quan 74 nghiên cứu) | Lời khuyên sai của hệ thống được làm theo nhiều hơn (RR 1,26). Đưa *thông tin* thay vì khuyến nghị giúp giảm. | Ở ca chuyển tiếp, hệ thống đưa dữ kiện, căn cứ và hệ quả bằng tiền của từng đáp án, không đưa kết luận. |
| Buçinca và cộng sự 2021, CSCW | "Cưỡng bức nhận thức" (tự quyết trước, xem gợi ý sau) giảm tin máy quá mức nhưng người dùng không thích. | Buổi thử 16/10 cho người dùng ghi quyết định trước khi xem máy. Trong sản phẩm chỉ áp dụng có chọn lọc. |
| Vasconcelos và cộng sự 2023, CSCW; Bansal và cộng sự 2021, CHI | Giải thích chỉ giúp khi kiểm chứng nhanh được; giải thích kiểu thuyết phục làm tăng chấp nhận bất kể máy đúng hay sai. | Lý do tự duyệt nên là checklist dữ kiện, và nêu rõ điều hệ thống *không* kiểm (backlog). |
| Schemmer và cộng sự 2023, IUI | "Mức độ tin cậy phù hợp" (AoR) có hai chiều: theo AI khi AI đúng, và giữ ý mình khi AI sai. Đo bằng thiết kế hai bước. | Chỉ số đồng thuận thô gộp cả những ca trùng tình cờ. Nên ghi thêm "quyết định sau khi xem máy". |
| Buser và cộng sự 2025, *Transp. Res. Part A* | Chèn ảnh vật cấm ảo (TIP) vào luồng soi chiếu thật để đo cảnh giác. Cần khoảng 100 sự kiện mỗi người để đo tin cậy (≥ 0,7). | Ca bẫy U2 với 3 người chỉ là **bằng chứng định tính**, không phải phép đo. |
| Green 2022, *CLSR* | Yêu cầu "có người giám sát" dễ tạo cảm giác an toàn giả; phải chứng minh giám sát hiệu quả bằng thực nghiệm. | Báo cáo tách "cơ chế đã có" khỏi "bằng chứng hiệu quả" (mục 4.3). |
| Santoni de Sio & van den Hoven 2018 | Kiểm soát có ý nghĩa cần *tracking* (hệ thống đáp ứng lý do của con người) và *tracing* (truy được về người chịu trách nhiệm). | Nhật ký công bố policy nay ghi cả người soạn lẫn người duyệt. |

### 4.2. Sản phẩm đã làm từ mảng này

- **Hậu kiểm ngẫu nhiên.** Đây là kiểm soát thay thế cho làn không có người duyệt, theo COSO nguyên tắc 10 và 16 và ISA/VSA 530:
  - 10% ca tự duyệt được chọn;
  - ca sát dưới ngưỡng 5 triệu / 20 triệu / 200 triệu được chọn với tỉ lệ gấp 3;
  - chọn mẫu bằng HMAC, nên người nhập không đoán trước được ca nào bị hậu kiểm;
  - Kế toán viên và người nhập không được tự hậu kiểm; "không đồng ý" thì giữ thuế ngay;
  - có tỉ lệ đồng thuận người–máy kèm khoảng Wilson 95%.
- **Nguyên tắc bốn mắt khi công bố policy** (COSO nguyên tắc 10; tinh thần Điều 14(5) EU AI Act và Điều 7.4 Luật 134/2025/QH15):
  - trước đây, một Kế toán trưởng có thể tự soạn và tự công bố policy nâng hạn mức của chính mình, khiến ca lớn không còn lên CFO;
  - nay bản nháp làm lỏng kiểm soát phải do một CFO khác người soạn duyệt;
  - không thể "rollback" một bản nháp để lách bước duyệt.

### 4.3. Đối chiếu khung giám sát của con người

Đây là **chuẩn tham chiếu tự nguyện**. Việc phân loại rủi ro theo Luật 134/2025/QH15 còn chờ văn bản hướng dẫn, và Tax Referee chưa được đánh giá theo EU AI Act hay ISO 42001, nên đội **không tuyên bố tuân thủ**.

| Yêu cầu | Cơ chế trong Tax Referee | Bằng chứng hiệu quả | Trạng thái |
|---|---|---|---|
| EU AI Act Điều 14(4)(a), (c): hiểu năng lực, giới hạn và diễn giải đúng đầu ra | Câu hỏi nêu dữ kiện, căn cứ theo ngày lập và hệ quả bằng tiền; trang /sop công khai quy tắc | Buổi thử 16/10 (định tính) | Một phần |
| Điều 14(4)(b): nhận biết tin máy quá mức | Hậu kiểm ngẫu nhiên kèm tỉ lệ đồng thuận; ca bẫy U2 trong buổi thử | Chưa có số liệu vận hành | Một phần |
| Điều 14(4)(d): bỏ qua, ghi đè, đảo ngược | OVERRIDE và UNDO là sự kiện mới, không sửa lịch sử | Kiểm thử tự động | Đã có |
| Điều 14(4)(e): nút dừng về trạng thái an toàn | Công tắc dừng toàn hệ thống: ca thường quy chờ KTT duyệt tay | Kiểm thử tự động | Đã có |
| Điều 14(5): hai người xác minh (áp dụng tương tự) | Bốn mắt khi công bố policy nới lỏng; người nhập không tự duyệt | Kiểm thử tự động | Đã có (policy); bật lại tự động hóa vẫn một người |
| Điều 12: nhật ký tự động | Nhật ký chỉ ghi thêm, chuỗi SHA-256 + HMAC, điểm neo có chữ ký phát hiện cắt đuôi và viết lại | Kiểm thử phát hiện sửa, xóa, cắt đuôi | Đã có |
| NIST AI RMF GOVERN 3.2: phân vai | Vai Kế toán viên / KTT / CFO; quyền theo vai ở server | Kiểm thử phân quyền | Đã có (chưa có bảng RACI văn bản) |
| NIST MEASURE 2.4: giám sát khi vận hành | Tỉ lệ đồng thuận hậu kiểm | Chưa có dữ liệu thật | Một phần |
| NIST MANAGE 2.4 và 4.1: ngắt, ghi đè, phục hồi | Công tắc dừng, rollback policy, CFO khôi phục ngưỡng | Kiểm thử tự động | Đã có |
| ISO/IEC 42001:2023: hệ thống quản lý AI | Policy có phiên bản, kiểm thử an toàn trước khi công bố, holdout, rollback | — | Một phần (thiếu lớp quản trị tổ chức) |
| OECD AI Principles 1.4: ghi đè, sửa, ngừng an toàn | Như trên | Kiểm thử tự động | Đã có |
| COSO nguyên tắc 10: phân tách nhiệm vụ, kiểm soát thay thế | Người nhập ≠ người duyệt; bốn mắt cho policy; hậu kiểm cho làn tự duyệt | Kiểm thử tự động | Đã có |
| COSO nguyên tắc 16, ISA/VSA 530: đánh giá định kỳ, lấy mẫu | Hậu kiểm ngẫu nhiên phân tầng, chọn mẫu tất định | Chưa có kỳ hậu kiểm thật | Một phần |
| Luật 134/2025/QH15 Điều 4.2: con người giữ thẩm quyền và khả năng can thiệp | Engine không tự duyệt ca có nghi vấn; KTT/CFO quyết; công tắc dừng | Kiểm thử tự động | Đã có |
| Luật 134 Điều 7.4: không vô hiệu hóa cơ chế giám sát | Bốn mắt cho policy nới lỏng; chặn rollback bản nháp | Kiểm thử tự động | Đã có |
| Luật 134 Điều 14.1(c), (d): hồ sơ kỹ thuật, nhật ký, khả năng giám sát | Hồ sơ kỹ thuật; nhật ký chống sửa | — | Đã có |

## 5. Mảng 3 — Document AI và tuân thủ hóa đơn/thuế

### 5.1. Phát hiện pháp lý (đội đã tự đối chiếu ngày 15/10/2026)

| Nội dung | Kết quả đối chiếu | Đã sửa trong mã |
|---|---|---|
| Danh mục loại trừ 8% theo NQ 204/2025/QH15, Điều 1 khoản 1 | Nguyên văn chỉ loại "viễn thông, hoạt động tài chính, ngân hàng, chứng khoán, bảo hiểm, kinh doanh bất động sản, sản phẩm kim loại, sản phẩm khai khoáng **(trừ than)**, sản phẩm hàng hóa và dịch vụ chịu thuế tiêu thụ đặc biệt **(trừ xăng)**". NĐ 174/2025 đưa xăng, nhiên liệu dầu, than các khâu, hóa chất và hàng hóa/dịch vụ CNTT vào diện được giảm. | Danh mục loại trừ chọn theo kỳ lập hóa đơn (`lib/legalBasis.ts`). Xăng, laptop, hóa chất áp 8% tháng 10/2026 không còn bị chặn; cùng mặt hàng tháng 3/2025 vẫn bị chặn với căn cứ NĐ 180/2024. |
| Thời gian giảm thuế | Các kỳ: 02–12/2022, 07/2023–12/2026 (NQ 43/2022, 101/2023, 110/2023, 142/2024, 174/2024, 204/2025). Kỳ 01–06/2023 không giảm thuế. | Hóa đơn 8% tháng 3/2023 nay bị chặn; trước đây lọt. |
| Hóa đơn điện tử | TT 32/2025/TT-BTC thay TT 78/2021 từ 01/6/2025. NĐ 254/2026/NĐ-CP thay NĐ 123/2020 và NĐ 70/2025 từ 01/7/2026, kèm TT 91/2026/TT-BTC thay TT 32/2025. | Căn cứ quy tắc mã CQT, ký hiệu, ngày ký, MST người mua chọn theo ngày lập. Với văn bản mới, mã chỉ ghi số hiệu, không ghi số điều, khi chưa đối chiếu nguyên văn. |
| Mua nhiều lần trong ngày | Khoản 3 Điều 26 NĐ 181/2025/NĐ-CP: mỗi lần dưới 5 triệu nhưng tổng trong ngày từ 5 triệu thì chỉ được khấu trừ khi có chứng từ thanh toán không dùng tiền mặt. | Căn cứ quy tắc cụm tiền mặt sửa thành khoản 3 Điều 26 NĐ 181/2025, thay cho "khoản 2 Điều 14 Luật 48/2024" chưa kiểm chứng được. Hóa đơn trước 01/7/2025 viện dẫn TT 219/2013. |
| Căn cứ cấp điều/khoản (đối chiếu 17/10 trên vanban.chinhphu.vn) | Ngưỡng 5 triệu: điểm b khoản 2 Điều 14 Luật 48/2024 (nguyên tắc) + Điều 26 NĐ 181/2025; trước 01/7/2025: khoản 2, khoản 5 Điều 15 TT 219/2013 (20 triệu). Mã CQT: điểm a khoản 2 Điều 3 và khoản 10 Điều 10 NĐ 123/2020. Năm trong ký hiệu: điểm b khoản 1 Điều 4 TT 78/2021 → điểm b khoản 1 Điều 5 TT 32/2025 → Điều 4 và Phụ lục I TT 91/2026. MST người mua: điểm a khoản 2 Điều 14 Luật 48/2024 + khoản 5 Điều 10 NĐ 123/2020. | `lib/legalBasis.ts` chọn chuỗi theo ngày lập; sổ văn bản sửa 6 liên kết trỏ sai văn bản, bỏ trích dẫn không có trong văn bản gốc, gắn nhãn UNVERIFIED cho văn bản chưa đối chiếu. Không quyết định nào thay đổi (so 180 ca trước/sau). |
| NĐ 181/2025 sửa bởi NĐ 144/2026 (hiệu lực 20/6/2026) | Có văn bản (docid 218020); sửa điểm g khoản 2 Điều 26 về trả chậm theo hợp đồng | Đã ghi vào sổ văn bản; engine chưa áp (lộ trình v1.2) |
| Luật 48/2024 sửa bởi Luật 149/2025/QH15 | Có văn bản, chưa đối chiếu điều khoản sửa đổi | Chưa đưa vào mã |

### 5.2. Nghiên cứu Document AI

| Nguồn | Ý chính | Hàm ý |
|---|---|---|
| LayoutLMv3 (ACM MM 2022) | Mô hình đa phương thức chữ + bố cục + ảnh; trọng số giấy phép CC BY-NC-SA (phi thương mại) | Không dùng thương mại được; chỉ để đối chứng |
| Donut (ECCV 2022, MIT) | Từ ảnh ra thẳng JSON, không cần OCR rời | Hướng tự host để dữ liệu không rời doanh nghiệp; vẫn cần lớp kiểm tra tất định sau trích xuất |
| SROIE (ICDAR 2019); MC-OCR 2021 (RIVF, 2.436 biên lai tiếng Việt) | Chuẩn đo trích xuất trường và chất lượng ảnh | Hồ sơ mới đo thời gian đọc, chưa đo độ chính xác (backlog) |
| OCRBench (Liu và cộng sự); khảo sát hallucination của Bai và cộng sự 2024 | Mô hình đa phương thức lớn yếu với chuỗi phi ngữ nghĩa | MST, số hóa đơn, MCCQT là chuỗi phi ngữ nghĩa. Đây là cơ sở học thuật cho nguyên tắc "AI chỉ đọc, quy tắc quyết định" |
| Alexopoulos và cộng sự 2021 (gian lận VAT, dữ liệu Bulgaria) | Gian lận VAT là hoạt động nhóm, chỉ cơ quan thuế thấy được toàn mạng | Doanh nghiệp mua nên dùng tín hiệu rủi ro do cơ quan thuế công bố, không tự xây ML phát hiện gian lận |
| VA OIG 16-02863-199; SSA OIG A-13-09-29027 | Tách nhỏ mua sắm để né hạn mức; một nguyên nhân là hướng dẫn nội bộ mâu thuẫn | Đã có quy tắc tách nhỏ cùng ngày; cửa sổ nhiều ngày là backlog |

### 5.3. So sánh với sản phẩm thương mại

Thông tin về sản phẩm lấy từ tài liệu công khai do chính hãng công bố, chưa kiểm chứng độc lập.

| Năng lực | AppZen | Coupa Spend Guard | SAP Concur Detect | Rossum / Vic.ai | MISA meInvoice | **Tax Referee** |
|---|---|---|---|---|---|---|
| Kiểm 100% hóa đơn trước khi duyệt | Có | Có | Có (trước và sau thanh toán) | Có (tự động khi đủ tin cậy) | Có | **Có**; mọi ca qua 24+ quy tắc tất định |
| Phát hiện trùng khác cách ghi | Có (đa kênh, khác người nộp) | Có; nêu rõ khớp tuyệt đối bỏ sót | — | — | Có | **Có** từ 15/10: chuẩn hóa số 0 đầu, ký tự phân cách, O/0 |
| Tách nhỏ để né hạn mức | — | Có (tự duyệt, thông đồng) | Có (mẫu hình theo thời gian) | — | — | **Có** (cùng bên bán, cùng ngày) |
| Tuân thủ thuế Việt Nam theo ngày hiệu lực | Không | Không | Không | Không | Có (thuế suất theo ngành, XML sửa sau ký) | **Có**: căn cứ và danh mục 8% theo ngày lập |
| Quyết định bằng | Mô hình chấm điểm | Mô hình + quy tắc | Mô hình | Độ tin cậy theo trường (Vic.ai: ≥ 95%) | Quy tắc + AI cảnh báo | **Quy tắc tất định có căn cứ; AI chỉ đọc chứng từ** |
| Câu hỏi chuyển tiếp trả lời một lần, có hệ quả bằng tiền | Không công bố | Không công bố | Không công bố | Không | Không công bố | **Có** ("Trả lời: 1A, 2B") |
| Ba kiểu dừng gắn thẩm quyền KTT/CFO | — | Định tuyến duyệt | — | Định tuyến | Kế toán và lãnh đạo duyệt | **Có** (ngoài quy định / vượt thẩm quyền / chưa rõ thông tin) |
| Nhật ký chống sửa có điểm neo | Không công bố | Không công bố | Không công bố | Không công bố | Không công bố | **Có** (chuỗi hash + HMAC + điểm neo) |
| Xác thực chữ ký số XML | — | — | — | — | Có | **Chưa** (chỉ so ngày ký với ngày lập; backlog) |
| Đồng bộ dữ liệu cơ quan thuế | — | — | — | — | Có | **Chưa** (chỉ nhập bảng kê bằng tệp) |

**Khác biệt của Tax Referee:** mỗi cảnh báo là một quy tắc có căn cứ, có người nhận và có hệ quả cho từng đáp án, không phải điểm số từ hộp đen. Hệ thống được tối ưu để *không hỏi thừa* nhờ ngưỡng trọng yếu. **Còn thua** MISA ở tích hợp dữ liệu cơ quan thuế và xác thực chữ ký số.

## 6. Mảng 4 — Nhật ký chống sửa, policy-as-code, kiểm thử

| Nguồn | Ý chính | Tax Referee |
|---|---|---|
| Schneier & Kelsey 1999 (TISSEC) | Chuỗi hash + MAC; khóa tiến hóa một chiều để kẻ chiếm máy không sửa được bản ghi cũ; việc xóa chỉ bị phát hiện khi đối chiếu với máy tin cậy | Đã có chuỗi hash + HMAC. Đã thêm điểm neo để đối chiếu. Khóa tiến hóa là backlog. |
| Ma & Tsudik 2008/2009 | Định nghĩa tấn công cắt đuôi (truncation attack) | Trước đây không phát hiện; **nay phát hiện được** khi so với điểm neo |
| Crosby & Wallach 2009 (USENIX Security); RFC 9162 Certificate Transparency | Logger không đáng tin; auditor giữ các commitment cũ và kiểm tính nhất quán | `/api/audit/anchor` cấp điểm neo {số sự kiện, hash cuối, thời điểm, chữ ký HMAC}; `/api/audit?verify=1&anchor…` kiểm cắt đuôi và viết lại |
| Microsoft SQL Server Ledger (digest management) | Digest phải lưu ở nơi người quản trị DB không sửa được | Điểm neo được thiết kế để lưu ra ngoài (email, ticket, file) |
| RFC 3161 (Time-Stamp Protocol); Luật GDĐT 2023 Điều 10; NĐ 23/2025 | Dấu thời gian do bên thứ ba ký; thông điệp dữ liệu toàn vẹn có giá trị như bản gốc | Backlog: neo bằng dịch vụ cấp dấu thời gian được cấp phép |
| OPA Decision Logs | Mỗi quyết định ghi input, kết quả, phiên bản policy để phát lại | `recordAction` ghi invoice, decision, policyVersion, policyHash, inputHash, commit. Công cụ phát lại là backlog. |
| OMG DMN, Drools; OECD OPSI 2020 (Rules as Code); Catala (ICFP 2021) | Bảng quyết định chạy được; ngoại lệ là cấu trúc hạng nhất; kiểm ở hai phía mỗi mốc hiệu lực | `lib/riskTaxonomy.ts` là một bảng duy nhất với thứ tự ưu tiên (hit policy PRIORITY). Đã thêm test ở hai phía mốc 01/7/2025. |
| Claessen & Hughes 2000 (QuickCheck); Chen và cộng sự 2018 (kiểm thử biến hình) | Phát biểu thuộc tính rồi sinh ngẫu nhiên đầu vào; quan hệ biến hình giải bài toán thiếu đáp án chuẩn | **Đã có**: 7 thuộc tính trên khoảng 1.500 hóa đơn sinh ngẫu nhiên (fast-check, seed cố định) |
| Jia & Harman 2011 (mutation testing); StrykerJS | Đo khả năng bộ test bắt lỗi cài cố ý | Backlog: chạy trong CI, không chạy trên máy dev ít RAM |
| Perez và cộng sự 2022 (red team bằng mô hình ngôn ngữ) | Cần đo độ đa dạng và có bộ chấm đáng tin | 72 ca red team do AI viết; nhãn chưa được người nghiệp vụ duyệt |

## 7. Cải tiến đã làm từ nghiên cứu

Tất cả nằm trên nhánh `feat/finals-improvements`. Sau mỗi commit, toàn bộ 16 bộ test đều đạt; unit test tăng từ 44 lên 68.

| # | Cải tiến | Căn cứ | Commit | Kiểm chứng |
|---|---|---|---|---|
| 1 | Tách nhỏ hóa đơn để né hạn mức phê duyệt: cộng các hóa đơn dưới hạn mức cùng bên bán, cùng ngày; vượt hạn mức thì chuyển CFO | VA OIG, SSA OIG; Coupa Spend Guard | `cad57ab` | `tests/unit/splitPurchase.test.ts`, đầu dò SPLIT1/SPLIT2 |
| 2 | Hậu kiểm ngẫu nhiên ca tự duyệt kèm tỉ lệ đồng thuận người–máy (Wilson 95%) | Amazon A2I; ISA/VSA 530; COSO nguyên tắc 10 và 16; Skitka 2000 | `fc655dc` | `tests/unit/postAudit.test.ts` |
| 3 | Cụm tiền mặt cùng ngày vượt ngưỡng: giữ thuế cả các hóa đơn tiền mặt đã tự duyệt trước đó | Khoản 3 Điều 26 NĐ 181/2025 | `363bf8b` | `tests/unit/sameDayCashCluster.test.ts` |
| 4 | Điểm neo nhật ký ký HMAC: phát hiện cắt đuôi và viết lại | Schneier–Kelsey; Ma–Tsudik; Crosby–Wallach; RFC 9162; SQL Ledger | `6af83cc` | `tests/unit/auditIntegrity.test.ts` |
| 5 | Chọn mẫu hậu kiểm bằng HMAC (không đoán trước được) và phân tầng ca sát ngưỡng ×3 | ISA 530 phụ lục 1; Amazon A2I | `ffd381b` | `tests/unit/postAudit.test.ts` |
| 6 | Bốn mắt khi công bố policy: nới lỏng kiểm soát cần CFO khác người soạn; chặn rollback bản nháp | COSO nguyên tắc 10; EU AI Act 14(5); Luật 134/2025 Điều 7.4; NIST GOVERN 3.2 | `e2e3840` | `tests/unit/policyMakerChecker.test.ts` |
| 7 | Kiểm thử thuộc tính: 7 bất biến trên khoảng 1.500 hóa đơn ngẫu nhiên. fast-check tìm ra ca biên "chuyển khoản từ 5 triệu nhưng thiếu UNC" (đúng luật, nên ghi thành điều kiện của thuộc tính) | QuickCheck; kiểm thử biến hình | `835381e` | `tests/unit/engineProperties.test.ts` |
| 8 | Căn cứ pháp lý theo ngày lập hóa đơn; danh mục loại trừ 8% đúng nguyên văn NQ 204/2025 | NQ 204/2025; NĐ 174/2025; TT 32/2025; NĐ 254/2026; TT 91/2026; NĐ 181/2025 | `9821f4d` | `tests/unit/keywordCoverage.test.ts` |
| 9 | Phát hiện trùng sau chuẩn hóa số hóa đơn ("123" = "0000123") | Coupa (khớp tuyệt đối bỏ sót trùng); AppZen | `ab0af92` | `tests/unit/duplicateNormalization.test.ts` |

Giao diện và API mới:
- `components/PostAuditPanel.tsx` (khối Hậu kiểm trong Nhật ký);
- `GET /api/post-audits`, `POST /api/post-audits/[id]`;
- `GET /api/audit/anchor`;
- khối "Bản nháp chờ duyệt" trong Policy Studio.

## 8. Việc còn lại (backlog có căn cứ)

| Ưu tiên | Việc | Căn cứ | Ghi chú |
|---|---|---|---|
| 1 | Ngưỡng có bảo đảm rủi ro trong `calibrateThreshold`: chỉ nâng ngưỡng khi cận trên tỉ lệ bỏ sót ≤ r* do CFO đặt; chưa đủ bằng chứng thì trả `INSUFFICIENT_EVIDENCE` | Geifman & El-Yaniv 2017; Conformal Risk Control 2024; Brown, Cai & DasGupta 2001 | Trả lời sẵn câu hỏi Q&A "mười mẫu có đủ không?" |
| 2 | Đảo mặc định phạm vi SOP sang danh sách trắng hạng mục; khoản không khớp thì hỏi một lần | Kamath và cộng sự 2020 | **Chỉ làm sau buổi thử 16/10**, vì ca bẫy U2 được giữ nguyên có chủ đích |
| 3 | Lý do tự duyệt dạng checklist dữ kiện, nêu rõ điều hệ thống không kiểm, ghi người phê duyệt policy | Vasconcelos 2023; Bansal 2021 (CHI); Santoni de Sio 2018 | |
| 4 | Đọc ảnh kép (Gemini + OCR cục bộ); trường bất đồng chuyển sang "chưa rõ thông tin"; đo độ chính xác trên MC-OCR/SROIE | Xiong 2024; Kumar 2026 (preprint); SROIE; MC-OCR | |
| 5 | Xác thực chữ ký số XML (XMLDSig) để phát hiện XML bị sửa sau khi ký | MISA meInvoice | Lấp khoảng cách lớn nhất so với MISA |
| 6 | Tách nhỏ theo cửa sổ nhiều ngày (7–30 ngày) và cụm hóa đơn sát ngưỡng; định nghĩa "tách nhỏ" trong SOP | VA OIG; SAP Concur Detect | Phải đo tỉ lệ chuyển tiếp thừa trước khi bật |
| 7 | Bốn mắt cho việc bật lại tự động hóa và cho nhãn hậu kiểm của chính người đã quyết ca | COSO nguyên tắc 10 | |
| 8 | Chuỗi HMAC v2: khóa theo kỷ nguyên (an toàn tiến) và mã hóa chuẩn tắc thay `join('|')`, vì `('INV-1|u-42','')` và `('INV-1','u-42|')` hiện cho cùng hash | Schneier–Kelsey; Ma–Tsudik; RFC 9162 | Mức nghiêm trọng thấp vì ID do hệ thống sinh; cần phiên bản hóa để không làm hỏng chuỗi cũ |
| 9 | Công cụ phát lại quyết định (`audit:replay`) và ghi đủ ngữ cảnh không tất định | OPA Decision Logs | |
| 10 | Mutation testing (StrykerJS) trong CI; nhãn red team do người nghiệp vụ duyệt | Jia & Harman 2011; Perez 2022 | |
| 11 | Giao thức đo hai bước cho buổi thử: thêm "quyết định sau khi xem máy" để đo AoR; báo kappa cạnh tỉ lệ đồng thuận thô | Schemmer 2023; Cohen 1960; Buçinca 2021 | Không thay đổi ca U2 |

## 9. Giới hạn của nghiên cứu này

- Bước tổng hợp tự động và bước kiểm chứng trích dẫn tự động của quy trình nghiên cứu không chạy xong. Đội tự tổng hợp từ kết quả của bốn mảng, tự kiểm chứng các văn bản pháp luật đã dùng để sửa mã và tra lại một số nguồn học thuật dễ sai.
- Một số trang (Coupa, thuvienphapluat, OECD PDF) chặn truy cập tự động. Phần liên quan chỉ dựa trên trích đoạn tìm kiếm.
- NĐ 254/2026 thay NĐ 123/2020 và NĐ 70/2025: số hiệu và hiệu lực khớp giữa nhiều nguồn, nhưng đội chưa đọc toàn văn trên Công báo. Vì vậy mã không ghi số điều của văn bản mới.
- Thuật ngữ RAIR/RSR được một số nguồn thứ cấp gắn với Schemmer và cộng sự 2023, nhưng chưa xác nhận trong bài gốc. Báo cáo chỉ dùng khái niệm AoR hai chiều đã xác nhận được.
- Số liệu sản phẩm thương mại do hãng tự công bố.
- Mọi diễn giải điều khoản pháp lý trong engine vẫn ở mức `DOCUMENT_CONFIRMED_RULE_PENDING`, nghĩa là văn bản đã được đối chiếu nhưng diễn giải vẫn cần chuyên gia thuế xác nhận.

## 10. Tài liệu tham khảo

**Khi nào máy tự quyết, khi nào chuyển người**
- Chow, C. K. (1970). On optimum recognition error and reject tradeoff. *IEEE Trans. Information Theory*, 16(1), 41–46. https://doi.org/10.1109/TIT.1970.1054406
- Geifman, Y., & El-Yaniv, R. (2017). Selective Classification for Deep Neural Networks. NeurIPS 30. arXiv:1705.08500
- Madras, D., Pitassi, T., & Zemel, R. (2018). Predict Responsibly: Improving Fairness and Accuracy by Learning to Defer. NeurIPS. arXiv:1711.06664
- Mozannar, H., & Sontag, D. (2020). Consistent Estimators for Learning to Defer to an Expert. ICML, PMLR 119. arXiv:2006.01862
- Bansal, G., Nushi, B., Kamar, E., Horvitz, E., & Weld, D. S. (2021). Is the Most Accurate AI the Best Teammate? AAAI 35(13). https://doi.org/10.1609/aaai.v35i13.17359
- Angelopoulos, A. N., & Bates, S. (2021). A Gentle Introduction to Conformal Prediction. arXiv:2107.07511
- Angelopoulos, A. N., Bates, S., Fisch, A., Lei, L., & Schuster, T. (2024). Conformal Risk Control. ICLR. arXiv:2208.02814
- Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q. (2017). On Calibration of Modern Neural Networks. ICML. arXiv:1706.04599
- Xiong, M. và cộng sự (2024). Can LLMs Express Their Uncertainty? ICLR. arXiv:2306.13063
- Kamath, A., Jia, R., & Liang, P. (2020). Selective Question Answering under Domain Shift. ACL. https://doi.org/10.18653/v1/2020.acl-main.503
- Rao, S., & Daumé III, H. (2018). Learning to Ask Good Questions (EVPI). ACL. https://doi.org/10.18653/v1/P18-1255
- Aliannejadi, M. và cộng sự (2020). ConvAI3: ClariQ. arXiv:2009.11352
- Zhang, M. J. Q., & Choi, E. (2023). Clarify When Necessary. arXiv:2311.09469
- Brown, L. D., Cai, T. T., & DasGupta, A. (2001). Interval Estimation for a Binomial Proportion. *Statistical Science* 16(2). https://doi.org/10.1214/ss/1009213286
- Amazon Web Services. Amazon Augmented AI with Amazon Textract — Human Loop Activation Conditions. https://docs.aws.amazon.com/sagemaker/latest/dg/a2i-json-humantaskactivationconditions-textract-example.html
- Kumar, N. (2026). Beyond Logprobs: A Multi-Signal Confidence Engine for LLM-Based Document Field Extraction. arXiv:2606.24420 (*preprint, chưa bình duyệt; chỉ dùng làm gợi ý thiết kế*)

**Giám sát của con người**
- Parasuraman, R., & Manzey, D. H. (2010). Complacency and Bias in Human Use of Automation. *Human Factors* 52(3). https://doi.org/10.1177/0018720810376055
- Skitka, L. J., Mosier, K. L., & Burdick, M. (1999). Does automation bias decision-making? *IJHCS* 51(5); (2000) Accountability and automation bias. *IJHCS* 52(4)
- Goddard, K., Roudsari, A., & Wyatt, J. C. (2012). Automation bias: a systematic review. *JAMIA* 19(1). https://doi.org/10.1136/amiajnl-2011-000089
- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). To Trust or to Think. *PACM HCI* 5(CSCW1). https://doi.org/10.1145/3449287
- Vasconcelos, H. và cộng sự (2023). Explanations Can Reduce Overreliance on AI Systems During Decision-Making. *PACM HCI* 7(CSCW1). https://doi.org/10.1145/3579605
- Bansal, G. và cộng sự (2021). Does the Whole Exceed its Parts? CHI '21. https://doi.org/10.1145/3411764.3445717
- Schemmer, M., Kühl, N., Benz, C., Bartos, A., & Satzger, G. (2023). Appropriate Reliance on AI Advice. IUI '23, 410–422. https://doi.org/10.1145/3581641.3584066
- Cohen, J. (1960). A Coefficient of Agreement for Nominal Scales. https://doi.org/10.1177/001316446002000104
- Green, B. (2022). The flaws of policies requiring human oversight of government algorithms. *CLSR* 45. https://doi.org/10.1016/j.clsr.2022.105681
- Santoni de Sio, F., & van den Hoven, J. (2018). Meaningful Human Control over Autonomous Systems. *Frontiers in Robotics and AI* 5:15. https://doi.org/10.3389/frobt.2018.00015
- Buser, D., Schwaninger, A., Rehor, V., & Sterchi, Y. (2025). Reliability and validity of threat image projection data. *Transportation Research Part A* 200, 104640. https://doi.org/10.1016/j.tra.2025.104640
- Regulation (EU) 2024/1689 (EU AI Act), Điều 12, 14. https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- NIST (2023). AI Risk Management Framework 1.0, NIST AI 100-1. https://doi.org/10.6028/NIST.AI.100-1
- ISO/IEC 42001:2023. https://www.iso.org/standard/81230.html
- OECD (2019, sửa 2024). Recommendation of the Council on AI, nguyên tắc 1.4. https://oecd.ai/en/dashboards/ai-principles/P8
- Quốc hội (2025). Luật Trí tuệ nhân tạo số 134/2025/QH15 (thông qua 10/12/2025, hiệu lực 01/3/2026)
- COSO (2013). Internal Control — Integrated Framework
- IAASB. ISA 530 Audit Sampling; Bộ Tài chính, VSA 530 (TT 214/2012/TT-BTC)

**Document AI và tuân thủ hóa đơn/thuế**
- Huang, Y. và cộng sự (2022). LayoutLMv3. ACM MM. arXiv:2204.08387
- Kim, G. và cộng sự (2022). OCR-free Document Understanding Transformer (Donut). ECCV. arXiv:2111.15664
- Huang, Z. và cộng sự (2019). ICDAR2019 SROIE. arXiv:2103.10213
- Vu, X.-S. và cộng sự (2021). MC-OCR Challenge. RIVF. https://doi.org/10.1109/RIVF51545.2021.9642077
- Liu, Y. và cộng sự (2023). On the Hidden Mystery of OCR in Large Multimodal Models (OCRBench). arXiv:2305.07895; Bai, Z. và cộng sự (2024). Hallucination of Multimodal LLMs: A Survey. arXiv:2404.18930
- Alexopoulos, A. và cộng sự (2021). A network and machine learning approach to detect VAT fraud. arXiv:2106.14005
- VA OIG (2018). Report 16-02863-199; SSA OIG (2010). A-13-09-29027
- Sản phẩm: AppZen (appzen.com/ap-automation); Coupa Spend Guard và blog Flight AI; SAP Concur Detect by Oversight; Rossum Knowledge Base; Vic.ai; Stampli; MISA meInvoice (meinvoice.vn/xu-ly-hoa-don-dau-vao)
- Văn bản pháp luật: Nghị quyết 204/2025/QH15; NĐ 174/2025/NĐ-CP; NĐ 181/2025/NĐ-CP (Điều 26); Luật 48/2024/QH15; TT 32/2025/TT-BTC; NĐ 254/2026/NĐ-CP; TT 91/2026/TT-BTC; NQ 43/2022, 101/2023, 110/2023, 142/2024, 174/2024/QH15 cùng NĐ 15/2022, 44/2023, 94/2023, 72/2024, 180/2024/NĐ-CP

**Nhật ký chống sửa, policy-as-code, kiểm thử**
- Schneier, B., & Kelsey, J. (1999). Secure Audit Logs to Support Computer Forensics. *ACM TISSEC*
- Ma, D., & Tsudik, G. (2009). A New Approach to Secure Logging. *ACM Trans. Storage* 5(1). https://doi.org/10.1145/1502777.1502779
- Crosby, S. A., & Wallach, D. S. (2009). Efficient Data Structures for Tamper-Evident Logging. USENIX Security
- RFC 9162 Certificate Transparency 2.0 (2021); RFC 3161 Time-Stamp Protocol (2001)
- Microsoft Learn. SQL Server Ledger — Digest management
- Luật Giao dịch điện tử 20/2023/QH15, Điều 10; NĐ 23/2025/NĐ-CP
- OMG DMN; Apache KIE Drools DMN; Open Policy Agent — Decision Logs, Policy Testing
- Mohun, J., & Roberts, A. (2020). Cracking the Code: Rulemaking for Humans and Machines. OECD WP on Public Governance No. 42
- Merigoux, D., Chataing, N., & Protzenko, J. (2021). Catala: A Programming Language for the Law. ICFP. https://doi.org/10.1145/3473582
- Claessen, K., & Hughes, J. (2000). QuickCheck. ICFP; fast-check (github.com/dubzzz/fast-check)
- Chen, T. Y. và cộng sự (2018). Metamorphic Testing: A Review. *ACM CSUR* 51(1). https://doi.org/10.1145/3143561
- Jia, Y., & Harman, M. (2011). An Analysis and Survey of the Development of Mutation Testing. *IEEE TSE* 37(5). https://doi.org/10.1109/TSE.2010.62
- Perez, E. và cộng sự (2022). Red Teaming Language Models with Language Models. EMNLP. https://doi.org/10.18653/v1/2022.emnlp-main.225
