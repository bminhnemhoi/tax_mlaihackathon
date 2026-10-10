# Trạng thái triển khai 09–10/10/2026

## Đã thực hiện trong mã

- Service điều phối; transaction cho trạng /thái/evaluation/voucher/macro/audit; gửi lặp; guard evaluation/revision và khóa đánh giá cùng hồ sơ.
- Guard duyệt/ghi đè; xác nhận từng phát hiện; dữ liệu/luật định không được giải tỏa bằng thẩm quyền hoặc tiền lệ; thuế chưa được duyệt bằng 0.
- Parser dùng chung; cảnh báo nguồn lưu ở backend; dữ liệu đọc/suy ra/xác nhận tách riêng; revision mới khi sửa và toàn bộ quy tắc chạy lại.
- PAUSED lưu backend; kết quả về sau khi dừng bị bỏ; giữ thuế backend; hoàn tác sự kiện bù, voucher/macro và thu hồi tiền lệ từ thao tác bị đảo.
- Tiền lệ có scope, trần/thời hạn; phản hồi hậu kiểm riêng; ngưỡng sau ≥10 ca, giảm FP với FN=0 trên phản hồi, ưu tiên ngưỡng thấp, safety gate và rollback. Không coi đây là độ chính xác độc lập.
- UI trang đầu, tiếp nhận trường chưa xác minh, chi tiết can thiệp/bổ sung, quyền server, chứng từ routine, Verify PASS nghiệp vụ 4/5/15 và nhập JSON mới.
- Demo theo phiên/database riêng, role switch chỉ demo; Verify database sạch/policy/fixture hash cố định.
- Docker/Compose/Nginx/health/backup/restore; Pillow thay sips. Có runbook, build log, bộ slide đúng 5 trang, kịch bản video, mẫu thu bằng chứng và runner đánh giá độc lập.

## Kiểm tra có bằng chứng tại máy

- `npm run typecheck` và production build.
- `npm run test:acceptance`: 4/4, 5/5, 15/15 hồi quy và 20/20 kiểm tra an toàn.
- Thiếu key và timeout AI giả lập: giữ template/phương án local; thiếu key không gọi mạng.
- API smoke: hai phiên demo độc lập, thường quy, dừng, stale 409, hoàn tác, nguồn văn bản, Verify và dữ liệu mới thiếu thông tin.
- Standalone: restart và offline snapshot/restore tại máy đã phục hồi session, revision, voucher, audit và chứng từ.
- UI Verify / trang đầu / tiếp nhận đã kiểm tra breakpoint 375, 768, 1366px; kiểm tra ca thiếu thông tin qua form. Chưa phải bộ tự động kiểm tra mọi modal/keyboard.

## Chưa thể nghiệm thu toàn bộ kế hoạch

1. VPS/domain chưa được cung cấp. Docker daemon tại máy chưa chạy, chưa xác nhận Linux image, HTTPS, URL công khai hoặc restore/restart trên VPS.
2. Chưa chạy OCR API thật trên tập chứng từ độc lập; cần key/mẫu hợp lệ và đánh giá kết quả.
3. Chưa có nhãn ≥20 ca độc lập và ba nhân sự thật. Mẫu CSV/JSON còn trống có chủ đích; runner từ chối tạo số liệu khi nhãn chưa khóa/không đủ ca.
4. Chưa có đo trước/sau, xác nhận tự viết hoặc cải tiến truy vết từ feedback thật. Slide ghi rõ thiếu bằng chứng, cần cập nhật trước nộp.
5. Video mới có kịch bản, chưa có bản ghi MP4. Build log Markdown một trang nội dung cần kiểm tra bản xuất khi nộp.
6. Chưa kiểm chứng clone sạch trên máy thứ hai; chưa tạo commit vì working tree có nhiều thay đổi sẵn trước tác vụ. Cần rà diff và commit trước khóa bài.

Không đánh dấu hoàn tất cuộc thi chỉ từ các kiểm tra local. Các tập hồi quy dùng dữ liệu tổng hợp và trùng một số ca giữa tập; không cộng mẫu hoặc suy diễn tiết kiệm thời gian.
