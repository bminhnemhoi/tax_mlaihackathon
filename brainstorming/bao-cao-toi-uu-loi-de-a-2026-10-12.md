# Bàn giao tối ưu năng lực cốt lõi theo đề A

Ngày bàn giao: 12/10/2026. Phạm vi: phân luồng, chuyển tiếp, SOP/policy và công cụ đánh giá. Chạy local, giữ dữ liệu cùng các thay đổi có trước; không triển khai Hostinger, không commit hoặc push trong đợt này.

## 1. Kết quả trước/sau

Bộ phát triển có 60 tình huống tổng hợp mới: 24 ROUTINE, 12 UNCERTAIN_INFO, 12 OUT_OF_POLICY và 12 EXCEED_AUTHORITY. Kỳ vọng được viết từ SOP trước khi sửa engine. Các ca dùng snapshot policy và SQLite cách ly; lịch sử chỉ có khi khai báo trong context. Đây là dữ liệu phát triển, không phải tập độc lập hay số đo độ chính xác thực tế.

| Chỉ số | Baseline | Sau cải tiến |
| --- | --- | --- |
| Ca đúng kỳ vọng và workflow | 50/60 | 60/60 |
| Bỏ sót chuyển tiếp (FN) | 0/36 | 0/36 |
| Chuyển tiếp dư (FP) | 7/24 | 0/24 |
| Lỗi đánh giá | 1/60 | 0/60 |
| Đúng nhóm và người nhận trong nhóm cần chuyển tiếp | 33/36 | 36/36 |
| Ca thường quy hoàn tất đúng | 17/24 | 24/24 |
| Hoàn thành tự động trên toàn tập | 17/60 | 24/60 |

Hai báo cáo dùng cùng fixture SHA-256 `f42e4736ed7f9ce4defd02b1b982086a1aabbef0ad3b0fd122c52b32f39f4b37`. Mỗi báo cáo giữ snapshot policy và phiên bản mã; bản sau có thêm dấu băm cây nguồn, gồm cả file mới chưa commit. Baseline không có dấu băm cây nguồn đầy đủ, chỉ có commit và dấu băm diff đã chụp lúc bắt đầu; không dùng nó để khẳng định có một commit baseline có thể checkout nguyên vẹn.

- [Baseline JSON](../docs/evidence/referee-core/baseline.json).
- [Báo cáo sau cải tiến JSON](../docs/evidence/referee-core/after.json), [CSV](../docs/evidence/referee-core/after.csv).
- [Kết quả HTTP Verify local](../docs/evidence/referee-core/verify-live.json).

## 2. Các lỗi và điểm yếu đã xử lý

**Dữ kiện áp dụng.** Thay kiểm tra mọi trường chưa biết bằng điều kiện của từng quy tắc. Khoản nhỏ không bị giữ chỉ vì thiếu chứng từ ngân hàng; tên hàng rõ hoặc có dòng hàng đủ chi tiết không bị giữ vì thiếu bảng kê riêng. Thiếu phương thức thanh toán không bị suy thành tiền mặt. MST/tên đã tra cứu không được suy thành trạng thái bên bán ACTIVE. Cảnh báo trong danh bạ NCC vẫn áp dụng, không bị dữ liệu nhập tay che mất.

**Thiếu dữ liệu và số học.** Sửa lỗi MST `undefined` ghi đè giá trị trung gian khiến workflow ném lỗi thay vì chuyển tiếp. Chưa rõ dữ kiện quan trọng vẫn giữ thuế được duyệt bằng 0 và chưa có voucher. Kiểm tra số âm/điều chỉnh/tham chiếu gốc, biên tiền và số học dòng hàng; header khớp không còn che được dòng sai số lượng × đơn giá hoặc tiền thuế dòng.

**Ngày và gộp giao dịch.** Ngưỡng thanh toán theo ngày hóa đơn và mốc hiệu lực trong config; profile lịch sử trước 01/07/2025 dùng 20 triệu, từ mốc đó dùng 5 triệu mặc định. Gộp giao dịch mua dương cùng MST/ngày, không đếm trùng và không gộp hóa đơn từ chối/điều chỉnh âm. Context rỗng trong runner không lấy lịch sử của dữ liệu đang vận hành.

