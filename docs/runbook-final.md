# Runbook Chung kết Đề A

> 📌 **Ảnh chụp lịch sử** — số liệu và tên quy tắc trong file này có thể đã cũ. Số liệu hiện hành: [README](../README.md), trang `/verify`, `/sop` và `docs/evidence/`.


## Clone sạch và kiểm tra

Yêu cầu: Node 22, npm; Python 3 + PyMuPDF + Pillow cho PDF/ảnh. Chạy từ thư mục repo:

```sh
npm ci
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm start
```

Verify chạy bằng quy tắc tất định, không cần AI key. Mở `/verify`, chế độ mặc định chạy 9 ca (4 ca chung + 5 ca Đề A) kèm thời điểm từng ca; có thể chọn riêng 4 / 5 / 15 / 60 ca. Ba tập có ca trùng nhau; không cộng thành 24 ca độc lập. Fixture là dữ liệu tổng hợp; MST thử nghiệm 0102030405. Bộ 5 gồm 3 thường quy và 2 chuyển tiếp. MST sai được giữ ở ca âm riêng.

Trang đầu → “② Mở hộp chuyển tiếp — demo riêng” mở phiên demo riêng, không cần tài khoản (mặc định vai Kế toán viên). Mỗi phiên có database riêng; cookie 8 giờ. Chỉ trong demo mới đổi được vai trò mô phỏng. Database demo lưu trên volume; tối đa 200 kết nối mở (`TAX_REFEREE_DEMO_CACHE`), quá ngưỡng thì đóng phiên ít dùng nhất thay vì từ chối người mới. Cần dọn file demo/artifact hết hạn theo chính sách lưu trữ sau đợt thi. Khi tải hóa đơn mới, sử dụng MST người mua theo policy của workspace (mặc định 0100109106), không theo MST fixture Verify.

## Triển khai VPS

1. Cài Docker Compose, Nginx, Certbot; cấu hình DNS tới VPS.
2. Tạo `.env.production` từ `.env.example`; đặt mật khẩu 3 tài khoản nội bộ (`TAX_REFEREE_*_PASSWORD`) và `GIT_COMMIT_SHA` (hiện ở `/api/health` và Verify). AI key chỉ đặt phía server. Đặt `TAX_REFEREE_DATA_DIR=/app/data/runtime`, `TAX_REFEREE_DB_PATH=/app/data/runtime/tax_referee.db`. Không đưa file này vào Git.
3. `docker compose up -d --build` rồi `curl --fail http://127.0.0.1:3000/api/health`.
4. Thay domain mẫu trong `deployment/nginx.conf`, cấp chứng chỉ trước khi bật khối HTTPS, kiểm tra `nginx -t` rồi reload.
5. Kiểm tra `/api/health`, `/verify` và nhập mới qua domain HTTPS. Giới hạn 15MB và 30 request/phút/IP được đặt ở Nginx. Node chỉ bind host loopback qua Compose.

Docker đã đóng gói Python/PyMuPDF/Pillow/Poppler; tối ưu ảnh dùng Pillow trên Linux. Docker image và cấu hình HTTPS cần được xác nhận trên VPS thực; máy phát triển chưa chứng minh triển khai thành công.

Kiểm thử standalone tại máy: `NEXT_BUILD_DIR=.next-production npm run test:recovery` sau build. Test tự dùng dữ liệu tổng hợp trong thư mục tạm, kiểm tra restart và offline snapshot/restore; không thay thế kiểm thử Docker/VPS.

## Backup và restore

`./deployment/backup.sh backups` dừng service ngắn hạn, sao lưu toàn bộ runtime gồm DB/WAL/chứng từ, sau đó tự khởi động lại. Giữ ít nhất bản trước khi khóa bài và bản sau diễn tập.

Restore vào volume trống hoặc sau khi đã lưu bản hiện trạng:

```sh
docker compose stop app
docker compose run --rm --no-deps --user root -v "$PWD/backups:/backup:ro" app tar xzf /backup/TEN_BAN_SAO_LUU.tar.gz -C /app/data
docker compose run --rm --no-deps --user root app chown -R node:node /app/data/runtime
docker compose start app
```

