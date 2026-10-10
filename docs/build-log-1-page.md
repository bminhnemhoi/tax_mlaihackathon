# Build log — Tax Referee / Đề A

**Ngày:** 09–10/10/2026. **Phạm vi:** Next.js + SQLite, luồng tiếp nhận → thẩm định → audit → Verify. Chưa có URL triển khai công khai được xác nhận.

**Thay đổi:** service nghiệp vụ dùng chung; transaction cho evaluation, trạng thái, voucher, macro và audit; guard revision/evaluation; thuế được duyệt bằng 0 khi còn nghi vấn; lưu cảnh báo nguồn và revision; dừng kết quả đang chạy; hoàn tác bằng sự kiện bù; giữ thuế backend; tiền lệ có mục đích/hạn mức/thời hạn và hiệu chỉnh từ ≥10 phản hồi hậu kiểm. Verify chạy database mới, dữ liệu/policy cố định.

**AI hỗ trợ:** đọc mã, xây dựng service/API/UI, tạo fixture tổng hợp và kiểm thử, soạn tài liệu triển khai. LLM chỉ diễn giải câu hỏi; quy tắc tất định quyết định luồng. Không dùng AI tạo xác nhận của người tham gia.

**Kiểm tra đã chạy:** TypeScript; production build; standalone restart và offline snapshot/restore tại máy; 4/4 ca chung, 5/5 Đề A, 15/15 hồi quy; 20 kiểm tra an toàn gồm gửi lặp, stale revision, nhiều vi phạm, bổ sung bằng chứng, dừng giữa xử lý, hoàn tác macro/voucher và giới hạn/rollback ngưỡng. Các bộ dữ liệu có ca trùng; đây là hồi quy tổng hợp, không chứng minh độ chính xác thực tế hay thời gian tiết kiệm.

**Điểm cắt giảm:** ERP trực tiếp, đa doanh nghiệp, tự cập nhật luật. Adapter mở rộng phải được công bố mức giả lập/xuất payload. Không coi schema hợp lệ là PASS nghiệp vụ.

**Còn cần bằng chứng:** Docker/Linux + HTTPS/restart/restore trên VPS thực; OCR API trên chứng từ độc lập; ≥20 ca do nghiệp vụ gán nhãn; ba người dùng thật, đo trước/sau, xác nhận tự viết và cải tiến gắn feedback; ghi video ≤3 phút. Bộ slide 5 trang phải bổ sung số liệu đo thực trước khi khóa bài.

**Lịch khóa:** 15/10; diễn tập 16–17/10. Giữ lịch sử Git hiện có; tạo commit theo giai đoạn sau khi rà soát diff, không gộp các thay đổi có sẵn thành một claim hoàn thành.
