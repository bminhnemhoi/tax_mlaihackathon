# Kết quả kiểm thử Tax Referee — 10/10/2026

**Chưa đạt nghiệm thu local.** Có 2 lỗi P0 và 7 lỗi P1 đã xác nhận; chưa thể kết luận hoàn tất toàn bộ ma trận thủ công. Không sửa mã nguồn/policy/.env của workspace.

## Phạm vi thực hiện

Production standalone ở cổng3001, DB/chứng từ tạm cách ly. Node24.5.0 trên macOS; Docker Linux dự kiến Node22 chưa kiểm thử. Baseline 202 file có SHA256 không thay đổi. Bộ Verify dùng policy TAX-SOP-2026-v2.5. Cấu hình và đáp án khóa trong evidence/policy-baseline.json và fixture-truth.json; không phải thẩm định pháp lý độc lập.

Có 434 bản ghi thực thi/check: **374 PASS, 37 FAIL, 12 BLOCKED, 11 NOT_RUN** sau hiệu chỉnh assertion. Đây là lượt thử, gồm HTTP contract, nghiệp vụ, retry và UI; không phải 434 ca độc lập được nhân sự nghiệp vụ gán nhãn. Trạng thái gốc và lý do sửa assertion vẫn có trong results.csv. Không lấy HTTP200/schema làm nghiệm thu chung.

Đã gửi request tới **50/50 tổ hợp method–route của36 nhóm route**. Có route chỉ mới kiểm tra contract/quyền, chưa đủ mọi nhánh nghiệp vụ. Danh mục gắn ID ở route-coverage.json. Mỗi request API có body đã làm sạch, response, thời gian và hash/count các bảng trước/sau; không kèm DB có session/hash mật khẩu.

## Kết quả chính

- typecheck, test:acceptance, test:api, test:recovery đều exit0; log check-0..3.txt. Acceptance: Verify4/4,5/5,15/15;20 workflow safety;2AI fallback;4 review regressions. Các fixture Verify có giao nhau, không cộng thành24 mẫu độc lập.
- Production build thành công trong chuẩn bị; standalone copy giữ symlink đã chạy health, workflow và recovery. stdout build ban đầu không lưu; build ID/metadata có đính kèm. Lint bị skip theo cấu hình hiện tại.
- Chrome native Verify5/5,3routine+2escalated,25ms; Safari native23ms. IAB Verify15/15,26ms. Thời gian này là chạy engine/harness, không phải toàn bộ thao tác của người dùng. Smoke Chrome/Safari không tương đương mọi chức năng đã thử trên cả hai trình duyệt.
- Dừng/giữ thuế/hoàn tác, conflict409, không tạo trùng voucher, xác nhận nguồn rồi sửa mất xác nhận, undo thu hồi tiền lệ và cân đối4adapter×2chế độ đã đối chiếu API/DB. Recovery mở lại phiên/revision/voucher/audit/artifact.
- UI đã đi qua tiếp nhận thiếu dữ liệu, XML nguồn, hồ sơ tiếp theo, dừng/undo, Nhật ký, SOP, TCT, ngân hàng, nhà cung cấp/snapshot, ERP rỗng, báo cáo và Verify. 1366/768/375 là viewport mô phỏng.
- Tải Verify1/5/10 request đồng thời:33/123/378ms cho cả batch, HTTP200 toàn bộ. Đây là tải kiểm soát ngắn, chưa phải soak/load production; không đo được peak RAM.

## OCR/AI và ngân sách

**16/20 request upstream**, tính cả thất bại:8Vision OpenRouter,6QGen Qwen,2lookup Qwen. Proxy kiểm soát hard cap20; gửi tuần tự, không dùng Jev, chỉ fixture giả lập.2PDF có lớp chữ dùng localparser nên không tính request upstream.

6Vision với model cấu hình cũ trả404 deprecated. Chỉ trong môi trường QA chuyển sang qwen/qwen3.7-flash của .env.example:2Vision trả200. Ảnh rõ đọc đúng nhiều trường nhưng thiếu buyerTaxCode; ảnh mờ trả0 với confidence0.98/needsReview=false. Không tuyên bố OCR đạt. QGen6ca giữ phân loại/thẩm quyền/phương án local. Nhánh thiếu key và timeout có test fallback PASS. Chưa có lỗi mạng nhà cung cấp thật được mô phỏng đầy đủ trên UI.

## Lỗi và giới hạn

[Danh sách18 lỗi và bước tái hiện](bugs.md). Ưu tiên xử lý API không xác thực, banking GET bỏ sandbox, boolean/revision khớp ngân hàng, tự duyệt CLOSED, OCR và UI TCT/chữ ký.

Đã phải sửa **dữ liệu fixture trong DB QA tạm**: đổi hasBankSlip số1 về boolean sau khi giữ bằng chứng lỗi, để kiểm tra phần khác. Chi tiết evidence/qa-data-workaround.json. Đây không phải bản sửa app; không tính lượt sau workaround là bằng chứng lỗi đã được khắc phục. Assertion copy standalone sai symlink, signing threshold, schema line items và cột precedent đã được loại khỏi kết luận lỗi.

Docker daemon thiếu socket; chưa có live HTTPS/nguồn pháp lý ngoài cấu hình. Các phần đó BLOCKED. Toàn bộ A/B trên UI ở cả hai browser, mọi modal Tab trap/zoom200%, đổi file trong request đang đọc, pan/zoom PDF, mạng mất/retry, đầy đủ ca biên K/làm tròn, policy đổi trong lúc xử lý, precedent hết hạn/tie/safety gate, browser concurrent thực và diễn tập8phút còn NOT_RUN. Không ghi là PASS hoặc suy ra từ test tự động. [Checklist tiếp tục](CHECKLIST.md).

## Chạy lại và bằng chứng

[results.csv](results.csv), [results.json](results.json), [route-coverage.json](route-coverage.json), fixtures/ và evidence/. Thư mục evidence chứa screenshot/DOM, response API, snapshot hash/count, provider counter và log checks đã làm sạch. Không chứa APIkey, token phiên, mật khẩu hoặc hóa đơn thật.

Môi trường QA tạm: `/var/folders/37/k102566s7v39pbgrzypptyd80000gn/T/tax-referee-qa-tqrup58q`. Không trỏ test cũ vào data/runtime của workspace. Dựng production riêng cổng3001 bằng TAX_REFEREE_DATA_DIR/TAX_REFEREE_DB_PATH tạm; copy standalone phải giữ symlink và thêm public/.nextstatic. Dùng tài khoản QA riêng; không tái sử dụng cookie của workspace. Chạy checks như log đính kèm; đọc route-coverage để chọn payload từng request. Đối chiếu UI → API → DB/voucher/audit và giữ nguyên policy baseline. Khi chạy AI, proxy/quota phải đếm request upstream kể cả retry.

Chỉ nghiệm thu lại sau khi P0/P1 đã sửa và các ca bắt buộc còn lại PASS. Bộ báo cáo này kết thúc lượt khảo sát hiện tại, không tuyên bố toàn bộ kế hoạch3–4ngày đã hoàn thành.
