# Lịch sử thay đổi

Định dạng phỏng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), phiên bản theo [SemVer](https://semver.org/). **v1.0.0** là commit `e496ab4` — bản đang chạy trên live, đã kiểm sau deploy ngày 16/10/2026. Các mốc trước đó ứng với Pull Request đã merge vào `main` của [repo gốc của đội](https://github.com/khanhle1406/Tax-Referee) (merge ở đó = deploy production). Lịch sử git không bị squash hay viết lại — chi tiết từng thay đổi xem `git log`.

## [Chưa phát hành]

_Chưa có thay đổi._

## [1.1.0] — 2026-10-17 — Sửa lỗi bảo mật đọc XML và nâng cấp repo

> Chưa deploy lên live: bản live chạy `v1.0.0` (commit `e496ab4`) từ repo gốc của đội.

### Bảo mật
- **Đọc XML không còn lệch do CDATA, chú thích, processing instruction, `>` trong thuộc tính hay tham chiếu ký tự:** chuẩn hóa trước mọi trích xuất. Trước đây hóa đơn chứa `2<![CDATA[2]]>880000` được đọc thành 2.880.000₫ trong khi phần mềm kế toán và cơ quan thuế đọc 22.880.000₫ — đủ để lọt ngưỡng tiền mặt và hạn mức Kế toán trưởng.
- **XML mơ hồ bị từ chối (fail-closed):** phần tử tổng tiền/số hóa đơn trùng tên ở phần đầu, khối bên bán/bên mua trùng, dòng hàng lồng nhau; tham chiếu tới ký tự cấm, `&` lẻ. Trước đây regex lấy phần tử trùng tên đầu tiên, nên một khối mở rộng đặt trước phần tổng thật làm hóa đơn 220 triệu thành 2,2 triệu và được tự duyệt.
- **XML và CSV sổ cái (beta):** escape mọi giá trị và loại ký tự cấm trong XML; CSV nhân đôi nháy kép, vô hiệu công thức — chặn chèn phần tử, cột hay dòng giả.
- **File tạm PDF:** thư mục riêng quyền 700, file 600, luôn được dọn; xóa hàm PDF→PNG không còn dùng.
- Bộ đệm trích xuất đổi phiên bản (`xml-canon-1`) để kết quả đọc theo cách cũ không bị dùng lại.
- Nguồn phát hiện: cảnh báo CodeQL cho lỗi đọc XML (CDATA, tham chiếu ký tự) và file tạm PDF; lỗi XML/CSV sổ cái và XML mơ hồ không có cảnh báo CodeQL riêng, được tìm ra khi phân loại và phản biện. Mỗi cảnh báo được phân loại và phản biện độc lập, bản sửa được phản biện lần hai (tìm ra và đã chặn một đường lệch mới qua processing instruction). Test hồi quy `tests/unit/xmlIntegrity.test.ts` (unit 103 → 110 kiểm tra), kiểm chứng ngược: 6/7 ca thất bại trên mã cũ.
- **Giới hạn còn lại:** trích theo tên thẻ, chưa theo đường dẫn schema — thẻ đồng nghĩa ưu tiên cao hơn (ví dụ `GrandTotal` so với `TotalAmount`) vẫn có thể được chọn (phép kiểm số học bắt trường hợp số không khớp); chuyển chuỗi thành số còn dễ dãi. Phép kiểm trùng tên có thể từ chối nhầm hóa đơn có bảng tổng hợp theo thuế suất dùng thẻ `TaxAmount`/`VATAmount`/`TotalAmount` ngoài dòng hàng (khi đó dùng PDF hoặc nhập tay) — cần thử với XML nhiều thuế suất thật trước khi đưa lên live.

### Tài liệu
- README viết lại: mục lục, kiến trúc (Mermaid), bảng bảo mật 4 trụ, cấu hình, API, giới hạn.
- Thêm `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, mẫu issue/PR, mục lục tài liệu [`docs/README.md`](docs/README.md).
- `.env.example` bổ sung các biến mới (ngân sách AI, chống hạ cấp chữ ký, khóa audit tự sinh); `package.json` có metadata giấy phép và repository.
- Ảnh giao diện thật chụp từ bản live (`docs/screenshots/`), mục thuật ngữ, `CITATION.cff`; đồng bộ các tài liệu còn ghi số liệu cũ (buổi thử người dùng, số quy tắc, trạng thái PR, yêu cầu Node).
- Bằng chứng live sau deploy PR #8: [`docs/evidence/live-2026-10-16-post-deploy.json`](docs/evidence/live-2026-10-16-post-deploy.json).

### Hạ tầng repo
- CI: quyền token tối thiểu (`contents: read`), action ghim theo SHA, `concurrency`, `timeout-minutes`, thêm Node 24 trên Ubuntu.
- CodeQL quét JavaScript/TypeScript, Python và workflow; Dependabot cập nhật hằng tuần (bỏ qua `better-sqlite3` đang ghim cho Hostinger và mọi bản nâng major).
- `CODEOWNERS`, `.gitattributes` (LF), `.nvmrc` (Node 22); `.gitignore` chặn gói nộp bài `.zip` và bộ cài Python cục bộ.

## [1.0.0] — 2026-10-16 — Bảo mật hệ có agent AI cho Demo Day (PR [#6](https://github.com/khanhle1406/Tax-Referee/pull/6), [#7](https://github.com/khanhle1406/Tax-Referee/pull/7), [#8](https://github.com/khanhle1406/Tax-Referee/pull/8))

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

## 2026-10-15 — Cải tiến từ nghiên cứu (PR [#5](https://github.com/khanhle1406/Tax-Referee/pull/5))

### Thêm
- **Hậu kiểm ngẫu nhiên** ca máy tự duyệt: 10%, gấp 3 ở vùng sát ngưỡng, chọn mẫu bằng HMAC; tỉ lệ đồng thuận người–máy kèm khoảng Wilson 95%.
- **Nguyên tắc bốn mắt cho policy:** bản nháp nới lỏng kiểm soát cần CFO khác người soạn.
- **Điểm neo nhật ký** (`/api/audit/anchor`): phát hiện cắt đuôi hoặc viết lại so với điểm neo lưu ngoài hệ thống.
- Phát hiện **tách nhỏ hóa đơn** để né hạn mức.
- **Cụm tiền mặt cùng ngày** vượt ngưỡng: giữ thuế cả các hóa đơn tiền mặt cùng bên bán đã tự duyệt trước đó (sự kiện `LINKED_CASH_HOLD`).
- **Căn cứ pháp lý theo ngày lập:** danh mục loại trừ 8% theo NQ 204/2025; khung hóa đơn TT 78/2021 → TT 32/2025 → NĐ 254/2026 + TT 91/2026 (số hiệu và hiệu lực theo nguồn thứ cấp).
- Trùng hóa đơn khác cách ghi số ("123" = "0000123"); **kiểm thử thuộc tính** bằng fast-check.
- Tổng hợp 63 nguồn nghiên cứu: [docs/research/nghien-cuu-lien-quan.md](docs/research/nghien-cuu-lien-quan.md).

## 2026-10-15 — Track A hardening và hồ sơ nộp bài (PR [#1](https://github.com/khanhle1406/Tax-Referee/pull/1) → [#4](https://github.com/khanhle1406/Tax-Referee/pull/4))

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

[Chưa phát hành]: https://github.com/bminhnemhoi/tax_mlaihackathon/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/bminhnemhoi/tax_mlaihackathon/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/bminhnemhoi/tax_mlaihackathon/releases/tag/v1.0.0
