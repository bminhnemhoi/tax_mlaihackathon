# Trước / sau: 11 ca diễn tập kiểu giám khảo (14/10/2026)

**Mục đích:** đo các thay đổi ở nhánh `feat/track-a-hardening` có cải thiện đúng ba tiêu chí chấm Đề A hay không:
phát hiện và phân loại đúng ca cần chuyển tiếp, không chuyển tiếp ca thường quy, và câu hỏi trả lời được trong một lần.

**Phương pháp**
- 11 ca nhập tay tối thiểu, giống cách giám khảo gõ ca mới: 3 ca thường quy và 8 ca cần chuyển tiếp (3 Chưa rõ thông tin,
  4 Ngoài quy định, 1 Vượt thẩm quyền). Nhãn kỳ vọng viết theo SOP **trước khi** chạy.
- Chạy cùng script [`scripts/qa/compare-rehearsal.ts`](../../scripts/qa/compare-rehearsal.ts) trên hai phiên bản mã nguồn:
  **trước** = commit `33522a0` (13/10), **sau** = nhánh hiện tại. Mỗi ca chạy trên database tạm riêng, không gọi AI.
- "Câu hỏi cụ thể" được kiểm tự động: câu hỏi có số tiền ₫ cụ thể và không yêu cầu "xác minh từ chứng từ gốc" hay "xem danh sách".
- **Giới hạn:** ca do chính đội viết, cùng lúc với việc sửa quy tắc, nên đây là **tập phát triển, không phải đánh giá độc lập**.
  Đánh giá độc lập dùng nhãn của người dùng thực tế (xem `docs/submission/proposal-user-questions.md`).

**Kết quả**

| Chỉ số | Trước (`33522a0`) | Sau |
|---|---|---|
| Ca xử lý đúng (trạng thái và nhóm dừng) | 3/11 | **11/11** |
| Ca thường quy bị chuyển tiếp thừa | 3/3 | **0/3** |
| Ca cần chuyển tiếp bị bỏ sót | 0/8 | 0/8 |
| Ca chuyển tiếp sai nhóm dừng | 4/8 | **0/8** |
| Ca lỗi hệ thống (thuế suất 7% → lỗi 400) | 1/11 | **0/11** |
| Câu hỏi có số tiền cụ thể, không bắt mở lại chứng từ | 1/10 | **8/8** |

Chi tiết từng ca:

| Ca | Nội dung | Kỳ vọng | Trước | Sau |
|---|---|---|---|---|
| R1 | Nước uống 540.000₫, không ghi phương thức/trạng thái MST | Tự xử lý | Chuyển tiếp (thừa) | Tự xử lý |
| R2 | Phí chuyển phát 2.200.000₫, chuyển khoản | Tự xử lý | Chuyển tiếp (thừa) | Tự xử lý |
| R3 | Bảo dưỡng máy lạnh 8.800.000₫, chuyển khoản có UNC | Tự xử lý | Chuyển tiếp (thừa) | Tự xử lý |
| E1 | UPS 12.100.000₫, chưa rõ phương thức thanh toán | Chưa rõ thông tin | Chưa rõ thông tin | Chưa rõ thông tin |
| E2 | Cước di động áp 8% | Ngoài quy định | Chưa rõ thông tin | Ngoài quy định |
| E3 | 10 laptop 330.000.000₫ | Vượt thẩm quyền | Chưa rõ thông tin | Vượt thẩm quyền (+ hỏi trạng thái MST) |
| E4 | Tiếp khách có rượu vang | Ngoài quy định | Chưa rõ thông tin | Ngoài quy định |
| E5 | Tổng in 480.000₫ ≠ 450.000 + 45.000 | Chưa rõ thông tin | Chưa rõ thông tin | Chưa rõ thông tin |
| E6 | Tài trợ giải chạy từ thiện | Ngoài quy định | Chưa rõ thông tin | Ngoài quy định |
| E7 | Thuế suất 7% | Chưa rõ thông tin | Lỗi 400 | Chưa rõ thông tin |
| E8 | Bàn ghế 22.000.000₫ trả tiền mặt | Ngoài quy định | Ngoài quy định | Ngoài quy định |

Ví dụ câu hỏi E1: **trước**: "…cần xác minh Thanh toán: chưa có dữ liệu… A: Xác minh dữ liệu từ chứng từ gốc; hoặc B: Yêu cầu bổ sung chứng từ";
**sau**: "Hóa đơn 12.100.000₫ được thanh toán bằng hình thức nào? A: Chuyển khoản qua ngân hàng (có UNC); hoặc B: Tiền mặt → không được khấu trừ 1.100.000₫ VAT?"

Tái lập (phải chạy với thư mục làm việc là phiên bản cần đo, vì alias `@/` lấy theo tsconfig của thư mục hiện tại — chạy từ gốc repo mới sẽ nạp lẫn mã mới và ra 6/11 thay vì 3/11):

```sh
git worktree add ../before 33522a0
cp scripts/qa/compare-rehearsal.ts ../before/
cd ../before && npm ci
TAX_REFEREE_DATA_DIR=$(mktemp -d) npx tsx compare-rehearsal.ts .      # bản 13/10 → 3/11
cd - && TAX_REFEREE_DATA_DIR=$(mktemp -d) npx tsx scripts/qa/compare-rehearsal.ts .   # bản hiện tại → 11/11
```

Chỉ số "câu hỏi cụ thể" là kiểm tra tự động: câu hỏi có số tiền ₫ và không chứa "chứng từ gốc / xem danh sách / xem xét lại".
Mẫu số khác nhau giữa hai bản (bản cũ hỏi 10 ca, gồm 3 ca thường quy bị hỏi thừa; bản mới hỏi 8 ca).
Kiểm thử tự động tương ứng: `tests/unit/judgeRehearsal.test.ts`.
