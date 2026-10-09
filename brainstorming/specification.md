# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SOFTWARE REQUIREMENTS SPECIFICATION - SRS)
## DỰ ÁN: THE ESCALATION REFEREE (BỘ ĐIỀU PHỐI CHUYỂN TIẾP THÔNG MINH)
### Phục vụ thiết kế & phát triển phần mềm theo mô hình Thác Nước (Waterfall Model)
### Căn cứ nghiệp vụ: Đề bài A - Cuộc thi OrganizationAI (MLAI Hackathon Track 2)

---

## MỤC LỤC
1. **Tổng Quan Dự Án & Phạm Vi Hệ Thống (Project Overview & Scope)**
2. **Bộ Quy Định Nghiệp Vụ Cốt Lõi (Core Business & Regulatory Rules)**
3. **Mô Hình Khái Niệm & Luồng Hoạt Động (Conceptual Model & Workflow)**
4. **Đặc Tả Yêu Cầu Chức Năng (Functional Requirements - FR)**
   - FR-1: Tiếp Nhận & Tiền Xử Lý Chứng Từ Đầu Vào (Ingestion & Normalization)
   - FR-2: Phân Loại Mức Độ Không Chắc Chắn (3-Tier Uncertainty Classification)
   - FR-3: Xử Lý Thẳng Tự Động Ca Thường Quy (Straight-Through Processing - STP)
   - FR-4: Tạo Sinh Câu Hỏi Chuyển Tiếp Hành Động A/B (Actionable Escalation Generator)
   - FR-5: Điều Phối Phân Cấp & Điểm Quyết Định Con Người (Human Authorization & Routing)
   - FR-6: Tự Động Điều Chỉnh Ngưỡng Chuyển Tiếp & Quản Lý Tiền Lệ (Threshold Adaptation)
   - FR-7: Lưu Vết Kiểm Toán Bất Biến & Can Thiệp Ghi Đè (Audit Trail & Human Override)
   - FR-8: Bộ Công Cụ Kiểm Thử Tự Động 90 Giây (Verify Harness & Sandbox)
   - FR-9: Báo Cáo Đo Lường Độ Chính Xác & Giám Sát Tắc Nghẽn (Metrics & SLA Monitor)
5. **Đặc Tả Yêu Cầu Phi Chức Năng (Non-Functional Requirements - NFR)**
6. **Mô Hình Trạng Thái & Dữ Liệu (State Transition & Data Dictionary)**
7. **Giao Diện Người Dùng & Tương Tác (UI/UX Specifications)**
8. **Ma Trận Truy Xuất & Tiêu Chí Nghiệm Thu (Traceability Matrix & Acceptance Criteria)**

---

## 1. TỔNG QUAN DỰ ÁN & PHẠM VI HỆ THỐNG (PROJECT OVERVIEW & SCOPE)

### 1.1. Bối cảnh bài toán
Trong các tổ chức và doanh nghiệp, quy trình thẩm định thanh toán chi phí và hóa đơn đầu vào có khối lượng giao dịch rất lớn nhưng chứa đựng nhiều "vùng xám" rủi ro pháp lý và chính sách:
- **Nguy cơ của Tự động hóa mù quáng (Blind Full Automation):** Nếu để hệ thống tự động duyệt 100% không có sự kiểm soát của con người, doanh nghiệp đối mặt với rủi ro bị truy thu thuế, xử phạt hành chính từ 20% đến 300% số thuế trốn do chấp nhận hóa đơn vi phạm quy định (doanh nghiệp bỏ trốn, sai thuế suất, thanh toán tiền mặt sai luật, chi sai mục đích).
- **Nguy cơ của Chuyển tiếp tràn lan (Over-Escalation):** Nếu hệ thống chuyển tiếp mọi chứng từ lên cấp quản lý để xin ý kiến, quy trình bị tắc nghẽn, người phê duyệt bị quá tải nhận thức (alert fatigue) và hệ thống mất đi giá trị tự động hóa.

### 1.2. Mục tiêu phần mềm
Hệ thống **The Escalation Referee** là một tác tử điều phối phần mềm thông minh hoạt động với mục tiêu:
1. **Xác định chính xác thời điểm dừng tự động hóa:** Dừng đúng lúc tại các điểm rủi ro, ngoại lệ hoặc vượt thẩm quyền để xin ý kiến con người.
2. **Xử lý tự động hoàn toàn các ca thường quy (STP):** Không làm phiền con người đối với các hồ sơ rõ ràng, hợp pháp và nằm trong hạn mức.
3. **Phân loại chuẩn 3 nhóm không chắc chắn:** Tách bạch nguyên nhân gốc rễ của nghi vấn.
4. **Sinh câu hỏi chuyển tiếp có tính hành động ngay (A/B Actionable):** Cung cấp đầy đủ ngữ cảnh để người duyệt quyết định ngay trong 1 câu trả lời mà không cần tra cứu hồ sơ gốc.
5. **Học tiền lệ an toàn:** Tự động nới lỏng hoặc thắt chặt ngưỡng chuyển tiếp dựa trên phản hồi của con người đối với chính sách nội bộ, nhưng tuyệt đối không phá vỡ luật định cứng.
6. **Lưu vết trách nhiệm minh bạch:** Nhật ký kiểm toán bất biến cho phép giải trình và can thiệp ghi đè/hoàn tác bất cứ lúc nào.

### 1.3. Ranh giới hệ thống (Scope Boundaries)
- **Trong phạm vi (In-Scope):**
  - Tiếp nhận hồ sơ chứng từ thanh toán/hóa đơn qua dữ liệu có cấu trúc (XML, JSON) và phi cấu trúc (ảnh chụp, PDF, text).
  - Kiểm tra tính tuân thủ pháp luật và quy chế nội bộ.
  - Phân luồng STP hoặc Escalation.
  - Tự động sinh câu hỏi và các phương án quyết định định lượng.
  - Điều phối quyền phê duyệt theo hạn mức và vai trò.
  - Ghi nhận tiền lệ và điều chỉnh ngưỡng rủi ro.
  - Nhật ký kiểm toán có mã băm bảo mật.
  - Bộ kiểm thử tự động Verify Harness độc lập phục vụ đánh giá tức thì.
