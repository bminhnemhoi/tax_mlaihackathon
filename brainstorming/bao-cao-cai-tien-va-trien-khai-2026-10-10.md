# Báo cáo cải tiến Đề A và triển khai Hostinger — 10/10/2026

Thực hiện theo `ke-hoach-hoan-thien-cau-a-2026-10-10.md`. Báo cáo phân biệt phần mã đã làm, kiểm thử đã chạy và phần cần dữ liệu/người dùng thật.

## Kết quả UI và backend

| Hạng mục | Đã thực hiện | Phần còn lại |
|---|---|---|
| A01 SOP/quy tắc | Registry rule → SOP, policy seed có văn bản/rules; đồng bộ thẩm quyền và tiền lệ trong SOP; nói rõ sửa văn bản không đổi logic; gate publish/rollback đối chiếu kỳ vọng cố định | Nhân sự nghiệp vụ xác nhận phạm vi và căn cứ |
| A02 Live/OCR | HTTPS Hostinger; sửa native install, đóng gói standalone, Passenger một instance; runtime/secret ngoài release; PDF tools user-level; Compose worker riêng có warm-up/health và routing local OCR thực sự được nối vào coordinator | Worker Docker chưa chạy trên môi trường Docker thực; ảnh live đang dùng Vision |
| A03 Xác minh dữ liệu | Form theo field, nhãn/lựa chọn nghiệp vụ; checkbox + evidence riêng; lỗi inline/tóm tắt; đồng bộ ngày qua cả input/change event; JSON nâng cao; API lưu giá trị/người/thời gian/artifact; đổi giá trị mất xác nhận cũ | Retest dễ dùng với người nghiệp vụ |
| A04 Câu hỏi | Số hóa đơn/người xử lý/checklist nhiều findings; guard QGen về options/số tiền/người nhận/quyền; giữ explanation và quyết định local; fallback khi AI không đạt | Chấm mù câu hỏi trên holdout thật |
| A05 Verify | Run ID, policy hash, ERROR, export JSON; SOP công khai; nhóm/trạng thái tiếng Việt; input form mới và JSON nâng cao; mode không hợp lệ bị chặn | Không dùng fixture thay cho independent evaluation |
| A06 Audit | Timeline dễ đọc: actor, thời gian, lý do, input, bằng chứng, before/after, policy snapshot; dữ liệu chưa rõ không gắn CFO; undo có target và quyền từ server | Thử tìm thông tin với người mới |
| A07 Hậu kiểm | Scope theo NCC/mục đích/thời hạn/trần; hiển thị trạng thái/ngưỡng/cỡ mẫu; test chính candidate trong savepoint rồi rollback; retry không tăng mẫu; chặn đổi nhãn cùng evaluation | Nhãn hậu kiểm thật và holdout riêng |
| A08 Độc lập | Runner yêu cầu LOCKED/lockedAt/provenance; chống ca trùng và trùng fixture/tập học; mã băm file/policy/code, FN/FP có mẫu số, ERROR và routing riêng; xuất câu hỏi cho người chấm | Nhân sự điền và khóa ít nhất 20 ca; chấm rubric bằng người |
| A09 Ba người dùng | Protocol và bảng measurements có sẵn, giữ trạng thái chưa có số liệu | Cần ba người thực sự làm kế toán/tài chính và xác nhận tự viết |
| A10 Cải tiến từ phản hồi | Chưa tạo claim phản hồi giả | Phụ thuộc A09; nối feedback → thay đổi → đo lại |
| A11 Vận hành | Lease 120s mặc định (giới hạn 60–300s), recovery ON_HOLD và revision fence; quota demo/nội bộ; script preview và cleanup offline | Diễn tập vận hành cùng chủ host theo lịch lưu trữ |
| A12 Tài liệu | README, runbook chung/Hostinger, cheat sheet 8 phút, nội dung 5 slide, kịch bản video cập nhật theo bản live | Video thật ≤180s và số liệu người dùng chưa có |
| A13 Nghiệm thu | Typecheck/build/acceptance, standalone restart/restore/recovery; API và giao diện HTTPS; XML/PDF/ảnh tổng hợp; backup SQLite đọc lại | Các giới hạn cụ thể ở phần dưới |

