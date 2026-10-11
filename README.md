# Tax Referee · Đề A: The Escalation Referee

Ứng dụng tiếp nhận chứng từ thuế, tự xử lý ca thường quy và chuyển ngoại lệ đến Kế toán trưởng/CFO. Quy tắc TypeScript quyết định phân luồng; AI đọc tài liệu và hỗ trợ diễn đạt câu hỏi. AI không có quyền tự thay đổi kết luận hoặc số thuế được duyệt.

**Live:** https://limegreen-salamander-517622.hostingersite.com
**Verify:** https://limegreen-salamander-517622.hostingersite.com/verify
**Cập nhật:** 10/10/2026. [Kế hoạch đối chiếu đề A](brainstorming/ke-hoach-hoan-thien-cau-a-2026-10-10.md), [báo cáo cải tiến](brainstorming/bao-cao-cai-tien-va-trien-khai-2026-10-10.md).

## Luồng đã triển khai

- Tiếp nhận XML, PDF có lớp chữ, PDF scan và ảnh. Lưu chứng từ gốc, kết quả trích xuất, các trường thiếu/suy luận/chưa chắc chắn.
- Từ laptop tạo QR chụp hóa đơn bằng điện thoại; mỗi ảnh được lưu làm chứng từ nguồn, tự OCR và điền vào biểu mẫu. QR hết hạn sau 10 phút, có thể chụp tiếp ảnh trong cùng phiên, giới hạn 15 MB; điện thoại không cần đăng nhập. Chạy `npm run test:capture` để kiểm tra API và vòng đời phiên.
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
npm run build
npm start
```

AI key chỉ đặt trong env phía server. MVP cuộc thi cho đăng nhập nội bộ bằng cách chọn Kế toán viên, Kế toán trưởng hoặc CFO, không cần mật khẩu; có thể đổi vai trò trong workspace. Dữ liệu nội bộ dùng chung, còn phiên demo có database riêng. Quyền thao tác và quy tắc duyệt vẫn áp dụng theo vai trò đang chọn. Đây là cơ chế trải nghiệm MVP, không xác minh danh tính người dùng. API email/mật khẩu cũ vẫn tương thích nếu đã cấu hình secret.

Profile `DOCUMENT_IMAGE_ENGINE=vision` dùng provider cấu hình cho ảnh. Profile `local-ocr` dùng worker resident ở `LOCAL_OCR_URL`; khi worker lỗi hoặc confidence thấp và fallback tắt, hồ sơ được giữ để xác minh. Compose có worker và health check; container chưa được nghiệm thu trên Hostinger shared hosting.

## Kiểm chứng và triển khai

```sh
npm run test:acceptance
TEST_BASE_URL=https://limegreen-salamander-517622.hostingersite.com npm run test:api
npm run evaluate:independent -- docs/evidence/independent-labels.json
```

Runner độc lập từ chối nhãn chưa khóa, ca trùng và fixture/tập học trùng. File nhãn hiện chưa được nhân sự nghiệp vụ điền; lệnh cuối phải báo lỗi, không sinh số liệu giả. Báo cáo có mẫu số FN/FP, ERROR riêng, độ đúng nhóm/người nhận, policy/code hash và câu hỏi để chấm mù thủ công.

[Runbook chung](docs/runbook-final.md) · [Runbook Hostinger](deployment/HOSTINGER.md) · [Quy trình thu bằng chứng người dùng](docs/evidence/user-study-protocol.md).

Hostinger hiện chạy bản standalone build tại local và dependency Linux riêng; `better-sqlite3` ghim 12.11.1 có binary Node 22. Runtime/SQLite/chứng từ nằm ngoài release. Không chạy lại pipeline hPanel từ phiên bản Git cũ trước khi đồng bộ các sửa đổi này.

Giao diện giữ bố cục trước redesign (r6), sau đó tinh gọn theo yêu cầu người dùng: nhãn ngắn, bốn thẻ thống kê, bàn thẩm định hai cột, chi tiết phụ thu gọn. Release hiện tại: `codex-20261011-r17-toast-no-inline-errors`; lỗi hiển thị bằng toaster, không còn trạng thái mặc định chiếm chỗ trên trang tiếp nhận, ảnh không nhận diện được sẽ không giữ dữ liệu cũ trong biểu mẫu và chi tiết nguồn bóc tách được thu gọn. [Ghi chú tinh gọn](brainstorming/tinh-gon-giao-dien-2026-10-11.md) · [Lịch sử khôi phục](brainstorming/khoi-phuc-giao-dien-2026-10-11.md). Kế hoạch/design system của lần redesign bị gỡ là tài liệu lịch sử.

## Phạm vi bằng chứng

Kiểm thử tổng hợp và API live đã được chạy. Ba bộ Verify có ca trùng; không cộng thành số ca độc lập. Kết quả đọc XML/PDF/ảnh live là kiểm tra vận hành với tài liệu tổng hợp, không phải benchmark độ chính xác.

Còn cần nhân sự thực tế: nhãn holdout, chấm chất lượng câu hỏi, ba người dùng nghiệp vụ, đo trước/sau và retest cải tiến từ feedback. Chưa có bằng chứng tích hợp thật ERP/ngân hàng/TCT, nộp tờ khai hoặc tự cập nhật luật. Chứng từ/voucher trong ứng dụng là nội bộ; xuất adapter không chứng minh đã hạch toán bên ngoài.
