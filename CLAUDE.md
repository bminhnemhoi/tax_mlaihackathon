# Tax Referee — hướng dẫn cho trợ lý AI (Claude Code)

Trọng tài thuế GTGT đầu vào cho hóa đơn điện tử Việt Nam (MLAI Hackathon 2026 · Track VNG · Đề A "The Escalation Referee").
**Quy tắc tất định quyết định; AI chỉ đọc chứng từ.** Live: https://limegreen-salamander-517622.hostingersite.com · Repo: khanhle1406/Tax-Referee.

> **Demo Day 17/10:** nếu người dùng là Khánh hoặc hỏi "cần làm gì", đọc và tóm tắt `docs/handoff/BAN-GIAO-DEMO-DAY-17-10.md` trước tiên.
> **Vòng cải tiến 4 giờ:** khi người dùng gửi yêu cầu của Ban tổ chức, dùng skill `sprint-4h` — playbook `docs/handoff/SPRINT-4H-PLAYBOOK.md`, sổ tay `docs/handoff/SPRINT-4H-COOKBOOK.md`.

## Luật cứng (không ngoại lệ)
- **Bí mật:** không đọc, in hay commit `env_*`, `.env*` (trừ `.env.example`); chỉ được nhắc TÊN biến. Hook `.claude/hooks/guard.mjs` chặn các lệnh vi phạm.
- **Lịch sử git là bằng chứng chấm thi:** không squash, không force-push, không `--no-verify`; mỗi thay đổi một commit nhỏ, message tiếng Việt, kết thúc bằng trailer Co-Authored-By. Làm trên nhánh riêng → PR (reviewer `khanhle1406`) → Khánh merge bằng merge commit. **Merge vào `main` = deploy production** (hPanel tự deploy).
- **Không bịa bằng chứng người dùng** (tên, chức danh, trích dẫn, số liệu). Ô `[CẬP NHẬT …]` chỉ điền bằng dữ liệu thật.
- **Thể lệ:** đúng 5 slide. Tài liệu nộp viết tiếng Việt có dấu.
- **Pháp lý:** căn cứ chọn theo NGÀY LẬP hóa đơn (`lib/legalBasis.ts`); văn bản chưa đối chiếu nguyên văn thì không ghi số điều.
- **Máy dev ít RAM:** chạy kiểm chứng tuần tự; tối đa 2 agent nặng song song; agent không tự khởi động server; tắt server `.next/standalone/server.js` mồ côi sau khi test UI.

## Bản đồ kiến trúc
| Lớp | Mã |
|---|---|
| Nạp chứng từ (XML tất định, lớp chữ PDF, ảnh → Vision) | `app/api/documents/parse/route.ts`, `lib/documentParser.ts`, `services/geminiService.ts` (`VISION_ALLOWED_KEYS`) |
| Quyết định tất định, 3 kiểu dừng | `services/policyEngine.ts`, `lib/riskTaxonomy.ts`, `lib/legalBasis.ts`, `data/policyContract.ts` |
| Workflow, thẩm quyền, hoàn tác, hậu kiểm | `services/workflowService.ts`, `services/postAuditService.ts`, `services/automationControl.ts` |
| Câu hỏi chuyển tiếp "1A, 2B" | `services/questionBuilder.ts`, `services/handoffService.ts` |
| Policy (bốn mắt) | `services/policyService.ts`, `app/api/policy/route.ts` |
| Nhật ký chống sửa | `lib/server/audit.ts` (SHA-256 + HMAC + điểm neo + `TAX_REFEREE_AUDIT_SIGNED_SINCE`) |
| Định danh, quyền, cách ly | `lib/server/auth.ts`, `lib/server/db.ts` (mỗi phiên demo một SQLite; `runIsolated`), `lib/capabilities.ts`, `middleware.ts` |
| Ngân sách AI (OWASP LLM10) | `lib/server/aiBudget.ts` |
| Bằng chứng bảo mật trực tiếp | `/trust` ← `services/securityProbeService.ts` (12 phép thử) · `/api/health` (`ai`, `warnings`) |

## Kiểm chứng (chạy TUẦN TỰ — skill `verify-all`)
```bash
npx tsc --noEmit          # typecheck
npm run lint
npm test                  # 16 bộ (scripts/qa/run-all.ts); bộ unit có minChecks — thêm test thì tăng minChecks
npm run build             # một lần, cuối cùng
```
Test đơn lẻ: `TAX_REFEREE_DATA_DIR=$(mktemp -d) NODE_ENV=test node --import tsx --test tests/unit/<file>.test.ts`.
Test mới viết bằng `node:test` trong `tests/unit/`, dùng `runIsolated` (DB `:memory:`) và `forceLocalOnly: true` (không gọi mạng).

## Agent chuyên gia (`.claude/agents/`)
`security-reviewer` (4 trụ + OWASP LLM) · `tax-domain-reviewer` (căn cứ pháp lý theo ngày) · `qa-verifier` (kiểm chứng tuần tự) · `docs-claims-auditor` (mọi câu trong tài liệu khớp mã).
