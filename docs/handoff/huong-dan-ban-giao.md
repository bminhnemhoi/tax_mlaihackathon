# Hướng dẫn bàn giao — việc cần làm từ 15/10 đến Demo Day 17/10

**Dành cho:** Khánh (merge, deploy, quay video) và Minh (hồ sơ nộp, phối hợp người dùng).
**Đi kèm:** [Báo cáo cải tiến](bao-cao-cai-tien-2026-10-15.md) · [README](../../README.md) · [RUNBOOK](../../RUNBOOK.md) · [Hostinger](../../deployment/HOSTINGER.md)

## Mốc thời gian

| Khi nào | Việc | Ai |
|---|---|---|
| **Ngay hôm nay 15/10** | Merge PR (main công khai còn 3 người dùng bịa → nguy cơ truất quyền) | Khánh |
| 15/10, trước khóa repo | Deploy lên Hostinger, kiểm tra, lưu bằng chứng Verify live | Khánh |
| **15/10, trước 19:00** | Nộp mục câu hỏi người dùng trong Proposal | Minh |
| 15/10 | Quay video 3 phút trên live mới; nộp slide + video lên Drive | Khánh + Minh |
| 16/10, ~13:00 | Nhận phản hồi 3 người dùng → tổng hợp → 1–2 commit cải tiến → cập nhật slide 3/5 → deploy lại | Cả đội |
| 17/10 | Demo Day: live demo 45 · Q&A 35 · track test 20 | Cả đội |

---

## Phần A — Việc của Khánh

### A1. Review và merge PR (hôm nay)
1. Mở PR `feat/track-a-hardening → main` trên GitHub, đọc mô tả và [báo cáo cải tiến](bao-cao-cai-tien-2026-10-15.md).
2. Kiểm tra CI xanh (tab Checks: Ubuntu, Windows, build).
3. Merge bằng **"Create a merge commit"**. **Không chọn "Squash and merge"**, không force-push: lịch sử commit nhỏ là bằng chứng quá trình làm theo thể lệ.
4. Sau khi merge, mở `https://github.com/khanhle1406/Tax-Referee/blob/main/brainstorming/opus-evaluation.md` và xác nhận §6, §7 là bản **đính chính**, không còn tên Trần Thị Mai / Nguyễn Hữu Đức / Lê Hoàng Nam.

### A2. Deploy lên Hostinger
Quy trình gốc ở [deployment/HOSTINGER.md](../../deployment/HOSTINGER.md). Tóm tắt các bước, chạy trên máy local đã checkout `main` sau khi merge:

```sh
git checkout main && git pull
npm ci
npm run typecheck && npm run lint
npm test                                   # kỳ vọng: 16/16 bộ kiểm thử đạt
NODE_OPTIONS=--max-old-space-size=1536 npm run build
python3 deployment/pack-hostinger.py /tmp/tax-referee-production.tgz   # tự ghi .git-commit
scp -P "$SSH_PORT" /tmp/tax-referee-production.tgz "$SSH_USER@$SSH_HOST:/home/$SSH_USER/"
```

Trên host (như các release trước):
1. Tạo `hbuilds/versions/<release-mới>/nodejs`, giải nén gói vào đó.
2. `npm ci` bằng Node `/opt/alt/alt-nodejs22/root/usr/bin/node` (hoặc dùng lại `node_modules` của release trước nếu `package-lock.json` không đổi — nhánh này **không đổi dependency**). Không chép `node_modules` từ máy Windows/macOS.
3. Symlink `.next/standalone/node_modules → ../../node_modules`; tạo `server.js` với `require('./deployment/hostinger-bootstrap.cjs');`, thư mục `tmp`.
4. Bổ sung biến trong `hbuilds/config/.env` (xem bảng dưới).
5. **Sao lưu SQLite trước** (`deployment/backup.sh` hoặc SQLite backup API, kèm thư mục `runtime/artifacts`).
6. Đổi symlink `hbuilds/current` sang release mới, `touch tmp/restart.txt`. **Giữ release cũ để rollback.**

**Biến môi trường** (`hbuilds/config/.env`, chmod 600):

