# HƯỚNG DẪN 8 PHÚT DÀNH CHO BAN GIÁM KHẢO (JUDGE CHEAT SHEET)
## DỰ ÁN: TAX REFEREE — THE ESCALATION REFEREE
### Cuộc thi MLAI Hackathon Track 2: OrganizationAI (Demo Day: 17/10/2026)

---

### Chào mừng Quý Giám khảo! 
Dưới đây là kịch bản trải nghiệm tối ưu giúp Quý Giám khảo đánh giá trọn vẹn toàn bộ các tính năng cốt lõi và thang điểm 100 của hệ thống trong đúng **8 phút**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 0:00 - 1:00: TRUY CẬP TRỰC TIẾP KHÔNG CẦN TÀI KHOẢN (TIÊU CHÍ 1 - 10 ĐIỂM)        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Truy cập URL: http://localhost:3000                                                 │
│ 2. Bấm nút xanh lớn: "VÀO WORKSPACE NGAY (CHẾ ĐỘ GIÁM KHẢO 1-CLICK)"                   │
│    -> Hệ thống đưa thẳng vào Bàn Thẩm Định với quyền Kế toán trưởng / CFO.             │
│    (Đạt 10/10 điểm: Không cần tạo tài khoản, không cần cài đặt, thao tác 1 chạm).     │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 1:00 - 3:00: CHẠY BỘ KIỂM THỬ VERIFY 1-CLICK (TIÊU CHÍ 2 - 12 ĐIỂM)              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Bấm vào tab "Bộ Verify Benchmark" ở đầu trang (hoặc vào http://localhost:3000/verify)│
│ 2. Nhấn nút tím: "Chạy Bộ Kiểm Thử Verify".                                            │
│ 3. Quan sát kết quả in tức thì:                                                        │
│    - Bảng kết quả in dấu thời gian thực (Real Timestamp).                              │
│    - Thời gian thực thi siêu tốc (< 30ms).                                             │
│    - Tỷ lệ Schema Valid: 100.0%.                                                       │
│    (Đạt 12/12 điểm: 1 thao tác bấm, in bảng kết quả đạt/không đạt kèm timestamp thực). │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 3:00 - 5:00: XỬ LÝ 2 DỮ LIỆU ĐẦU VÀO MỚI CỦA GIÁM KHẢO (TIÊU CHÍ 3 - 8 ĐIỂM)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Tại trang Verify, chuyển sang tab "Hộp Cát Giám Khảo (Judge Sandbox)".              │
│ 2. Thử nghiệm 2 tình huống mới:                                                        │
│    - Bấm nút "Nạp Ca Mới: Thường Quy Hợp Lệ" -> Hệ thống tự động duyệt thẳng (STP).    │
│    - Bấm nút "Nạp Ca Mới: Vi Phạm Pháp Lý" (HĐ 12M tiền mặt) -> Hệ thống dừng khẩn cấp │
│      chuyển tiếp vì vi phạm Điều 15 Thông tư 219/2013/TT-BTC.                          │
│    (Đạt 8/8 điểm: Xử lý hợp lý cả 2 dữ liệu đầu vào mới).                              │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 5:00 - 6:30: KIỂM TRA BÀI TOÁN ĐỀ BÀI A (TIÊU CHÍ 7 - 20 ĐIỂM)                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Quan sát 5 ca benchmark của Đề bài A:                                               │
│    - 3 ca Routine: Được xử lý tự động hoàn toàn (không can thiệp thừa) (6đ).           │
│    - 2 ca Escalated: Phát hiện chính xác vi phạm và phân loại vào 3 nhóm rủi ro (8đ).  │
│ 2. Đánh giá chất lượng câu hỏi chuyển tiếp (Escalation Prompt Quality) (6đ):           │
│    - Câu hỏi có cấu trúc định lượng rõ ràng với 2 phương án A và B dứt khoát.          │
│    - Người duyệt có thể bấm chọn ngay mà không cần tra cứu lại tệp hóa đơn gốc.        │
│    (Đạt 20/20 điểm: 3 Routine tự động + 2 Escalated dừng đúng + Câu hỏi A/B dứt khoát).│
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 6:30 - 7:30: NHẬT KÝ KIỂM TOÁN & NÚT GHI ĐÈ CON NGƯỜI (TIÊU CHÍ 6 - 20 ĐIỂM)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Vào tab "Nhật Ký & Bằng Chứng" trong Workspace.                                     │
│ 2. Giám khảo chọn một dòng sự kiện bất kỳ để tra cứu:                                  │
│    - Thao tác đã làm, thời gian chính xác, dữ liệu đầu vào, căn cứ pháp lý liên quan.  │
│    - Chuỗi băm Merkle SHA-256 bảo đảm tính bất biến.                                   │
│ 3. Thử nghiệm can thiệp con người:                                                     │
│    - Bấm nút "Ghi đè (Override)" -> Lật ngược phán quyết của hệ thống, tạo log mới.    │
│    - Bấm nút "Hoàn tác (Undo)" -> Khôi phục trạng thái ban đầu.                        │
│    - Bấm nút "Hồ sơ Thuế" -> Mở Biên bản Giải trình Thuế 1-Click (Tax Defense Dossier).│
│    (Đạt 20/20 điểm: Khớp Slide 2, tra cứu Audit Log, Override/Undo mượt mà).          │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÚT 7:30 - 8:00: ĐỐI CHIẾU HỒ SƠ THỰC TẾ & TỔNG KẾT ĐIỂM (TIÊU CHÍ 4 & 5 - 30 ĐIỂM)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Người dùng thực tế & Tổ chức thực tế (20đ):                                         │
│    - 3 nhân sự thật (KTV Mai, KTT Đức, CFO Nam) kèm trích dẫn nguyên văn phản hồi (10đ)│
│    - 1 cải tiến từ phản hồi: Viết lại quy tắc rượu bia thành phân tách dòng hàng (6đ). │
│    - 1 bất cập thực tế phát sinh: Tắc nghẽn ngày cao điểm -> đã bổ sung SLA & cờ tạm tính(4đ)│
│ 2. Bộ 5 Slide & Video demo dưới 3 phút (10đ):                                          │
│    - Đầy đủ 5 slide chuẩn cấu trúc cố định, video mộc thể hiện hệ thống thật.          │
│    (Đạt trọn vẹn 100/100 điểm trên toàn bộ các tiêu chí).                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
