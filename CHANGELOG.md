# Lịch sử thay đổi

Định dạng phỏng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dự án chưa gắn tag phiên bản; mỗi mốc ứng với các Pull Request đã merge vào `main` (merge vào `main` = deploy production). Lịch sử git không bị squash hay viết lại — chi tiết từng thay đổi xem `git log`.

## [Chưa phát hành]

### Thêm
- Nối chatbot Zalo (Goblin) vào Tax Referee: web tự làm mới khi có hóa đơn mới từ bot (hỏi `/api/inbox` mỗi 4 giây khi tab hiện), công tắc `TAX_REFEREE_ALLOW_WORKSPACE_RESET` cho nút "Xóa hết hóa đơn" ở workspace nội bộ (mặc định tắt, có test), bộ nối `integrations/goblin-relay/` (bộ nhận, cầu nối đọc ảnh, script chạy/kiểm tra). Xem [docs/integrations/zalo-goblin-relay.md](docs/integrations/zalo-goblin-relay.md).

### Tài liệu
- README viết lại: mục lục, kiến trúc (Mermaid), bảng bảo mật 4 trụ, cấu hình, API, giới hạn.
- Thêm `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, mẫu issue/PR, mục lục tài liệu [`docs/README.md`](docs/README.md).
- `.env.example` bổ sung các biến mới (ngân sách AI, chống hạ cấp chữ ký, khóa audit tự sinh); `package.json` có metadata giấy phép và repository.

## 2026-10-16 — Bảo mật hệ có agent AI cho Demo Day (PR #6, #7, #8)

### Bảo mật
- **Ranh giới đầu ra Vision:** chỉ nhận 14 trường nhìn thấy trên chứng từ (`VISION_ALLOWED_KEYS`); trường lạ bị loại và ghi lại; bỏ tên file khỏi prompt; dấu vết `agent:vision@model#hash-prompt`.
- **Chuyển trạng thái ngược không nới lỏng kiểm soát:** hoàn tác không gỡ lệnh giữ do người khác đặt; lệnh giữ thuế của CFO chỉ CFO gỡ; duyệt chỉ hợp lệ khi hồ sơ đang chờ duyệt.
- **Thẩm quyền không hạ theo số tiền:** ca từng cần CFO vẫn chờ CFO khi người khác sửa số tiền; người nhập không tự xác nhận dữ liệu của chính mình.
- **Ngân sách gọi AI** (OWASP LLM10) cho đọc ảnh và tra cứu có grounding; vượt ngân sách thì fail-closed.
- **Rollback policy cũng bị kiểm nới lỏng:** quay về bản cũ mà nới lỏng kiểm soát thì người thực hiện phải là CFO; sửa danh mục nhà cung cấp được ghi nhật ký.
- **Nhật ký:** chống hạ cấp chữ ký (`TAX_REFEREE_AUDIT_SIGNED_SINCE`); production tự sinh khóa HMAC (`.audit-key`) khi chưa cấu hình.
- Tiến trình đọc PDF chỉ nhận biến môi trường trong danh sách cho phép.

### Thêm
- Trang **`/trust`**: ma trận quyền (8 principal, 20 quyền) và 12 phép thử tấn công chạy trên mã đang deploy, mỗi phép thử trên database `:memory:` riêng.
- `/api/health` có thêm `ai`, `warnings`, nguồn khóa audit; commit được ghi vào bản build.
- Tài liệu [mô hình mối đe dọa](docs/security/threat-model.md), [kiến trúc demo → production](docs/architecture/demo-to-production.md), [bàn giao Demo Day](docs/handoff/BAN-GIAO-DEMO-DAY-17-10.md); harness `.claude/` (agent chuyên gia, hook chặn lệnh nguy hiểm, skill kiểm chứng).