- **Ngoài phạm vi (Out-of-Scope):**
  - Không xây dựng phân hệ ERP toàn diện (không làm quản lý kho, sổ quỹ chi tiết, hạch toán khấu hao TSCĐ, nộp tờ khai lên cổng thuế nhà nước).
  - Không thay thế trách nhiệm pháp lý của con người: Hệ thống chỉ là trọng tài hỗ trợ ra quyết định.

---

## 2. BỘ QUY ĐỊNH NGHIỆP VỤ CỐT LÕI (CORE BUSINESS & REGULATORY RULES)

Tài liệu quy định nghiệp vụ được chuẩn hóa làm "Nguồn chân lý" (Ground Truth) để hệ thống đối chiếu:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÂN TẦNG QUY CHẾ NGHIỆP VỤ (RULE HIERARCHY)                                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 1: QUY ĐỊNH PHÁP LUẬT BẮT BUỘC (STATUTORY LAWS) - ĐỘ ƯU TIÊN CAO NHẤT (CẤM GHI ĐÈ)│
│ - Quy định thanh toán không dùng tiền mặt: Giao dịch từng lần từ 5.000.000 VNĐ trở lên │
│   bắt buộc phải có chứng từ thanh toán qua ngân hàng (UNC, sao kê).                    │
│ - Quy định tính hợp pháp của bên bán: Hóa đơn xuất sau ngày bên bán bị cơ quan quản lý  │
│   thông báo đóng mã số thuế / ngừng hoạt động là hóa đơn bất hợp pháp 100%.            │
│ - Quy định thuế suất: Các mặt hàng thuộc danh mục loại trừ (viễn thông, tài chính, bds,│
│   hóa chất...) bắt buộc áp dụng thuế suất chuẩn 10%, không được áp dụng ưu đãi 8%.     │
│                                                                                        │
│ TẦNG 2: CHẤT LƯỢNG DỮ LIỆU ĐẦU VÀO (DATA INTEGRITY)                                   │
│ - Tính toàn vẹn số học: Tiền trước thuế + Tiền thuế = Tổng tiền thanh toán (sai lệch 0đ)│
│ - Tính xác thực: Dữ liệu bị mờ, mất góc, thiếu thông tin cốt lõi bắt buộc phải xác minh.│
│                                                                                        │
│ TẦNG 3: QUY CHẾ TÀI CHÍNH NỘI BỘ (INTERNAL FINANCIAL POLICIES) - CHO PHÉP HỌC TIỀN LỆ │
│ - Chi phí tiếp khách, ăn uống có đồ uống có cồn: Bắt buộc có quy chế tiếp khách và     │
│   danh sách đối tác kèm theo; nếu không đủ điều kiện phải loại trừ thuế và chi phí.    │
│ - Hóa đơn mua hàng từ nhà cung cấp mới lần đầu giao dịch cần kiểm tra phê duyệt.       │
│                                                                                        │
│ TẦNG 4: PHÂN CẤP THẨM QUYỀN PHÊ DUYỆT (AUTHORIZATION MATRIX)                           │
│ - Kế toán viên (KTV): Tiếp nhận, chuẩn hóa, chỉ xác nhận các ca thường quy hợp lệ.     │
│ - Kế toán trưởng (KTT): Thẩm định các khoản chi ngoại lệ có giá trị dưới 200.000.000đ. │
│ - Giám đốc Tài chính / Lãnh đạo (CFO): Phê duyệt bắt buộc với giao dịch từ 200.000.000đ│
│   trở lên hoặc các giao dịch có độ lệch rủi ro vĩ mô lớn.                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MÔ HÌNH KHÁI NIỆM & LUỒNG HOẠT ĐỘNG (CONCEPTUAL MODEL & WORKFLOW)

### 3.1. Sơ đồ luồng xử lý từ Đầu vào đến Đầu ra

```text
       ┌────────────────────────┐
       │   DỮ LIỆU ĐẦU VÀO      │
       │ (Hóa đơn, Chứng từ,    │
       │  Sao kê, Thông tin NCC)│
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │  TIỀN XỬ LÝ & BÓC TÁCH │
       │  Chuẩn hóa cấu trúc    │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │  BỘ MÁY ĐỐI SOÁT LUẬT  │◄──────── CSDL Quy chế & Pháp luật
       │  & KIỂM TRA ĐA TẦNG    │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         │ Đánh giá rủi ro?  │
         └─────────┬─────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
 [HỢP LỆ THƯỜNG QUY]     [CÓ NGHI VẤN / RỦI RO / NGOẠI LỆ]
        │                     │
        ▼                     ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│  XỬ LÝ THẲNG     │   │ TỰ ĐỘNG DỪNG (HALT)                          │
│  (STP - 100%)    │   │ Phân loại vào 3 nhóm không chắc chắn         │
│  - Hạch toán     │   └──────────────────────┬───────────────────────┘
│  - Ghi nhận chi  │                          │
│    phí được trừ  │                          ▼
│  - Lưu Audit Log │   ┌──────────────────────────────────────────────┐
└──────────────────┘   │ TẠO THẺ CHUYỂN TIẾP (ESCALATION CARD)        │
                       │ - Tóm tắt rủi ro & Căn cứ quy chế            │
                       │ - Sinh câu hỏi A/B định lượng dứt khoát      │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │ ĐIỀU PHỐI TỚI ĐÚNG VAI TRÒ (KTT HOẶC CFO)    │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │ CON NGƯỜI CHỌN PHƯƠNG ÁN (A HOẶC B)          │
                       │ (Hỗ trợ Can thiệp dừng & Ghi đè Override)    │
                       └──────────────────────┬───────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
       ┌──────────────────────────────┐                ┌──────────────────────────────┐
       │ NẾU LÀ CHÍNH SÁCH NỘI BỘ     │                │ GHI NHẬN ĐẦU RA              │
       │ Kiểm tra điều kiện tạo       │                │ - Cập nhật trạng thái duyệt  │
       │ TIỀN LỆ HỌC TỰ ĐỘNG          │                │ - Băm chuỗi Merkle SHA-256   │
       │ (Cấm tạo tiền lệ luật cứng)  │                │ - Sẵn sàng giải trình        │
       └──────────────────────────────┘                └──────────────────────────────┘
```