**Nhiều phát hiện và thẩm quyền.** Giữ đầy đủ findings; nhóm chính theo ưu tiên quy tắc, nhưng người nhận theo quyền cao nhất cần thiết. Chỉ xử lý vấn đề thẩm quyền không giải tỏa vấn đề dữ liệu hoặc điều kiện thanh toán. Tiền lệ chỉ có thể giải tỏa quy tắc nội bộ phù hợp; không vượt ràng buộc dữ liệu, luật định hoặc quyền duyệt.

**SOP và gate policy.** Registry có 22 quy tắc với điều SOP, dữ kiện, điều kiện, nhóm, người nhận, phương án và ca kiểm thử. SOP thực thi được sinh từ registry/config; ghi chú tự do lưu riêng dưới policyNotes. Ghi chú tạo draft thật, không làm UI giả cập nhật một phiên bản ACTIVE. Gate kiểm tra biên theo tham số candidate; đổi trần KTT hợp lệ không còn bị bộ ca cũ cố định 200 triệu chặn sai. Có danh sách hồ sơ đổi quyết định/nhóm/người nhận/phát hiện và các tham số đổi trước publish.

Xem [bảng đối chiếu đủ 22 rule](../docs/referee-core-rule-matrix.md), hoặc `/sop`. API policy nội bộ trả executableText/ruleMatrix, contractVersion và notes. Hồ sơ/policy cũ được giữ; không tự publish một policy mới vào dữ liệu của bạn.

## 3. Chuyển tiếp và giao diện

Quyết định ESCALATED có handoff tùy chọn để tương thích hồ sơ cũ, gồm người nhận, hóa đơn, câu hỏi, dữ kiện, A/B, toàn bộ vấn đề mở, bằng chứng và tham chiếu policy/hash. Dữ liệu chưa có được hiển thị đúng là chưa có, không biến giá trị trung gian thành sự thật.

Câu hỏi mẫu nêu hóa đơn/NCC/số tiền, vấn đề/ngưỡng, điều SOP và hành động A/B. AI chỉ diễn đạt lại nội dung đã chốt. Nội dung thêm con số, đổi người xử lý, thay hành động hoặc thiếu dữ kiện bắt buộc bị từ chối; lỗi provider dùng mẫu hoàn chỉnh. Kiểm thử AI diễn đạt tách khỏi bộ đánh giá local và dùng phản hồi giả lập; chưa đo chất lượng AI thực tế trên dữ liệu gán nhãn.

Thẻ trong workspace đặt dữ kiện, bằng chứng và phương án gần câu hỏi; danh sách findings vẫn giữ đầy đủ. Verify và thẻ chuyển tiếp cũ hỗ trợ handoff mới. Verify thêm bộ 60 ca, kiểm tra câu hỏi/workflow, tải JSON/CSV và nhập tình huống mới qua cùng workflow sandbox cách ly. Lỗi thao tác dùng toaster. Bằng chứng trình duyệt:

- [Verify đề A](../docs/evidence/referee-core/verify-desktop.png): 3 thường quy, 2 chuyển tiếp.
- [Verify bộ phát triển](../docs/evidence/referee-core/verify-development.png): 24 thường quy, 36 chuyển tiếp.
- [Tình huống nhập mới nhiều phát hiện](../docs/evidence/referee-core/handoff-sandbox.png): tiền mặt, ảnh chưa rõ và vượt quyền chuyển CFO; vẫn giữ đủ vấn đề.

Sau sửa dữ liệu/bổ sung bằng chứng, revision mới chạy lại toàn bộ quy tắc. Xác nhận cũ bị vô hiệu nếu giá trị thay đổi. Audit đánh giá lưu quyết định/handoff, dữ kiện, căn cứ, người xử lý và before/after; các kiểm soát quyền, gửi lặp, dừng, kết quả muộn và hoàn tác tiếp tục hoạt động.

## 4. Kiểm thử đã quan sát đạt

