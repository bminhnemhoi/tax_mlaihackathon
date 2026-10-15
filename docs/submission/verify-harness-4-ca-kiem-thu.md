# Verify harness và 4 trường hợp kiểm thử — Tax Referee

**Đội:** Fprinciples · **Đề:** A — The Escalation Referee · **Live:** https://limegreen-salamander-517622.hostingersite.com

## Cách chạy (một nút, khoảng 90 giây)

| Cách | Thao tác | Kết quả in ra |
|---|---|---|
| Trên Live URL (giám khảo) | Trang chủ → **① Chạy Verify (90 giây)** → **Chạy Verify** | Bảng PASS/FAIL 9 ca (4 ca chung + 5 ca Đề A), thời điểm bắt đầu/kết thúc từng ca, nhóm dừng, người nhận, câu hỏi chuyển tiếp; tải báo cáo JSON/CSV |
| Bằng API | `GET /api/verify?mode=judge` | JSON gồm `runId`, `summary`, `results[]` (có `startedAt`, `finishedAt`) |
| Từ mã nguồn | `npm ci && npm test` (xem [RUNBOOK](../../RUNBOOK.md)) | 16 bộ kiểm thử, mỗi bộ trên database tạm, in PASS/FAIL kèm dấu thời gian |

Verify chạy bằng quy tắc tất định, **không gọi AI**, không cần tài khoản. Bộ 15 và 60 ca chạy được trong cùng trang (tự mở phiên demo).

## 4 trường hợp kiểm thử chung

| Ca | Dữ liệu đầu vào | Hành vi kỳ vọng | Cách thực thi |
|---|---|---|---|
| C-01 | Phí chuyển phát nhanh tài liệu: 2.000.000₫ + VAT 10% = 2.200.000₫, chuyển khoản | **Tự xử lý** (thường quy), tạo chứng từ nội bộ, ghi nhật ký | Verify, nhóm "4 ca chung" |
| C-02 | Tài trợ giải chạy từ thiện: 15.000.000₫ + VAT = 16.500.000₫ | **Chuyển tiếp · Ngoài quy định** (khoản chi ngoài phạm vi tự duyệt), Kế toán trưởng quyết định | như trên |
| C-03 | Hóa đơn lấy từ ảnh mờ | **Chuyển tiếp · Chưa rõ thông tin**: không kết luận trên số tiền chưa chắc, hỏi số đúng | như trên |
| C-04 | MST người mua trên hóa đơn (0200200200) khác MST doanh nghiệp (0102030405) | **Chuyển tiếp · Ngoài quy định**: không đủ điều kiện khấu trừ | như trên |

3/4 ca có hành vi đúng là **chuyển tiếp** (yêu cầu thể lệ: ít nhất một ca từ chối/chuyển tiếp). Dữ liệu: `data/verification/challengeCases.ts`.

## Bài kiểm tra nhanh Đề A (5 ca, chạy cùng nút)

| Ca | Nội dung | Kỳ vọng |
|---|---|---|
| A-01 | Văn phòng phẩm, chuyển khoản | Tự xử lý |
| A-02 | Văn phòng phẩm tiền mặt dưới 5 triệu | Tự xử lý |
| A-03 | Dịch vụ viễn thông đúng thuế suất | Tự xử lý |
| A-04 | Thanh toán tiền mặt 11.000.000₫ (≥ 5 triệu) | Chuyển tiếp · Ngoài quy định (Kế toán trưởng) |
| A-05 | Khoản mua 275.000.000₫ (≥ hạn mức 200 triệu) | Chuyển tiếp · Vượt thẩm quyền (CFO) |

## Kết quả chạy trên Live URL (15/10/2026)

**9/9 PASS** · runId `79f02bce-a485-4877-a206-4768bd802aae` · bắt đầu 09:39:27.271 UTC, mỗi ca 20–50 ms.
Bằng chứng đầy đủ: [docs/evidence/verify-live-2026-10-15.json](../evidence/verify-live-2026-10-15.json).

> Dữ liệu kiểm thử là **tổng hợp** do đội viết theo SOP, không phải đánh giá độc lập. Hướng dẫn vận hành từ clone sạch: [RUNBOOK.md](../../RUNBOOK.md).