| Biến | Cần? | Ghi chú |
|---|---|---|
| `APP_PUBLIC_URL` | Đã có | Giữ nguyên (QR dùng domain HTTPS công khai) |
| `SHOPAIKEY_API_KEY` | Đã có | Chỉ cần cho đọc ảnh/PDF; Verify không cần |
| `TAX_REFEREE_AUDIT_KEY` | **Nên đặt** | Chuỗi ngẫu nhiên ≥ 32 ký tự, giữ cố định giữa các lần deploy (mất khóa thì chữ ký cũ không kiểm được). VD `openssl rand -hex 32` |
| `TAX_REFEREE_DEMO_PER_HOUR` | **Đặt 200 trước Demo Day** | Mặc định 30 phiên demo mới/giờ/IP. Ở hội trường nhiều người dùng chung một IP → có thể bị 429 |
| `TAX_REFEREE_DEMO_MAX` | Tùy chọn | Trần tổng số phiên demo (mặc định 2000); dọn bằng `scripts/ops/cleanup-demo.py` |
| `TAX_REFEREE_LOOKUP_PER_HOUR` | Tùy chọn | Tra cứu NCC (gọi AI) mỗi tài khoản/giờ, mặc định 60 |
| `LEGAL_WEBHOOK_SECRET` | Chỉ khi dùng webhook | ≥ 24 ký tự. **Không đặt thì webhook trả 503** (đã bỏ khóa mặc định trong mã) |
| `TAX_REFEREE_*_PASSWORD` | Tùy chọn | Chỉ cho đăng nhập nội bộ (`ke-toan@local`, `ktt@local`, `cfo@local`); đặt sau lần chạy đầu vẫn có hiệu lực |

**Thay đổi hành vi cần biết khi deploy:**
- MST công ty mặc định đổi thành `0102030405` (trùng Verify). Database nội bộ cũ giữ policy cũ; **phiên demo mới** (giám khảo dùng) lấy giá trị mới, không cần làm gì thêm.
- Cookie demo cũ của người dùng trước đó sẽ được cấp phiên mới (không còn mở theo cookie tự đặt).
- `middleware.ts` mới chặn POST từ trang khác; nằm sẵn trong bản build, không cần cấu hình.

### A3. Kiểm tra sau deploy (bắt buộc, khoảng 15 phút)
```sh
curl --fail https://limegreen-salamander-517622.hostingersite.com/api/health
# → "commit" phải trùng `git rev-parse HEAD` của main vừa merge; "contractVersion": "referee-contract-2026-10-15"
TEST_BASE_URL=https://limegreen-salamander-517622.hostingersite.com npm run test:api
# → PASS API: demo isolation + 4 seeded cases, ..., answer "1A, 2A", kill switch hold/release.
```
Rồi thử bằng trình duyệt ẩn danh (cả máy tính và điện thoại):
1. Trang chủ → **① Chạy Verify** → **Chạy Verify**: 9/9 PASS, có giờ từng ca → bấm **Tải báo cáo JSON**, lưu thành `docs/evidence/verify-live-2026-10-15.json`, commit + push (bằng chứng live chạy đúng commit).
2. Trang chủ → **② Mở hộp chuyển tiếp — demo riêng** → thấy 4 ca mẫu (0009001–0009004).
3. Mở ca **0009004** (laptop 330 triệu) → đổi vai **CFO** (góc trên) → bảng **Trả lời một lần** gõ `1A, 2A` + lý do → Gửi → "Đã được phê duyệt".
4. Mở ca **0009002** (UPS) với vai **Kế toán trưởng** → trả lời `1B` → hồ sơ "Đã từ chối" (không bị hỏi lại).
5. Gõ lý do → **Hoàn tác** → hồ sơ về "Chờ CFO"; tab **Nhật ký** thấy ai, lúc nào, lý do; mục "Sự kiện hệ thống" cho công tắc dừng.
6. Công tắc **Tự động hóa** (vai KTT/CFO): dừng → nhập 1 ca thường quy → ca chờ duyệt tay → bật lại → ca tự hoàn tất.
7. Điện thoại: quét QR chụp hóa đơn (Tiếp nhận → chụp bằng điện thoại) để chắc QR dùng domain HTTPS.

**Rollback** nếu có lỗi: đổi `hbuilds/current` về release trước, `touch tmp/restart.txt`, kiểm tra `/api/health`. Dữ liệu runtime không đổi theo release; migration mới (20–21) chỉ thêm trigger và bảng phụ, release cũ vẫn chạy được. Lưu ý: nếu đã đặt `TAX_REFEREE_AUDIT_KEY`, bản cũ dùng định dạng chữ ký khác nên `/api/audit?verify=1` sẽ báo không khớp với sự kiện do bản mới ghi — muốn sạch hoàn toàn thì khôi phục cả bản sao lưu SQLite chụp trước khi deploy.

### A4. Quay video 3 phút (sau khi deploy)
Theo [docs/video-script-3-minutes.md](../video-script-3-minutes.md): quay mộc trên **live mới** (kiểm `/api/health` có commit mới trước khi quay), ≤ 3:00, cửa sổ ẩn danh, không lộ key. Thứ tự: Verify 9 ca → thử dữ liệu mới → ca mẫu 0009004 trả lời "1A, 2A" → Nhật ký → Dừng/Hoàn tác → nói rõ giới hạn.

