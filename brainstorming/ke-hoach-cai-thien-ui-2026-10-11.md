# Kế hoạch cải thiện giao diện Tax Referee

> Đã hủy áp dụng theo yêu cầu người dùng ngày 11/10/2026 và khôi phục giao diện trước redesign. Kế hoạch này được giữ làm lịch sử, không tiếp tục triển khai nếu chưa có yêu cầu mới. Xem [ghi chú khôi phục](khoi-phuc-giao-dien-2026-10-11.md).

Ngày chốt: 11/10/2026. Phạm vi: triển khai toàn bộ giao diện theo từng chặng, giữ hợp đồng API và quy tắc nghiệp vụ Đề A. Đây vẫn là MVP cuộc thi với đăng nhập bằng lựa chọn vai trò.

## Mục tiêu và định hướng đã chọn

Chuyển workspace nhiều thẻ, nhiều mô tả và nhiều nút cạnh tranh thành công cụ xử lý hóa đơn: người dùng biết hồ sơ nào cần xử lý, mở hồ sơ, đối chiếu nguồn, quyết định và xem dấu vết. Dùng nền trắng/slate, xanh đậm làm màu hành động; xanh lá/vàng/đỏ chỉ biểu thị trạng thái. Áp dụng ui-ux-pro-max và hướng dẫn redesign của Taste theo ngữ cảnh công cụ kế toán, không thêm trang quảng bá hoặc hiệu ứng trang trí.

Giảm chữ ở điều hướng, tiêu đề và mô tả; dùng disclosure cho thông tin kỹ thuật. Giữ nguyên câu hỏi hành động chính thức, phương án xử lý, lý do chặn duyệt, phát hiện và các yêu cầu bằng chứng. Không rút gọn câu hỏi nghiệp vụ bằng cách làm mất điều kiện.

## Chặng 1 — Nền tảng và điều hướng

- Tự lưu trữ font Inter, trọng lượng 400/500/600; tiền và số liệu dùng tabular numerals. H1 24px, H2 16–18px, nội dung 14px, metadata 12px.
- Khoảng cách 4/8/12/16/24/32px; control 36px desktop và tối thiểu 44px trên mobile; control radius 6px, panel 10px. Shadow chỉ dành cho overlay, tránh neon, gradient và chữ in hoa diện rộng.
- Sidebar 216px có chế độ thu gọn 64px; header 56px. Bốn mục chính: Hóa đơn, Tiếp nhận, Nhật ký, Chính sách.
- Menu Công cụ chứa Verify, báo cáo, ngân hàng, đối soát TCT, nhà cung cấp và xuất ERP payload. Reset chỉ hiện trong phiên demo.
- Menu người dùng chứa ba role và đăng xuất; role picker vẫn không yêu cầu mật khẩu theo yêu cầu MVP. Nhãn Nội bộ/Demo riêng luôn rõ ràng.
- Có skip link, focus ring, nhãn nút icon và reduced motion. Root `/` dùng dynamic response để tránh HTML login cũ bị cache khi thay bản triển khai.

Đầu ra: `globals.css`, UI primitives, `WorkspaceShell`, `HomePage`, design-system master.

## Chặng 2 — Danh sách và thẩm định

- Thay các thẻ thống kê lớn bằng các tab Tất cả/Cần xử lý/Chờ KTT/Chờ CFO/Hoàn tất và số lượng.
- Bảng gồm hóa đơn/ngày, nhà cung cấp/MST, tổng tiền, trạng thái, việc cần làm. Tìm kiếm luôn hiện; lọc rủi ro, hạn mức, trạng thái nằm trong disclosure. Bỏ hàng trống vô nghĩa, có empty state và CTA tiếp nhận.
- Chọn hóa đơn mở panel bên phải ở màn hình >=1280px. Tablet mở overlay; mobile mở panel toàn chiều rộng, có Escape, vòng focus và khôi phục focus về dòng hóa đơn khi đóng. Giữ nguyên tìm kiếm/bộ lọc.
- Header hồ sơ giữ số hóa đơn, nhà cung cấp, tiền, trạng thái, việc cần làm, câu hỏi canonical và lý do chặn duyệt. Phần dài được cuộn, không xóa nội dung.
- Bốn tab: Xử lý/Chứng từ/Căn cứ/Lịch sử. Dùng radio chọn một phương án, lý do, xác nhận từng phát hiện và một nút ghi nhận. Tiền lệ chỉ hiện nếu đủ quyền.
- Dừng/tiếp tục/bổ sung/giữ thuế/hoàn tác và phản hồi tiền lệ nằm trong mục bổ sung. Quyền đến từ `allowedActions` của server. Không suy diễn quyền từ role hoặc tự dựng trạng thái sau evaluate.
- Hồ sơ đã hoàn tất vẫn có xuất bản in/PDF, JSON và biểu mẫu; lịch sử có before/after đọc được, kỹ thuật JSON/hash thu gọn.
- Giữ bản nháp khi đổi tab; cảnh báo khi chuyển hồ sơ, đổi trang/role, logout hoặc refresh có thay đổi. HTTP 409 tải lại trạng thái, yêu cầu xác nhận lại phiên bản và không tự gửi lại thao tác.

Đầu ra: `InboxTable`, `InvoiceReview`, `WorkflowControls`, `SourceReviewForm`, `uiPresentation`, guard bản nháp.

## Chặng 3 — Tiếp nhận và đối chiếu