## Kiểm thử và bằng chứng

- Acceptance: 4/4 ca chung, 5/5 Đề A, 15/15 hồi quy; 20 workflow, 2 AI fallback, 4 review, 39 QA mock và 16 kiểm tra cải tiến. Các bộ fixture có ca trùng; không cộng thành dữ liệu độc lập.
- Kiểm tra cải tiến bao gồm xác minh một phần, evidence ngắn, sửa giá trị, field nghiệp vụ UNKNOWN, kết quả trả về sau lease, retry sau recovery, policy sai ngữ nghĩa, QGen bịa nội dung, SLA không quay vòng, feedback retry và worker offline không gọi provider khi fallback tắt.
- Standalone: restart giữ phiên/revision/voucher/audit/artifact; recovery lượt EVALUATING quá hạn về ON_HOLD rồi chạy lại; offline snapshot/restore giữ chứng từ.
- Giao diện HTTPS đã thử nhập mới, lỗi inline khi chưa có ngày, xác nhận riêng ngày lập → revision 2 vẫn chờ bốn trường nghiệp vụ; timeline thể hiện người nhập, ngày thay đổi và các lần đánh giá; xác nhận đủ bốn trường còn lại → revision 3 tự hoàn tất và tạo voucher.
- API live: cách ly hai demo, thường quy tạo voucher, pause/stale409/undo, source text, Verify 4/5/15, input thiếu dữ liệu; runtime/notifications/duplicate API được kiểm tra để đảm bảo toàn Workspace hoạt động.
- Live đăng nhập cả ba vai trò nội bộ thành công. Mật khẩu ứng dụng tạo riêng và lưu trên host, không có trong Git/báo cáo.
- Upload tổng hợp trên HTTPS: XML 200 ~416ms; PDF có lớp chữ 200 ~326ms, còn taxAmount cần xác minh; PNG 200 ~7.821ms. Đây là một lần kiểm tra vận hành, không phải tốc độ p95 hay accuracy benchmark.
- SQLite backup: bản nội bộ 0 hóa đơn và demo 1 hóa đơn đọc lại được, integrity `ok`, count trùng nguồn. Không coi phép kiểm này là phục hồi toàn bộ host sau thảm họa.
- `docs/evidence/deployment-live-2026-10-10.json` lưu timestamp/run ID/hash/kết quả live; `docs/evidence/verify-live-2026-10-10.jpg` là ảnh giao diện. `docs/evidence/verify-export-live-2026-10-10.json` là báo cáo tải qua nút trên giao diện (PASS 5/5). Runner independent vẫn từ chối file `AWAITING_HUMAN_LABELS` hiện có.

## Triển khai và nguyên nhân lỗi ban đầu

Domain live: https://limegreen-salamander-517622.hostingersite.com. Host SSH là shared hosting Node.js/Passenger, không phải VPS có Docker/root.

Pipeline cũ lỗi ở better-sqlite3 13.0.3 vì phải compile native. Ghim 12.11.1 có binary Node 22 Linux giúp `npm ci` thành công. Next.js được ghim 15.5.27 để nhận bản vá cache của nhánh 15. Build tại host tiếp tục gặp giới hạn tiến trình `EAGAIN`; chuyển bundle production đã kiểm tra từ local, cài dependency Linux riêng. Không dùng native module macOS trên Linux.

Giao diện không dựng hóa đơn gốc giả cho hồ sơ nhập tay; nhãn hoàn tác hiển thị đúng trạng thái ON_HOLD khi bỏ kết quả đang đánh giá. Đã sửa packer để bảo vệ secret/data mà không loại nhầm thư mục API `/runtime`; thêm kiểm tra tất cả compiled route trong manifest phải có trong archive. Giữ release trước để rollback; đổi symlink current khi release mới đã đầy đủ. Dữ liệu và secret nằm ngoài release. Website khác cùng tài khoản Hostinger không bị thay đổi.

