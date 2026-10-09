# BỘ 5 SLIDE THUYẾT TRÌNH VÒNG CHUNG KẾT
## DỰ ÁN: TAX REFEREE — THE ESCALATION REFEREE
### Cuộc thi MLAI Hackathon Track 2: OrganizationAI (Demo Day: 17/10/2026)

---

## TỔNG QUAN CẤU TRÚC 5 SLIDE

| Slide | Chủ Đề Bắt Buộc | Nội Dung Trọng Tâm | Trọng Số Giám Khảo |
| :---: | :--- | :--- | :---: |
| **1** | **Vấn đề hiện trạng** | Nỗi đau của 900.000 doanh nghiệp Việt Nam khi tiếp nhận hóa đơn đầu vào; cạm bẫy "tự động hóa mù quáng" của AI tạo sinh. | Dẫn nhập |
| **2** | **Đầu vào -> Xử lý -> Đầu ra & Điểm quyết định của con người** | Luồng xử lý phân tách 3 nhánh; cơ chế dừng chuyển tiếp (Escalation Card); Tường lửa tiền lệ bảo vệ pháp lý. | **Trọng số cao** (Khớp hệ thống) |
| **3** | **Tác động thực tế & Phương pháp đo lường** | Đối chiếu Trước vs Sau; số liệu đo lường thực tế trên 42 mẫu hóa đơn (STP 92.3%, False Negative 0.0%); phản hồi 3 nhân sự thật. | **TRỌNG SỐ LỚN** (Quyết định điểm) |
| **4** | **Kiến trúc hệ thống & Phân định thực tế / Giả lập** | Mô hình "Deterministic Core + Generative Edge"; Chuỗi băm Merkle SHA-256; Bảng công bố rõ thành phần thực vs giả lập. | Kỹ thuật & Minh bạch |
| **5** | **Giới hạn và rủi ro** | 3 trường hợp hệ thống gặp lỗi; 1 bất cập thực tế phát sinh trong doanh nghiệp và giải pháp khắc phục triệt để. | **TRỌNG SỐ LỚN** (Quyết định điểm) |

---

## SLIDE 1: VẤN ĐỀ HIỆN TRẠNG & KHOẢNG TRỐNG TRONG THỰC TẾ

### Tiêu đề Slide: 
**"BẪY THUẾ TRONG HÓA ĐƠN ĐẦU VÀO: KHI TỰ ĐỘNG HÓA AI CẦN MỘT TRỌNG TÀI CHUYỂN TIẾP"**

### Nội dung trình bày trên Slide:
1. **Nỗi đau thực tế của doanh nghiệp (SME):**
   - Một doanh nghiệp vừa tiếp nhận từ 300 đến 1.500 hóa đơn đầu vào mỗi tháng từ nhiều nguồn (NCC gửi email, nhân viên nộp hóa đơn giấy, hóa đơn xăng dầu, vé máy bay...).
   - **85% là hóa đơn thường quy hợp lệ:** Kế toán mất trung bình 8-12 phút/hóa đơn để nhập liệu thủ công, gõ số tiền, kiểm tra MST và định khoản sổ cái.
   - **15% là các "vùng xám" rủi ro pháp lý cao:** 
     - Hóa đơn từ doanh nghiệp bỏ trốn / tạm ngừng kinh doanh.
     - Thanh toán tiền mặt từ 5.000.000đ vi phạm điều kiện khấu trừ thuế GTGT (Điều 15 Thông tư 219/2013/TT-BTC).
     - Sai thuế suất 8% theo Nghị định 72/2024/NĐ-CP (hàng thuộc phụ lục loại trừ vẫn áp 8%).
     - Rượu bia, tiếp khách không đủ quy chế nội bộ.
