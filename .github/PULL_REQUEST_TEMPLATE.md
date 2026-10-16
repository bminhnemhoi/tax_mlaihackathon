## Mục đích

<!-- Thay đổi gì, vì sao. Liên kết issue nếu có (Closes #...). -->

## Thay đổi chính

-

## Kiểm chứng

- [ ] `npm run typecheck` và `npm run lint` sạch
- [ ] `npm test` — 16/16 bộ đạt (thêm test unit thì đã tăng `minChecks` trong `scripts/qa/run-all.ts`)
- [ ] `npm run build` đạt
- [ ] Đã thử trên giao diện, nếu đổi UI (ghi trang và vai trò đã thử)

## Rủi ro và ảnh hưởng

- [ ] Có đổi quyết định của engine (`services/policyEngine.ts`, `lib/legalBasis.ts`)? Nếu có: ca nào đổi kết quả, căn cứ theo ngày lập hóa đơn
- [ ] Có chạm workflow, xác thực, đọc chứng từ, nhật ký hoặc policy? Nếu có: test hồi quy bảo mật đã thêm
- [ ] Tài liệu, README, `/trust` vẫn khớp mã sau thay đổi

## Lưu ý merge

- Merge bằng **Create a merge commit** (không squash, không rebase).
- Repo này không deploy. Thay đổi cần lên bản live phải được merge ở [repo gốc của đội](https://github.com/khanhle1406/Tax-Referee) — ở đó merge vào `main` = deploy production: chờ 2–5 phút rồi kiểm `/api/health` (commit), `/verify` (9/9), `/trust` (12/12).
