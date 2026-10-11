# Tax Referee — nội dung đúng 5 slide

## 1. Quy trình thẩm định hóa đơn

Tiếp nhận nhiều loại chứng từ, kiểm tra điều kiện và chuyển ngoại lệ đến đúng người. Mục tiêu: ca thường quy hoàn thành tự động; ca thiếu bằng chứng dừng để xác minh. Chưa công bố tỷ lệ thường quy hoặc thời gian tiết kiệm từ thực tế.

## 2. Tự xử lý và chuyển tiếp

Đầu vào XML/PDF/ảnh/văn bản → parser + cảnh báo nguồn → quy tắc → thường quy tạo chứng từ nội bộ; ngoài quy chế / vượt thẩm quyền / thông tin chưa chắc chắn đặt câu hỏi cụ thể cho KTT/CFO. Giải quyết một phát hiện không xóa các phát hiện khác; bổ sung bằng chứng tạo revision và đánh giá lại.

## 3. Kết quả kiểm thử và phương pháp đo

Đã chạy: 4/4 chung, 5/5 Đề A (3 thường quy + 2 chuyển tiếp), 15/15 hồi quy; 20 kiểm tra an toàn và 16 kiểm tra cải tiến; HTTPS/Verify/API/XML/PDF/ảnh tổng hợp live đã xác nhận. Đây là fixture tổng hợp, có ca trùng giữa các tập. Kết quả thực tế CHƯA CÓ: ≥20 ca độc lập gán nhãn trước; ba nhân sự trực tiếp làm kế toán/tài chính, đo trước/sau và xác nhận tự viết. Không sử dụng số liệu 42 ca, 92,3% STP hoặc trích dẫn cũ chưa có nguồn.

## 4. Kiến trúc và can thiệp

Next.js + SQLite; service nghiệp vụ dùng chung; transaction và revision/evaluation guard; audit trước/sau; dừng, giữ thuế, hoàn tác voucher/macro/tiền lệ. Tiền lệ giới hạn theo rule/nhà cung cấp/mục đích/thời hạn/trần CFO; ≥10 phản hồi hậu kiểm mới hiệu chỉnh, có rollback. Demo và Verify tách database. ERP/ngân hàng/TCT chưa chứng minh kết nối thật.

## 5. Giới hạn và chốt bài

OCR lỗi/key timeout cần template và trạng thái chưa xác minh. Live: https://limegreen-salamander-517622.hostingersite.com. Hostinger shared chạy Passenger, bundle local và dependency Linux; worker Docker chưa nghiệm thu. Standalone local restart/restore và khôi phục evaluation hết hạn đạt; backup SQLite live đọc lại integrity ok. Cần hoàn thành nghiên cứu người dùng, bổ sung số liệu slide, ghi video ≤3 phút và cải tiến gắn feedback trước 15/10. Không cam kết độ chính xác hoặc tiết kiệm thời gian khi thiếu bằng chứng.
