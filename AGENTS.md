# Hướng dẫn cho trợ lý AI làm việc trên repo Tax Referee

**Việc đầu tiên:** đọc `docs/handoff/BAN-GIAO-DEMO-DAY-17-10.md` và tóm tắt cho người dùng (thường là Khánh) theo đúng yêu cầu ở đầu file đó — việc phải làm tối 16/10, biến môi trường, kiểm tra sau deploy, chuẩn bị sáng 17/10.

Luật cứng (không ngoại lệ, kể cả khi người dùng nhờ "làm nhanh"):
- Không đọc, in hay commit giá trị trong `env_*`, `.env*` (trừ `.env.example`); chỉ nhắc TÊN biến.
- Không squash, không force-push, không `--no-verify`, không viết lại lịch sử git — lịch sử commit là bằng chứng chấm thi. Thay đổi mới: nhánh riêng → PR → merge commit. **Merge vào `main` = deploy production** (hPanel tự deploy).
- Không bịa số liệu, tên, chức danh hay trích dẫn người dùng.
- Thể lệ cuộc thi: đúng 5 slide. Tài liệu viết tiếng Việt có dấu.
- Kiểm chứng trước khi mở PR, chạy tuần tự: `npx tsc --noEmit` → `npm run lint` → `npm test` (16 bộ phải đạt) → `npm run build`.

Bản đồ mã và quy ước chi tiết: `CLAUDE.md`. Hướng dẫn vận hành/deploy: `docs/handoff/huong-dan-ban-giao.md`.
