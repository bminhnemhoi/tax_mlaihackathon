# Kịch bản video demo ≤ 3 phút (quay màn hình mộc)

**Quy định:** tối đa 180 giây, quay bản chạy thật trên Live URL **sau khi deploy bản 15/10** (kiểm tra `/api/health` có commit mới),
thể hiện cả điểm chưa hoàn thiện. Không chèn số liệu chưa có nguồn. Mục tiêu dừng ở 2:45–2:55.

Chuẩn bị: cửa sổ ẩn danh, zoom trình duyệt 110%, tắt thông báo, mở sẵn tab Live URL. Không lộ key/ chứng từ thật.

| Thời gian | Màn hình | Thao tác | Lời nói (gợi ý) |
|---|---|---|---|
| 0:00–0:15 | Trang chủ | Chỉ dòng hướng dẫn giám khảo | "Tax Referee tự xử lý hóa đơn đầu vào thường quy, và chỉ dừng khi hóa đơn chưa rõ thông tin, ngoài quy định hoặc vượt thẩm quyền. Không cần tài khoản." |
| 0:15–0:45 | `/verify` | ① Chạy Verify → bảng 9 ca | "Một nút chạy 4 ca chung và 5 ca Đề A trên database tạm, không gọi AI. Mỗi ca có thời điểm chạy, kỳ vọng và thực tế: 3 ca tự xử lý, 2 ca chuyển tiếp, kèm câu hỏi." Chỉ vào câu hỏi ca 275 triệu. |
| 0:45–1:20 | Verify → Thử dữ liệu mới | Bấm "Lệch tổng: 480.000₫ hay 495.000₫?" → Đánh giá | "Ca mới chưa có trong bộ test. Hệ thống không tự sửa số; nó hỏi: tổng đúng là 495 nghìn theo phép tính hay 480 nghìn như in? Trả lời một lần, không cần mở lại hóa đơn." Rồi bấm "Laptop 330 triệu": "Ca này có hai vấn đề, gộp thành hai ý cho CFO, trả lời 1A, 2A." |
| 1:20–1:35 | Thử dữ liệu mới | Bấm "Thường quy: nước uống 540.000₫" | "Ca nhỏ không ghi phương thức thanh toán vẫn tự xử lý, vì dưới ngưỡng 5 triệu dữ kiện đó không làm đổi kết quả. Hỏi thêm chỉ tạo việc." |
| 1:35–2:10 | Trang chủ → ② demo riêng | Mở ca mẫu 0009004 (10 laptop 330 triệu) → đổi vai trò CFO → bảng Trả lời: bấm "1A, 2A" → ghi lý do → Gửi | "Phiên demo có sẵn 4 ca mẫu. Ca này vượt hạn mức Kế toán trưởng và thiếu trạng thái bên bán, nên CFO nhận một câu hỏi 2 ý. Trả lời một lần: '1A, 2A'. Người nhập là Kế toán viên; người duyệt là tài khoản khác, hệ thống chặn tự duyệt. Thuế chỉ được ghi nhận sau khi người có thẩm quyền xác nhận." |
| 2:10–2:35 | Nhật ký | Chọn hồ sơ → xem sự kiện → **Dừng** → **Hoàn tác** | "Mỗi hành động ghi ai làm, lúc nào, dữ liệu đầu vào, quy tắc, lý do, nối chuỗi hash. Dừng và hoàn tác cũng là sự kiện mới, không xóa lịch sử." |
| 2:35–2:55 | README hoặc slide 5 | — | "Giới hạn: dữ liệu kiểm thử là tổng hợp, chưa có đánh giá độc lập quy mô lớn; khoản chi lạ ngoài danh mục rủi ro vẫn có thể tự duyệt; diễn giải pháp lý cần kế toán xác nhận. Chúng tôi đang thử với 3 người dùng do BTC điều phối." |

Sau khi quay: kiểm tra thời lượng ≤ 3:00, âm thanh rõ, không lộ thông tin nhạy cảm; tải lên Drive đúng thư mục nộp bài.

## Bản đã quay ngày 15/10/2026

Quay tự động bằng Playwright trên Live URL (thao tác thật, không dựng cảnh), giọng đọc AI edge-tts (vi-VN-HoaiMyNeural), phụ đề in sẵn, 1920×1080, dài 2:04.
Trong video có dòng ghi chú "Quay trực tiếp trên Live URL · giọng đọc AI". Mã dựng lại: `scratch/video/` (không commit).

| # | Phần | Lời đọc |
|---|---|---|
| 1 | Tax Referee · Trang chủ | Đây là Tax Referee, trọng tài hóa đơn đầu vào cho kế toán doanh nghiệp. Hệ thống tự xử lý hóa đơn thường quy, và chỉ dừng lại khi hóa đơn chưa rõ thông tin, ngoài quy định, hoặc vượt thẩm quyền. Giám khảo không cần tài khoản. |
| 2 | ① Verify: 9 ca một nút | Một nút chạy chín ca kiểm thử: bốn ca chung và năm ca của Đề A, trên cơ sở dữ liệu tạm, không gọi AI. Mỗi ca có thời điểm chạy, kết quả kỳ vọng và thực tế. Ca thường quy được tự xử lý; các ca còn lại dừng đúng nhóm, kèm câu hỏi chuyển tiếp. |
| 3 | Dữ liệu mới: hỏi thay vì đoán | Với dữ liệu mới chưa có trong bộ kiểm thử, hệ thống không tự sửa số. Tổng tiền in trên hóa đơn lệch với tiền hàng cộng thuế, nên nó hỏi kế toán trưởng: tổng đúng là bao nhiêu, và mỗi lựa chọn dẫn tới hệ quả gì. |
| 4 | ② Demo riêng · 4 ca mẫu | Mỗi phiên demo có cơ sở dữ liệu riêng và bốn ca mẫu: một ca tự xử lý, và một ca cho mỗi kiểu dừng. |
| 5 | Vượt thẩm quyền → CFO trả lời "1A, 2A" | Ca mua mười laptop, ba trăm ba mươi triệu đồng, vượt hạn mức của kế toán trưởng và chưa rõ trạng thái mã số thuế bên bán. CFO nhận một câu hỏi hai ý, và trả lời một lần: một A, hai A. Người nhập là kế toán viên, người duyệt là tài khoản khác; hệ thống chặn tự duyệt. |
| 6 | Trả lời B → kết thúc theo hệ quả | Nếu kế toán trưởng xác nhận đã trả tiền mặt cho hóa đơn trên năm triệu, hồ sơ kết thúc bằng từ chối khấu trừ, không hỏi lại. |
| 7 | Nhật ký · Hoàn tác · Dừng tự động hóa | Mỗi hành động được ghi vào nhật ký chỉ ghi thêm, có chữ ký chống sửa: ai làm, lúc nào, dữ liệu đầu vào và lý do. Hoàn tác là một sự kiện mới. Công tắc này dừng toàn bộ tự động hóa; khi đó ca thường quy chờ duyệt tay. |
| 8 | Giới hạn hiện tại | Giới hạn: dữ liệu kiểm thử là dữ liệu tổng hợp, chưa phải đánh giá độc lập. Khoản ngoài phạm vi được nhận diện bằng từ khóa, nên chi cá nhân đặt tên khác vẫn có thể lọt. Đọc ảnh bằng AI mất mười lăm đến hai mươi lăm giây và luôn cần người kiểm tra. Đội đang thử nghiệm với ba người dùng do Ban tổ chức điều phối. |
