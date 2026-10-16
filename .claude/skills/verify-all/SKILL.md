---
name: verify-all
description: Kiểm chứng toàn bộ Tax Referee trước khi mở PR hoặc deploy — typecheck, lint, 16 bộ test, build, và (tùy chọn) Playwright trên bản build standalone. Chạy tuần tự để không treo máy ít RAM.
---

# verify-all

Chạy lần lượt, dừng ở bước đầu tiên lỗi và báo nguyên văn lỗi:

```bash
export NODE_OPTIONS=--max-old-space-size=1536
npx tsc --noEmit
npm run lint
npm test                      # 16/16 bộ phải đạt
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

## Kiểm UI (khi thay đổi giao diện hoặc API)
1. `rm -rf .next/standalone/.next/static .next/standalone/public && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public`
2. Chạy nền: `PORT=3060 HOSTNAME=127.0.0.1 NODE_ENV=production TAX_REFEREE_DATA_DIR=<thư mục tạm> node .next/standalone/server.js`
3. `BASE=http://127.0.0.1:3060 python scratch/ui-check/ui_trust.py` và `python scratch/ui-check/ui_finals.py` (các script Playwright nằm trong `scratch/`, không commit).
4. **Tắt server** theo cổng, rồi dọn mọi tiến trình `.next/standalone/server.js` còn sót.

## Sau deploy (live)
- `curl -s https://limegreen-salamander-517622.hostingersite.com/api/health` → `hmac: true`, `warnings: []`, commit đúng, `ai.decisionPathLlmCalls: 0`, `audit.events` không giảm so với trước deploy.
- `/verify` 9/9; `/trust` → "Chạy 12 phép thử tấn công" 12/12.

Báo cáo: bảng bước → kết quả → số liệu. Không tuyên bố "đạt" nếu chưa chạy.
