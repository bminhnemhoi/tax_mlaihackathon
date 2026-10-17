# Kịch bản demo vòng cải tiến — lô dựng sẵn, người chốt, dashboard, Gmail/Zalo (chạy LOCAL)

> Người trình bày cầm bản này lên sân khấu. Slide: `docs/submission/Tax-Referee-trinh-bay-cai-tien-17-10.pptx` (11 trang; Q2 ở slide 5, Q1 ở slide 9; lời nói ở `docs/submission/KICH-BAN-THUYET-TRINH-17-10.md`).
> Video dự phòng (1 phút 24 giây, có giọng đọc): `docs/submission/video/Tax-Referee-demo-1-phut.mp4`. Hỏi đáp phản biện: `docs/submission/HOI-DAP-PHAN-BIEN-17-10.md`.
> Mọi doanh nghiệp, mã số thuế, người gửi trong demo là **dữ liệu mẫu tổng hợp**.

## 0. Khởi động (5 phút trước khi lên)
```bash
npm run demo:local -- --build   # lần đầu hoặc khi vừa đổi mã: build rồi chạy
npm run demo:local              # các lần sau: chạy luôn bản build sẵn có
```
- Mở `http://127.0.0.1:3060`. Lệnh này bật `TAX_REFEREE_DEMO_PRESET_BATCHES=1`: **mỗi phiên demo mới có sẵn 2 lô**, không phải chờ tải file trên sân khấu.
- Gmail/Zalo trong phiên demo chạy **chế độ mô phỏng** (hộp thư và bot giả, màn hình ghi "Mô phỏng · dữ liệu mẫu"). Muốn kênh thật: xem `docs/handoff/KET-NOI-GMAIL-ZALO.md`.
- Mở sẵn 3 tab trước khi lên: trang chủ, `/trust`, `/privacy`.

## Dữ liệu có sẵn trong mỗi phiên
| Lô | Trạng thái | Nội dung |
|---|---|---|
| **Lô cuối tháng 10 · 25 file (Kế toán viên tải lên)** | Đang mở — chưa ghi sổ | 25 file `data/demo-batch/`: **10** máy đề xuất duyệt · **12** cần người quyết · **1** tạm giữ (HĐ 0000120) · **1** không đọc được (`not-an-invoice.xml`) · file trùng được gộp (24 dòng). Có 2 nhóm câu hỏi giống nhau: **3 hóa đơn ủy nhiệm chi**, **2 hóa đơn tiếp khách**. |
| **Lô tuần 2 tháng 10 · 5 hóa đơn (đã chốt)** | Đã chốt | 5 hóa đơn thường quy, Kế toán trưởng đã chốt — để Tổng quan và Lịch sử có số ngay. |
| (ngoài lô) | — | 4 ca mẫu của hộp chuyển tiếp như bản live (1 tự xử lý + 3 kiểu dừng). |

## 1. Lô hóa đơn (60 giây) — vai Kế toán viên
1. Trang chủ → vai **Kế toán viên** → **"② Mở hộp chuyển tiếp — demo riêng"** → menu **Lô hóa đơn**.
2. Chỉ vào danh sách: một lô **Đang mở**, một lô **Đã chốt**. Bấm **Lô cuối tháng 10**.
   > "Cuối tháng chị kế toán kéo cả lô vào. Máy đọc hết, xếp theo mã số thuế, ngày, số hóa đơn rồi kiểm từng tờ. Thứ tự cố định nên kết quả không phụ thuộc file nào đến trước."
3. Chỉ 4 ô số: **Máy đề xuất duyệt · Cần người quyết · Đã duyệt sau khi hỏi · Từ chối/tạm giữ/lỗi**. Kéo xuống: `not-an-invoice.xml` ở "Không đọc được".
   > "Lô đang mở là chưa ghi sổ. Máy chỉ đề xuất."
4. (Muốn cho thấy tải lô thật: nút **"Chọn các file hóa đơn"** → chọn vài file trong `data/demo-batch/`. Tải cả 25 file mất khoảng 20 giây.)

## 2. Vì sao tin, vì sao dừng (45 giây)
- Bấm **HĐ 0000107** (hai thuế suất 8% + 10%): phiếu giải trình liệt kê ✓ từng điều kiện kèm số.
  > "Giống cô giáo chấm bài: đúng hết thì cho điểm, và ghi rõ đúng ở đâu."
- Bấm **HĐ 0000117** (nhóm Cần người quyết): ô đỏ ghi quy tắc, trường bị nghi và VAT đang chờ, kèm câu hỏi có sẵn 2 lựa chọn.

