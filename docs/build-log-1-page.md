# NHẬT KÝ PHÁT TRIỂN (BUILD LOG) — ĐỘ DÀI 1 TRANG A4
## DỰ ÁN: TAX REFEREE — THE ESCALATION REFEREE
### Cuộc thi MLAI Hackathon Track 2: OrganizationAI (Demo Day: 17/10/2026)

---

### 1. Thông Tin Nhóm & Định Vị Dự Án
- **Tên dự án:** Tax Referee — Bộ Điều Phối Chuyển Tiếp Rủi Ro Hóa Đơn Đầu Vào (The Escalation Referee).
- **Đề bài dự thi:** Đề bài A (The Escalation Referee) — Khối lượng lớn thường quy + Vùng xám rủi ro cao.
- **Thời gian phát triển:** Từ 19/09/2026 đến 15/10/2026 (Chia thành 2 Sprint: Sprint 1 xây dựng khung 72h; Sprint 2 thu thập thực tế và hoàn thiện an toàn).

---

### 2. Các Công Cụ AI Đã Sử Dụng & Phương Thức Áp Dụng
Trong suốt quá trình phát triển dự án, đội ngũ đã khai thác phối hợp các công cụ AI theo mô hình phân tầng:
1. **Google Antigravity & Claude 3.7 Sonnet / Opus:** Được sử dụng làm kiến trúc sư phần mềm và trợ lý lập trình cặp (Pair-Programming). Hỗ trợ tái cấu trúc mã nguồn, thiết kế bộ máy quy tắc đa phát hiện (Multi-finding engine), viết test suites và rà soát các lỗ hổng an toàn pháp lý P0.
2. **DeepSeek-V3 / DeepSeek-R1 (Local & API):** Được ứng dụng tại tầng "Generative Edge". DeepSeek chịu trách nhiệm đọc hiểu ngữ cảnh hóa đơn tiếng Việt, chuyển hóa các mã lỗi kỹ thuật phức tạp thành câu hỏi A/B định lượng dứt khoát trên thẻ Escalation Card, và giải thích quyết định cho người dùng không chuyên.
3. **Google Gemini Flash 2.0:** Đóng vai trò làm động cơ dự phòng (Fallback engine) khi máy chủ DeepSeek quá tải hoặc ngoại tuyến, bảo đảm hệ thống luôn phản hồi dưới 50ms.

---

### 3. Những Điểm Công Cụ AI Mang Lại Hiệu Quả Đột Phá
- **Tăng tốc độ phát triển gấp 5 lần:** Tự động tạo lập 42 kịch bản kiểm thử biên phức tạp (hóa đơn xăng dầu, vé máy bay đa chặng, đa thuế suất 8% và 10% lồng ghép) chỉ trong vài giờ thay vì mất hàng tuần viết tay.
- **Tạo sinh câu hỏi A/B chuẩn nghiệp vụ:** Khả năng hiểu tiếng Việt và văn cảnh kinh doanh của DeepSeek giúp sinh ra các câu hỏi chuyển tiếp có tính hành động ngay, dẫn chiếu đúng điều khoản luật (Thông tư 219, Nghị định 123) mà không cần người dùng tra cứu lại hồ sơ gốc.
- **Tối ưu hóa kiến trúc Merkle Audit Trail:** AI hỗ trợ cấu trúc hóa chuỗi băm Merkle SHA-256 nối tiếp, bảo đảm tính toàn vẹn và bất biến của nhật ký kiểm toán.

---

### 4. Những Điểm Công Cụ AI Gây Phát Sinh Chi Phí / Thời Gian (Lessons Learned)
- **Cạm bẫy ảo giác pháp lý (Hallucination Trap):** Ban đầu nhóm thử nghiệm để LLM tự quyết định xem hóa đơn có hợp lệ hay không. Kết quả là LLM thường xuyên "bỏ qua" lỗi thanh toán tiền mặt trên 5 triệu hoặc tự ý suy diễn các mặt hàng cấm. Nhóm đã mất 3 ngày tái cấu trúc toàn bộ để đưa logic pháp lý về **Bộ máy quy tắc tất định (Deterministic Core)** bằng TypeScript; LLM chỉ đóng vai trò trợ lý ngôn ngữ.
- **Độ trễ và giới hạn kết nối (Latency & Rate Limits):** Khi kiểm thử hàng loạt hóa đơn, việc gọi API đám mây gây chậm trễ (từ 2s - 4s/lần gọi). Đội ngũ đã giải quyết bằng cách tích hợp bộ nhớ đệm (Cache) kết quả quy tắc và chế độ chạy Verify độc lập không phụ thuộc mạng ngoài.

---

### 5. Tính Năng Lớn Nhất Đã Quyết Định Cắt Giảm & Lý Do Tương Ứng (Scope Pruning)
- **Tính năng bị cắt giảm:** **"Hệ thống ERP Toàn diện & Quản lý Thuế Cuối tháng"** (Bao gồm: tự động quét email IMAP/Gmail, hạch toán khấu hao TSCĐ TK 214, quản lý hóa đơn bán ra, và lập tờ khai nộp thuế điện tử eTax).
- **Lý do quyết định cắt giảm:**
  - Nhóm nhận thấy đây là cạm bẫy "Scope Creep" của **Đề bài B (Tái cấu trúc toàn bộ quy trình)**. Việc mở rộng sang toàn bộ chức năng kế toán thuế khiến hệ thống trở nên cồng kềnh, phân tán nguồn lực và làm lu mờ giá trị cốt lõi của **Đề bài A: The Escalation Referee**.
  - Đội ngũ đã quyết định đóng băng toàn bộ các phân hệ ERP ngoài rìa để dồn 100% tâm huyết tinh chỉnh **Bộ máy phân luồng chuyển tiếp rủi ro**, **Tường lửa tiền lệ (Precedent Firewall)**, **Chất lượng câu hỏi A/B**, và **Nhật ký kiểm toán con người ghi đè (Human Override)**. Quyết định này giúp sản phẩm đạt độ hoàn thiện cao nhất và ghi điểm tối đa trong 8 phút chấm thi của Ban giám khảo.