- Mặc định tải XML/PDF/ảnh; thêm Nhập tay; dán văn bản là tùy chọn phụ.
- Desktop: nguồn bên trái, dữ liệu bên phải. Tablet/mobile: chuyển Nguồn/Dữ liệu. Nhập tay dùng một cột và không dựng ảnh hóa đơn giả.
- Nhóm form thành thông tin hóa đơn, giá trị/thuế, thanh toán/bằng chứng. Trường thiếu, mâu thuẫn, suy ra giữ trạng thái chưa xác minh; không tự điền mặc định thành bằng chứng.
- Chỉ hiện hướng dẫn chi tiết, nguồn/confidence và JSON khi người dùng mở. Bỏ robot tự bật và các khối giải thích dài thường trực.
- Chứng từ trong hồ sơ phải tải file gốc qua API artifact. PDF/ảnh hiển thị nguyên bản; XML/text hiển thị raw text có escape. Tóm tắt dữ liệu không được gắn nhãn chứng từ gốc.
- Mỗi trường nghi vấn có checkbox và nguồn bằng chứng riêng; sửa giá trị sau xác nhận sẽ bỏ xác nhận cũ. Giữ validation summary và dẫn tới đúng trường lỗi.

Đầu ra: `InteractiveInputForm`, `DocumentViewer` dùng artifact thật, form xác minh theo trường.

## Chặng 4 — Nhật ký, chính sách, Verify và SOP

- Nhật ký có tìm kiếm và phân nhóm; giao diện đọc ưu tiên actor, hành động, thời gian, hồ sơ. Mở lịch sử hồ sơ để đọc chuỗi sự kiện và thay đổi trước/sau. JSON/hash mặc định đóng.
- Chính sách nằm trong workspace, gồm Quy chế/Tiền lệ/Phiên bản. Kế toán viên chỉ đọc. Quy tắc/Soạn thảo/Toàn văn là các chế độ phụ của Quy chế.
- Giữ gate tạo draft/kiểm tra/phê duyệt/rollback của backend. Không hiển thị draft chưa publish như phiên bản đang có hiệu lực. Giữ lý do thay đổi và nguồn tài liệu.
- Verify ưu tiên chọn bộ ca, chạy, kết quả từng ca và tải JSON. Chi tiết câu hỏi/options/effects mở theo ca, metrics/run hash mở theo yêu cầu. Ghi rõ đây là hồi quy tổng hợp nội bộ, chưa phải đánh giá độc lập.
- Form custom Verify và JSON sandbox đóng mặc định. SOP dùng cùng typography và màu, không thêm màn demo trùng lặp.
- Các màn công cụ phụ và payload ERP vẫn hoạt động, không tuyên bố đã có kết nối ERP trực tiếp.

## Chặng 5 — Kiểm thử và triển khai

1. Typecheck và build production phải pass.
2. Chạy acceptance hiện có: manifest, workflow, AI fallback, review regressions, QA regressions, cải tiến Đề A; API smoke trên server production tạm và standalone recovery.
3. Browser QA tại 375/768/1024/1440px: login, điều hướng, bảng/bộ lọc, panel, nguồn/dữ liệu, chính sách readonly, Verify. Không tràn toàn trang; bảng lớn có vùng cuộn riêng.
4. Keyboard: tab switch với arrow/Home/End, Escape, vòng focus overlay và focus return; cảnh báo bản nháp phải cho phép hủy điều hướng.
5. Kiểm tra form nhập tay, checkbox xác nhận từng trường, sửa giá trị hủy xác nhận, lý do tối thiểu, quyền duyệt, stale revision và audit.
6. Chụp ảnh desktop/mobile và lưu bằng chứng tại `docs/evidence/ui-2026-10-11/`; ghi kết quả, giới hạn và bản triển khai trong báo cáo MD.
7. Build local, đóng gói standalone không secrets hoặc native module macOS. Tạo release Hostinger mới dùng Linux dependencies hiện có; chuyển symlink current atomically, restart Passenger. Dữ liệu runtime/config ở ngoài release; giữ release trước để rollback.
8. Xác minh live `/` phục vụ UI mới không cần query chống cache; kiểm tra API, Verify 4/5/15 và session/role. Không can thiệp website khác trên tài khoản hosting.

## Tiêu chí hoàn thành

- Luồng Hóa đơn → Chứng từ → Xử lý → Lịch sử thực hiện được trên desktop/mobile.
- UI mặc định không có đoạn hướng dẫn dài, JSON hay nhiều CTA quyết định cạnh tranh.
- Canonical question, finding confirmations, `allowedActions`, revision fencing và audit không bị bỏ qua.
- Màn chính thống nhất typography, spacing, màu; font không cần CDN.
- Có build/test/browser evidence và deployment live kiểm chứng được.
- Tài liệu kế hoạch, design system và báo cáo nằm trong repository; mọi hạn chế kiểm thử được ghi rõ.

## Trạng thái thực hiện — 11/10/2026

| Chặng | Trạng thái |
| --- | --- |
| 1. Nền tảng và điều hướng | Hoàn tất |
| 2. Danh sách và thẩm định | Hoàn tất |
| 3. Tiếp nhận và đối chiếu | Hoàn tất triển khai; upload API và đọc nguồn gốc đã pass. Đường chọn file browser cần kiểm tra thủ công do quyền extension chặn tự động hóa. |
| 4. Nhật ký, chính sách, Verify và SOP | Hoàn tất |
| 5. Kiểm thử và triển khai | Build/typecheck/acceptance/API/recovery và responsive QA đạt; live Hostinger chạy `codex-20261011-r9`, giữ rollback và runtime. |

[Báo cáo thực hiện và giới hạn kiểm chứng](bao-cao-cai-thien-ui-va-trien-khai-2026-10-11.md) · [Bằng chứng](../docs/evidence/ui-2026-10-11/).
