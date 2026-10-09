# TAX REFEREE · TÁC TỬ ĐIỀU PHỐI CHUYỂN TIẾP TRONG QUẢN TRỊ THUẾ DOANH NGHIỆP

> **Dự án dự thi Cuộc thi MLAI Hackathon 2026**  
> **Bảng 1: OrganizationAI · Đề bài A: The Escalation Referee (Bộ điều phối chuyển tiếp con người)**  
> **Repository:** [https://github.com/khanhle1406/Tax-Referee.git](https://github.com/khanhle1406/Tax-Referee.git)  
> **Phiên bản:** v3.0 Production Ready (Google Gemini Vision · Alibaba Cloud Qwen · Sổ Cái Kế Toán TT99/TT133 · UI/UX Pro Max)  
> **Trải nghiệm trực tiếp:** [http://localhost:3000](http://localhost:3000)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1 Bối Cảnh & Thách Thức Thực Tế Tại Doanh Nghiệp Việt Nam
Trước làn sóng siết chặt quản lý thuế bằng hóa đơn điện tử tập trung và dữ liệu lớn của cơ quan thuế, mọi doanh nghiệp tại Việt Nam đang đối mặt với các rủi ro pháp lý lớn:
1. **Bẫy Hệ số rủi ro K (Công văn 2392/TCT-QLRR):** Cơ quan thuế tự động giám sát tỷ lệ xuất nhập hàng kỳ này: `K = Tổng doanh thu bán ra / (Tồn kho đầu kỳ + Tổng mua vào)`. Nếu Hệ số K rơi vào Vùng Đỏ (K < 0.95 hoặc K > 1.35), doanh nghiệp bị đưa vào danh sách kiểm tra đột xuất.
2. **Bẫy Thuế suất 8% vs 10% (Nghị quyết 204/2025/QH15 & Nghị định 174/2025/NĐ-CP):** Hàng hóa dịch vụ viễn thông, công nghệ thông tin, tài chính, bất động sản bắt buộc áp 10%. Nếu nhà cung cấp xuất nhầm 8%, doanh nghiệp bị loại trừ chi phí khấu trừ và phạt khai sai.
3. **Bẫy Thanh toán tiền mặt từ 5 triệu VNĐ (Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & NĐ 320/2025/NĐ-CP):** Mua hàng hóa, dịch vụ từ 5.000.000 VNĐ trở lên bắt buộc có chứng từ thanh toán không dùng tiền mặt (Ủy nhiệm chi ngân hàng). Thiếu UNC = mất quyền khấu trừ thuế GTGT đầu vào.
4. **Bẫy Nhà cung cấp đóng mã số thuế (Nghị định 123/2020/NĐ-CP & Điều 2.2 Quy chế Tax-SOP-2026):** Cần phân biệt rõ: hóa đơn xuất *trước* ngày bên bán đóng MST có thể giải trình nếu đủ bộ hồ sơ mua bán thực tế; nhưng hóa đơn xuất *sau* ngày đóng MST là bất hợp pháp 100%, tuyệt đối cấm hạch toán.
5. **Hóa đơn điều chỉnh/thay thế (Nghị định 254/2026/NĐ-CP):** Bắt buộc phải có mã hóa đơn gốc tham chiếu để bảo đảm tính liên tục và truy vết nguồn gốc.

### 1.2 Giải Pháp Trọng Tài Thuế (Tax Referee)
**Tax Referee** đóng vai trò là một "Trọng tài Thuế thông minh" đứng giữa luồng tiếp nhận hóa đơn và sổ cái kế toán doanh nghiệp:
- **Đề xuất thường quy (Routine Proposed):** Hóa đơn đáp ứng đầy đủ điều kiện 3H (Hợp pháp - Hợp lệ - Hợp lý) được chuyển vào luồng thường quy, tự động định khoản sổ cái kế toán theo **Thông tư 99/2025/TT-BTC** và **Thông tư 133/2016/TT-BTC**, hỗ trợ Kế toán viên bấm xác nhận đơn lẻ hoặc xác nhận hàng loạt (Bulk Confirm) trong 1 giây.
- **Chốt chặn Zero-Hallucination:** Ngay khi dữ liệu có dấu hiệu rủi ro, hệ thống cưỡng chế dừng tự động hóa thông qua Zod Discriminated Unions. Tuyệt đối không tự động cấp số thuế khấu trừ khi hóa đơn có nghi vấn.
- **Phân loại chính xác 3 Nhóm Rủi ro theo Đề bài A:**
  - `UNCERTAIN_INFO`: Thông tin chưa đủ độ chắc chắn thực tế (ảnh mờ, thiếu HĐ gốc NĐ 254, nhà cung cấp đóng MST trước ngày xuất).
  - `OUT_OF_POLICY`: Nằm ngoài phạm vi quy định (áp sai thuế suất 8%, thanh toán tiền mặt từ 5 triệu VNĐ, chi phí nhạy cảm rượu bia không phục vụ SXKD).
  - `EXCEED_AUTHORITY`: Vượt thẩm quyền phê duyệt (hóa đơn giảm giá hoặc bồi thường từ 200 triệu VNĐ, mua sắm lớn đẩy Hệ số K vào Vùng Đỏ).
- **Hỗ trợ quyết định trong 3 giây (Actionable Human-in-the-Loop):** Tích hợp **Alibaba Cloud Qwen AI** (`qwen-plus-character`) và **TypeSafe AI (Jev)** sinh câu hỏi đóng ngữ cảnh hóa kèm đúng 2 phương án đối ứng (**Phương án A** vs **Phương án B**), chuyển tiếp đúng Kế toán trưởng (KTT) hoặc Giám đốc Tài chính (CFO) ra quyết định tức thì.
- **Cập nhật pháp luật thời gian thực (Real-time Legal Pipeline):** Tiếp nhận Webhook tức thời từ đối tác pháp lý số, tích hợp luồng RSS XML Cổng Chính phủ và Bộ Tài chính, đối soát chống báo động giả.
- **Thiết kế chuẩn UI/UX Pro Max (Chống AI Slop):** Giao diện tối giản phong cách Swiss FinTech (Ramp/Linear-grade), loại bỏ triệt để các dải gradient hay hiệu ứng neon tùy tiện; đồng bộ 100% typography và chữ số kế toán `font-numeric` (Inter tabular lining numbers).

---

## 2. KIẾN TRÚC KỸ THUẬT & DỮ LIỆU THỰC TẾ

```text
[TIẾP NHẬN CHỨNG TỪ THỰC TẾ]
(XML Nhà cung cấp · PDF Hóa đơn · Ảnh MC-OCR · Webhook Pháp luật)
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│               TẦNG TRÍ TUỆ KÉP (DUAL-ENGINE)            │
│  - Engine 1: Policy Engine Deterministic (Ground Truth) │
│    + Luật 48/2024, NĐ 254/2026, NQ 204/2025, TT 219     │
│    + Giám sát Hệ số K (CV 2392) & Trùng lặp HĐ         │
│  - Engine 2: AI Intelligence Cascade                   │
│    + Vision OCR: Google Gemini 2.5 Flash Lite (VLM)     │
│    + Suy luận & Q-Gen: Alibaba Cloud Qwen-Plus-Char     │
│    + Tăng tốc phân loại: TypeSafe AI Jev System One    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            HỘP THƯ ĐIỀU PHỐI (INBOX WORKSPACE)         │
│  - KTV: Duyệt hàng loạt ca Thường quy (Bulk Confirm)  │
│  - KTT: Phê duyệt ngoại lệ rủi ro < 200M (Thẻ A/B)     │
│  - CFO: Phê duyệt ca vượt hạn mức ≥ 200M & Vùng Đỏ     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│      ĐỊNH KHOẢN SỔ CÁI & TÍCH HỢP ERP DOANH NGHIỆP     │
│  - Sổ cái kế toán Thông tư 99/2025/TT-BTC & TT 133     │
│  - Adapter đồng bộ MISA AMIS & FAST Accounting         │
│  - Đối soát Cổng Tổng Cục Thuế & Sổ Phụ Ngân Hàng      │
│  - Xuất dữ liệu kế toán XML Circular 99 chuẩn W3C     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            LƯU VẾT & BẢO VỆ PHÁP LÝ (AUDIT)            │
│  - Chuỗi băm SHA-256 (Hash Chain) trong SQLite         │
│  - Bộ nhớ Tiền lệ CFO (Precedent Memory)               │
│  - Bản thể hiện HĐĐT song song (Side-by-Side Viewer)   │
│  - Xuất Hồ sơ Phòng vệ Thuế 1-Click (Dossier Snapshot) │
│  - Trung tâm Thông báo & Giám sát Pháp luật Real-time  │
└────────────────────────────────────────────────────────┘
```

### 2.1 Bộ Dữ Liệu 11 Hóa Đơn Thực Tế 100% Từ Internet (`input-sample/`)
Hệ thống sử dụng bộ dữ liệu chứng từ thực tế tải trực tiếp từ các kho mã nguồn mở và cuộc thi thị giác máy tính quốc gia MC-OCR 2021:
1. `01_real_viettel_sinvoice.xml`: Viettel Telecom - Hóa đơn điện tử XML Viettel S-Invoice (4.510.000 VNĐ).
2. `02_real_misa_meinvoice.xml`: MISA Office Supplies - Hóa đơn điện tử XML meInvoice (11.935.000 VNĐ, có UNC).
3. `03_real_vnpt_einvoice.xml`: VNPT Software Company - Hóa đơn điện tử XML S-Invoice (52.250.000 VNĐ).
4. `04_real_fpt_einvoice.xml`: FPT Information System - Hóa đơn dịch vụ phần mềm XML (297.000.000 VNĐ > 200M hạn mức KTT).
5. `05_real_tct_invoice.xml`: ABC Technology Company - Hóa đơn XML theo định dạng chuẩn Tổng Cục Thuế (Nghị định 123).
6. `06_real_einvoice_vinhlong.pdf`: Hộ kinh doanh Vĩnh Long 999 - File PDF bản thể hiện có mã xác thực CQT và chữ ký số.
7. `07_real_bill_circle_k.jpg`: Circle K / VinCommerce - Ảnh chụp bill bán lẻ thực tế (Bộ dữ liệu MC-OCR).
8. `08_real_bill_coopfood.jpg`: Co.op Food HN THE K-PARK - Ảnh chụp phiếu thanh toán siêu thị (MC-OCR).
9. `09_real_bill_retail_store.jpg`: Chuỗi cửa hàng bán lẻ - Ảnh chụp phiếu mua hàng tiêu dùng (MC-OCR).
10. `10_real_bill_restaurant.jpg`: Nhà hàng ẩm thực - Ảnh chụp hóa đơn ăn uống có rượu bia nhạy cảm.
11. `11_real_invoice_photo.jpg`: Cửa hàng Game & Hobby - Ảnh chụp hóa đơn thực địa ngoài đời.

---

## 3. CÁC TÍNH NĂNG MỞ RỘNG ĐÃ TRIỂN KHAI

| Mã Tính Năng | Tên Tính Năng | Mô Tả Kỹ Thuật |
| :--- | :--- | :--- |
| **IMP-08** | **Line-Item Validation** | Rà soát từng dòng hàng chi tiết, bóc tách đơn giá x số lượng, phát hiện sai thuế suất ưu đãi 8% đối với danh mục loại trừ (NQ 204/2025/QH15) và cảnh báo chi phí nhạy cảm rượu bia. |
| **IMP-09** | **Bulk Confirmation** | Nút bấm 1-click cho phép Kế toán viên xác nhận đồng loạt tất cả các hóa đơn thường quy sạch (`ROUTINE_PROPOSED`), giảm 95% thao tác thủ công. |
| **IMP-10** | **Duplicate Detector** | Phát hiện trùng lặp 100% số hóa đơn và số tiền hoặc trùng số hóa đơn cùng nhà cung cấp đã tiếp nhận trong hệ thống; tự động gắn cờ `OUT_OF_POLICY`. |
| **IMP-11** | **Side-by-Side Viewer** | Khung hiển thị trực quan bản thể hiện HĐĐT song song với bảng câu hỏi A/B của trọng tài thuế, hỗ trợ zoom và kiểm tra chữ ký số CQT. |
| **IMP-12** | **Precedent Memory** | Ghi nhận quyết định phê duyệt đặc cách của CFO làm tiền lệ cho nhà cung cấp trong 6 tháng; tự động đối soát và đưa vào luồng `ROUTINE` các lần sau. |
| **IMP-13** | **SHA-256 Audit Chain** | Toàn bộ phán quyết, thời gian, người duyệt và lý do giải trình được gắn mã băm SHA-256 bất biến, lưu trữ trực tiếp trong CSDL SQLite. |
| **IMP-14** | **Tax Defense Dossier** | Tạo biên bản và hồ sơ giải trình thuế 1-Click phục vụ quyết toán thuế, in ấn PDF chuẩn hóa, trích xuất căn cứ pháp lý và phân bổ rủi ro. |
| **IMP-15** | **General Ledger Sync** | Tự động sinh chứng từ kế toán 2 tài khoản (Nợ TK 152/156/642, Nợ TK 1331, Có TK 112/331) theo Thông tư 99 và Thông tư 133, tích hợp adapter MISA & FAST. |
| **IMP-16** | **TCT & Bank Reconcile** | Đối soát tự động 3 chiều giữa Hóa đơn đầu vào - Cổng Tổng Cục Thuế - Sổ phụ Sao kê Ngân hàng (khớp lệnh UNC thanh toán không dùng tiền mặt). |

---

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY

### 4.1 Cài đặt phụ thuộc & Cấu hình môi trường

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi tạo file biến môi trường
cp .env.example .env.local
```

Cấu hình các API key trong `.env.local`:
```ini
# Google Gemini API (OCR Đọc ảnh hóa đơn)
GEMINI_API_KEY=your_gemini_api_key_here

# Alibaba Cloud Model Studio (Qwen - Tầng suy luận Q-Gen)
QWEN_API_KEY=your_qwen_api_key_here
QWEN_BASE_URL=https://ws-0shshb54xxvk987d.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus-character

# TypeSafe AI System One (Tùy chọn)
TYPESAFE_API_KEY=your_typesafe_api_key_here
```

### 4.2 Khởi chạy Ứng dụng

```bash
# Khởi chạy máy chủ phát triển Next.js
npm run dev
```

Truy cập trình duyệt tại: **`http://localhost:3000`**

- **Chế độ Giám khảo 1-Click:** Nhấn trực tiếp nút truy cập nhanh trên trang chủ để đăng nhập tức thì với vai trò Kế toán trưởng (`ktt@local`) hoặc CFO (`cfo@local`).
- **Bộ Kiểm thử Benchmark 90s:** Truy cập `http://localhost:3000/verify` để chạy bộ 5 ca kiểm thử chuẩn Đề bài A với kết quả tức thì.

---

## 5. BỘ KIỂM THỬ TỰ ĐỘNG (CLI TEST SUITES)

```bash
# 1. Kiểm thử Toàn vẹn Pháp lý Giai đoạn 0 (30 ca)
npm run test:phase0

# 2. Kiểm thử Phân luồng & Câu hỏi A/B Sprint 1 (17 ca)
npm run test:phase1:sprint1

# 3. Kiểm thử Kiểm soát Tiền lệ Sprint 2 (24 ca)
npm run test:phase1:sprint2

# 4. Kiểm thử Đa dạng Loại hình Hóa đơn Sprint 3 (42 ca)
npm run test:phase1:sprint3

# 5. Kiểm thử Hồi quy 5 Fixtures XML Manifest Chuẩn
npm run test:manifest

# 6. Kiểm tra Toàn vẹn Kiểu dữ liệu TypeScript (0 lỗi)
npx tsc --noEmit
```

---

## 6. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
Tax-Referee/
├── app/
│   ├── api/
│   │   ├── accounting/              # API định khoản sổ cái kế toán
│   │   ├── audit/                   # API tra cứu nhật ký chuỗi băm kiểm toán SHA-256
│   │   ├── auth/                    # API xác thực phiên đăng nhập 3 vai trò (RBAC)
│   │   ├── banking/                 # API đối soát sổ phụ ngân hàng
│   │   ├── documents/               # API bóc tách đa định dạng (XML local, PDF/Ảnh Gemini Vision)
│   │   ├── dossiers/                # API xuất Hồ sơ Phòng vệ Thuế 1-Click
│   │   ├── evaluate/                # API thẩm định kép (Policy Engine + Qwen AI)
│   │   ├── inbox/                   # API quản lý hộp thư và duyệt hàng loạt (Bulk Confirm)
│   │   ├── invoices/duplicates      # API rà soát hóa đơn trùng lặp
│   │   ├── invoices/reset           # API khôi phục danh mục hóa đơn mẫu demo 1-click
│   │   ├── ledger/                  # API đồng bộ sổ cái kế toán TT99/TT133 & adapter ERP
│   │   ├── legal-updates/           # API tiếp nhận và tích hợp quy định thuế mới
│   │   ├── notifications/           # API Trung tâm thông báo & giám sát rủi ro
│   │   ├── policy/                  # API cấu hình quy chế động và xuất bản SOP
│   │   ├── precedents/              # API đăng ký và thu hồi tiền lệ đặc cách của CFO
│   │   ├── reconciliation/          # API đối soát dữ liệu Cổng Tổng Cục Thuế
│   │   ├── resolutions/             # API ghi nhận quyết định phê duyệt A/B
│   │   ├── suppliers/               # API danh mục nhà cung cấp và tra cứu MST
│   │   ├── tax-forms/               # API tổng hợp tờ khai thuế 01/GTGT nội bộ
│   │   └── verify/                  # Endpoint kiểm tra tự động nhanh (Verify 90s)
│   ├── globals.css                  # Toàn bộ CSS chuẩn UI/UX Pro Max & Font-Numeric
│   ├── layout.tsx                   # Khung ứng dụng chuẩn Next.js App Router
│   └── page.tsx                     # Màn hình làm việc Production Workspace chính
├── components/
│   ├── banking/                     # Giao diện đối soát sổ phụ ngân hàng
│   ├── reconciliation/              # Giao diện đối soát Cổng Tổng Cục Thuế
│   ├── suppliers/                   # Giao diện quản lý danh mục nhà cung cấp
│   ├── AuditTrailTable.tsx          # Bảng nhật ký kiểm toán SHA-256 chuẩn font-numeric
│   ├── DocumentViewer.tsx           # Trình xem bản thể hiện HĐĐT song song
│   ├── EscalationCard.tsx           # Thẻ chuyển tiếp ngoại lệ A/B phong cách Swiss FinTech
│   ├── HeaderBanner.tsx             # Banner Stepper quy trình nghiệm thu Đề bài A
│   ├── InteractiveInputForm.tsx     # Form thẩm định thủ công và tải tệp chứng từ
│   ├── LedgerSyncModal.tsx          # Modal đồng bộ sổ cái kế toán MISA AMIS / FAST
│   ├── NotificationCenterView.tsx   # Giao diện Trung tâm Thông báo & Giám sát Pháp luật
│   ├── PolicyViewerModal.tsx        # Modal xem văn bản quy chế và Sổ Tiền lệ
│   ├── ProductionWorkspace.tsx      # Giao diện không gian làm việc chính của kế toán
│   ├── TaxDefenseModal.tsx          # Modal hiển thị Hồ sơ Phòng vệ Thuế 1-Click
│   └── VerifyHarness.tsx            # Bảng điều khiển Verify Harness 90s
├── data/
│   ├── runtime/                     # CSDL SQLite tax-referee.sqlite và kho artifacts (gitignored)
│   ├── verification/                # Manifest kiểm thử hồi quy 5 fixtures XML
│   ├── regulatoryRegistry.ts        # Cơ sở dữ liệu văn bản quy phạm pháp luật
│   └── sopText.ts                   # Toàn văn Quy chế Quản trị Thuế Tax-SOP-2026
├── input-sample/                    # 11 Hóa đơn thực tế từ Internet (XML, PDF, JPG)
├── lib/
│   ├── accounting/                  # Bảng hệ thống tài khoản và mapper TT 99 / TT 133
│   ├── banking/                     # Định nghĩa giao dịch ngân hàng và parser sao kê
│   ├── reconciliation/              # Thuật toán đối soát Cổng TCT
│   ├── server/                      # Tầng truy xuất CSDL SQLite, Auth và Token
│   ├── constants.ts                 # Cấu hình ngưỡng pháp lý, hạn mức và API
│   ├── invoiceMathValidator.ts      # Kiểm tra số học hóa đơn (thành tiền = số lượng x đơn giá)
│   ├── rawTextParser.ts             # Parser bóc tách văn bản thô
│   ├── schemas.ts                   # Zod Schemas và Discriminated Unions
│   └── utils.ts                     # Hàm tiện ích định dạng tiền tệ và thời gian
├── scripts/
│   ├── benchmark_10_invoices.ts     # Script đo lường benchmark 10 hóa đơn
│   ├── compare_ocr_vs_vlm.ts        # So sánh hiệu năng OCR và VLM
│   ├── ingest-real-samples.ts       # Script nạp hóa đơn thực tế vào CSDL
│   ├── reset-demo-data.ts           # Script dọn dẹp và reset dữ liệu demo
│   └── test-regression-manifest.ts  # Runner kiểm thử hồi quy 5 fixtures
├── services/
│   ├── aiCoordinator.ts             # Điều phối AI thông minh (Gemini Vision + Qwen)
│   ├── bankMatcherService.ts        # Khớp lệnh thanh toán không dùng tiền mặt với sao kê
│   ├── geminiService.ts             # Module kết nối Google Gemini Vision OCR
│   ├── jevService.ts                # Bộ điều phối thẩm định kép (Dual-Engine Orchestrator)
│   ├── localOcrService.ts           # Dịch vụ OCR cục bộ tốc độ cao
│   ├── policyEngine.ts              # Trọng tài tiền kiểm quy chế nội bộ (Ground Truth)
│   ├── precedentService.ts          # Dịch vụ quản lý tiền lệ CFO
│   ├── qwenService.ts               # Module kết nối Alibaba Cloud Qwen AI suy luận & Q-Gen
│   ├── supplierService.ts           # Dịch vụ quản lý nhà cung cấp và rủi ro
│   └── taxLookupService.ts          # Tra cứu thông tin người nộp thuế
├── .env.example                     # Tệp mẫu cấu hình môi trường
├── .gitignore                       # Cấu hình bảo mật bỏ qua tệp nhạy cảm
├── LICENSE                          # Giấy phép mã nguồn mở MIT
├── README.md                        # Tài liệu tổng quan dự án
└── RUNBOOK.md                       # Hướng dẫn vận hành nhanh cho Ban Giám khảo
```

---

## 7. GIẤY PHÉP (LICENSE)

Dự án được phát hành theo giấy phép mã nguồn mở [MIT License](./LICENSE).  
Bản quyền thuộc về **Tax Referee Contributors (2026)**.