Xác nhận health, invoice revision, audit, voucher và mở lại chứng từ. Ghi thời điểm/filename/kết quả vào biên bản; chưa chạy thử restore thực thì không đánh dấu đạt.

## Diễn tập 90 giây và 8 phút

- 0–90s: trang đầu → Verify 5 ca → PASS 5/5; 3 chứng từ được tạo, 2 ngoại lệ thuế được duyệt bằng 0; đọc câu hỏi/người nhận.
- 90–180s: giám khảo nhập JSON mới hoặc tiếp nhận file; thử thiếu dữ liệu; giải thích trường chưa xác minh.
- 180–300s: chi tiết ngoại lệ → bổ sung dữ liệu/bằng chứng → đánh giá lại; sửa sai tổng tiền phải vẫn bị chặn; KTT không duyệt vượt thẩm quyền.
- 300–420s: dừng/tiếp tục/giữ thuế/hoàn tác; reload rồi kiểm tra nhật ký, chứng từ, tổng hợp.
- 420–480s: tiền lệ giới hạn và phản hồi hậu kiểm; công bố nguồn tổng hợp, phạm vi adapter, dữ liệu đo thật còn thiếu.

## Đánh giá tập độc lập

Sau khi nhân sự gán nhãn ít nhất 20 ca, đổi status thành `LOCKED` và thêm `companyTaxCode` theo doanh nghiệp thử nghiệm. Mỗi ca có invoice đầy đủ, expectedStatus/riskGroup/requiresCFO, rationale/labeledBy/labeledAt. Chạy:

```sh
npm run evaluate:independent -- docs/evidence/independent-labels.json > docs/evidence/independent-report.json
```

Runner từ chối tập trống hoặc chưa khóa. Không ghi đè báo cáo đã chốt mà không lưu bản cũ.

## Phân định thực và giả lập

Thực: SQLite, quy tắc phân luồng, revision, audit, voucher nội bộ, parser XML, API OCR nếu có key và nguồn hỗ trợ. Verify luôn local.

Chưa chứng minh trực tiếp: độ chính xác OCR trên tập độc lập, nộp tờ khai, kết nối ERP/ngân hàng/TCT, tự cập nhật luật. Adapter xuất payload không đồng nghĩa đã hạch toán ERP. Các màn hình mở rộng và số liệu nền là demo, không phải bằng chứng nghiệp vụ thực tế.

## Cập nhật nghiệm thu 10/10/2026

Bản HTTPS đã được triển khai tại `https://limegreen-salamander-517622.hostingersite.com`. Host là shared hosting Node/Passenger; xem [runbook riêng](../deployment/HOSTINGER.md) cho bundle build local, dependency Linux, env ngoài release và vị trí runtime.

Đã chạy API smoke live, Verify 4/4–5/5–15/15, đăng nhập ba vai trò và upload XML/PDF/PNG tổng hợp. Bản sao SQLite nội bộ/demo đọc lại được, integrity `ok`; đây là xác minh snapshot, chưa phải phục hồi toàn bộ môi trường từ sự cố host. Standalone local đã kiểm tra restart, lượt đánh giá bị gián đoạn hết hạn và retry, offline restore kèm chứng từ.

Compose đã thêm worker OCR riêng với warm-up/health; host shared hiện dùng Vision. Không lấy kết quả một ảnh tổng hợp làm benchmark độc lập. Không chạy dọn demo khi app còn mở kết nối; dùng `cleanup-demo.py` preview trước, `--apply --offline` sau khi dừng app.

Nhãn độc lập bổ sung `lockedAt`, `provenance` cho từng ca, và `trainingInvoiceHashes` nếu có tập dùng hiệu chỉnh bên ngoài fixture. Runner kiểm tra ca trùng/tập học trùng, ngày nhãn trước lúc khóa, xuất run ID, mã băm file nhãn/policy/code và ERROR riêng. Câu hỏi trong báo cáo cần người chấm mù theo rubric; runner chưa chứng minh điểm chất lượng câu hỏi.