---

## 4. ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 4.1. FR-1: Tiếp Nhận & Tiền Xử Lý Chứng Từ Đầu Vào (Ingestion & Normalization)
- **FR-1.1:** Hệ thống phải tiếp nhận chứng từ đầu vào qua tối thiểu 3 phương thức:
  - Tải lên tệp dữ liệu có cấu trúc (XML, JSON).
  - Tải lên tệp tài liệu số hoặc hình ảnh (PDF, JPG, PNG).
  - Giao diện nhập liệu trực tiếp (Interactive Form) hoặc dán văn bản (Paste-in).
- **FR-1.2:** Hệ thống phải chuẩn hóa dữ liệu bóc tách được thành cấu trúc hồ sơ chuẩn bao gồm:
  - `invoiceId`: Định danh duy nhất của hồ sơ.
  - `invoiceNumber`: Số hóa đơn / Số chứng từ.
  - `invoiceDate`: Ngày lập chứng từ định dạng ISO-8601 (YYYY-MM-DD).
  - `supplierTaxCode`: Mã định danh đơn vị cung cấp (MST).
  - `supplierName`: Tên pháp nhân đơn vị cung cấp.
  - `itemName`: Tên hàng hóa, dịch vụ chính.
  - `preTaxAmount`: Giá trị trước thuế (Số thực dương).
  - `taxRate`: Thuế suất áp dụng (0, 5, 8, 10%).
  - `taxAmount`: Tiền thuế (Số thực).
  - `totalAmount`: Tổng tiền thanh toán (Số thực dương).
  - `paymentMethod`: Hình thức thanh toán (`CASH` hoặc `BANK_TRANSFER`).
  - `hasBankSlip`: Cờ xác nhận đã có chứng từ ngân hàng đối ứng (boolean).
  - `hasItemManifest`: Cờ xác nhận có bảng kê chi tiết mặt hàng (boolean).
  - `sellerStatus`: Trạng thái bên bán (`ACTIVE`, `SUSPENDED`, `UNKNOWN`).
  - `isImageBlurry`: Cờ cảnh báo chất lượng hình ảnh không rõ nét (boolean).
- **FR-1.3 Khóa chống trùng lắp (Idempotency & Deduplication):** Hệ thống phải tự động tính toán mã băm SHA-256 của nội dung tệp và kiểm tra khóa phức hợp `(supplierTaxCode, invoiceSeries, invoiceNumber)`. Nếu trùng lặp, phải cảnh báo ngay lập tức và từ chối xử lý kép.

---

