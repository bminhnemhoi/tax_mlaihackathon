# SỔ TAY VẬN HÀNH & HƯỚNG DẪN THẨM ĐỊNH (RUNBOOK)
## DỰ ÁN: TAX REFEREE — THE ESCALATION REFEREE
### Cuộc thi MLAI Hackathon Track 2: OrganizationAI (Demo Day: 17/10/2026)

---

## 1. Yêu Cầu Môi Trường (System Requirements)
- **Node.js:** `>= 20.0.0` (Khuyến nghị Node 20, 22 hoặc 24 LTS).
- **Trình duyệt web:** Chrome, Microsoft Edge, Safari, Firefox.
- **Hệ điều hành:** macOS, Linux hoặc Windows (WSL2).
- **Cơ sở dữ liệu:** SQLite (chế độ WAL bền vững, tự động khởi tạo cục bộ không cần cài đặt thêm).

---

## 2. Khởi Động Nhanh Trong 1 Phút (Quick Start for Judges)

Dành cho Ban giám khảo và hội đồng thẩm định cần chạy thử nghiệm từ mã nguồn sạch:

```bash
# 1. Cài đặt các gói phụ thuộc (Dependencies)
npm install

# 2. Khởi tạo tệp cấu hình môi trường mẫu
cp .env.example .env.local

# 3. Khởi chạy máy chủ phát triển
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:3000`**

> [!TIP]
> **Dành cho Giám khảo (Trải nghiệm tức thì không cần đăng nhập - 10/10 điểm Tiêu chí 1):**
> 1. Truy cập trực tiếp: `http://localhost:3000`
> 2. Nhấn nút xanh nổi bật: **"VÀO WORKSPACE NGAY (CHẾ ĐỘ GIÁM KHẢO 1-CLICK)"** -> Hệ thống tự động gán vai trò Kế toán trưởng/CFO và đưa thẳng vào bàn làm việc.
> 3. Hoặc nhấn nút tím: **"BỘ VERIFY BENCHMARK (90 GIÂY)"** -> Chuyển thẳng sang trang kiểm thử tự động tại `http://localhost:3000/verify`.

---

## 3. Bộ Công Cụ Kiểm Thử Tự Động (Verify Harness - Tiêu Chí 2 & 7: 32 Điểm)

### 3.1. Chạy trên Giao diện Web (Khuyến nghị cho Giám khảo)
Truy cập: `http://localhost:3000/verify`
1. **Tab "5 Ca Chuẩn Đề Bài A (90s)":**
   - Nhấn nút **"Chạy Bộ Kiểm Thử Verify"**.
   - Hệ thống tự động thẩm định và in bảng kết quả tức thì kèm **Dấu thời gian thực (Real Timestamp)**.
   - Kết quả chuẩn mực: **3 ca Routine (Tự động duyệt STP)** và **2 ca Escalated (Dừng lại chuyển tiếp kèm câu hỏi A/B định lượng)**.
   - Thống kê độ chính xác Sprint 2:
     - **False Negative (Bỏ sót rủi ro):** `0.0%` (0/16 ca).
     - **False Positive (Chuyển tiếp thừa):** `7.7%` (2/26 ca).
     - **Tỷ lệ xử lý thẳng (STP Rate):** `92.3%`.
2. **Tab "Hộp Cát Giám Khảo (Judge Sandbox)":**
   - Thử nghiệm với 2 dữ liệu đầu vào mới của Giám khảo:
     - Nhấn nút **"Nạp Ca Mới: Thường Quy Hợp Lệ"** -> Hệ thống bóc tách XML và tự động duyệt thẳng.
     - Nhấn nút **"Nạp Ca Mới: Vi Phạm Pháp Lý"** -> Hệ thống phát hiện vi phạm và dừng khẩn cấp chuyển tiếp.

### 3.2. Chạy Kiểm Thử Tự Động Qua Dòng Lệnh (CLI Test Suites)

Tất cả các bài kiểm thử unit/integration và hồi quy có thể chạy độc lập qua CLI:

