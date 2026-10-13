# Tax Referee · Đề A: The Escalation Referee

Ứng dụng tiếp nhận chứng từ thuế, tự xử lý ca thường quy và chuyển ngoại lệ đến Kế toán trưởng/CFO. Quy tắc TypeScript quyết định phân luồng; AI đọc tài liệu và hỗ trợ diễn đạt câu hỏi. AI không có quyền tự thay đổi kết luận hoặc số thuế được duyệt.

**Bản hiện tại:** đã kiểm tra trên local; chưa triển khai bản cập nhật này lên Hostinger.
**Liên kết triển khai trước:** https://limegreen-salamander-517622.hostingersite.com · [Verify](https://limegreen-salamander-517622.hostingersite.com/verify).
**Cập nhật:** 13/10/2026. [Kế hoạch đối chiếu đề A](brainstorming/ke-hoach-hoan-thien-cau-a-2026-10-10.md), [báo cáo cải tiến trước](brainstorming/bao-cao-cai-tien-va-trien-khai-2026-10-10.md).

**Cải tiến lõi đề A 12/10/2026:** dữ kiện bắt buộc theo từng quy tắc; SOP sinh từ registry, ghi chú tự do lưu riêng; chuyển tiếp có `handoff` gồm dữ kiện/câu hỏi/A-B/người nhận/phát hiện/nguồn; gate policy theo biên tham số đề xuất và báo tác động trước khi ban hành. Verify có thêm 60 ca phát triển tổng hợp, JSON/CSV và kiểm tra cấu trúc câu hỏi. [Hướng dẫn đánh giá và thu nhãn](docs/referee-core-evaluation.md). Các con số hồi quy không thay thế đánh giá độc lập; tập nhãn nghiệp vụ hiện vẫn chưa có.

## Luồng đã triển khai

- Tiếp nhận XML, PDF có lớp chữ, PDF scan và ảnh. Lưu chứng từ gốc, kết quả trích xuất, các trường thiếu/suy luận/chưa chắc chắn.
- Từ laptop tạo QR chụp hóa đơn bằng điện thoại; khi chạy dev qua localhost, server tự lấy IPv4 theo tuyến mạng hiện tại. Production local dùng `APP_PUBLIC_URL` khi truy cập bằng localhost. Ảnh được lưu làm chứng từ nguồn rồi gửi trực tiếp cho Gemini Vision qua ShopAIKey để phân loại và trích xuất, không chạy OCR cục bộ. QR hết hạn sau 10 phút, có thể chụp tiếp ảnh trong cùng phiên, giới hạn 15 MB; điện thoại không cần đăng nhập. Chạy `npm run test:capture` để kiểm tra API và vòng đời phiên.
- Ca đủ dữ liệu và không có phát hiện: trạng thái `APPROVED`, chứng từ kế toán nội bộ, tổng thuế và audit trong cùng transaction.
- Ngoại lệ: ba nhóm chưa rõ thông tin / ngoài quy định / vượt thẩm quyền; giữ toàn bộ findings, câu hỏi cụ thể và người xử lý. Chưa duyệt thuế khi còn nghi vấn.
- KTT/CFO sửa dữ liệu, xác nhận từng trường bằng nguồn bằng chứng rồi đánh giá lại. Thay giá trị làm mất xác nhận cũ; server kiểm tra revision và thẩm quyền.
- Dừng, tiếp tục, tạm giữ thuế và hoàn tác có audit trước/sau. Lượt đánh giá hết hạn được giữ `ON_HOLD`, kết quả trả về muộn bị chặn.
- Tiền lệ CFO chỉ áp dụng đúng nhà cung cấp, mục đích, thời hạn và trần. Ít nhất 10 hồ sơ hậu kiểm mới hiệu chỉnh ngưỡng; kiểm tra chính candidate trong savepoint trước khi áp dụng. Retry cùng phản hồi không tăng mẫu; CFO có thể rollback.
- Audit hiển thị người, thời gian, lý do, đầu vào, bằng chứng và policy snapshot. Hash chain giúp phát hiện sửa chuỗi; không phải dịch vụ chứng thực bên ngoài.
- Verify chạy trong SQLite độc lập: 4 ca chung, 5 ca Đề A, 15 ca hồi quy. Có SOP công khai, form nhập mới, JSON nâng cao và báo cáo JSON với run ID/policy hash.

