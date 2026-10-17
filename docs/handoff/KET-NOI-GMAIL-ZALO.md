# Bật Gmail và Zalo THẬT cho demo (10 phút)

Mã đã có sẵn: `services/channels/*`. Chỉ cần tài khoản và 5 biến môi trường. **Giá trị chỉ đặt trên máy demo, không gửi vào chat, không commit.**

## 1. Gmail (hộp thư nhận hóa đơn của công ty)
1. Dùng một Gmail riêng cho demo (VD hộp thư kế toán). Vào **myaccount.google.com → Bảo mật → Xác minh 2 bước**: bật.
2. Cùng trang → **Mật khẩu ứng dụng (App passwords)** → tạo một mật khẩu cho "Tax Referee" → nhận chuỗi 16 ký tự.
3. Gmail → Cài đặt → **Chuyển tiếp và POP/IMAP → Bật IMAP**.
4. Đặt biến:
   - `GMAIL_IMAP_USER` = địa chỉ Gmail đó
   - `GMAIL_APP_PASSWORD` = chuỗi 16 ký tự (bỏ dấu cách)
   - `GMAIL_NOTIFY_TO` = email Kế toán trưởng nhận tin tóm tắt (có thể chính hộp thư đó)

## 2. Zalo Bot
1. Mở Zalo → tìm **"Zalo Bot Manager"** (bot.zaloplatforms.com) → tạo bot → nhận **token**.
2. Đặt `ZALO_BOT_TOKEN` = token đó.
3. Dùng Zalo cá nhân **nhắn một tin bất kỳ cho bot** (bot chỉ gửi được cho người đã nhắn nó trước).
4. Chạy `npx tsx --env-file=<file biến của bạn> scripts/ops/channels-check.ts` → dòng "chat id gần đây" hiện chat id của bạn → đặt `ZALO_NOTIFY_CHAT_ID` = chat id đó.
5. Lưu ý: **Zalo Bot chỉ nhận ảnh** (không nhận file XML/PDF). Hóa đơn gửi qua Zalo là ảnh chụp, vào lô để AI đọc 14 trường.

## 3. Cho phép kênh thật trong phiên demo trên máy của đội
Đặt `TAX_REFEREE_ALLOW_REAL_CHANNELS_IN_DEMO=1`. Mặc định hệ thống **chặn** kênh thật trong phiên demo để người lạ không kéo được hộp thư của đội về.

## 4. Kiểm tra trước khi lên sân khấu
```bash
npx tsx --env-file=<file biến của bạn> scripts/ops/channels-check.ts             # phải ra ĐẠT cho Gmail IMAP, SMTP, Zalo
npx tsx --env-file=<file biến của bạn> scripts/ops/channels-check.ts --send-test # nhận được 1 email + 1 tin Zalo thử
```

## 5. Chạy app local có nạp biến
```bash
npm run build
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
PORT=3060 HOSTNAME=127.0.0.1 NODE_ENV=production TAX_REFEREE_DATA_DIR=$(mktemp -d) node --env-file=<file biến của bạn> .next/standalone/server.js
```

## 6. Kịch bản demo kênh thật (60 giây)
1. Vào **Hộp thư vào** (vai Kế toán trưởng) → **Danh bạ người gửi** → thêm email Gmail của một thành viên (và Zalo user id nếu có).
2. Thành viên đó gửi email có đính kèm `data/demo-batch/01-van-phong-pham.xml` tới hộp thư demo.
3. Bấm **"Lấy hóa đơn từ Gmail"** → file hiện nhãn **✓ Nhân viên đã xác thực** → hóa đơn tự vào một lô mới → Kế toán trưởng nhận email/Zalo tóm tắt, người gửi nhận email kết quả.
4. Gửi thử từ một email **không có trong danh bạ** → nhãn **? Ngoài danh bạ**, hệ thống không xử lý cho tới khi Kế toán trưởng xác nhận.
5. Chụp một hóa đơn giấy gửi cho bot Zalo → bấm **"Lấy hóa đơn từ Zalo"** → ảnh vào hàng chờ đọc.