### Sửa
- Cụm tiền mặt cùng ngày không còn phụ thuộc thứ tự nhập hóa đơn.
- Giảm báo nhầm danh mục loại trừ thuế suất 8% (viễn thông, ô tô).
- Đóng ca bẫy U2 ("tiệc cưới người thân giám đốc") sau buổi thử 16/10.
- Giới hạn tạo phiên demo mặc định 200/giờ/IP.

## 2026-10-15 — Cải tiến từ nghiên cứu (PR #5)

### Thêm
- **Hậu kiểm ngẫu nhiên** ca máy tự duyệt: 10%, gấp 3 ở vùng sát ngưỡng, chọn mẫu bằng HMAC; tỉ lệ đồng thuận người–máy kèm khoảng Wilson 95%.
- **Nguyên tắc bốn mắt cho policy:** bản nháp nới lỏng kiểm soát cần CFO khác người soạn.
- **Điểm neo nhật ký** (`/api/audit/anchor`): phát hiện cắt đuôi hoặc viết lại so với điểm neo lưu ngoài hệ thống.
- Phát hiện **tách nhỏ hóa đơn** để né hạn mức.
- **Cụm tiền mặt cùng ngày** vượt ngưỡng: giữ thuế cả các hóa đơn tiền mặt cùng bên bán đã tự duyệt trước đó (sự kiện `LINKED_CASH_HOLD`).
- **Căn cứ pháp lý theo ngày lập:** danh mục loại trừ 8% theo NQ 204/2025; khung hóa đơn TT 78/2021 → TT 32/2025 → NĐ 254/2026 + TT 91/2026 (số hiệu và hiệu lực theo nguồn thứ cấp).
- Trùng hóa đơn khác cách ghi số ("123" = "0000123"); **kiểm thử thuộc tính** bằng fast-check.
- Tổng hợp 63 nguồn nghiên cứu: [docs/research/nghien-cuu-lien-quan.md](docs/research/nghien-cuu-lien-quan.md).

## 2026-10-15 — Track A hardening và hồ sơ nộp bài (PR #1 → #4)

### Thêm
- Ba kiểu dừng nhất quán (chưa rõ thông tin / ngoài quy định / vượt thẩm quyền) từ một bảng phân loại duy nhất.
- Câu hỏi chuyển tiếp trả lời trong một câu ("1A, 2B") ngay trên hồ sơ; không chuyển tiếp thừa nhờ ngưỡng trọng yếu.
- Verify chế độ giám khảo: 9 ca một nút, dấu thời gian từng ca, câu hỏi hiển thị ngay.
- Nhật ký chỉ ghi thêm + HMAC; công tắc dừng tự động hóa toàn hệ thống.
- `npm test` chạy được trên Windows và Linux; CI GitHub Actions.
- `CONTRIBUTING.md`; danh mục nộp bài, bằng chứng Verify live, build log.

### Bảo mật
- Chặn leo thang thành CFO và chèn sự kiện nhật ký giả.
- Dữ liệu nghi vấn (đọc từ ảnh, lệch chứng từ gốc) không được coi là đã xác minh.

### Minh bạch
- Gỡ 3 persona giả định kèm trích dẫn không có thật do bản nháp AI tạo (commit `3ace396`); gắn đính chính cho bảng số liệu không có lần chạy tương ứng (commit `997ba93`). Không viết lại lịch sử.

## 2026-09-22 → 2026-10-13 — Giai đoạn đầu và Sprint 1

- Khởi tạo hệ thống: parser XML hóa đơn điện tử, policy engine, SQLite, sổ cái và adapter ERP (beta), trung tâm thông báo, luồng cập nhật văn bản pháp luật.
- Đọc ảnh/PDF scan bằng Gemini Vision; gỡ các engine AI cũ.
- Siết khâu đọc chứng từ (chặn `DOCTYPE`/`ENTITY` — XXE) và quy trình thẩm định; workspace cho kế toán.
- Verify chạy tất định, không gọi AI (13/10).