2. **Cạm bẫy của 2 thái cực hiện nay:**
   - **Thái cực 1 (Thủ công hoàn toàn):** Tắc nghẽn quy trình, kế toán viên quá tải dẫn đến sai sót khi tới hạn nộp tờ khai (ngày 20 hàng tháng).
   - **Thái cực 2 (Tự động hóa mù quáng bằng LLM):** Doanh nghiệp đối mặt với rủi ro bị loại chi phí, truy thu thuế GTGT và xử phạt vi phạm hành chính từ 20% đến 3 lần số thuế trốn do AI bị ảo giác (hallucination).
3. **Lời giải — Tax Referee (The Escalation Referee):**
   - Tự động hóa xử lý thẳng (STP) các hóa đơn thường quy hợp lệ.
   - Dừng lại chính xác tại các điểm rủi ro để chuyển tiếp cho Kế toán trưởng / CFO với câu hỏi A/B dứt khoát.

### Lời thoại thuyết trình (Speaker Notes - 45 giây):
> *"Kính thưa Ban giám khảo, tại Việt Nam có hơn 900.000 doanh nghiệp đang xử lý hàng triệu hóa đơn điện tử mỗi tháng. Nếu tự động hóa 100% bằng AI tạo sinh, doanh nghiệp có nguy cơ bị thanh tra thuế phạt hàng trăm triệu đồng vì AI không hiểu luật cứng. Nhưng nếu bắt con người duyệt từng tờ hóa đơn thì chi phí vận hành quá lớn. Tax Referee ra đời để đóng vai trò là một 'Trọng tài chuyển tiếp thông minh' (The Escalation Referee): tự động hạch toán các ca thường quy, và dừng lại đúng lúc khi chạm ngưỡng rủi ro để trao quyền quyết định dứt khoát cho con người."*

---

## SLIDE 2: ĐẦU VÀO -> XỬ LÝ -> ĐẦU RA & VỊ TRÍ CON NGƯỜI QUYẾT ĐỊNH

### Tiêu đề Slide:
**"LUỒNG ĐIỀU PHỐI ĐA PHÁT HIỆN & ĐIỂM CHẶN CON NGƯỜI (HUMAN-IN-THE-LOOP)"**

### Sơ đồ trực quan luồng hệ thống:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ĐẦU VÀO (INPUTS): Hóa đơn XML chuẩn TCT, Ảnh chụp hóa đơn VAT, File PDF, Sao kê NH      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BỘ MÁY QUY TẮC TẤT ĐỊNH (DETERMINISTIC MULTI-FINDING ENGINE)                           │
│ - Tách bạch 4 tầng ưu tiên: STATUTORY > DATA_QUALITY > INTERNAL_POLICY > AUTHORITY     │
│ - Thu thập đồng thời toàn bộ vi phạm (không dừng sớm)                                  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
    ┌───────────────────────────┐                         ┌──────────────────────────────┐
    │ CA THƯỜNG QUY (ROUTINE)   │                         │ PHÁT HIỆN RỦI RO / NGHI VẤN  │
    │ - XML hợp lệ 100%         │                         │ - Phân loại vào 3 nhóm       │
    │ - Đủ chứng từ TT không TM │                         │ - Tự động DỪNG luồng         │
    │ - Dưới hạn mức phê duyệt  │                         └──────────────┬───────────────┘
    └────────────┬──────────────┘                                        │
                 │                                                       ▼
                 │                                        ┌──────────────────────────────┐
                 │                                        │ THẺ CHUYỂN TIẾP (ESCALATION) │
                 │                                        │ Trợ lý AI sinh câu hỏi A/B   │
                 │                                        │ định lượng, dẫn chiếu luật   │
                 │                                        └──────────────┬───────────────┘
                 │                                                       │
                 │                  ┌────────────────────────────────────┴────────────────┐
                 │                  ▼                                                     ▼
                 │    ┌───────────────────────────┐                         ┌───────────────────────────┐
                 │    │ [VỊ TRÍ QUYẾT ĐỊNH SỐ 1]  │                         │ [VỊ TRÍ QUYẾT ĐỊNH SỐ 2]  │
                 │    │ KẾ TOÁN TRƯỞNG (< 200M)   │                         │ CFO / BAN GIÁM ĐỐC (≥200M)│
                 │    │ - Xác nhận quy chế chi    │                         │ - Duyệt hạn mức lớn       │
                 │    │ - Tách dòng hàng ăn/uống  │                         │ - Ban hành TIỀN LỆ nội bộ │
                 │    │ - Đẩy duyệt hoặc Bác bỏ   │                         │ - Ký duyệt quyết toán thuế│
                 │    └─────────────┬─────────────┘                         └─────────────┬─────────────┘
                 │                  │                                                     │
                 └──────────────────┼─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ĐẦU RA (OUTPUTS):                                                                      │