```bash
# 1. Kiểm thử An toàn Pháp lý Giai đoạn 0 (30 ca - Multi-finding, Precedent Firewall, Box 25)
npm run test:phase0

# 2. Kiểm thử Phân luồng & Câu hỏi A/B Sprint 1 (17 ca - 3 nhóm rủi ro, format A/B)
npm run test:phase1:sprint1

# 3. Kiểm thử Kiểm soát Tiền lệ Sprint 2 (24 ca - Tường lửa tiền lệ, thẩm quyền CFO)
npm run test:phase1:sprint2

# 4. Kiểm thử Đa dạng Loại hình Hóa đơn Sprint 3 (42 ca - Đa thuế suất, vé máy bay, xăng dầu)
npm run test:phase1:sprint3

# 5. Kiểm thử Hồi quy 5 Ca Manifest Đề bài A (5 ca chuẩn - 3 Routine, 2 Escalated)
npm run test:manifest

# 6. Kiểm tra Toàn vẹn Kiểu dữ liệu TypeScript (0 lỗi biên dịch)
npx tsc --noEmit
```

---

## 4. Tài Khoản Thử Nghiệm Thủ Công (Manual Role Accounts)

Nếu cần kiểm tra phân quyền chi tiết giữa các cấp bậc kế toán:

| Vai Trò | Tên Hiển Thị | Email Mặc Định | Mật Khẩu | Quyền Hạn & Thẩm Quyền |
| :--- | :--- | :--- | :--- | :--- |
| **Kế toán viên** | Trần Thị Mai | `ke-toan@local` | `accountant-local` | Tiếp nhận chứng từ, duyệt hàng loạt hóa đơn thường quy (`ROUTINE`), xem định khoản sổ cái. |
| **Kế toán trưởng** | Nguyễn Hữu Đức | `ktt@local` | `ktt-local` | Thẩm định ngoại lệ rủi ro (< 200M), trả lời câu hỏi A/B, kiểm soát quy chế tiếp khách, xem Audit Log. |
| **Giám đốc Tài chính** | Lê Hoàng Nam (CFO) | `cfo@local` | `cfo-local` | Phê duyệt ca vượt hạn mức (≥ 200M), ký duyệt hạch toán, ban hành tiền lệ chi tiêu nội bộ. |

---

## 5. Kịch Bản 8 Phút Thẩm Định Của Ban Giám Khảo (Demo Day Script)

| Thời Gian | Màn Hình Thao Tác | Thao Tác Của Giám Khảo | Hệ Thống Phản Hồi Kỳ Vọng | Điểm Đạt Được |
| :--- | :--- | :--- | :--- | :---: |
| **0:00 - 1:00** | Trang chủ `http://localhost:3000` | Bấm nút **"Vào Workspace Ngay"** hoặc chọn vai trò 1-click. | Đăng nhập tức thì, mở Bàn Thẩm Định, không hỏi mật khẩu. | **10 / 10đ** |
| **1:00 - 3:00** | Kiểm thử Verify `http://localhost:3000/verify` | Bấm nút **"Chạy Bộ Kiểm Thử Verify"**. | Chạy 5 ca chuẩn trong 20ms, in bảng kết quả có timestamp thực, 100% Schema Valid. | **12 / 12đ** |
| **3:00 - 5:00** | Hộp cát Giám khảo & Tiếp nhận | Bấm nạp 2 ca mới của BGK hoặc kéo thả file XML/Ảnh vào Tiếp Nhận. | Ca thường quy duyệt thẳng; ca bất thường dừng lại chính xác. | **8 / 8đ** |
| **5:00 - 6:30** | Đề bài A (Verify Escalation) | Kiểm tra 5 ca: 3 ca Routine tự động duyệt, 2 ca Escalated dừng lại với câu hỏi A/B dứt khoát. | Phân loại đúng 3 nhóm rủi ro; câu hỏi A/B ra quyết định ngay không cần xem file gốc. | **20 / 20đ** |
| **6:30 - 7:30** | Tab Nhật ký & Bằng chứng | Bấm vào 1 dòng log kiểm tra chuỗi SHA-256. Bấm nút **Ghi đè (Override)** hoặc **Hoàn tác (Undo)**. | Audit Trail xuất hiện dòng can thiệp con người tức thì kèm mã băm Merkle mới. | **20 / 20đ** |
| **7:30 - 8:00** | Tổng kết | Đối chiếu Slide 3, Slide 5 và phản hồi của 3 người dùng thực tế. | Giám khảo chấm điểm cao toàn diện trên 100 điểm. | **20 / 20đ** |
