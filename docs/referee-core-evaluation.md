# Đánh giá năng lực chuyển tiếp theo đề A

> 📌 **Ảnh chụp lịch sử** — số liệu và tên quy tắc trong file này có thể đã cũ. Số liệu hiện hành: [README](../README.md), trang `/verify`, `/sop` và `docs/evidence/`.


Đợt cải tiến này chuẩn bị kỹ thuật. Bộ phát triển có 60 tình huống tổng hợp với nhãn từ SOP: 24 thường quy và 12 cho mỗi nhóm ngoại lệ. Bộ Verify/hồi quy và bộ phát triển được xem là dữ liệu đã dùng để sửa chương trình, không được đưa vào tập độc lập.

## Kiểm tra tại local

```sh
npm run test:referee-core
npm run test:referee-labels
npm run test:acceptance
npm run typecheck
npm run typecheck:referee
npm run evaluate:referee -- docs/evidence/referee-core/after.json --assert
```

Mỗi tình huống chạy trong SQLite riêng với snapshot policy. Lịch sử giao dịch hoặc số liệu nền K chỉ được dùng khi context khai báo. Hồ sơ thường quy phải có trạng thái APPROVED, số thuế, voucher và audit; hồ sơ chuyển tiếp chưa có số thuế được duyệt hoặc voucher. Đổi thứ tự ca không được đổi kết quả. Chế độ này không gọi dịch vụ AI.

FN dùng mẫu số là số ca cần chuyển tiếp; FP dùng mẫu số là số ca thường quy. Lỗi dịch vụ/đánh giá được ghi riêng và giữ trong mẫu số. Độ đúng nhóm/người nhận và hoàn tất workflow được báo riêng. JSON/CSV có phiên bản policy, mã nguồn và dấu băm dữ liệu.

## Thu nhãn độc lập

Nhóm mời ít nhất ba nhân sự đang trực tiếp xử lý kế toán/tài chính, sử dụng chứng từ được phép và đã ẩn thông tin cá nhân. Người tham gia tự ghi vai trò, phản hồi và nhãn; không điền tên hoặc nhận xét thay họ. Lưu xác nhận gốc và nhãn chứa thông tin cá nhân ngoài repository công khai.

Sao chép `docs/evidence/referee-core/labeling-template.json` ra nơi lưu dữ liệu riêng. Mục tiêu 40 ca mới: 16 thường quy và 8 ca mỗi nhóm ngoại lệ; runner yêu cầu tối thiểu 20 ca. Gán nhãn từ SOP trước khi xem kết quả hệ thống; các ca chưa thống nhất phải được trao đổi và chốt trước khi khóa.

Mỗi ca có `id`, `name`, `invoice`, `expectedStatus`, `expectedRiskGroup` nếu chuyển tiếp, `expectedRequiresCFO`, `rationale`, `labeledBy`, `labeledAt`, `provenance`. `invoice` cho phép thiếu trường để kiểm tra khả năng chuyển tiếp; không điền giá trị đoán. `context` tùy chọn gồm `history`, `macroBaseline` và `config`. Có thể gắn `policySnapshot` lấy từ trường `policy` trong báo cáo kỹ thuật; MST của snapshot phải khớp `companyTaxCode` của tập nhãn.

```sh
npm run labels:lock -- /duong-dan-rieng/nhan-nhap.json /duong-dan-rieng/nhan-khoa.json
npm run evaluate:independent -- /duong-dan-rieng/nhan-khoa.json --out /duong-dan-rieng/bao-cao.json
```

Lệnh khóa tạo file JSON cùng dấu SHA-256, không ghi đè tập đã khóa. Runner từ chối nhãn thay đổi sau khóa, nhãn muộn hơn thời điểm khóa, ca trùng hoặc trùng bộ phát triển/Verify. Tập nhãn cũ schema 1 vẫn đọc được, nhưng báo rõ LEGACY_UNSEALED khi chưa có dấu khóa. Không coi việc bộ công cụ nhận một file khai báo nhãn là bằng chứng người nghiệp vụ đã tham gia; cần giữ xác nhận thực tế.

Nếu dùng lỗi của tập độc lập để sửa chương trình, chuyển tập đó thành dữ liệu phát triển và lấy tập mới cho lần đo tiếp theo. Các file hiện tại vẫn trống có chủ đích; không có tỷ lệ chính xác độc lập được công bố.

## Chấm câu hỏi và tác động đến người dùng

Người chấm đọc câu hỏi, dữ kiện và A/B mà không thấy nhãn/kết quả kỳ vọng. Mức 6: có thể quyết định ngay; mức 3: câu hỏi cụ thể nhưng phải tra thêm hồ sơ; mức 0: câu hỏi chung chung. Ghi nhận vì sao cần tra thêm; kiểm tra cấu trúc tự động không thay thế chấm nghiệp vụ.

Báo cáo xuất bảng `*-question-scoring.csv` để thu phản hồi. Sau khi chấm, nhập JSON gồm `runId` và `scores` với các trường `caseId`, `score` (0, 3 hoặc 6), `reviewerId`, `scoredAt`, `notes`, rồi chạy:

```sh
npm run score:referee-questions -- /duong-dan-rieng/bao-cao.json /duong-dan-rieng/cham-cau-hoi.json
```

Công cụ từ chối sai run ID, ca trùng/ngoài lần chạy hoặc chưa chấm đủ. Kết quả không tự sửa ngưỡng/policy. Dùng hai bộ tác vụ tương đương, đổi thứ tự giữa ba nhân sự; đo thời gian thao tác, thời gian chờ, lỗi nghiệp vụ, nhu cầu hỏi đồng nghiệp và cảm giác áp lực duyệt. Ghi ít nhất một cải tiến theo chuỗi feedback → thay đổi mã → kiểm tra lại. Quy trình chi tiết trong `docs/evidence/user-study-protocol.md`.

## Giới hạn nguồn pháp lý

Registry đối chiếu sự tồn tại và ngày hiệu lực của văn bản từ Cổng Chính phủ: [181/2025](https://vanban.chinhphu.vn/?docid=214336&pageid=27160), [174/2025](https://vanban.chinhphu.vn/?docid=214310&pageid=27160), [70/2025](https://vanban.chinhphu.vn/?docid=213179&pageid=27160), [254/2026](https://vanban.chinhphu.vn/?docid=218689&pageid=27160). Nguồn đối chiếu thêm điều kiện thanh toán là [hướng dẫn của Bộ Tài chính được Cổng Chính phủ đăng lại](https://baochinhphu.vn/hoa-don-phat-sinh-ngoai-gio-hanh-chinh-co-duoc-khau-tru-thue-102260114102928901.htm).

Các rule giữ trạng thái DOCUMENT_CONFIRMED_RULE_PENDING hoặc UNVERIFIED cho diễn giải chưa xác minh ở cấp điều khoản. Hệ thống ghi nhận kết quả theo SOP trong phạm vi MVP; nguồn văn bản tồn tại không chứng minh mọi diễn giải luật hoặc mọi tình huống thực tế đều đúng. Nhân sự nghiệp vụ cần chốt phạm vi trước khi đánh giá độc lập hoặc sử dụng thực tế.