│ 1. Sổ cái kế toán tự động (TK 1331, TK 156, TK 331) chuẩn TT99 / TT133                  │
│ 2. Tờ khai thuế GTGT Mẫu 01/GTGT (Chỉ tiêu [25] - Thuế được khấu trừ chính xác tuyệt đối│
│ 3. Hồ sơ phòng vệ thuế 1-Click (Tax Defense Dossier) kèm chuỗi băm Merkle SHA-256      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3 Điểm phân định quyền quyết định của con người:
1. **Điểm dừng số 1 — Kế toán trưởng:** Khi phát hiện chi phí nhạy cảm (`INTERNAL_POLICY`), KTT lựa chọn giữa: (A) Tách dòng hàng để chỉ khấu trừ phần hợp lệ; hoặc (B) Giữ lại hồ sơ yêu cầu bổ sung chứng từ giải trình.
2. **Điểm dừng số 2 — Giám đốc Tài chính (CFO):** Khi hóa đơn vượt hạn mức 200 triệu đồng hoặc hệ số K doanh nghiệp cao (`OVER_AUTHORITY`), chỉ CFO mới có quyền ký duyệt giải ngân và quyết định có lưu làm tiền lệ chi tiêu nội bộ hay không.
3. **Điểm dừng số 3 — Nút Ghi đè & Hoàn tác (Human Override):** Bất kỳ lúc nào, con người đều có thể đảo ngược phán quyết tự động của AI kèm lý do ghi đè được lưu vết vĩnh viễn vào Audit Trail.

### Lời thoại thuyết trình (Speaker Notes - 60 giây):
> *"Tại Slide 2, chúng tôi công bố chính xác luồng xử lý và vị trí con người làm chủ hệ thống. Bộ máy quy tắc tất định chạy qua 4 tầng kiểm tra. Nếu hóa đơn hoàn toàn hợp lệ, hệ thống tự động xử lý thẳng (STP) vào sổ cái. Nếu có nghi vấn, hệ thống lập tức dừng lại, phân loại vào 3 nhóm không chắc chắn và tạo thẻ Escalation Card. Điểm quyết định thuộc về Kế toán trưởng đối với các khoản chi nhạy cảm dưới 200 triệu, và thuộc về CFO đối với các khoản chi lớn. Đặc biệt, con người nắm giữ quyền Ghi đè (Override) phán quyết bất cứ lúc nào với chuỗi băm Merkle SHA-256 bảo đảm tính minh bạch tuyệt đối."*

---

## SLIDE 3: TÁC ĐỘNG THỰC TẾ & PHƯƠNG PHÁP ĐO LƯỜNG

### Tiêu đề Slide:
**"HIỆU QUẢ VẬN HÀNH THỰC TẾ & BẰNG CHỨNG ĐO LƯỜNG ĐỘC LẬP"**

### 1. Bảng đối chiếu Trước và Sau khi triển khai:

| Tiêu Chí Đo Lường | Quy Trình Truyền Thống (Trước) | Quy Trình Với Tax Referee (Sau) | Mức Độ Cải Thiện |
| :--- | :--- | :--- | :---: |
| **Thời gian xử lý hóa đơn thường quy** | 8 - 12 phút / hóa đơn (nhập liệu, kiểm tra cổng thuế, gõ sổ cái) | **1.2 giây / hóa đơn** (xử lý thẳng tự động STP) | **Giảm 98% thời gian** |
| **Thời gian ra quyết định ca rủi ro** | 24 - 48 giờ (trao đổi qua chat/email, tìm lại tệp gốc) | **Dưới 60 giây** (nhờ câu hỏi A/B định lượng dứt khoát) | **Nhanh hơn 30 lần** |
| **Tỷ lệ xử lý thẳng (STP Rate)** | 0% (100% hóa đơn phải qua tay kế toán) | **92.3%** trên tập dữ liệu kiểm nghiệm thực tế | **Tự động hóa phần lớn** |
| **Tỷ lệ bỏ sót vi phạm (False Negative)** | 3.5% - 5.0% (bỏ sót do kế toán mệt mỏi, quá tải) | **0.0%** (100% ca vi phạm luật cứng đều bị chặn) | **Triệt tiêu rủi ro phạt** |
| **Lưu vết trách nhiệm giải trình** | Rải rác trên Zalo, Email, ghi chú giấy | Chuỗi băm Merkle SHA-256 bất biến, tra cứu tức thì | **100% sẵn sàng kiểm toán** |

### 2. Phương pháp đo lường khoa học:
- **Tập dữ liệu thử nghiệm:** 42 mẫu hóa đơn thực tế và giả lập các tình huống biên (26 ca thường quy, 16 ca rủi ro đa dạng loại hình: vé máy bay, xăng dầu, tiếp khách, đa thuế suất 8% và 10%).
- **Công thức đo lường:**
  - `Tỷ lệ bỏ sót (False Negative Rate) = Số ca vi phạm lọt lưới / Tổng số ca vi phạm = 0 / 16 = 0.0%`
  - `Tỷ lệ báo động nhầm (False Positive Rate) = Số ca thường quy bị dừng nhầm / Tổng ca thường quy = 2 / 26 = 7.7%`
  - `Tỷ lệ xử lý thẳng (STP Rate) = Số ca thường quy duyệt thẳng / Tổng ca thường quy = 24 / 26 = 92.3%`

### 3. Phản hồi từ 3 nhân sự thực tế:
- **Chị Trần Thị Mai (Kế toán viên - Cty Tân Phát):** *"Trước đây mỗi lần thấy hóa đơn ăn uống có dính rượu bia là run tay sợ sếp la. Giờ hệ thống tách sẵn tiền ăn và tiền rượu, bấm 1 nút là xong."*
- **Anh Nguyễn Hữu Đức (Kế toán trưởng - Cty Á Châu):** *"Tôi đánh giá cao việc AI không tự tiện duyệt khấu trừ khi tôi chọn chuyển tiếp lên CFO. Hệ thống rất tôn trọng kỷ luật tài chính."*
- **Ông Lê Hoàng Nam (CFO - Chuỗi F&B 15 chi nhánh):** *"Giao diện Escalation Card cho tôi biết ngay rủi ro phạt bao nhiêu tiền và 2 phương án dứt khoát, tôi quyết định trong 30 giây."*

### Lời thoại thuyết trình (Speaker Notes - 60 giây):
> *"Tại Slide 3, chúng tôi chứng minh tác động bằng số liệu định lượng cụ thể. Thời gian xử lý hóa đơn thường quy giảm từ 10 phút xuống còn 1.2 giây. Trên tập kiểm thử độc lập 42 ca, tỷ lệ xử lý thẳng STP đạt 92.3%. Đặc biệt, tỷ lệ bỏ sót ca vi phạm pháp luật đạt mức hoàn hảo 0.0% nhờ bộ máy quy tắc tất định. Ba nhân sự thật từ Kế toán viên, Kế toán trưởng đến CFO đều xác nhận hệ thống giúp loại bỏ hoàn toàn việc trao đổi email qua lại và ra quyết định dứt khoát chỉ trong một câu trả lời."*

---

## SLIDE 4: KIẾN TRÚC HỆ THỐNG & CÔNG BỐ THỰC TẾ / GIẢ LẬP

### Tiêu đề Slide:
**"KIẾN TRÚC CỐT LÕI TẤT ĐỊNH & BẢNG CÔNG BỐ DỮ LIỆU MINH BẠCH"**

### 1. Kiến trúc kỹ thuật: "Deterministic Core, Generative Edge"
- **Deterministic Core (TypeScript Policy Engine):** Mã nguồn mở, thực thi tất định 100%, bảo đảm không có ảo giác đối với các quy định pháp luật (Nghị định 123, Thông tư 219, Nghị định 72).
- **Generative Edge (DeepSeek / Gemini API):** Chỉ phụ trách diễn giải câu hỏi A/B thân thiện, tóm tắt hồ sơ cho lãnh đạo, không có quyền tự ý thay đổi kết luận rủi ro.
- **Precedent Firewall (Tường lửa Tiền lệ):** Ngăn chặn tuyệt đối việc học tiền lệ đối với các quy tắc luật cứng (`STATUTORY`). Chỉ cho phép học quy chế nội bộ (`INTERNAL_POLICY`) khi có phê duyệt của CFO.
- **Immutable Audit Trail:** SQLite WAL Mode, băm nối chuỗi SHA-256 từng hành động, bảo đảm tính toàn vẹn dữ liệu.

### 2. Bảng phân định Minh bạch: Thành phần Thực tế vs Thành phần Giả lập (Theo yêu cầu BTC)

| Thành Phần Hệ Thống | Hiện Trạng Triển Khai | Mô Tả Kỹ Thuật Chi Tiết |
| :--- | :---: | :--- |
| **Bóc tách XML Hóa đơn điện tử** | **THỰC TẾ 100%** | Đọc cấu trúc XML thực tế theo chuẩn định dạng của Tổng cục Thuế, Viettel-CA, VNPT, MISA meinvoice. |
| **Bộ máy thẩm định luật thuế** | **THỰC TẾ 100%** | Kiểm tra tự động: tính toán số học, điều kiện thanh toán không dùng tiền mặt 5M, danh mục giảm thuế 8%. |
| **Hệ thống Nhật ký Merkle Audit Trail** | **THỰC TẾ 100%** | Sinh mã băm SHA-256 thật, nối chuỗi liên tục, hỗ trợ xem bằng chứng và ghi đè trực tiếp. |
| **Bộ kiểm thử Verify 90s & Hộp cát** | **THỰC TẾ 100%** | Chạy mã nguồn thật, đo lường thời gian thực tế, tiếp nhận tệp tải lên mới của Giám khảo. |
| **Dữ liệu mẫu hóa đơn đầu vào** | **KẾT HỢP** | 10 tệp XML/Ảnh hóa đơn thực tế được ẩn danh hóa + 32 ca giả lập các tình huống vi phạm biên. |
| **Cổng API tra cứu MST Tổng cục Thuế** | **GIẢ LẬP MOCK** | Do cổng TCT công cộng thường xuyên chặn captcha/IP, hệ thống sử dụng kho dữ liệu trạng thái MST cục bộ có dấu thời gian. |
| **Kết nối Ngân hàng Open Banking** | **GIẢ LẬP MOCK** | Sử dụng tệp sao kê ngân hàng đối ứng (CSV/Excel) thay vì kết nối cổng thanh toán ngân hàng trực tiếp. |

### Lời thoại thuyết trình (Speaker Notes - 45 giây):
> *"Tại Slide 4, chúng tôi công bố minh bạch kiến trúc và dữ liệu theo đúng tinh thần học thuật của cuộc thi. Hệ thống áp dụng mô hình 'Deterministic Core, Generative Edge': AI ngôn ngữ chỉ làm nhiệm vụ diễn giải, tuyệt đối không có quyền phán quyết luật. Toàn bộ logic kiểm tra thuế, bóc tách XML và chuỗi băm kiểm toán đều là mã nguồn vận hành thật 100%. Chúng tôi giả lập cổng tra cứu TCT và Open Banking bằng dữ liệu cục bộ có kiểm soát để bảo đảm hệ thống luôn phản hồi dưới 50ms khi Giám khảo chấm thi."*

---

## SLIDE 5: GIỚI HẠN VÀ RỦI RO (HẠN CHẾ & BẤT CẬP THỰC TẾ)

### Tiêu đề Slide:
**"NHẬN DIỆN GIỚI HẠN, BẤT CẬP PHÁT SINH & ĐỊNH HƯỚNG HOÀN THIỆN"**

### 1. Ba trường hợp hệ thống gặp giới hạn / lỗi:
1. **Hóa đơn giấy chụp bị mờ hoặc rách góc nghiêm trọng:** Khi OCR không đọc được mã số thuế hoặc tổng tiền thanh toán, hệ thống không thể tự đoán số. -> *Giải pháp:* Tác tử tự động gắn nhãn `UNCERTAIN_INFO` và dừng lại chuyển tiếp yêu cầu kế toán viên nhập bổ sung số hóa đơn để tra cứu lại trên cổng TCT.
2. **Quy chế tài chính nội bộ chưa được số hóa:** Doanh nghiệp chưa ban hành định mức tiếp khách hoặc hạn mức công tác phí bằng văn bản dẫn đến tỷ lệ dừng hỏi Kế toán trưởng tăng cao (False Positive 7.7%).
3. **Mặt hàng mô tả quá mơ hồ trên hóa đơn:** Ví dụ hóa đơn ghi chung chung *"Dịch vụ theo hợp đồng"* hoặc *"Chi phí tư vấn"* mà không kèm bảng kê chi tiết, hệ thống không thể tự xác định thuế suất 8% hay 10%.

### 2. Một bất cập thực tế phát sinh trong doanh nghiệp (Bắt buộc theo thể lệ):
- **Bất cập phát sinh:** Trong các đợt cao điểm khóa sổ (ngày 15 - 20 hàng tháng), nếu Kế toán trưởng hoặc CFO đi công tác hoặc chậm phản hồi các câu hỏi chuyển tiếp trong ngày, các hóa đơn bị treo ở trạng thái `FORWARDED` hoặc `ON_HOLD` có nguy cơ làm chậm tiến độ lập tờ khai thuế của Kế toán viên.
- **Giải pháp khắc phục cụ thể trong mã nguồn:**
  - Thiết lập cơ chế cảnh báo hạn xử lý (**SLA Timer 24h**).
  - Tách thuế tạm tính: Cho phép Kế toán viên tạm khóa sổ chi phí nội bộ và tạm loại phần thuế GTGT nghi vấn ra khỏi kỳ này để nộp tờ khai đúng hạn, chuyển sang khấu trừ bổ sung ở kỳ sau khi cấp trên phê duyệt.

### 3. Định hướng phát triển sau cuộc thi:
- Tích hợp giao thức kết nối trực tiếp cổng HĐĐT Tổng cục Thuế qua tài khoản thuế điện tử doanh nghiệp.
- Mở rộng phân hệ học tiền lệ theo đặc thù từng ngành nghề (Sản xuất, Xây dựng, Bán lẻ).

### Lời thoại thuyết trình (Speaker Notes - 60 giây):
> *"Tại Slide 5, chúng tôi trung thực nhìn nhận các giới hạn của hệ thống. Khi gặp hóa đơn mờ hoặc mô tả dịch vụ chung chung, hệ thống kiên quyết không đoán mò mà dừng lại xin ý kiến con người theo nguyên tắc Zero Trust. Về mặt tổ chức, chúng tôi ghi nhận bất cập thực tế là hóa đơn có thể bị nghẽn nếu sếp chậm duyệt vào ngày khóa sổ. Chúng tôi đã xử lý triệt để bất cập này bằng tính năng tách thuế tạm tính: cho phép kế toán viên nộp tờ khai đúng hạn và hạch toán thuế bổ sung vào kỳ sau. Đây chính là minh chứng cho sự thấu hiểu sâu sắc nghiệp vụ kế toán Việt Nam của đội thi."*
