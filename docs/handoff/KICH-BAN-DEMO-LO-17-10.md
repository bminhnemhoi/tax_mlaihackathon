# Kịch bản demo vòng cải tiến — xử lý theo lô, người chốt, dashboard (chạy LOCAL)

> Người trình bày đọc trên sân khấu. Slide: `docs/submission/Tax-Referee-trinh-bay-cai-tien-17-10.pptx` (19 trang, lời nói nằm trong phần ghi chú).
> Video dự phòng 1 phút: `docs/submission/video/Tax-Referee-demo-1-phut.mp4`. Dữ liệu demo: `data/demo-batch/` (25 XML, dữ liệu tổng hợp).

## 0. Khởi động (5 phút trước khi lên)
```bash
npm run build                                   # nếu chưa build bản mới nhất
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
PORT=3060 HOSTNAME=127.0.0.1 NODE_ENV=production TAX_REFEREE_DATA_DIR=$(mktemp -d) node .next/standalone/server.js
```
Mở `http://127.0.0.1:3060`. Muốn bật Gmail/Zalo thật thì đặt trước các biến `GMAIL_IMAP_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_NOTIFY_TO`, `ZALO_BOT_TOKEN`, `ZALO_NOTIFY_CHAT_ID` (giá trị đặt ở máy, không ghi vào repo). Muốn dùng LLM demo cho ảnh: `DEV_LLM_ENABLED=1` cùng `DEV_LLM_BASE_URL`, `DEV_LLM_API_KEY`, `DEV_LLM_MODEL`.

## 1. Lô hóa đơn (90 giây)
1. Trang chủ → vai **Kế toán viên** → **"② Mở hộp chuyển tiếp — demo riêng"**.
2. Menu **Lô hóa đơn** → **"Chọn các file hóa đơn"** → chọn cả 25 file trong `data/demo-batch/`.
   > "Cuối tháng chị kế toán có hàng chục hóa đơn. Chị kéo cả lô vào. Máy đọc hết, xếp theo MST, ngày, số rồi kiểm từng tờ — thứ tự cố định nên kết quả không phụ thuộc file nào đến trước."
3. Chỉ 4 ô số: **Máy đề xuất duyệt · Cần người quyết · Đã duyệt sau khi hỏi · Từ chối/tạm giữ/lỗi**. Chỉ file `not-an-invoice.xml` nằm ở "Không đọc được" và file trùng không tạo bản thứ hai.
   > "Lô đang mở — chưa ghi sổ. Máy chỉ đề xuất."

## 2. Vì sao tin, vì sao dừng (45 giây)
- Bấm **HĐ 0000107** (hai thuế suất 8% + 10%): danh sách ✓ từng điều kiện kèm số.
  > "Giống cô giáo chấm bài: đúng hết thì cho điểm, và ghi rõ đúng ở đâu."
- Bấm một tờ **Cần người quyết** (VD thuê văn phòng 8%): ô đỏ ghi quy tắc, trường bị nghi và VAT đang chờ.

## 3. Người nắm quyền (75 giây)
1. Đổi vai **Kế toán trưởng** (góc trên) → **Lô hóa đơn** → chọn lô.
2. Khung vàng **"Trả lời chung 3 hóa đơn cùng câu hỏi"** (đã có ủy nhiệm chi chưa?) → chọn **A** → lý do → **"Áp dụng cho 3 hóa đơn"**.
   > "Ba tờ cùng một câu hỏi, trả lời một lần. Mỗi tờ vẫn được kiểm quyền riêng và ghi nhật ký riêng."
3. Kéo xuống **Chốt lô** → ghi chú → **"Chốt N hóa đơn"** → xác nhận.
   > "Đây là chỗ giám khảo hỏi: máy không tự ghi sổ. Kế toán trưởng ký chốt lô. Người tạo lô không tự chốt được; lô có hóa đơn từ 200 triệu thì phải CFO."

## 4. Sếp và từng người (45 giây)
- **Tổng quan**: "Đang chờ anh/chị quyết định: N hóa đơn — VAT chờ …", tỉ lệ máy tự xử lý / người duyệt, lý do dừng nhiều nhất, theo người gửi.
- **Lịch sử của tôi**: ai cũng xem lại việc mình đã làm và hóa đơn mình đã gửi.

## 5. Gmail, Zalo và biết ai gửi (45 giây)
- **Hộp thư vào**: thẻ Gmail/Zalo (đã kết nối/chưa cấu hình), **"Lấy hóa đơn từ Gmail"**, bảng file nhận được với nhãn người gửi.
  > "Email chỉ được tin là của nhân viên khi qua xác thực SPF/DKIM. Cùng địa chỉ mà không xác thực thì ghi 'nghi mạo danh' và không xử lý. Người ngoài danh bạ phải được Kế toán trưởng xác nhận."
- Nếu đã cấu hình Gmail: một thành viên gửi `01-van-phong-pham.xml` từ email đã có trong **Danh bạ người gửi** → bấm lấy thư → hóa đơn vào lô mới, Kế toán trưởng nhận tin tóm tắt.

## 6. Hai câu hỏi của BTC (dùng slide 10–14)
- **Q1 bảo mật**: 4 trụ — định danh, đặc quyền tối thiểu, ranh giới thực thi tất định, cách ly — mở `/trust` → **"Chạy 12 phép thử tấn công"** → 12/12. Câu trả lời dài: `docs/handoff/the-nhac-thuyet-trinh-17-10.md` mục A.
- **Q2 kiến trúc**: 7 lớp, thật/giả lập, 3 đánh đổi, lộ trình D0/30/90 — mục B của thẻ nhắc.
- **Riêng tư**: mở `/privacy` "Dữ liệu của bạn đi đâu".

## Nếu sự cố
- Server không lên: chiếu video `Tax-Referee-demo-1-phut.mp4` (quay trên chính bản build này).
- Muốn làm lại từ đầu: tắt server, chạy lại lệnh ở mục 0 (thư mục dữ liệu tạm mới = phiên sạch).
- Không nói Gmail/Zalo "đang chạy thật" nếu chưa đặt biến môi trường trên máy demo.
