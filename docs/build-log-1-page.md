# Build log — Tax Referee (Đề A · The Escalation Referee)

**Đội:** Fprinciples · **Thời gian:** Sprint 1 (19–22/09) và Sprint 2 (28/09–15/10/2026) · **Live:** https://limegreen-salamander-517622.hostingersite.com

## 1. Công cụ AI đã dùng và cách dùng
| Công cụ | Dùng để làm gì |
|---|---|
| **ChatGPT, Claude** (chat) | Brainstorm bài toán, đọc đề, phác SOP và luồng nghiệp vụ kế toán (ghi chú nháp trong `brainstorming/`, không phải bằng chứng) |
| **OpenAI Codex** (cấp trong Sprint 2), **Claude Code** | Viết và refactor mã Next.js/TypeScript, test, tài liệu; mỗi thay đổi được đội đọc lại, chạy test rồi mới commit |
| **Gemini 2.5 Flash Vision** (qua ShopAIKey) | Thành phần **trong sản phẩm**: đọc ảnh/PDF scan hóa đơn. Không tham gia phân loại hay quyết định thuế |
| Claude Code (14–15/10) | Rà soát như giám khảo, sửa lỗ hổng phân quyền, bảng phân loại 3 kiểu dừng, câu hỏi một câu, trả lời "1A, 2B" ngay trên hồ sơ, bộ test chuẩn + CI. Cho nhiều agent phản biện chéo mã nguồn và viết 72 ca "đánh lừa" từ SOP; đội chỉ sửa các lỗi được ít nhất 2 agent xác nhận và tái hiện được bằng test |

## 2. AI giúp nhanh ở đâu
- Dựng khung Next.js + SQLite + workflow có revision/audit trong Sprint 1; sinh fixture tổng hợp và nhiều kịch bản test.
- Rà soát mã diện rộng: tìm được các lỗi đội bỏ sót (ai cũng chuyển được thành CFO, ca không khớp quy tắc nào bị tự duyệt, thuế suất 8% cho cước di động lọt qua, test phụ thuộc file bị gitignore nên clone sạch luôn fail).
- Viết lại câu hỏi chuyển tiếp thành template có số liệu: đo được trên 11 ca diễn tập, câu hỏi cụ thể tăng từ 1/10 lên 8/8.
- Red team bằng agent: 72 ca bẫy viết từ SOP (agent không đọc mã engine) lúc đầu đúng 66/72, lộ lỗi "phạt" bị bỏ sót và kết luận vượt quyền khi số tiền chưa chắc; sau khi sửa đạt 72/72 và trở thành bộ hồi quy trong `npm test`.

## 3. AI gây tốn thời gian / rủi ro ở đâu
- **Commit khổng lồ:** để AI sửa nhiều thứ một lượt tạo ra commit 216 file (+28.859 dòng), khó review, khó chứng minh quá trình. Từ 14/10 đội chuyển sang commit nhỏ theo từng hạng mục.
- **Nội dung bịa:** một bản đánh giá do AI viết khi brainstorm chứa 3 "người dùng thật" có tên và trích dẫn **không có thật**. Đội đã gỡ, ghi đính chính công khai (`brainstorming/opus-evaluation.md` §7) và quy định: không đưa nội dung AI sinh vào bằng chứng.
- **Claim sai:** kịch bản video/RUNBOOK cũ có "0% bỏ sót", "Merkle", điều luật đã hết hiệu lực, tự chấm "10/10 điểm". Đã xóa; mọi số liệu phải có lệnh tái lập.
- **Quá phạm vi:** AI dễ đề xuất thêm module (ngân hàng, ERP, đối soát TCT, crawler luật…) làm loãng Đề A. Các module này được gom vào nhóm "Mở rộng · beta (một phần giả lập)".
- Môi trường: build trên Hostinger bị EAGAIN, phải đóng gói local; máy phát triển thiếu RAM làm build/test có lúc bị OOM.

## 4. Tính năng lớn nhất đã cắt và lý do
**Tích hợp thật với ERP/ngân hàng/Cổng thuế (tự hạch toán, tự đối soát sao kê, tự nộp tờ khai).** Lý do: không có môi trường và dữ liệu thật để
kiểm chứng trong thời gian thi; làm giả sẽ vi phạm nguyên tắc "không khẳng định điều chưa chứng minh". Đội dồn thời gian vào lõi Đề A:
quyết định đúng lúc dừng, câu hỏi một câu, audit/dừng/hoàn tác. Các màn hình liên quan chỉ giữ ở mức xuất payload/demo và ghi rõ.
Cũng đã cắt **chữ ký số trên hồ sơ giải trình PDF** (cần chứng thư số thật).

## 5. Kiểm chứng
`npm test`: 16/16 bộ (32 unit test node:test + 15 bộ hồi quy gồm 72 ca red team, mỗi bộ trên database tạm, có số kiểm tra tối thiểu để không "PASS" khi thoát sớm); CI GitHub Actions (Ubuntu + Windows) chạy khi đẩy mã lên `main`/`feat/**` và khi mở PR — xanh cả 3 job (Ubuntu, Windows, build): https://github.com/khanhle1406/Tax-Referee/actions/runs/38613527917; smoke test HTTP trên bản build production (`npm run test:api`): phiên demo có ca mẫu, trả lời "1A, 2A", công tắc dừng; Verify 9 ca có dấu thời gian;
11 ca diễn tập giám khảo trước/sau: `docs/evidence/before-after-judge-rehearsal-2026-10-14.md`. Dữ liệu là tổng hợp; đánh giá với người dùng thật đang thực hiện.
