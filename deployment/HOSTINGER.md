# Hostinger: cấu hình đã triển khai ngày 11/10/2026

Domain: `limegreen-salamander-517622.hostingersite.com`. Đây là Node.js Web App trên shared hosting, không phải VPS có quyền root/Docker.

## Nguyên nhân và cách khắc phục

1. Pipeline cũ dùng `better-sqlite3` 13.0.3 và rơi vào `node-gyp`; host không có Python trong PATH hoặc bộ compiler. Ghim 12.11.1 có prebuilt Node 22 Linux x64; `npm ci` trên host đã thành công.
2. Build Next tại host báo `spawn ... EAGAIN` do giới hạn tiến trình. Source đã giới hạn `cpus: 1`, tắt webpack build worker. Release chạy từ standalone build đã qua typecheck/acceptance trên local, dependency native được cài riêng trên Linux.
3. Cấu hình Passenger trỏ đúng `hbuilds/current/nodejs/server.js`, một instance. Wrapper `hostinger-bootstrap.cjs` đọc env ngoài release, dùng Python tại `/opt/alt/python311/bin` và dữ liệu bền vững.

## Các vị trí trên server

```text
/home/$SSH_USER/domains/limegreen-salamander-517622.hostingersite.com/
  hbuilds/config/.env             # secret, chmod 600; không đưa vào Git
  hbuilds/versions/<release>/nodejs
  hbuilds/current                 # symlink tới release đang chạy
  public_html/.htaccess           # Passenger routing
  runtime/tax-referee.sqlite      # SQLite WAL
  runtime/artifacts/             # chứng từ nội bộ và demo
  runtime/demo/                  # database phiên demo
  runtime/python/                # PyMuPDF, Pillow, pypdf
```

MVP hiện cho đăng nhập nội bộ bằng cách chọn một trong ba vai trò, không yêu cầu mật khẩu; có thể đổi vai trò trong workspace. Đây là cơ chế trình diễn, không xác minh danh tính. API email/mật khẩu cũ vẫn tương thích với secret riêng trong `hbuilds/config/.env`. Profile live là Vision; worker OCR local chỉ nằm trong Compose dành cho môi trường có Docker.

## Đóng gói và cập nhật

Trên máy local:

```sh
npm ci
npm run typecheck
npm run test:acceptance
npm run build
python3 deployment/pack-hostinger.py /tmp/tax-referee-production.tgz
scp -P "$SSH_PORT" /tmp/tax-referee-production.tgz "$SSH_USER@$SSH_HOST:/home/$SSH_USER/"
```

Tạo release mới trên host, giải nén vào `nodejs`. Dùng Node `/opt/alt/alt-nodejs22/root/usr/bin/node`; cài `npm ci` với PATH tương ứng hoặc dùng dependency của release trước nếu lockfile không đổi. **Không sao chép node_modules macOS**. Tạo symlink `.next/standalone/node_modules` tới `../../node_modules`; tạo `server.js` với `require('./deployment/hostinger-bootstrap.cjs');`, thư mục `tmp` và `tmp/restart.txt`.

Chỉ đổi symlink `hbuilds/current` sau khi bundle và dependencies đã đầy đủ. Restart Passenger bằng cách touch `tmp/restart.txt`, rồi kiểm tra health/Verify/demo. Giữ release trước để rollback; dữ liệu runtime không chuyển theo release. hPanel có thể ghi lại symlink/routing khi redeploy: đồng bộ repository mới trước khi dùng pipeline tự động.

## Kiểm tra sau cập nhật

```sh
curl --fail https://limegreen-salamander-517622.hostingersite.com/api/health
TEST_BASE_URL=https://limegreen-salamander-517622.hostingersite.com npm run test:api
```

Mở `/verify`, chạy 5 ca; kiểm tra 3 thường quy hoàn tất và 2 ngoại lệ thuế bằng 0. Thử thêm XML/PDF/ảnh tổng hợp và xác minh chứng từ nguồn đọc lại được trong đúng phiên. Kiểm tra đăng nhập bằng lựa chọn cả ba vai trò và quyền thao tác của server. Root `/` phải hiển thị UI mới không cần query chống cache, với `Cache-Control: no-store, max-age=0`.

Release `codex-20261011-r17-toast-no-inline-errors` đang chạy. Hostinger đặt `APP_PUBLIC_URL=https://limegreen-salamander-517622.hostingersite.com` trong `hbuilds/config/.env`, để QR dùng domain HTTPS công khai thay vì địa chỉ nội bộ của Passenger. Bản trước `r16-toast-no-inline-errors` và backup SQLite trước migration nằm trên host để rollback.

## Backup, rollback và dọn demo

Dùng SQLite backup API để có snapshot nhất quán khi app đang chạy, rồi sao lưu thư mục artifacts; không chỉ copy file `.sqlite` đang có WAL. Backup cần nằm ngoài `public_html` và có quyền 600/700. Kiểm tra integrity/count/hash trên bản sao trước khi restore. Restore runtime chỉ khi Passenger đã dừng và bản hiện trạng đã được sao lưu.

Rollback mã: đổi `hbuilds/current` về release trước, touch `tmp/restart.txt`, kiểm tra health. Migration 14 thêm cột và không xóa dữ liệu; release trước vẫn đọc được schema.

Preview file demo cũ:

```sh
python3 scripts/ops/cleanup-demo.py /DUONG_DAN/runtime --days 7
```

Chỉ xóa sau khi dừng app: thêm `--apply --offline`. Script không đụng database/chứng từ nội bộ; giữ tối thiểu một ngày. Quota mỗi demo: 100 chứng từ / 100MB, mỗi file 15MB. Nội bộ: 10.000 chứng từ / 1GB; lưu trữ/backup trước khi tăng giới hạn.

## Bằng chứng và giới hạn

HTTPS health, đăng nhập ba vai trò, API smoke, Verify 4/5/15 và ba định dạng đã được kiểm tra trên host. Bản thử ảnh mất khoảng 7,8 giây trong một lần chạy; không đạt mục tiêu ảnh mới dưới 2 giây. Docker OCR worker chưa chạy trên host shared, không có benchmark accuracy độc lập hoặc thử nghiệm ba nhân sự thật.