## 3. Người nắm quyền (75 giây) — đổi vai Kế toán trưởng
1. Góc trên đổi vai **Kế toán trưởng** → **Lô hóa đơn** → **Lô cuối tháng 10**.
2. Khung vàng **"Trả lời chung 3 hóa đơn cùng câu hỏi: Xác minh dữ liệu nguồn (ủy nhiệm chi)"** → chọn **A** → lý do (VD "Đã đối chiếu ủy nhiệm chi trên sao kê ngân hàng") → **"Áp dụng cho 3 hóa đơn"**. Ô "Đã duyệt sau khi hỏi" lên **3**.
   > "Ba tờ cùng một câu hỏi, trả lời một lần. Mỗi tờ vẫn được kiểm quyền riêng và ghi nhật ký riêng."
3. Kéo xuống **Chốt lô (người ký trước khi ghi sổ)** → ghi chú ít nhất 8 ký tự → **"Chốt 13 hóa đơn"** → xác nhận.
   > "Máy không tự ghi sổ. Kế toán trưởng ký chốt lô. Hóa đơn còn chờ người quyết không bị ghi sổ. Người tạo lô không tự chốt được; lô có hóa đơn từ 200 triệu đã duyệt thì phải CFO; sổ sách và xuất chứng từ không lấy hóa đơn trong lô chưa chốt."
4. (Nếu giám khảo hỏi "kế toán viên có tự chốt được không": đổi về Kế toán viên → nút chốt không hiện / bị chặn.)

## 4. Sếp và từng người (45 giây)
- **Tổng quan**: "Đang chờ anh/chị quyết định: N hóa đơn — VAT chờ …", hóa đơn đi đâu (máy tự xử lý / có người duyệt / đang chờ / tạm giữ / từ chối), lô đã chốt và chưa chốt. Đổi vai **CFO** để thấy việc của CFO (hóa đơn laptop 330 triệu).
- **Lịch sử của tôi** (vai Kế toán trưởng): các dòng **"Ghi sổ theo lô đã chốt"** kèm lý do vừa ghi, lấy từ nhật ký chỉ ghi thêm.

## 5. Gmail, Zalo và biết ai gửi (45 giây)
- **Hộp thư vào** → thẻ Gmail/Zalo ghi **"Mô phỏng · dữ liệu mẫu"** → bấm **"Lấy hóa đơn từ Gmail"**, rồi **"Lấy hóa đơn từ Zalo"**.
- Kết quả hiện ngay:
  - 2 thư nhân viên **✓ Nhân viên đã xác thực** → máy kiểm, vào một **Lô Gmail (mô phỏng)** mới;
  - 1 thư giả địa chỉ nhân viên nhưng SPF/DKIM trượt → **⚠ Nghi mạo danh**, không xử lý;
  - 1 nhà cung cấp lạ → **? Ngoài danh bạ**, chờ Kế toán trưởng xác nhận;
  - 1 ảnh Zalo của nhân viên → chờ đọc ở Lô hóa đơn; 1 ảnh của người lạ → chờ xác nhận;
  - mục **Tin gửi**: thư tóm tắt cho Kế toán trưởng và thư kết quả cho người gửi, ghi **"Mô phỏng — không gửi thật"**.
  > "Email chỉ được tin là của nhân viên khi qua xác thực SPF/DKIM của Gmail. Cùng địa chỉ mà không xác thực thì ghi nghi mạo danh và không xử lý."
- **Nói trung thực:** "Trong phiên demo đây là hộp thư mô phỏng chạy đúng quy trình thật; kênh Gmail/Zalo thật có mã và script kiểm `npm run channels:check`, bật trên máy của đội bằng biến môi trường."

## 6. Hai câu hỏi của Ban tổ chức
- **Q1 bảo mật** (slide 9): 4 trụ — định danh, đặc quyền tối thiểu, ranh giới thực thi tất định, cách ly → mở `/trust` → **"Chạy 12 phép thử tấn công"**.
- **Q2 lên production** (slide 5): sơ đồ kiến trúc, đánh đổi, lộ trình 30/90 ngày.
- **Riêng tư**: mở `/privacy` "Dữ liệu của bạn đi đâu".

## Nếu sự cố
- **Muốn phiên sạch có lô dựng sẵn:** mở cửa sổ ẩn danh mới (phiên demo mới), hoặc tắt server và chạy lại `npm run demo:local`.
- Server không lên: chiếu video `Tax-Referee-demo-1-phut.mp4` (quay trên chính bản build này).
- Không nói Gmail/Zalo "đang chạy thật" khi thẻ ghi "Mô phỏng".
