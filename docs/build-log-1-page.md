# Build log — Tax Referee / Đề A

**Ngày:** 10/10/2026. **Live:** https://limegreen-salamander-517622.hostingersite.com. **Phạm vi:** Next.js/SQLite, UI xử lý ngoại lệ, policy/QGen, hậu kiểm, vận hành Hostinger.

**Thay đổi:** form sửa dữ liệu và xác nhận nguồn theo từng trường; audit dễ đọc với actor/reason/input/effect/policy snapshot; quyền undo từ server; SLA tuyệt đối không quay vòng. Backend lưu evidence theo giá trị, loại xác nhận khi sửa, lease/fence cho evaluation quá hạn. SOP/rule registry phản ánh logic đã triển khai; gate publish/rollback kiểm tra phân loại theo fixture thay vì chỉ schema. QGen không thay quyết định/explanation và bị chặn khi sai ngữ cảnh/options/số tiền/người nhận. Hiệu chỉnh ngưỡng kiểm tra candidate trong savepoint; retry feedback không tăng mẫu. Verify thêm run ID/hash/export/SOP; runner độc lập chống trùng và ghi ERROR riêng. Quota chứng từ và script preview/dọn demo offline.

**AI hỗ trợ:** đọc mã, sửa service/API/UI, tạo fixture tổng hợp, kiểm thử và tài liệu. Không tạo nhãn nghiệp vụ, lời chứng người dùng hoặc số liệu tiết kiệm giả.

**Kiểm tra:** typecheck và production build đạt; Verify 4/4, 5/5, 15/15; 20 workflow, 2 AI fallback, 4 review, 39 QA mock, 16 kiểm tra cải tiến. Standalone restart, phục hồi evaluation hết hạn/retry và offline snapshot/restore đạt. Các tập Verify có ca trùng, không phải holdout độc lập.

**Triển khai:** fix native install bằng ghim better-sqlite3 12.11.1; build host bị EAGAIN nên dùng bundle local + dependency Linux. Passenger một instance, env/SQLite/chứng từ ngoài release, Python user-level. HTTPS health, ba vai trò, demo isolation, pause/stale409/undo, Verify và XML/PDF/ảnh tổng hợp live đạt. SQLite backup đọc lại integrity ok. Ảnh tổng hợp một lần mất khoảng 7,8s; không claim OCR dưới 2s.

**Còn cần:** nhãn độc lập do nghiệp vụ khóa; chấm mù câu hỏi; ba người dùng, đo trước/sau, feedback và retest; hoàn thiện số liệu slide/video ≤3 phút. Worker Docker đã đóng gói nhưng chưa được nghiệm thu trên môi trường Docker thực. Adapter ERP/TCT/ngân hàng chỉ là phạm vi demo/xuất payload.
