# Tax Referee · Đề A — The Escalation Referee

[![CI](https://github.com/khanhle1406/Tax-Referee/actions/workflows/ci.yml/badge.svg)](https://github.com/khanhle1406/Tax-Referee/actions/workflows/ci.yml)

**Tự xử lý hóa đơn đầu vào thường quy. Dừng đúng lúc, hỏi đúng người, bằng một câu hỏi trả lời được ngay.**

Tax Referee đọc hóa đơn điện tử Việt Nam (XML chuẩn TT78/NĐ123, PDF, ảnh), chạy **quy tắc tất định trước** rồi mới dùng AI,
và chỉ chuyển cho con người những ca thật sự cần: **chưa rõ thông tin**, **ngoài quy định**, hoặc **vượt thẩm quyền**.
Mọi quyết định có nhật ký kiểm toán, dừng và hoàn tác được.

| | |
|---|---|
| **Live URL** (không cần tài khoản) | https://limegreen-salamander-517622.hostingersite.com |
| **Verify** (một nút, 9 ca, có dấu thời gian) | https://limegreen-salamander-517622.hostingersite.com/verify |
| **Tài liệu quy định (SOP)** | https://limegreen-salamander-517622.hostingersite.com/sop |
| **Phiên bản đang chạy** | [`/api/health`](https://limegreen-salamander-517622.hostingersite.com/api/health) trả về commit, phiên bản policy và contract quy tắc |
| Runbook (clone sạch → chạy → kiểm chứng) | [RUNBOOK.md](RUNBOOK.md) |
| Báo cáo cải tiến 14–15/10 và hướng dẫn bàn giao | [docs/handoff/](docs/handoff/bao-cao-cai-tien-2026-10-15.md) · [hướng dẫn](docs/handoff/huong-dan-ban-giao.md) |

## Giám khảo: 90 giây

1. Mở Live URL → bấm **① Chạy Verify** → **Chạy Verify**. Bảng in 4 ca chung + 5 ca Đề A (3 tự xử lý, 2 chuyển tiếp), PASS/FAIL và thời điểm chạy từng ca.
2. Tab **Thử dữ liệu mới**: sửa JSON hoặc bấm ca mẫu (bỏ trống trường chưa biết). Hệ thống chỉ hỏi những dữ kiện **thực sự làm thay đổi kết quả**.
3. Trang chủ → **② Mở hộp chuyển tiếp — demo riêng** (database riêng cho phiên, có sẵn 4 ca mẫu: 1 tự xử lý + 1 ca cho mỗi kiểu dừng) → mở một ca → đổi vai trò KTT/CFO → trả lời ngay trên hồ sơ (VD "1A, 2A") → tab **Nhật ký** → **Dừng / Hoàn tác**.

### 4 trường hợp kiểm thử chung

| Ca | Dữ liệu đầu vào | Hành vi kỳ vọng | Cách chạy |
|---|---|---|---|
| C-01 | Phí chuyển phát nhanh tài liệu 2.200.000₫, chuyển khoản | Tự xử lý (thường quy), tạo chứng từ nội bộ | `/verify` → Chạy Verify, hoặc `npm test` |
| C-02 | Tài trợ giải chạy từ thiện 16.500.000₫ | Chuyển tiếp · Ngoài quy định (KTT quyết định) | như trên |
| C-03 | Hóa đơn từ ảnh mờ | Chuyển tiếp · Chưa rõ thông tin (không kết luận trên số tiền chưa chắc) | như trên |
| C-04 | MST người mua khác MST doanh nghiệp (0102030405) | Chuyển tiếp · Ngoài quy định (không đủ điều kiện khấu trừ) | như trên |

Dữ liệu: `data/verification/challengeCases.ts`. 5 ca Đề A (3 tự xử lý, 2 chuyển tiếp) chạy cùng nút Verify.

## Ba kiểu dừng và câu hỏi "trả lời trong một câu"

| Kiểu dừng | Khi nào | Ví dụ câu hỏi hệ thống tạo |
|---|---|---|
| **Chưa rõ thông tin** | Thiếu/mờ/mâu thuẫn dữ kiện làm thay đổi kết quả | *Tổng thanh toán in trên hóa đơn 480.000₫ lệch tiền hàng + thuế = 495.000₫. A: 495.000₫ — sửa và đánh giá lại; hoặc B: 480.000₫ như in — yêu cầu NCC điều chỉnh?* |
| **Ngoài quy định** | Vi phạm điều kiện khấu trừ, hoặc khoản chi thuộc danh mục ngoài phạm vi tự duyệt (tài trợ, phạt, quà biếu/tặng, chi cá nhân…) | *“Tiếp khách đối tác - rượu vang” (3.300.000₫) nằm ngoài nhóm chi được tự duyệt. A: Tiếp khách theo quy chế — duyệt, khấu trừ 300.000₫; hoặc B: Chi cá nhân — loại 300.000₫ VAT?* |
| **Vượt thẩm quyền** | Từ 200 triệu (hạn mức KTT) hoặc lô hàng làm hệ số K vào vùng đỏ | *Tổng thanh toán 330.000.000₫ ≥ hạn mức tự duyệt của KTT 200.000.000₫. A: CFO phê duyệt chi, khấu trừ 30.000.000₫; hoặc B: Tạm dừng để thẩm tra hợp đồng?* |

- Ca có nhiều vấn đề được gộp thành **các ý đánh số trong một câu hỏi**; người xử lý trả lời một lần (VD "1A, 2A").
- **Không kết luận trên dữ liệu nghi vấn:** nếu số tiền chưa chắc, hệ thống không nói "vượt quyền" hay "vi phạm"; nó hỏi xác nhận số tiền trước.
- **Không chuyển tiếp thừa:** phương thức thanh toán chỉ được hỏi khi tổng tiền (gộp cùng nhà cung cấp trong ngày) đạt ngưỡng 5 triệu; trạng thái MST bên bán chỉ hỏi từ ngưỡng trọng yếu 20 triệu. Dưới các ngưỡng này, dữ kiện đó không làm đổi kết quả nên hỏi chỉ thêm việc.
- Bảng phân loại duy nhất cho SOP, engine và workflow: [`lib/riskTaxonomy.ts`](lib/riskTaxonomy.ts). Câu hỏi: [`services/questionBuilder.ts`](services/questionBuilder.ts).

## Kiến trúc

```
XML / PDF / ảnh / nhập tay
   │  parser XML (chặn DOCTYPE/ENTITY – XXE) · PDF text · Gemini Vision cho ảnh/PDF scan
   ▼
Kiểm tra nguồn: trường thiếu, mờ, khác chứng từ gốc, MST mâu thuẫn danh tính → "chưa xác minh"
   ▼
Policy engine tất định (24 quy tắc SOP, không gọi AI) ──► ROUTINE → tự duyệt, tạo chứng từ nội bộ, audit
   │                                                   └► ESCALATED → nhóm dừng + câu hỏi một câu + người nhận (KTT/CFO)
   ▼
Con người: trả lời / xác nhận từng dữ kiện / duyệt / từ chối · Dừng · Hoàn tác
   ▼
SQLite (WAL, bền qua khởi động lại) · audit nối chuỗi SHA-256 (ai, khi nào, inputHash, policy, contract, commit, lý do)
```

- **Không có vòng lặp agent:** mỗi lượt đánh giá chạy một lần qua quy tắc; AI chỉ đọc ảnh (timeout 35s) và, nếu bật `QGEN_AI=1`, diễn đạt lại câu hỏi (timeout 3,5s, bị guard chặn nếu thêm số liệu hoặc đổi người nhận/phương án). Lượt đánh giá có hạn 60–300s; quá hạn → `ON_HOLD`, kết quả trễ bị loại.
- **Persistence:** SQLite WAL trên volume; mỗi phiên demo một file riêng; kiểm thử khởi động lại (`npm run test:recovery`).

### Thật / giả lập

| Thành phần | Trạng thái |
|---|---|
| Quy tắc phân luồng, câu hỏi, workflow, audit, dừng/hoàn tác, SQLite | **Thật**, chạy trên live |
| Parser XML hóa đơn điện tử (Viettel, MISA, VNPT, FPT, TCT) | **Thật**; file mẫu là XML mẫu công khai, MST thử nghiệm |
| Đọc ảnh/PDF scan | **Thật** qua Gemini 2.5 Flash (proxy ShopAIKey) khi có key |
| Dữ liệu Verify (4 + 5 + 15 + 60 ca) | **Tổng hợp**, nhãn viết theo SOP; không phải đánh giá độc lập |
| Ngân hàng, đối soát TCT, ERP, báo cáo thuế, thông báo (nhóm **Mở rộng · beta**) | **Một phần giả lập** / chỉ xuất payload; ngoài phạm vi Đề A |
| Vai trò Kế toán viên / KTT / CFO trong demo | **Mô phỏng** trong database riêng của phiên; không phải người dùng thật |

## Chạy và kiểm thử

```sh
npm ci
cp .env.example .env.local        # key AI chỉ cần cho đọc ảnh; Verify và test không cần
npm run dev                       # http://localhost:3000
npm test                          # unit (node:test) + 15 bộ hồi quy (kể cả 72 ca red team), mỗi bộ chạy trên DB tạm riêng
npm run typecheck && npm run lint
```

CI (GitHub Actions, Ubuntu + Windows): typecheck, lint, test, build khi đẩy mã lên `main`/`feat/**` và khi mở PR. Chi tiết: [RUNBOOK.md](RUNBOOK.md).

## Phản hồi Sprint 1 → đã xử lý

| Góp ý (Doanh nghiệp / Ban kỹ thuật) | Đã làm |
|---|---|
| Dữ liệu trên RAM, mất audit khi khởi động lại | SQLite WAL bền vững + audit nối chuỗi hash, test khởi động lại |
| XML parser nạp thực thể ngoài (XXE) | Từ chối `DOCTYPE`/`ENTITY` trước khi parse; test payload XXE trả 400 |
| Script test chưa thành bộ kiểm thử chuẩn | `npm test` (node:test + runner đa nền tảng), CI Ubuntu/Windows |
| Vòng lặp agent không có trần | Không còn vòng lặp: một lượt quy tắc, AI có timeout, lease quá hạn → `ON_HOLD` |
| 2/3 kiểu dừng, "không đoán bừa", "không chuyển tiếp thừa" mới đạt một phần | Bảng phân loại 3 nhóm duy nhất; quy tắc "ngoài phạm vi SOP"; so với chứng từ gốc; ngưỡng trọng yếu; 11 ca diễn tập giám khảo trong `tests/unit/judgeRehearsal.test.ts` |
| Gemini 429 làm Verify lỗi | Verify chạy tất định, không gọi AI |

## Bằng chứng và giới hạn (trung thực)

- **Người dùng thực tế:** đang thử nghiệm với 3 người dùng do BTC điều phối (bộ câu hỏi: [docs/submission/proposal-user-questions.md](docs/submission/proposal-user-questions.md)). Chưa có kết quả tại thời điểm khóa repo; kết quả và cải tiến từ phản hồi sẽ được ghi ở `docs/evidence/` kèm commit riêng.
- **Độ chính xác:** các bộ Verify và 60 ca phát triển là dữ liệu tổng hợp đội tự gán nhãn; 72 ca red team do agent AI viết từ SOP (không đọc `services/policyEngine.ts`, có đọc SOP và module ngưỡng `lib/refereeRequirements.ts`; nhãn do AI gán, chưa được người nghiệp vụ duyệt) (`data/verification/redteam/cases.json`, 72/72). Tất cả **chưa phải đánh giá độc lập**. Công cụ khóa nhãn và chấm độc lập đã có (`npm run labels:lock`, `npm run evaluate:independent`).
- **Pháp lý:** quy tắc mô tả SOP nội bộ; điều khoản luật được dẫn nguồn nhưng diễn giải cần kế toán xác nhận.
- **Đã biết:** "ngoài phạm vi" được nhận diện bằng danh sách từ khóa, nên chi cá nhân ghi tên khác vẫn có thể tự duyệt (VD "tiệc cưới người thân giám đốc" — giữ nguyên làm ca bẫy U2 cho buổi thử 16/10 đã công bố trong Proposal); hóa đơn tách nhỏ cùng nhà cung cấp cùng ngày chưa được cộng dồn khi xét hạn mức CFO; ngày lập tương lai gần chưa bị chặn (chỉ chặn khi quá 6 tháng); dữ liệu ảnh gửi qua dịch vụ AI bên thứ ba; SQLite một instance; đăng nhập nội bộ là MVP.

Các thư mục `brainstorming/` là ghi chú nháp do AI hỗ trợ soạn, **không phải bằng chứng** (xem [brainstorming/README.md](brainstorming/README.md)).
Lịch sử commit trước 14/10 có bản nháp AI chứa 3 persona giả định kèm trích dẫn **không có thật** và một bảng số liệu "tập độc lập 42 ca" không có lần chạy tương ứng; đội đã gỡ/đính chính công khai ở commit `3ace396` và trong `brainstorming/opus-evaluation.md` (§6, §7). Không viết lại lịch sử git để giữ minh bạch.

## Cấu trúc mã nguồn

| Đường dẫn | Nội dung |
|---|---|
| `services/policyEngine.ts` | 24 quy tắc SOP tất định |
| `lib/riskTaxonomy.ts` | Ba kiểu dừng, thứ tự ưu tiên, quy tắc nào người duyệt được chấp nhận |
| `services/questionBuilder.ts`, `services/handoffService.ts` | Câu hỏi một câu, cấu trúc chuyển tiếp |
| `services/workflowService.ts` | Revision, kiểm tra nguồn, duyệt, dừng, hoàn tác, audit |
| `data/policyContract.ts` | SOP sinh từ registry quy tắc (trang `/sop`) |
| `data/verification/` | Fixture Verify (tổng hợp) |
| `scripts/qa/run-all.ts`, `tests/unit/` | Bộ kiểm thử |

MIT License · Đội Fprinciples · MLAI Hackathon 2026 · Track VNG
