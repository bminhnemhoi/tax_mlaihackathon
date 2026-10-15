# Danh mục nộp bài — Tax Referee (khóa bài 15/10/2026)

**Đội:** Fprinciples · **Track:** VNG · **Đề:** A — The Escalation Referee

| | Đường dẫn |
|---|---|
| **Live URL** (không cần tài khoản) | https://limegreen-salamander-517622.hostingersite.com |
| **Verify harness** (một nút, 9 ca, có dấu thời gian) | https://limegreen-salamander-517622.hostingersite.com/verify |
| **Kho mã nguồn công khai** | https://github.com/khanhle1406/Tax-Referee |
| **Runbook** (clone sạch → chạy → kiểm chứng) | https://github.com/khanhle1406/Tax-Referee/blob/main/RUNBOOK.md |
| **Tài liệu quy định (SOP)** | https://limegreen-salamander-517622.hostingersite.com/sop |

## Sáu hạng mục theo thể lệ

| # | Hạng mục | File / nơi nộp | Trạng thái |
|---|---|---|---|
| a | Live URL + dòng hướng dẫn ở trang chủ | Link trên | ✅ Đã triển khai bản mới (15/10). Trang chủ có dòng "Giám khảo: bấm ① … sau đó ②" |
| b | Verify harness + 4 ca kiểm thử dạng bảng + runbook | `4-Verify-harness-va-4-ca-kiem-thu.pdf`, `6-Bang-chung-Verify-live.json`, RUNBOOK | ✅ Chạy trên live 9/9 PASS |
| c | Repo công khai, đủ lịch sử commit | GitHub | ✅ Không squash, không force-push (PR merge bằng merge commit) |
| d | Video demo ≤ 3 phút | `3-Video-demo.mp4` (2:41, 1920×1080) | ✅ Quay trực tiếp trên Live URL; màn mở đầu tóm tắt 6 tính năng nổi bật; giọng đọc AI (nam) và phụ đề |
| e | 5 slide đúng cấu trúc | `2-Slide-5-trang.pptx` (+ bản PDF) | ✅ Ô "[Cập nhật 16/10]" ở slide 3 chờ phản hồi người dùng thật |
| f | Build log 1 trang | `5-Build-log-1-trang.pdf` (+ .docx) | ✅ Đủ 4 ý: công cụ AI, chỗ hiệu quả, chỗ tốn kém, tính năng đã cắt |
| + | Mục câu hỏi người dùng trong Proposal (hạn 19:00 15/10) | `1-Proposal-cau-hoi-nguoi-dung.docx` (+ .pdf) | ⬜ Chép vào Proposal trên Drive |
| + | Tính năng nổi bật (kèm cách tự thử và bằng chứng) | `7-Tinh-nang-noi-bat.pdf` | ✅ 6 tính năng, mỗi tính năng có file chứng minh trong repo |

## Ghi chú minh bạch
- **Video** được quay tự động bằng Playwright trên Live URL ngày 15/10/2026 (thao tác thật trên hệ thống đang chạy, không dựng cảnh); **giọng đọc do AI tạo** (edge-tts, giọng nam vi-VN-NamMinhNeural) và phụ đề in sẵn; lời thuyết minh đã được đối chiếu từng câu với mã nguồn. Video nêu rõ giới hạn của hệ thống ở phần cuối.
- **Số liệu** trên slide và build log là dữ liệu tổng hợp do đội/AI viết, không phải đánh giá độc lập. Kết quả 3 người dùng do BTC điều phối có ngày 16/10; ô tương ứng trên slide chỉ được điền bằng phản hồi thật.
- Đọc ảnh/PDF scan dùng Gemini Vision qua ShopAIKey (đã kiểm với key thật 15/10: ảnh ~14 giây, PDF ~26 giây, luôn cần kế toán kiểm tra lại).

## Kiểm tra trên Live URL ngày 15/10/2026
- `GET /api/verify?mode=judge`: 9/9 PASS (runId `79f02bce-a485-4877-a206-4768bd802aae`).
- Smoke test API (`TEST_BASE_URL=<live> npm run test:api`): đạt — phiên demo có 4 ca mẫu, trả lời "1A, 2A", dừng/hoàn tác, công tắc tự động hóa, bộ lớn cần phiên.
- Playwright trên máy tính và điện thoại 390px: các luồng chính đạt; trang chủ ~1,3–2,2 giây, ca mẫu hiện sau ~0,3 giây.
- Còn thiếu trên live: `/api/health` hiện `commit: unknown` (cần biến `GIT_COMMIT_SHA`) và `hmac: false` (cần `TAX_REFEREE_AUDIT_KEY` để bật chữ ký HMAC cho nhật ký; chuỗi hash vẫn hoạt động).
