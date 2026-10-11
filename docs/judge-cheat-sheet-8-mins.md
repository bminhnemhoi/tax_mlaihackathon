# Tax Referee · Hướng dẫn giám khảo 8 phút

Live: https://limegreen-salamander-517622.hostingersite.com. Không cần tài khoản để dùng Verify và demo riêng.

| Thời gian | Thao tác | Điều cần quan sát |
|---|---|---|
| 0–90 giây | Trang đầu → **Chạy Verify** → chọn **5 ca Đề A** → **Chạy Verify** | 5/5; 3 thường quy đã hoàn tất, 2 ngoại lệ chờ KTT/CFO; các chỉ số có mẫu số và timestamp |
| 90–150 giây | Đọc **SOP và các quy tắc đang kiểm thử**, **Tải báo cáo JSON** | Mã lượt chạy, policy/fixture hash; lời văn SOP không tự sửa quy tắc |
| 150–240 giây | Form **Nhập Hóa Đơn Thử Nghiệm** hoặc trang đầu → **Thử dữ liệu mới** → **Tiếp Nhận Chứng Từ** | Nhập trường chưa biết hoặc tải XML/PDF/ảnh; dữ liệu nghi vấn chuyển tiếp, chưa duyệt thuế |
| 240–330 giây | **Bàn Thẩm Định** → chọn hồ sơ → **Can thiệp và bổ sung hồ sơ** | Sửa từng trường, chọn đã đối chiếu và ghi bằng chứng riêng; trường chưa xác nhận vẫn cần xử lý; đánh giá lại toàn bộ findings |
| 330–420 giây | Nhập lý do → **Dừng xử lý** → **Hoàn tác**; mở **Xem lịch sử trước/sau và dữ liệu nguồn** | Ai, lúc nào, lý do, input, policy snapshot, hiệu ứng lên voucher/thuế; phiên bản cũ bị chặn |
| 420–480 giây | Xem hậu kiểm tiền lệ hoặc đổi vai trò trong demo | KTT không duyệt ca CFO; tiền lệ có scope/trần; ≥10 hồ sơ hậu kiểm mới hiệu chỉnh; có rollback |

Các bộ 4/5/15 là hồi quy tổng hợp và có ca trùng. Không coi tỷ lệ đúng của fixture là độ chính xác trên dữ liệu độc lập. API live và upload ba định dạng đã được kiểm tra; ảnh thử tổng hợp một lần mất khoảng 7,8 giây.

Dừng/hoàn tác chỉ cập nhật dữ liệu kế toán nội bộ; không đảo giao dịch ERP bên ngoài. Luồng ERP/ngân hàng/TCT hiện là demo/xuất payload. Chưa có nhãn độc lập và nghiên cứu ba người dùng thật để công bố tiết kiệm thời gian hoặc tự xác định điểm thi.
