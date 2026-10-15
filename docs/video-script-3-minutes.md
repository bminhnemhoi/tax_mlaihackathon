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

## Bản đã quay ngày 15/10/2026 (bản 2)

Quay tự động bằng Playwright trên Live URL (thao tác thật, không dựng cảnh); màn mở đầu tóm tắt 6 tính năng nổi bật; giọng đọc AI giọng nam edge-tts (vi-VN-NamMinhNeural); phụ đề in sẵn; 1920×1080; dài 2:41.
Lời thuyết minh do 3 người viết theo 3 góc (kể chuyện, tiêu chí chấm, giá trị kinh doanh), một người tổng hợp và một người đối chiếu từng câu với mã nguồn. Trong video có dòng ghi chú "Quay trực tiếp trên Live URL · giọng đọc AI".

| # | Phần | Lời đọc |
|---|---|---|
| 1 | Tax Referee · trọng tài hóa đơn đầu vào | Chào anh chị. Hóa đơn đầu vào thiếu một điều kiện là mất khấu trừ. Mà tờ nào cũng hỏi sếp thì không ai làm nổi. Tax Referee tự xử lý ca thường quy, dừng đúng lúc, hỏi đúng người. |
| 2 | Trang chủ live · không cần tài khoản | Đây là bản chạy thật, không cần tài khoản. Trang chủ có hướng dẫn cho giám khảo và hai nút: chạy kiểm chứng, và mở hộp chuyển tiếp. |
| 3 | Điểm 1 · Verify một nút: 9/9 ca đạt | Bấm chạy. Chín ca, bốn ca chung và năm ca Đề A, đạt cả chín, mỗi ca vài chục mili giây. Điểm thứ nhất: kiểm chứng một nút, không gọi trí tuệ nhân tạo. Ca dừng có nhóm, người nhận, câu hỏi ngay bên dưới. |
| 4 | Điểm 2 · Hỏi thay vì đoán, không sửa số | Giờ thử dữ liệu mới. Hóa đơn in tổng bốn trăm tám mươi nghìn, nhưng tiền hàng cộng thuế ra bốn trăm chín mươi lăm. Điểm thứ hai: không đoán. Hệ thống không tự sửa số, mà hỏi kế toán trưởng số nào đúng, kèm hệ quả. |
| 5 | Điểm 3 · Đúng 3 kiểu dừng, không hỏi thừa | Sang nút hai, mỗi phiên một bộ dữ liệu riêng, sẵn bốn ca mẫu. Điểm thứ ba: dừng đúng ba kiểu. Phí chuyển phát tự xử lý. Ba ca kia: chưa rõ thông tin, ngoài quy định, vượt thẩm quyền. |
| 6 | Điểm 4 · Một câu hỏi, đúng người: 1A, 2A | Mở ca mười laptop, ba trăm ba mươi triệu, đổi vai CFO. Điểm thứ tư: một câu hỏi, đúng người. Ca này vượt hạn mức hai trăm triệu của kế toán trưởng, lại chưa rõ trạng thái mã số thuế bên bán. Thuế chờ quyết định: ba mươi triệu. Trả lời một lần: một A, hai A. Đã được phê duyệt. Người nhập không tự duyệt, kế toán trưởng không quyết thay CFO. |
| 7 | Trả lời có hệ quả: 1B → từ chối khấu trừ | Còn trả lời bất lợi thì sao? Kế toán trưởng mở ca bộ lưu điện, chọn một B: trả tiền mặt. Từ năm triệu mà trả tiền mặt thì mất khấu trừ, hồ sơ bị từ chối, không hỏi lại. |
| 8 | Điểm 5 · Hoàn tác, nhật ký, công tắc dừng | Điểm thứ năm: con người cầm lái. CFO bấm hoàn tác kèm lý do, ghi thành sự kiện mới. Nhật ký chỉ ghi thêm: ai làm, lúc nào, dữ liệu trước và sau, quy chế, lý do. Các dòng nối chuỗi, sửa lén là lộ. Công tắc này dừng mọi tự động hóa, ca thường quy chờ duyệt tay. |
| 9 | Giới hạn hiện tại (nói thật) | Nói thật về giới hạn. Dữ liệu kiểm thử là tổng hợp, chưa phải đánh giá độc lập. Khoản ngoài phạm vi dò bằng từ khóa, chi cá nhân đặt tên khác có thể lọt. Đọc ảnh mất khoảng mười lăm giây, PDF hai mươi lăm giây, luôn cần người kiểm tra. Ba người dùng thực tế sẽ thử vào ngày mười sáu. |
| 10 | Tự thử trên live · không cần tài khoản | Máy làm việc lặp lại, con người giữ quyết định khó, bước nào cũng có dấu vết. Mời anh chị tự thử: một nút kiểm chứng, demo riêng, không cần tài khoản. |