## Chạy local

Yêu cầu Node 22 hoặc 24, npm. PDF cần Python 3.11 cùng PyMuPDF/Pillow/pypdf.

```sh
npm ci
cp .env.example .env.local
python3 -m pip install PyMuPDF Pillow pypdf
npm run typecheck
npm run test:acceptance
npm run test:referee-core
npm run test:referee-labels
npm run typecheck:referee
npm run test:workspace-ui
npm run lint
npm run build
npm run test:capture
npm start
```

AI key chỉ đặt trong env phía server. MVP cuộc thi cho đăng nhập nội bộ bằng cách chọn Kế toán viên, Kế toán trưởng hoặc CFO, không cần mật khẩu; có thể đổi vai trò trong workspace. Dữ liệu nội bộ dùng chung, còn phiên demo có database riêng. Quyền thao tác và quy tắc duyệt vẫn áp dụng theo vai trò đang chọn. Đây là cơ chế trải nghiệm MVP, không xác minh danh tính người dùng. API email/mật khẩu cũ vẫn tương thích nếu đã cấu hình secret.

Để thử chụp điện thoại cùng mạng trong dev, chạy `npm run dev -- --hostname 0.0.0.0`. Với production local, đặt `APP_PUBLIC_URL=http://IP_LAN:3000` trong env (thay `IP_LAN` bằng địa chỉ hiện tại), rồi chạy `npm start -- --hostname 0.0.0.0`. Sau khi đổi mạng, khởi động lại và tạo QR mới. Không commit `.env.local`, database, chứng từ hoặc thư mục build.

## Giao diện và điều hướng

Workspace dùng nền sáng trung tính, Inter và điểm nhấn lime theo Taste Skill. Các màn chính có URL riêng: `/workspace/inbox`, `/workspace/receive`, `/workspace/approvals`, `/workspace/audit`; hồ sơ tại `/workspace/invoices/[id]` đọc trực tiếp qua API, không phụ thuộc danh sách 200 dòng. Bộ lọc/tab/page có query parameter, Back/Forward hoạt động; bản nháp và vị trí danh sách được giữ trong phiên điều hướng client.

Các công cụ gồm nhà cung cấp, ngân hàng, đối soát TCT, báo cáo, thông báo, quy chế và xuất ERP. Ảnh dùng viewer chung để thấy toàn bộ khi mới hiển thị, có zoom/fit/fullscreen; mobile có safe area và chụp tiếp trực tiếp. Toast ngắn không đẩy nội dung. Giữ `/verify`, `/sop` và `/capture/[id]`.

[Đặc tả redesign](brainstorming/ke-hoach-redesign-taste-tax-referee.md) · [Báo cáo kiểm tra và giới hạn](docs/taste-redesign-handoff.md) · [Danh mục component](docs/evidence/taste-redesign/component-inventory.md).

Ảnh hóa đơn và PDF scan được gửi trực tiếp cho Gemini Vision qua `SHOPAIKEY_API_KEY`; XML và PDF có lớp chữ dùng dữ liệu sẵn có. Danh tính nhà cung cấp được đối chiếu theo thứ tự: kho danh tính đã xác minh trong đúng phiên → tra MST chính xác từ dữ liệu thuế có cấu trúc → tìm ứng viên theo tên nếu có cấu hình → ShopAIKey Google Search grounding khi cần nối tên thương hiệu/tên cũ với pháp nhân. Ứng viên tìm theo tên không phải bằng chứng: MST và tên phải được đối chiếu dữ liệu thuế, hoặc cùng được citation nguồn chính thức `.gov.vn` hỗ trợ. Không dùng master nhập tay hay tên gần giống để tự gán MST.