### A5. Ngày 16/10 — vòng phản hồi người dùng (cùng Minh)
1. Chép `docs/evidence/user-study/responses.template.json` → `responses.json`, điền **đúng câu người dùng tự viết** (không điền thay, không ước đoán).
2. `npx tsx scripts/qa/evaluate-user-study.ts docs/evidence/user-study/responses.json > docs/evidence/user-study/report.md` — commit cả hai file.
3. **Commit cải tiến từ phản hồi** (mỗi thay đổi một commit, message trích phản hồi). Việc đã chuẩn bị sẵn sau buổi thử:
   - Thêm từ khóa `TIỆC CƯỚI`, `NGƯỜI THÂN` vào `SCOPE_NOT_COVERED_DEFAULT` (`services/policyEngine.ts`), đổi test ca U2 trong `tests/unit/keywordCoverage.test.ts` từ "giữ ROUTINE" thành "phải ESCALATED", ghi vào `docs/evidence/improvement-trace.csv`. **Chỉ làm sau khi buổi thử kết thúc** (U2 là ca bẫy đã công bố).
   - 1 cải tiến khác lấy từ phản hồi thật (VD câu hỏi khó hiểu, bước thừa).
4. Cập nhật slide 3 và 5: điền các ô `[CẬP NHẬT 16/10]` **chỉ bằng số và trích dẫn thật** (tên + chức danh theo phạm vi đồng ý), dựng lại `.pptx`, deploy lại, chạy lại mục A3.

### A6. Trước Demo Day 17/10
- Đặt `TAX_REFEREE_DEMO_PER_HOUR=200`; sao lưu SQLite bằng `deployment/backup.sh` (hoặc SQLite backup API) trước khi trình diễn.
- Diễn tập: 8 phút theo [docs/judge-cheat-sheet-8-mins.md](../judge-cheat-sheet-8-mins.md) trên live; mời người ngoài tự gõ ca mới.
- Chuẩn bị video dự phòng nếu mạng hội trường kém.
- Q&A: mỗi người nắm chắc một mảng (engine/3 kiểu dừng · audit/HITL · bảo mật/vận hành · số liệu/giới hạn).

---

## Phần B — Việc của Minh
- [x] Mở PR (đã làm cùng tài liệu này).
- [ ] **Trước 19:00 15/10:** chép nội dung [docs/submission/proposal-user-questions.md](../submission/proposal-user-questions.md) vào mục câu hỏi người dùng của Proposal trên Drive.
- [ ] Tải `docs/submission/Tax-Referee-5-slides.pptx` và video lên đúng thư mục nộp bài trên Drive; xóa mọi bản slide/proposal cũ có tên người dùng giả định.
- [ ] Nhắc Khánh merge + deploy hôm nay; kiểm tra lại `/api/health` trên live.
- [ ] 16/10: nhận phản hồi BTC, cùng Khánh làm mục A5. Không điền bất kỳ số liệu/ý kiến nào không do người dùng thật cung cấp.
- [ ] Chuẩn bị Q&A: câu hỏi khó nhất và bằng chứng trong [báo cáo cải tiến](bao-cao-cai-tien-2026-10-15.md) mục 5–6.

---

## Những điều không được làm
- Không squash, không force-push, không viết lại lịch sử git.
- Không bịa, không "làm đẹp" bằng chứng người dùng; ô chưa có dữ liệu ghi "chưa có".
- Không commit file `.env*`, `env_*.local` hay key.
- Không sửa ca U2 (tiệc cưới người thân) trước khi buổi thử 16/10 kết thúc.

## Xử lý sự cố thường gặp
| Hiện tượng | Cách xử lý |
|---|---|
| `npm run build` hết RAM | `NODE_OPTIONS=--max-old-space-size=1536`, đóng bớt ứng dụng |
| Build trên Hostinger báo `spawn EAGAIN` | Không build trên host; build local rồi đóng gói (như trên) |
| `better-sqlite3` đòi node-gyp trên host | Giữ bản đã ghim trong `package-lock.json`, dùng Node 22 của host |
| Giám khảo gặp 429 "quá nhiều phiên demo" | Tăng `TAX_REFEREE_DEMO_PER_HOUR`, restart |
| Thư mục `runtime/demo` quá nhiều file | `python3 scripts/ops/cleanup-demo.py <runtime> --days 1` (xem trước), thêm `--apply --offline` khi đã dừng app |
| `/api/health` hiện commit cũ | Symlink `hbuilds/current` chưa đổi hoặc chưa `touch tmp/restart.txt` |
| Webhook pháp luật trả 503 | Chưa đặt `LEGAL_WEBHOOK_SECRET` (≥ 24 ký tự) |