### 4.2. FR-2: Phân Loại Mức Độ Không Chắc Chắn (3-Tier Uncertainty Classification)
Khi phát hiện hồ sơ có dấu hiệu nghi vấn, bộ máy thẩm định **bắt buộc phải phân loại chính xác vào một trong ba nhóm không chắc chắn** theo đúng yêu cầu đề bài:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BẢNG PHÂN LOẠI 3 NHÓM MỨC ĐỘ KHÔNG CHẮC CHẮN (UNCERTAINTY TAXONOMY)                    │
├───────────────────┬──────────────────────────────────┬─────────────────────────────────┤
│ NHÓM RỦI RO       │ ĐỊNH NGHĨA & NGUYÊN NHÂN         │ CÁC TÌNH HUỐNG THỰC TẾ ĐIỂN HÌNH│
├───────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ 1. UNCERTAIN_INFO │ Chưa xác định được thông tin     │ - Ảnh chụp chứng từ bị mờ/mất   │
│    (Thông tin     │ thực tế một cách chắc chắn;      │   góc không đọc được số tiền.   │
│     chưa rõ ràng) │ thiếu tài liệu xác minh đối ứng. │ - Hóa đơn >= 5 triệu ghi TM/CK  │
│                   │                                  │   nhưng chưa có sao kê ngân hàng│
│                   │                                  │ - MST người bán có trạng thái   │
│                   │                                  │   UNKNOWN cần kế toán tra cứu.  │
├───────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ 2. OUT_OF_POLICY  │ Hồ sơ đọc rõ thông tin nhưng     │ - Hóa đơn tiếp khách có chi phí │
│    (Nằm ngoài     │ nội dung khoản chi nằm ngoài     │   rượu vang, bia, karaoke.      │
│     quy định)     │ phạm vi quy chế tiêu chuẩn hoặc  │ - Hóa đơn áp sai thuế suất 8%   │
│                   │ vi phạm quy định chính sách.     │   cho mặt hàng loại trừ (viễn   │
│                   │                                  │   thông, hóa chất, bất động sản)│
│                   │                                  │ - Mua từ nhà cung cấp mới chưa  │
│                   │                                  │   được phê duyệt định mức.      │
├───────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ 3. OVER_AUTHORITY │ Hồ sơ hoàn toàn hợp lệ về mặt    │ - Hóa đơn mua hàng có tổng tiền │
│    (Vượt thẩm     │ pháp lý và chính sách, nhưng giá │   >= 200.000.000 VNĐ (vượt thẩm │
│     quyền xử lý)  │ trị hoặc mức độ rủi ro vượt quá  │   quyền duyệt của Kế toán trưởng│
│                   │ hạn mức của người kiểm tra hiện  │ - Chỉ số rủi ro tích lũy của    │
│                   │ tại, đòi hỏi cấp cao hơn duyệt.  │   doanh nghiệp vượt ngưỡng an   │
│                   │                                  │   toàn vĩ mô.                   │
└───────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

- **Nguyên tắc an toàn bắt buộc (Zero False-Negative on Statutory):** Tuyệt đối không đưa ra kết luận "Hợp lệ thường quy" đối với dữ liệu đầu vào đã bị gắn cờ nghi vấn thuộc nhóm Luật định cứng (`STATUTORY`).

---

### 4.3. FR-3: Xử Lý Thẳng Tự Động Ca Thường Quy (Straight-Through Processing - STP)
- **FR-3.1:** Đối với các hồ sơ thỏa mãn đồng thời 100% các tiêu chí:
  - Dữ liệu đầy đủ, sắc nét, khớp số học 100%.
  - Bên bán đang hoạt động bình thường (`ACTIVE`).
  - Áp dụng đúng thuế suất theo quy định hiện hành.
  - Đã có chứng từ thanh toán không dùng tiền mặt hợp lệ đối với giao dịch từ 5.000.000 VNĐ trở lên.
  - Không chứa các mặt hàng nhạy cảm (rượu bia, thuốc lá, giải trí).
  - Giá trị thanh toán nằm trong hạn mức thường quy của Kế toán viên (< 200.000.000 VNĐ).
- **FR-3.2:** Hệ thống phải tự động thực thi các hành động sau trong thời gian không quá 100ms mà không yêu cầu bất kỳ thao tác thủ công nào từ con người:
  - Chuyển trạng thái hồ sơ sang `ROUTINE_APPROVED`.
  - Ghi nhận 100% giá trị thuế GTGT vào chỉ tiêu thuế được khấu trừ hợp lệ.
  - Tự động sinh bản ghi nhật ký kiểm toán với tác nhân thực thi là `SYSTEM_REFEREE`.

---

### 4.4. FR-4: Tạo Sinh Câu Hỏi Chuyển Tiếp Hành Động A/B (Actionable Escalation Generator)
Khi hồ sơ bị dừng do rơi vào 1 trong 3 nhóm không chắc chắn, hệ thống phải tự động tạo một **Thẻ Chuyển Tiếp (Escalation Card)** với cấu trúc dữ liệu bắt buộc:

- **FR-4.1 Cấu trúc nội dung thẻ chuyển tiếp:**
  1. `flaggedReason`: Nêu chính xác lý do vi phạm trong 1 câu ngắn gọn.
  2. `sopClause`: Dẫn chiếu đích danh điều khoản quy chế nội bộ hoặc văn bản pháp luật bị vi phạm (Ví dụ: *"Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 1.2 Tax-SOP-2026"*).
  3. `plainExplanation`: Lời giải thích dứt khoát bằng ngôn ngữ tiếng Việt phổ thông, dễ hiểu cho người không chuyên kế toán.
  4. `actionableQuestion`: Câu hỏi hành động đóng, mang tính định lượng cụ thể. Bắt buộc chứa:
     - Mã chứng từ, tên đối tác giao dịch, giá trị tiền cụ thể.
     - Đặt ra vấn đề then chốt để người duyệt ra quyết định ngay.
  5. `options`: Đúng hai phương án lựa chọn độc quyền (`Phương án A` và `Phương án B`).
- **FR-4.2 Yêu cầu đối với hai phương án A và B:**
  - Mỗi phương án phải có nhãn ngắn gọn (Label dưới 35 ký tự), mô tả hành động (Action Description) và mã hành động tương ứng (`resultingAction`).
  - Phải bao quát 2 hướng xử lý đối nghịch hợp lý trong nghiệp vụ (Ví dụ: Bổ sung chứng từ đối ứng VS Loại trừ chi phí; Chuyển tiếp cấp trên VS Tạm dừng yêu cầu giải trình).
  - **Tiêu chuẩn chất lượng:** Người phê duyệt có thể bấm chọn ngay 1 trong 2 nút để hệ thống thi hành mà **không cần mở lại tệp chứng từ gốc để tra cứu**.

---

### 4.5. FR-5: Điều Phối Phân Cấp & Điểm Quyết Định Con Người (Human Authorization & Routing)
- **FR-5.1 Ma trận phân quyền xử lý ngoại lệ:**
  - Nếu lý do chuyển tiếp thuộc nhóm `UNCERTAIN_INFO` hoặc `OUT_OF_POLICY` với giá trị < 200.000.000 VNĐ: Thẻ chuyển tiếp được định tuyến tới **Kế toán trưởng (Chief Accountant)**.
  - Nếu lý do chuyển tiếp thuộc nhóm `OVER_AUTHORITY` hoặc giá trị >= 200.000.000 VNĐ: Thẻ chuyển tiếp bắt buộc phải định tuyến tới **Giám đốc Tài chính / Lãnh đạo (CFO)**.
- **FR-5.2 Không tự tiện phê duyệt ngầm khi chuyển tiếp:**
  - Khi Kế toán trưởng chọn phương án chuyển tiếp hồ sơ lên cấp trên (`FORWARD_TO_CFO`), hệ thống chuyển trạng thái sang `FORWARDED` hoặc `ON_HOLD`.
  - Hệ thống **tuyệt đối không được tự động tính thuế được khấu trừ** hoặc tự động ghi sổ cái cho đến khi CFO đưa ra quyết định phê duyệt cuối cùng.
- **FR-5.3 Nguyên tắc chống tự duyệt (Anti-Self-Approval):** Người dùng nhập liệu/tải lên chứng từ không được phép tự đóng vai trò phê duyệt chính chứng từ đó.

---

### 4.6. FR-6: Tự Động Điều Chỉnh Ngưỡng Chuyển Tiếp & Quản Lý Tiền Lệ (Threshold Adaptation)
Để đáp ứng tiêu chí Sprint 2 về khả năng học thích ứng dựa trên phản hồi của người dùng:

- **FR-6.1 Thẩm quyền ban hành tiền lệ:** Chỉ người dùng có vai trò CFO mới có quyền đánh dấu tùy chọn *"Lưu làm tiền lệ cho các hóa đơn tương tự sau này"* khi phê duyệt phương án chuyển tiếp.
- **FR-6.2 Tường lửa Tiền lệ (Precedent Firewall - Rào chắn an toàn tối thượng):**
  - **CẤM TIỀN LỆ CHO QUY ĐỊNH PHÁP LUẬT (STATUTORY FIREWALL):** Hệ thống cấm tuyệt đối việc tạo tiền lệ cho các lỗi vi phạm thuộc nhóm Luật định cứng (Thanh toán tiền mặt >= 5 triệu, hóa đơn bên bán đã ngừng hoạt động, sai thuế suất danh mục loại trừ). Dù CFO có chọn duyệt chi một lần thì các hóa đơn tương tự tiếp theo vẫn **bắt buộc phải dừng lại chuyển tiếp**.
  - **CHO PHÉP TIỀN LỆ CHO CHÍNH SÁCH NỘI BỘ (POLICY RELAXATION):** Đối với các quy định thuộc nhóm `INTERNAL_POLICY` (ví dụ: chấp nhận chi phí tiếp khách của một nhà hàng đối tác quen thuộc dưới một ngưỡng tiền nhất định), tiền lệ được kích hoạt.
- **FR-6.3 Khóa khớp tiền lệ chính xác (Exact Rule Matching):**
  - Tiền lệ phải được lưu trữ với bộ khóa nghiêm ngặt: `(supplierTaxCode, ruleId, maxAmountThreshold, approvedBy, timestamp)`.
  - Khi một hóa đơn mới được tự động thông qua nhờ tiền lệ, trạng thái phải ghi rõ: `ROUTINE_BY_PRECEDENT` kèm mã tiền lệ tham chiếu, không được ngụy tạo thành hóa đơn thông thường.

---

### 4.7. FR-7: Lưu Vết Kiểm Toán Bất Biến & Can Thiệp Ghi Đè (Audit Trail & Human Override)
- **FR-7.1 Cấu trúc chuỗi băm bất biến (Cryptographic Merkle Audit Trail):**
  - Mọi sự kiện trong hệ thống (Tiếp nhận, Đánh giá, Chuyển tiếp, Con người phê duyệt, Ghi đè) đều phải sinh một bản ghi kiểm toán chứa:
    - `id`: Mã định danh bản ghi.
    - `timestamp`: Dấu thời gian thực tế chuẩn ISO.
    - `invoiceId`: Mã chứng từ liên quan.
    - `actor`: Tác nhân thực thi (`SYSTEM_REFEREE`, `ACCOUNTANT`, `CHIEF_ACCOUNTANT`, `CFO`).
    - `actionTaken`: Hành động cụ thể đã làm.
    - `plainExplanation`: Lý do thực hiện bằng ngôn ngữ dễ hiểu.
    - `applicableRegulations`: Danh sách các điều khoản luật/SOP làm căn cứ.
    - `previousHash`: Mã băm SHA-256 của bản ghi liền trước.
    - `entryHash`: Mã băm SHA-256 của toàn bộ dữ liệu bản ghi hiện tại kết hợp `previousHash`.
  - Chuỗi băm đảm bảo dữ liệu không thể bị sửa chữa hoặc xóa bỏ sau khi đã ghi nhận.
- **FR-7.2 Tra cứu kiểm toán tức thì (Instant Audit Lookup):**
  - Người dùng có thể bấm vào bất kỳ một sự kiện nào trong danh sách kiểm toán để tra cứu: Ai làm, thời gian nào, dữ liệu đầu vào là gì, và lý do căn cứ pháp lý nào.
- **FR-7.3 Tính năng Can thiệp dừng & Ghi đè của con người (Emergency Stop / Override / Undo):**
  - Con người có thẩm quyền có quyền bấm nút **Ghi đè (Override)** hoặc **Hoàn tác (Undo)** đối với phán quyết của hệ thống bất kỳ lúc nào.
  - Khi bấm Ghi đè, người dùng bắt buộc phải nhập lý do can thiệp.
  - Hệ thống cập nhật lại trạng thái chứng từ và ngay lập tức nối thêm một khối băm mới vào chuỗi Audit Trail để ghi nhận sự can thiệp này.

---

### 4.8. FR-8: Bộ Công Cụ Kiểm Thử Tự Động 90 Giây (Verify Harness & Sandbox)
Nhằm phục vụ quá trình thẩm định của Ban Giám khảo trong 90 giây:

- **FR-8.1 1-Click Benchmark 5 Ca Đề bài A:**
  - Cung cấp một nút bấm duy nhất trên giao diện và một endpoint API (`GET /api/verify`).
  - Khi kích hoạt, hệ thống tự động thẩm định tuần tự bộ dữ liệu chuẩn mực gồm đúng **5 ca kiểm thử**:
    - **3 ca Thường quy (Routine):** Hệ thống tự động xử lý thẳng (STP) không dừng lại.
    - **2 ca Chuyển tiếp (Escalated):** Hệ thống phát hiện chính xác rủi ro, dừng lại và xuất hiện thẻ câu hỏi A/B dứt khoát.
  - Kết quả in ra bảng hiển thị tức thì (< 100ms) kèm **Dấu thời gian thực (Real Timestamp)** và trạng thái đạt/không đạt của từng ca.
- **FR-8.2 Hộp cát dữ liệu mới của Giám khảo (Judge Sandbox):**
  - Cung cấp giao diện nạp nhanh tối thiểu 2 dữ liệu đầu vào mới do Giám khảo đưa ra mà hệ thống chưa từng thấy trước đó:
    - 1 ca thường quy hợp lệ mới -> Hệ thống tự động duyệt thẳng.
    - 1 ca bất thường/ngoại lệ mới (ví dụ: vi phạm thanh toán tiền mặt 12 triệu) -> Hệ thống xử lý hợp lý bằng cách dừng lại chuyển tiếp, tuyệt đối không tự duyệt sai.

---

### 4.9. FR-9: Báo Cáo Đo Lường Độ Chính Xác & Giám Sát Tắc Nghẽn (Metrics & SLA Monitor)
- **FR-9.1 Báo cáo số liệu độ chính xác phân luồng (Accuracy Metrics):**
  Hệ thống phải tự động tính toán và hiển thị các chỉ số trên tập kiểm thử độc lập:
  - `Tỷ lệ bỏ sót ca cần dừng (False Negative Rate) = (Số ca vi phạm bị duyệt nhầm / Tổng ca vi phạm) * 100%`. Yêu cầu: Bằng **0.0%** đối với luật cứng.
  - `Tỷ lệ chuyển tiếp thừa (False Positive Rate) = (Số ca thường quy bị dừng nhầm / Tổng ca thường quy) * 100%`. Yêu cầu: Nhỏ hơn hoặc bằng **10.0%**.
  - `Tỷ lệ xử lý thẳng tự động (STP Rate) = (Số ca thường quy tự duyệt / Tổng ca thường quy) * 100%`. Yêu cầu: Đạt trên **90.0%**.
- **FR-9.2 Giám sát hạn xử lý (SLA Monitoring & Deadlock Prevention):**
  - Nhận diện nguy cơ tắc nghẽn khi các ca chuyển tiếp bị treo trong ngày cao điểm kế toán.
  - Cung cấp bộ đếm cảnh báo thời gian chờ xử lý (SLA Timer 24h).
  - Cơ chế tách thuế tạm tính: Cho phép tạm khóa chi phí nội bộ và tạm loại thuế nghi vấn ra khỏi kỳ khai báo hiện tại để đảm bảo tiến độ nộp tờ khai của kế toán viên, chờ cấp trên giải quyết bổ sung sau.

---

## 5. ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)

### 5.1. NFR-1: Hiệu năng & Thời gian đáp ứng (Performance & Latency)
- Thời gian phân loại và đưa ra quyết định thẩm định cho 1 chứng từ thông qua bộ quy tắc tất định không vượt quá **50ms**.
- Thời gian thực thi toàn bộ bài kiểm tra Verify Harness 5 ca không vượt quá **500ms**.
- Thời gian sinh câu hỏi hành động ngôn ngữ tự nhiên không vượt quá **3.0 giây**.

### 5.2. NFR-2: Tính sẵn sàng & Khả năng vận hành không cài đặt (Zero-Installation Operability)
- Đáp ứng Tiêu chí 1 của cuộc thi: Giám khảo truy cập đường dẫn trực tuyến (Live URL) là có thể thao tác ngay lập tức trên trình duyệt web tiêu chuẩn (Chrome, Edge, Safari, Firefox).
- **Không bắt buộc tạo tài khoản, không bắt buộc cài đặt extension hay phần mềm phụ trợ.**
- Cung cấp nút truy cập nhanh 1-click vào thẳng không gian làm việc với đầy đủ quyền hạn để đánh giá.

### 5.3. NFR-3: Độ tin cậy & Tính tất định (Determinism & Zero-Hallucination)
- Bộ máy quyết định phân loại rủi ro pháp lý và thẩm quyền phải vận hành dựa trên mã nguồn tất định (Deterministic Logic).
- Mô hình ngôn ngữ AI chỉ đóng vai trò trợ lý tổng hợp ngữ cảnh và định dạng câu chữ thân thiện cho người dùng, **tuyệt đối không được trao quyền thay đổi kết luận rủi ro của bộ quy tắc**.

### 5.4. NFR-4: Tính toàn vẹn dữ liệu (Data Integrity)
- Mọi thay đổi dữ liệu sổ sách và nhật ký kiểm toán phải tuân thủ nguyên tắc ACID.
- Chuỗi băm Merkle SHA-256 phải được xác minh tính liên tục trước mỗi lần ghi bản ghi mới. Nếu phát hiện chuỗi bị can thiệp trái phép, hệ thống phải kích hoạt cờ cảnh báo toàn vẹn ngay lập tức.

### 5.5. NFR-5: Khả năng giải thích (Explainability for Non-Technical Users)
- Mọi thông báo lỗi hoặc thẻ chuyển tiếp phải có phần diễn giải bằng ngôn ngữ tự nhiên rõ ràng, tránh hiển thị các mã lỗi lập trình (code stacktrace, raw regex) gây khó hiểu cho người dùng kế toán hoặc giám khảo chuyên môn.

---

## 6. MÔ HÌNH TRẠNG THÁI & DỮ LIỆU (STATE TRANSITION & DATA DICTIONARY)

### 6.1. Sơ đồ chuyển đổi trạng thái của hồ sơ chứng từ (State Machine)

```text
               ┌───────────────┐
               │   RECEIVED    │ (Mới tiếp nhận / Bóc tách)
               └───────┬───────┘
                       │
             [Thẩm định tất định]
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────┐             ┌───────────────┐
│   ROUTINE     │             │   ESCALATED   │ (Phát hiện 1 trong 3 nhóm rủi ro)
└───────┬───────┘             └───────┬───────┘
        │                             │
 [Tự động xử lý STP]          [Tạo thẻ câu hỏi A/B]
        │                             │
        ▼                             ▼
┌───────────────┐             ┌───────────────┐
│ROUTINE_APPROVE│             │ PENDING_HUMAN │ (Chờ KTT hoặc CFO trả lời)
└───────┬───────┘             └───────┬───────┘
        │                             │
        │                  ┌──────────┴──────────┐
        │                  ▼                     ▼
        │          [Chọn Phương án A]    [Chọn Phương án B]
        │                  │                     │
        │                  ▼                     ▼
        │          ┌───────────────┐     ┌───────────────┐
        │          │   ACCEPTED    │     │   REJECTED    │
        │          │ (Có hồ sơ/UNC)│     │(Loại trừ thuế)│
        │          └───────┬───────┘     └───────┬───────┘
        │                  │                     │
        └──────────────────┼─────────────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │    AUDITED    │ (Đã chốt sổ & Băm chuỗi SHA-256)
                   └───────┬───────┘
                           │
                 [Can thiệp ghi đè?]
                           │
                           ▼
                   ┌───────────────┐
                   │  OVERRIDDEN   │ (Con người lật ngược phán quyết)
                   └───────────────┘
```

### 6.2. Từ điển dữ liệu thực thể chính (Key Data Entities)

#### Thực thể 1: Hồ Sơ Chứng Từ (`InvoiceDocument`)
| Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Diễn giải |
| :--- | :--- | :---: | :--- |
| `id` | String (UUID) | Có | Định danh nội bộ của hồ sơ |
| `invoiceNumber` | String | Có | Số hóa đơn / Số chứng từ thực tế |
| `invoiceDate` | String (YYYY-MM-DD) | Có | Ngày lập chứng từ |
| `supplierTaxCode` | String | Có | Mã số thuế đơn vị phát hành |
| `supplierName` | String | Có | Tên công ty/nhà cung cấp |
| `itemName` | String | Có | Tên hàng hóa / dịch vụ chính |
| `preTaxAmount` | Decimal | Có | Tiền trước thuế |
| `taxRate` | Integer | Có | Thuế suất (0, 5, 8, 10) |
| `taxAmount` | Decimal | Có | Tiền thuế GTGT |
| `totalAmount` | Decimal | Có | Tổng tiền thanh toán |
| `paymentMethod` | Enum (`CASH`, `BANK_TRANSFER`)| Có | Hình thức thanh toán |
| `hasBankSlip` | Boolean | Có | Đã có chứng từ ngân hàng đối ứng hay chưa |
| `sellerStatus` | Enum (`ACTIVE`, `SUSPENDED`, `UNKNOWN`) | Có | Trạng thái hoạt động của người bán |
| `status` | Enum (`RECEIVED`, `ROUTINE_APPROVED`, `ESCALATED`, `FORWARDED`, `REJECTED`, `OVERRIDDEN`) | Có | Trạng thái vòng đời hồ sơ |
| `deductibleTaxAmount` | Decimal | Có | Số tiền thuế được khấu trừ thực tế (sau khi xét ngoại lệ) |

#### Thực thể 2: Thẻ Chuyển Tiếp (`EscalationRecord`)
| Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Diễn giải |
| :--- | :--- | :---: | :--- |
| `id` | String | Có | Định danh bản ghi chuyển tiếp |
| `invoiceId` | String | Có | Mã chứng từ liên kết |
| `riskGroup` | Enum (`UNCERTAIN_INFO`, `OUT_OF_POLICY`, `OVER_AUTHORITY`) | Có | Phân loại nhóm không chắc chắn |
| `flaggedReason` | String | Có | Lý do vi phạm ngắn gọn |
| `sopClause` | String | Có | Căn cứ điều khoản luật hoặc SOP |
| `actionableQuestion` | String | Có | Câu hỏi hành động đóng A/B |
| `targetRole` | Enum (`CHIEF_ACCOUNTANT`, `CFO`) | Có | Vai trò thẩm quyền tiếp nhận xử lý |
| `optionA_Label` | String | Có | Nhãn phương án A |
| `optionA_Action` | String | Có | Hành động nghiệp vụ khi chọn A |
| `optionB_Label` | String | Có | Nhãn phương án B |
| `optionB_Action` | String | Có | Hành động nghiệp vụ khi chọn B |
| `selectedOption` | Enum (`A`, `B`, `OVERRIDE_CUSTOM`) | Không | Lựa chọn thực tế của con người |
| `resolvedBy` | String | Không | Người dùng đã ra phán quyết |
| `resolvedAt` | Timestamp | Không | Thời điểm giải quyết |

#### Thực thể 3: Tiền Lệ Thích Ứng (`AdaptivePrecedent`)
| Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Diễn giải |
| :--- | :--- | :---: | :--- |
| `id` | String | Có | Định danh tiền lệ (PREC-YYYY-XX) |
| `supplierTaxCode` | String | Có | Mã số thuế áp dụng tiền lệ |
| `ruleId` | String | Có | Mã quy tắc nội bộ được đặc cách |
| `maxAmountThreshold`| Decimal | Có | Ngưỡng tiền tối đa được áp dụng |
| `rationale` | String | Có | Căn cứ lý do đặc cách |
| `approvedBy` | String | Có | Phải là người dùng có vai trò CFO |
| `isActive` | Boolean | Có | Trạng thái hiệu lực của tiền lệ |

#### Thực thể 4: Bản Ghi Kiểm Toán (`AuditLogEntry`)
| Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Diễn giải |
| :--- | :--- | :---: | :--- |
| `id` | String | Có | Định danh bản ghi kiểm toán |
| `timestamp` | Timestamp | Có | Dấu thời gian thực thi |
| `invoiceId` | String | Có | Mã hồ sơ liên quan |
| `actor` | String | Có | Người hoặc tác tử thực hiện |
| `actionTaken` | String | Có | Hành động đã làm |
| `plainExplanation` | String | Có | Giải thích cho người không chuyên |
| `applicableRegulations`| Array of String | Có | Các văn bản pháp luật căn cứ |
| `previousHash` | String (SHA-256) | Có | Mã băm của khối trước |
| `entryHash` | String (SHA-256) | Có | Mã băm của khối hiện tại |
| `isOverridden` | Boolean | Có | Đánh dấu sự kiện này đã bị ghi đè hay chưa |

---

## 7. GIAO DIỆN NGƯỜI DÙNG & TƯƠNG TÁC (UI/UX SPECIFICATIONS)

Giao diện được tổ chức theo tiêu chuẩn hiển thị rõ ràng, tập trung vào trải nghiệm đánh giá nhanh trong 8 phút:

### 7.1. Màn hình 1: Trang Chủ & Lối Vào Nhanh (Instant Entry)
- Phía trên cùng có nút lớn nổi bật: **"TRẢI NGHIỆM NHANH CHO GIÁM KHẢO (1-CLICK KHÔNG CẦN TÀI KHOẢN)"**.
- Bấm vào nút này: Tự động gán quyền Kế toán trưởng/CFO và chuyển thẳng vào Bàn Làm Việc Điều Phối.
- Kèm liên kết trực tiếp dẫn sang màn hình **"/verify"** để chạy bộ kiểm thử 90 giây.

### 7.2. Màn hình 2: Bàn Làm Việc Điều Phối (Escalation Workspace)
- **Khu vực Tiếp nhận:** Ô kéo thả tệp hóa đơn (XML, ảnh, PDF) hoặc dán văn bản.
- **Khu vực Hồ sơ chờ duyệt (Escalation Inbox):**
  - Hiển thị danh sách các hồ sơ bị gắn cờ rủi ro.
  - Mỗi thẻ hiển thị rõ: Huy hiệu nhóm không chắc chắn (`UNCERTAIN_INFO`, `OUT_OF_POLICY`, `OVER_AUTHORITY`).
  - Hộp thông tin câu hỏi hành động A/B:
    - 2 nút bấm phương án A và B có màu sắc đối lập rõ ràng.
    - Bấm nút là lưu phán quyết ngay, không yêu cầu gõ thêm văn bản trừ khi muốn ghi đè.

### 7.3. Màn hình 3: Bộ Công Cụ Kiểm Thử Tự Động (Verify Harness)
- **Tab 1: 5 Ca Chuẩn Benchmark 90 Giây:**
  - Nút bấm **"Chạy Bộ Kiểm Thử Verify"**.
  - Bảng kết quả 5 dòng (3 ca Routine xanh lá, 2 ca Escalated vàng cam).
  - Cột hiển thị: Mã kiểm thử, File nguồn, Trạng thái kỳ vọng, Trạng thái thực tế, Schema Valid, Thời gian thực thi (ms), Câu hỏi A/B.
  - Khối tổng hợp số liệu: Timestamp thực, Tỷ lệ Pass 100%, False Negative 0.0%, False Positive 7.7%, STP 92.3%.
- **Tab 2: Hộp Cát Giám Khảo (Judge Sandbox):**
  - 2 nút nạp nhanh tình huống mẫu: "Nạp ca thường quy mới" và "Nạp ca bất thường mới".
  - Cho phép Giám khảo tự kiểm chứng phản ứng của hệ thống.

### 7.4. Màn hình 4: Nhật Ký Kiểm Toán & Can Thiệp Ghi Đè (Audit Trail & Human Override)
- Bảng lịch sử chuỗi băm Merkle:
  - Hiển thị thời gian thực, người thực hiện, hành động, căn cứ pháp lý, và mã băm SHA-256 nối chuỗi.
- Bộ nút thao tác trên từng dòng:
  - **Nút "Hồ sơ Thuế" (Tax Defense Dossier):** Mở modal hiển thị biên bản giải trình thuế 1-click có thể in ấn.
  - **Nút "Ghi đè" (Override):** Cho phép con người lật ngược phán quyết của AI kèm ô nhập lý do ghi đè.
  - **Nút "Hoàn tác" (Undo):** Đưa hồ sơ về trạng thái trước đó và tạo thêm 1 khối kiểm toán mới.

---

## 8. MA TRẬN TRUY XUẤT & TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

Bảng đối chiếu 100% giữa các yêu cầu chức năng (FR) của bản đặc tả với Thang điểm 100 của Ban Giám khảo cuộc thi OrganizationAI Track 2:

| Tiêu Chí Chấm Thi | Trọng Số | Yêu Cầu Của Ban Giám Khảo | Chức Năng Đối Ứng (FR) | Tiêu Chí Nghiệm Thu (Acceptance Test) |
| :--- | :---: | :--- | :---: | :--- |
| **Tiêu chí 1: Đường dẫn trực tuyến** | **10 đ** | Truy cập URL và thao tác ngay, không cần tài khoản, không cài đặt. | **NFR-2, FR-8** | Mở trình duyệt ẩn danh, truy cập URL, bấm 1 nút là vào thẳng bàn làm việc thẩm định. |
| **Tiêu chí 2: Kiểm thử Verify tự động** | **12 đ** | Một thao tác bấm chạy toàn bộ và in bảng kết quả đạt/không đạt kèm timestamp thực. | **FR-8.1** | Bấm nút Verify -> In bảng kết quả 5 ca trong < 100ms, có dấu thời gian thực chuẩn ISO. |
| **Tiêu chí 3: Dữ liệu mới của Giám khảo** | **8 đ** | Xử lý hợp lý 2 dữ liệu đầu vào mới của Giám khảo, dừng đúng nếu có bất thường. | **FR-8.2** | Nạp 2 dữ liệu mới vào Hộp cát: ca thường quy duyệt thẳng, ca vi phạm luật dừng chuyển tiếp. |
| **Tiêu chí 4: 5 Slide, Video & Build Log** | **10 đ** | Đầy đủ 5 slide theo cấu trúc, video mộc < 3 phút, build log 1 trang A4. | **Hồ sơ nộp** | Đầy đủ tài liệu, thể hiện rõ trọng số Slide 3 (đo lường) và Slide 5 (giới hạn & bất cập). |
| **Tiêu chí 5: Người dùng thực tế** | **20 đ** | 3 nhân sự thật kèm trích dẫn nguyên văn; 1 cải tiến từ phản hồi; 1 bất cập thực tế phát sinh. | **FR-6, FR-9** | Có hồ sơ 3 nhân sự (KTV, KTT, CFO); cải tiến quy tắc rượu bia; chỉ ra bất cập nghẽn ngày cao điểm. |
| **Tiêu chí 6: Vai trò con người & Audit** | **20 đ** | Khớp điểm quyết định Slide 2; tra cứu Audit Log bất kỳ; nút Dừng & Ghi đè hiệu quả; giải thích dễ hiểu. | **FR-5, FR-7** | Chọn 1 log -> xem chi tiết & SHA-256; bấm nút Override lật ngược phán quyết tức thì; giải thích bình dân. |
| **Tiêu chí 7: Xác thực Đề bài A** | **20 đ** | Chuyển tiếp đúng 2 ca (8đ); tự duyệt 3 ca thường quy STP (6đ); câu hỏi A/B dứt khoát không cần xem lại file gốc (6đ). | **FR-2, FR-3, FR-4** | 5 ca Benchmark chạy đúng 3 Routine + 2 Escalated; câu hỏi có 2 lựa chọn A/B rõ ràng định lượng. |
| **TỔNG CỘNG** | **100 đ** | **ĐẠT ĐIỂM TỐI ĐA TRÊN TẤT CẢ CÁC HẠNG MỤC** | | |

---

## 9. KẾT LUẬN & HƯỚNG DẪN BƯỚC THIẾT KẾ TIẾP THEO THEO WATERFALL

Bản đặc tả yêu cầu phần mềm (SRS) này là căn cứ duy nhất để đội ngũ kỹ thuật thực hiện các bước tiếp theo trong quy trình Thác Nước:
1. **Giai đoạn Thiết kế Kiến trúc (System Architecture Design):** Thiết kế sơ đồ phân rã thành phần, giao thức API giữa các module, và cơ chế bảo mật chuỗi băm.
2. **Giai đoạn Thiết kế Chi tiết (Detailed Design & Database Schema):** Thiết kế chi tiết các bảng cơ sở dữ liệu quan hệ, các câu lệnh DDL, và mã giả của bộ máy quy tắc tất định.
3. **Giai đoạn Cài đặt (Implementation & Coding):** Lập trình các module theo đúng hợp đồng giao diện đã định nghĩa trong bản đặc tả.
4. **Giai đoạn Kiểm thử & Nghiệm thu (Testing & Verification):** Thực thi ma trận kiểm thử tại Mục 8 để bảo đảm sản phẩm sẵn sàng 100% trước khi bước vào phiên chấm thi 8 phút của Hội đồng Ban Giám khảo.
