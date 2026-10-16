---
name: sprint-4h
description: Quy trình vòng cải tiến 4 giờ của hackathon. Dùng khi người dùng gửi yêu cầu của Ban tổ chức trong vòng thi: hỏi rõ, chia lát nhỏ, làm, phản biện đối kháng, kiểm chứng, ship lên live, kiểm live, chuẩn bị bằng chứng và lời trình bày. Playbook đầy đủ ở docs/handoff/SPRINT-4H-PLAYBOOK.md.
---

# sprint-4h — vòng cải tiến 4 giờ

Mục tiêu: **một lát nhỏ chạy đúng trên live** tốt hơn một bản lớn còn lỗi. Live deploy từ `main` của repo đội
(khanhle1406/Tax-Referee), khoảng 1,5 phút sau khi merge. Người dùng là người bấm merge trên repo đội.

## Mốc thời gian (T = lúc nhận đề)
| Mốc | Việc | Cổng |
|---|---|---|
| T+0:00–0:15 | Đọc đề, nhắc lại yêu cầu bằng 3 câu, hỏi tối đa 3 câu làm rõ, chọn 1 trong các phương án của playbook | Người dùng chốt phạm vi |
| T+0:15–0:25 | Chia 2–4 lát; lát 1 phải demo được một mình. Tạo nhánh `feat/btc-<tên>` từ `origin/main` | Có danh sách lát và tiêu chí xong |
| T+0:25–2:30 | Làm từng lát: test đỏ → sửa → `npm run referee:diff` → commit nhỏ (tiếng Việt, trailer Co-Authored-By) | Mỗi lát xanh trước khi sang lát sau |
| T+2:30–3:05 | Workflow `sprint-verify` (phản biện đối kháng → qa-verifier tuần tự). Sửa blocker | 16/16 bộ, tsc, lint, build xanh |
| T+3:05–3:15 | Mở PR (mẫu trong playbook), CI xanh, người dùng **merge commit** | **Chậm nhất T+3:15** |
| T+3:15–3:30 | `npm run live:check -- --expect-commit <sha>`; đỏ thì revert merge commit ngay | Live xanh |
| T+3:30–4:00 | Bằng chứng (JSON live, số liệu trước/sau), CHANGELOG, lời trình bày 60 giây | Người dùng sẵn sàng demo |

## Lệnh lưới an toàn (chạy tuần tự, máy ít RAM)
```bash
npx tsc --noEmit
npm run lint                       # lỗi trong Python/ cục bộ thì bỏ qua (không thuộc repo)
npm run referee:diff               # 180 ca, ~3 giây — phải KHÔNG ĐỔI, hoặc chỉ đổi đúng ca đã định
npm test                           # 16/16 bộ; thêm test thì tăng minChecks ở scripts/qa/run-all.ts
npm run build                      # một lần, trước khi mở PR
npm run live:check -- --expect-commit <7 ký tự>   # sau khi merge (dùng --no-probes nếu đã chạy nhiều lần)
```
Khi chủ ý đổi hành vi: chạy `npm run referee:diff`, chép danh sách ca đổi vào commit message, rồi `npm run referee:snapshot`.

## Quy tắc
- Không squash, không force-push, không `--no-verify`; merge bằng merge commit. Merge vào `main` repo đội = deploy.
- Không bịa số liệu, trích dẫn, tên người dùng; căn cứ pháp lý theo ngày lập, điều khoản chưa đối chiếu thì chỉ ghi số hiệu.
- Không đọc `env_*`, `.env*`. Tối đa 2 agent nặng song song; không tự khởi động server khi không cần; tắt server mồ côi.
- Đề mơ hồ: làm phương án hẹp nhất thỏa yêu cầu, ghi rõ giới hạn; không mở rộng phạm vi khi chưa có lát chạy được.
- Gần hết giờ mà chưa xanh: ship phần đã xanh (cờ tắt phần dở), nói thật phần còn lại.
