# Tax Referee · Hướng dẫn giám khảo 8 phút

Live: https://limegreen-salamander-517622.hostingersite.com — không cần tài khoản. Phiên bản đang chạy: `/api/health` (commit).

| Thời gian | Thao tác | Điều cần quan sát |
|---|---|---|
| 0:00–1:00 | Trang chủ → đọc dòng hướng dẫn → **② Mở hộp chuyển tiếp — demo riêng** | Vào workspace với database riêng của phiên, vai Kế toán viên; đổi vai trò mô phỏng ở góc trên |
| 1:00–3:00 | **① Chạy Verify** (`/verify`) → **Chạy Verify** | PASS 9/9: 4 ca chung + 5 ca Đề A (3 tự xử lý, 2 chuyển tiếp); thời điểm từng ca; câu hỏi chuyển tiếp hiện ngay dưới ca |
| 3:00–5:00 | Verify → **Thử dữ liệu mới** (sửa JSON, bỏ trống trường chưa biết) hoặc workspace → **Tiếp nhận** (XML/PDF/ảnh) | Ca thường quy tự xử lý; ca nghi vấn chuyển tiếp với nhóm dừng + câu hỏi có số tiền, trả lời một lần; không lỗi khi dữ liệu lạ (VD thuế suất 7%) |
| 5:00–6:30 | Bài kiểm tra Đề A: nhập ca không rõ ràng theo `/sop` | Đúng nhóm (Chưa rõ thông tin / Ngoài quy định / Vượt thẩm quyền), đúng người nhận (KTT / CFO), câu hỏi quyết định được ngay |
| 6:30–7:30 | Workspace → **Nhật ký** → chọn hồ sơ → xem sự kiện → **Dừng** → **Hoàn tác** | Ai, lúc nào, dữ liệu đầu vào (snapshot + inputHash), policy/contract/commit, lý do; hoàn tác là sự kiện mới |

Ghi chú trung thực: dữ liệu Verify là tổng hợp, không phải đánh giá độc lập. Nhóm "Mở rộng · beta" (ngân hàng, đối soát TCT, ERP, báo cáo) là một phần giả lập, ngoài phạm vi Đề A. Thử nghiệm với 3 người dùng do BTC điều phối đang thực hiện.