Kho danh tính lưu tên pháp lý, alias có phạm vi địa chỉ, MST đầy đủ của chi nhánh, nguồn, thời điểm tra cứu và lịch sử tên. Cache thành công có hiệu lực 7 ngày; lỗi dịch vụ được giữ 15 giây, chưa tìm được/mơ hồ 60 giây. Các yêu cầu giống nhau cùng phiên chia sẻ một lời gọi đang chạy. Nếu nhiều pháp nhân hoặc MST ảnh mâu thuẫn với alias đã xác minh, hệ thống giữ thông tin ảnh để rà soát. Khi đọc lại cùng ảnh, chỉ kiểm tra danh tính nhà cung cấp, không gọi Vision lại. Tên/MST gốc và kết quả chuẩn hóa được lưu cùng lần trích xuất và hồ sơ. Sửa trường nhà cung cấp sẽ xóa dấu xác minh cũ; thông báo vẫn hiển thị bằng toaster.

`XINVOICE_CLIENT_ID` + `XINVOICE_API_KEY` bật adapter tra dữ liệu thuế có cấu trúc; nguồn dữ liệu phải khớp MST và còn mới. VietQR là phương án tra MST chuyển tiếp nếu nguồn trả metadata Cục Thuế và thời điểm cập nhật phù hợp. `DOANHNGHIEP_API_KEY` bật tìm ứng viên theo tên; danh bạ này chỉ dùng để tìm ứng viên trước bước đối chiếu thuế. Thiếu hai cấu hình này vẫn chạy kho cục bộ và ShopAIKey grounding. Google Search grounding có thể không trả citation, nên luồng lạnh không bảo đảm luôn tự điền. Chi tiết tại [Thiết kế đối chiếu nhà cung cấp](docs/supplier-identity-resolution.md).

## Kiểm chứng và triển khai

```sh
npm run test:acceptance
TEST_BASE_URL=https://limegreen-salamander-517622.hostingersite.com npm run test:api
npm run evaluate:independent -- docs/evidence/independent-labels.json
```

Trên macOS có Apple Vision, `npm run evaluate:supplier-samples` đo riêng tên/MST đọc trực tiếp từ 5 ảnh chụp có nhãn thủ công; lệnh này không gọi dịch vụ AI trực tuyến và không đo khả năng suy MST từ tên. Đây là kiểm tra nội bộ vì giấy phép của các ảnh mẫu chưa được xác minh.

Runner độc lập từ chối nhãn chưa khóa, ca trùng và fixture/tập học trùng. File nhãn hiện chưa được nhân sự nghiệp vụ điền; lệnh cuối phải báo lỗi, không sinh số liệu giả. Báo cáo có mẫu số FN/FP, ERROR riêng, độ đúng nhóm/người nhận, policy/code hash và câu hỏi để chấm mù thủ công.

[Runbook chung](docs/runbook-final.md) · [Runbook Hostinger](deployment/HOSTINGER.md) · [Quy trình thu bằng chứng người dùng](docs/evidence/user-study-protocol.md).

Runbook Hostinger mô tả quy trình standalone và dependency Linux riêng; runtime/SQLite/chứng từ nằm ngoài release. Chỉ triển khai khi có yêu cầu riêng. Các ghi chú giao diện ngày 11/10 là lịch sử trước redesign Taste: [tinh gọn](brainstorming/tinh-gon-giao-dien-2026-10-11.md), [khôi phục](brainstorming/khoi-phuc-giao-dien-2026-10-11.md).

## Phạm vi bằng chứng

Kiểm thử tổng hợp và API live đã được chạy. Ba bộ Verify có ca trùng; không cộng thành số ca độc lập. Kết quả đọc XML/PDF/ảnh live là kiểm tra vận hành với tài liệu tổng hợp, không phải benchmark độ chính xác.

Còn cần nhân sự thực tế: nhãn holdout, chấm chất lượng câu hỏi, ba người dùng nghiệp vụ, đo trước/sau và retest cải tiến từ feedback. Chưa có bằng chứng tích hợp thật ERP/ngân hàng/TCT, nộp tờ khai hoặc tự cập nhật luật. Chứng từ/voucher trong ứng dụng là nội bộ; xuất adapter không chứng minh đã hạch toán bên ngoài.