| Kiểm tra | Kết quả |
| --- | --- |
| npm run test:referee-core | 14 kiểm tra đạt, gồm 60 ca, chạy đảo thứ tự, snapshot không bị sửa, probe đủ 22 rule, multi-finding/quyền, policy impact, audit và QGen fallback |
| npm run test:referee-labels | Khóa/không ghi đè nhãn, xuất JSON/CSV, phát hiện sửa file và trùng bộ phát triển; chấm câu hỏi chặn sai run/ca trùng/ca lạ/thiếu chấm |
| npm run test:acceptance | Các suite hiện có đạt, gồm workflow, AI fallback, review, parsing/NCC và hồi quy; QA 39 kiểm tra, cải tiến đề A 19 kiểm tra |
| npm run typecheck; npm run typecheck:referee | Đạt cho ứng dụng và các script QA mới |
| ESLint các file thuộc đợt thay đổi | Đạt; cấu hình lint chạy không còn yêu cầu thiết lập tương tác |
| npm run evaluate:referee -- docs/evidence/referee-core/after.json --assert | 60/60, FN 0, FP 0, lỗi 0 |
| NEXT_BUILD_DIR=.next-referee-core npm run build | Build production local thành công |
| NEXT_BUILD_DIR=.next-referee-core npm run test:capture | Đạt vòng đời QR, token, ảnh, artifact, gate ShopAIKey, chụp tiếp, hết hạn và audit trong runtime tạm |
| HTTP + trình duyệt local | Trang chính/SOP/Verify/health hoạt động; Verify đề A 5/5; bộ phát triển 60/60; nhập mới chuyển CFO và hiện đủ vấn đề |

Các kiểm thử provider, nhãn và điểm câu hỏi mô phỏng ghi rõ MOCK/SYNTHETIC; không đưa các dữ liệu đó thành nhãn của người thật. Kiểm thử thiết bị điện thoại thật/ảnh thật/AI thật không được suy từ kiểm thử API này.

## 5. Công cụ thu nhãn và đánh giá độc lập

[Hướng dẫn đầy đủ](../docs/referee-core-evaluation.md) và [mẫu nhãn trống](../docs/evidence/referee-core/labeling-template.json) đã có. Mục tiêu 40 ca mới, tối thiểu 20; mời ba nhân sự nghiệp vụ thực sự gán nhãn trước khi xem kết quả. Không ghi thông tin cá nhân/chứng từ thật vào repository công khai.

```sh
npm run labels:lock -- /duong-dan-rieng/nhan-nhap.json /duong-dan-rieng/nhan-khoa.json
npm run evaluate:independent -- /duong-dan-rieng/nhan-khoa.json --out /duong-dan-rieng/bao-cao.json
npm run score:referee-questions -- /duong-dan-rieng/bao-cao.json /duong-dan-rieng/cham-cau-hoi.json
```

Runner mới nhận snapshot policy và context riêng từng ca; giữ phiên bản legacy để tương thích. Tập schema 2 phải có SHA-256; từ chối sửa sau khóa, ca trùng và ca đã dùng phát triển/Verify. Báo cáo giữ FN/FP/lỗi, nhóm/người nhận, hoàn tất/voucher/thuế/audit, câu hỏi và phiên bản mã/policy. Tập cũ không có dấu khóa bị ghi LEGACY_UNSEALED.

Bảng after-question-scoring.csv là mẫu trống để người nghiệp vụ chấm: 6 trả lời ngay, 3 cần tra cứu thêm, 0 chung chung. Chấm cấu trúc tự động không thay cho chấm chất lượng. Khi dùng lỗi tập độc lập để sửa engine, chuyển tập đó sang phát triển và dùng tập mới cho lần đo kế tiếp. Hiện chưa có nhãn/điểm/feedback của người thật, chưa công bố độ chính xác hay mức tiết kiệm thời gian thực tế.

## 6. Giới hạn còn lại và cách dùng thử

Căn cứ pháp lý được kiểm tra nguồn văn bản/ngày hiệu lực, nhưng diễn giải từng điều khoản còn cần nghiệp vụ xác nhận. Registry và thẻ chuyển tiếp ghi rõ DOCUMENT_CONFIRMED_RULE_PENDING hoặc UNVERIFIED; không coi sự tồn tại của văn bản là bằng chứng mọi kết luận thuế đều đúng. Danh mục ngành hàng và các dung sai hiện là profile MVP cần chốt trước đánh giá độc lập.

Server local đang chạy bản build mới tại `http://localhost:3000`; mở `http://localhost:3000/verify` để chạy bộ đề A, bộ 60 ca hoặc nhập tình huống mới. Tại thời điểm bàn giao, địa chỉ LAN là `http://192.168.1.95:3000`; IP có thể đổi khi đổi mạng. Không thay khóa API, không gửi dữ liệu kế toán thật đến provider trong bộ đánh giá local, và chưa triển khai lên Hostinger.