Runbook cụ thể: `deployment/HOSTINGER.md`. Sau khi đồng bộ mã lên repository, có thể cấu hình lại hPanel; pipeline từ Git cũ vẫn chứa lỗi native dependency nên không tự redeploy phiên bản đó.

## Việc cần dữ liệu/người dùng thật

1. Khóa ít nhất 20 ca độc lập, không lấy fixture Verify; cung cấp nguồn, người gán nhãn, thời gian/lý do, lockedAt và hash tập học nếu có.
2. Ba nhân sự làm kế toán/tài chính chạy tác vụ thật; ghi measurements/raw feedback và xác nhận của chính họ, kể cả một bất cập hoặc tác động tiêu cực.
3. Dùng feedback thực để chọn cải tiến tiếp theo, đo lại cùng kịch bản và xác nhận retest.
4. Chấm mù chất lượng câu hỏi, điền slide bằng kết quả đã đo, quay video ≤3 phút và nghiệm thu gói nộp.
5. Ảnh mới dưới 2 giây chưa đạt. Worker/container mới chỉ đóng gói và kiểm tra routing mock; cần benchmark trên hạ tầng Docker phù hợp nếu chọn profile này.

Không có bằng chứng ERP/ngân hàng/TCT thật, tự cập nhật luật, nộp tờ khai hay tiết kiệm thời gian thực tế. Các phần đó tiếp tục được công bố đúng phạm vi.

## Theo dõi dependency

`npm audit fix` đã áp dụng cập nhật tương thích. Audit còn 9 cảnh báo (3 moderate, 6 high), chủ yếu chuỗi công cụ CSS/glob và PostCSS lồng trong Next. Cách sửa npm đề xuất yêu cầu Next 16/Tailwind 4; chưa ép nâng major trong đợt này. Cần xử lý dependency riêng và nghiệm thu lại CSS/build trước khi mở rộng vận hành production. Không công bố audit dependency là sạch.

## Cập nhật đăng nhập MVP theo yêu cầu

- Đăng nhập nội bộ cho chọn Kế toán viên, Kế toán trưởng hoặc CFO mà không cần email/mật khẩu. Các vai trò dùng chung workspace nội bộ và có thể đổi ngay trong workspace.
- API xác thực role hợp lệ, tạo session 8 giờ, ghi audit và xóa cookie demo để tránh đăng nhập nhầm database. API mật khẩu cũ vẫn tương thích; giá trị secret đã lưu trên host không phải điều kiện để trải nghiệm MVP.
- Quyền thao tác, hạn mức duyệt và kiểm tra người tạo không tự duyệt giữ nguyên theo vai trò đang chọn. Việc chọn vai trò không xác minh danh tính, phù hợp phạm vi MVP cuộc thi.
- Kiểm thử regression bổ sung: đủ ba role, login khi đang có cookie demo vẫn tạo phiên nội bộ, chuyển role nội bộ, từ chối role sai và từ chối đổi role khi chưa có session.
- Triển khai release `codex-20261010-r6` trên Hostinger. Typecheck, build, regression ở chế độ development/production và 20 kiểm tra workflow đạt. API live xác minh đủ ba role, database nội bộ, đổi role, từ chối role sai; UI live đã chọn Kế toán viên và chuyển CFO thành công.
- Trình duyệt kiểm tra vẫn hiển thị frontend cũ ở URL gốc dù HTTP kiểm tra từ máy local đã trả bản mới. Đường dẫn `https://limegreen-salamander-517622.hostingersite.com/?release=mvp-role-r6` đã xác nhận giao diện mới; dùng đường dẫn này để tránh bản cache cũ khi trình diễn.
