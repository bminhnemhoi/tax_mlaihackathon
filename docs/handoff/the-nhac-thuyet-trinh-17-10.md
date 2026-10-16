# Thẻ nhắc thuyết trình — trả lời Q1 và Q2, Demo Day 17/10/2026

> Dành cho người trình bày của đội (Khánh, Minh…). Đọc cùng `docs/handoff/BAN-GIAO-DEMO-DAY-17-10.md`. Bản xem trên điện thoại: https://claude.ai/artifact/MaXwKPW3H6oRbCdSVjW1ua (riêng tư — Minh chia sẻ link).
> Mọi câu về hệ thống đều đối chiếu với mã của PR #6 `feat/demo-day-security` (đỉnh `98ea813`) và tài liệu PR #7 `docs/demo-day-q1-q2`. Tài liệu chỉ ghi tên file và tên hàm, không ghi số dòng, để không bị lệch khi mã thay đổi.
> Nguyên tắc: không đưa ra số nào ngoài mã. Không có số liệu buổi thử người dùng. Không nói "tuân thủ" chuẩn nào; OWASP/NIST chỉ là **chuẩn tham chiếu tự nguyện**.

---

## 0. Kiểm tra 5 phút trước khi lên sân khấu

| Kiểm | Kỳ vọng | Nếu không đạt |
|---|---|---|
| `GET /api/health` | `audit.hmac: true` · `warnings: []` · `commit` khác `"unknown"` và trùng merge commit PR #6 trên GitHub · `ai.decisionPathLlmCalls: 0` | Nếu `hmac:false` hoặc có `audit_key_missing`, nói thẳng: "khóa audit chưa bật trên live; đây chính là lỗi cấu hình fail-open mà `/api/health` được thiết kế để làm lộ ra". Không nói "HMAC đang bật". |
| `/trust` → bấm **"Chạy 12 phép thử tấn công"** | Dòng `12/12 đạt · … ms · commit …` | Nếu trang 404 (PR #6 chưa lên live) thì mục C3 cũng không lấy được từ live. Khi đó chạy `node --import tsx --test tests/unit/securityProbes.test.ts` trên máy (hoặc dùng video dự phòng) và nói "đã có trên nhánh, cùng hàm chạy trong CI". |
| Bằng chứng dự phòng | Đã lưu theo mục C3, ngay sáng 17/10 | Không có thì dùng video dự phòng (bàn giao mục A6). |
| Cuối trang `/trust` | Hai link "mô hình mối đe dọa" và "kiến trúc và lộ trình production" trỏ tới `github.com/khanhle1406/Tax-Referee/blob/main/...` | Hai file `docs/security/threat-model.md` và `docs/architecture/demo-to-production.md` nằm trong PR #7. Chỉ bấm khi PR #7 đã merge vào `main` và mở thử không bị 404. |
| Giới hạn tần suất | `/api/security/probes` cho chạy tối đa 10 lần trong 10 phút mỗi người dùng | Không bấm thử liên tục ngay trước giờ lên. |

### Số liệu được phép nói (đều lấy từ mã)

| Nói | Nguồn trong mã |
|---|---|
| Đường quyết định: **0** lần gọi LLM | `aiRuntimeInfo` (`lib/server/runtimeInfo.ts`); `queryJevReferee` trả về ngay kết quả của `evaluateInvoiceLocally` khi QGEN tắt (`services/jevService.ts`) |
| Nạp một ảnh hoặc PDF scan: tối đa **1** lần gọi Vision (timeout **35 giây**) và tối đa **2** lần tra cứu có trích dẫn, gói trong **18 giây**. Tổng `ingestionMaxLlmCalls = 3` | `VISION_TIMEOUT_MS` (`services/geminiService.ts`); `GROUNDING_BUDGET_MS`, `GROUNDING_MAX_CALLS` (`services/officialSupplierLookupService.ts`) |
| Con số **3,5 giây** chỉ áp dụng cho AI diễn đạt câu hỏi. Tính năng này **tắt mặc định** (`QGEN_AI`) | `QGEN_TIMEOUT_MS`; `isGroundedQuestion` (`services/questionGuard.ts`) |
| Nội dung XML được đọc tất định, **không qua AI**; DOCTYPE/ENTITY bị từ chối. Riêng tên và MST bên bán vẫn có thể đi tra cứu grounding khi chưa có bản ghi cục bộ | `parseXml` (`lib/documentParser.ts`); `resolveSupplierIdentity` |
| Agent đọc ảnh chỉ được khai **14** trường nhìn thấy | `VISION_ALLOWED_KEYS`, `filterVisionInvoice` |
| **8** principal, **20** quyền | `PRINCIPALS`, `CAPABILITIES` (`lib/capabilities.ts`) |
| **12** phép thử, chia theo 4 trụ | `services/securityProbeService.ts` |
| Workflow chỉ nhận **7** tên thao tác | `WORKFLOW_ACTIONS` (`services/workflowService.ts`) |
| Ngân sách AI mặc định: 60 lần đọc ảnh/giờ mỗi người, 600/giờ toàn tiến trình; 60 lần tra cứu/giờ mỗi phiên, 300/giờ toàn tiến trình. Vượt trần thì không gọi AI (fail-closed) | `AI_BUDGET_DEFAULTS` (`lib/server/aiBudget.ts`) |
| Hậu kiểm **10%** số ca máy tự duyệt; **gấp 3** khi số tiền nằm trong khoảng 15% sát dưới một ngưỡng | `DEFAULT_POST_AUDIT_RATE`, `stratifiedRate` (`services/postAuditService.ts`) |
| Hạn mức KTT mặc định **200 triệu**; từ mức này trở lên là ca của CFO | `kttApprovalLimit` (`services/policyEngine.ts`) |
| Upload tối đa 15 MB (413); cookie phiên demo sống 8 giờ; mỗi phiên một file SQLite | `app/api/documents/parse/route.ts`; `app/api/demo/session/route.ts`; `withDemoDatabase` (`lib/server/db.ts`) |

### Không nói

- "Tối đa 1 lời gọi LLM, khoảng 3,5 giây" cho khâu nạp chứng từ: câu này sai.
- "Parser PDF đã sandbox": chưa. Chỉ được nói "tiến trình đọc PDF không thừa hưởng biến bí mật" (`pdfChildEnv`, commit `1d4b8d9`) — vẫn cùng máy, cùng UID.
- "Ca từ 200 triệu luôn sang CFO" như một bảo đảm trước agent bị chiếm. Câu này chỉ đúng với **số tiền đã ghi nhận**, không đúng khi số tiền bị đọc sai.
- "Chống được người chiếm cả máy."
- Bất kỳ số liệu, trích dẫn nào từ buổi thử người dùng.
- Những trích dẫn đã bị loại: vuln.today, tên metric OpenTelemetry cụ thể, HackAPrompt 2.0, "Litestream chỉ cho một writer". "Secret Manager của VNG Cloud" cũng không nói vì chưa xác minh.

---

## A. Q1: Bảo mật hệ có agent AI trong doanh nghiệp

### A1. Bản 60 giây

> **Máy đọc có thể bị lừa, trọng tài thì không.** Tax Referee cố ý không để agent AI quyết định. AI chỉ đọc chứng từ; quyền ghi trạng thái thuế nằm trong bộ quy tắc tất định, và đường quyết định không gọi LLM lần nào.
>
> **Định danh:** khi máy tự duyệt, nhật ký ghi tên SYSTEM_REFEREE kèm hash của policy và hash dữ liệu; máy không mượn danh người nhập. Agent đọc ảnh cũng có danh tính riêng, gồm tên model và hash của prompt.
>
> **Đặc quyền tối thiểu:** quyền được kiểm ở server. Kế toán trưởng sửa ca 330 triệu xuống 198 triệu thì ca vẫn phải chờ CFO.
>
> **Ranh giới thực thi:** agent đọc ảnh chỉ được khai 14 trường nhìn thấy trên chứng từ. Nếu nó tự khai thêm "đã có ủy nhiệm chi", trường đó bị loại và ca phải hỏi người.
>
> **Cách ly:** mỗi phiên dùng một database riêng; nhật ký bị sửa là bị phát hiện.
>
> Mười hai phép thử cho bốn trụ này chạy ngay trên bản đang deploy, ở trang /trust. Giới hạn chúng tôi nói thẳng: định danh trong demo là vai trò mô phỏng, và trình đọc PDF chưa nằm trong container riêng.

### A2. Bản 2 phút 30 giây

**[Mở, 15 giây]**
> Máy đọc có thể bị lừa, trọng tài thì không. Trong Tax Referee, AI chỉ đọc chứng từ, còn quyền ghi trạng thái thuế thuộc về bộ quy tắc tất định. Đây là mẫu Dual LLM / Action-Selector trong nghiên cứu về chống prompt injection. Vì AI không có quyền ghi, rủi ro agentic chuyển sang dữ liệu: mỗi trường AI viết ra mà quy tắc dùng tới là một quyền, và chúng tôi kiểm soát nó như một quyền.

**[Định danh, 30 giây]**
> *Thách thức:* khi máy tự duyệt, câu hỏi đầu tiên của kiểm toán là "ai đã duyệt". Nếu máy mượn danh người nhập, hoặc mọi agent dùng chung một khóa, thì không truy được.
> *Cơ chế:* hệ thống có tám danh tính tách bạch: ba vai người, trọng tài tất định, ba agent AI và nguồn cập nhật pháp lý. Ca do máy tự duyệt được ghi actorRole SYSTEM_REFEREE, kèm policyHash, inputHash và commit đang chạy. Agent đọc ảnh mang danh tính "agent:vision@model#hash-prompt", và danh tính này đi theo hồ sơ vào nhật ký.
> *Bằng chứng:* phép thử **I1**, **I2**; trường `commit` và `ai.visionAgent` trên /api/health.
> *Giới hạn:* trong demo, một người đổi được ba vai. Việc đổi vai chỉ làm được trong phiên demo; ngoài sandbox bị chặn. Production cần SSO, MFA khi CFO duyệt, và thu hồi quyền tự động.

**[Đặc quyền tối thiểu, 35 giây]**
> *Thách thức:* ẩn nút không phải là phân quyền; kẻ tấn công thật sẽ đi đường vòng. Lỗ hổng chúng tôi tự tìm ra khi rà ma trận quyền: Kế toán trưởng hạ ca laptop 330 triệu xuống 198 triệu, kèm xác nhận, để máy tự duyệt, và CFO không bao giờ thấy ca đó.
> *Cơ chế:* mọi quyền đều kiểm ở server. Chúng tôi thêm "bánh cóc thẩm quyền": ca đã từng cần CFO thì người khác CFO sửa dữ liệu cũng không hạ được thẩm quyền. Với AI: agent đọc ảnh không có công cụ, không ghi được database, và bị giới hạn số lần gọi theo người dùng.
> *Bằng chứng:* **L1**, **L2**, **L3**. L3 hiện `WAITING_CFO` kèm sự kiện `ROUTINE_HELD_AUTHORITY_FLOOR`. Ma trận quyền trên trang được test kiểm bằng chính hàm thực thi.
> *Giới hạn:* dữ kiện nghiệp vụ như "đã có ủy nhiệm chi" vẫn do kế toán khai. Chúng tôi ghi tên người khai và hậu kiểm ngẫu nhiên, nhưng chưa bắt buộc gắn giao dịch ngân hàng.

**[Ranh giới thực thi tất định, 40 giây]**
> *Thách thức:* agent đọc ảnh tiếp xúc dữ liệu không tin cậy, và ảnh có thể chứa lệnh chèn. Không thể trông vào việc mô hình tự chống: trong đánh giá của NIST CAISI, tỉ lệ chiếm quyền agent tăng từ 11% lên 81% khi dùng đòn tấn công mới.
> *Cơ chế:* nên ranh giới phải nằm trong mã. Đường quyết định không gọi LLM. Workflow chỉ nhận bảy tên thao tác có trong danh sách. Đầu ra Vision phải qua bộ lọc 14 trường, và tên file không được đưa vào prompt. Kết quả AI về trễ bị loại nhờ số revision. Thao tác hoàn tác không được nới lỏng kiểm soát.
> *Bằng chứng:* **D2**: cùng một đầu ra của agent bị chiếm, nếu tin AI thì ca thành ROUTINE, qua ranh giới thì thành ESCALATED. Thêm **D1**, **D3**, **D4**. Trên /api/health: `decisionPathLlmCalls` bằng 0.
> *Giới hạn:* agent bị chiếm vẫn quyết định được giá trị của 14 trường, kể cả số tiền; đọc sai mà vẫn cân đối thì ca có thể đi luồng thấp hơn. Lớp chặn hiện có là kiểm số học, kiểm checksum MST, người nhập đối chiếu với ảnh (quy trình, mã chưa bắt buộc) và hậu kiểm; các lớp này không tuyệt đối. Production cần đối chiếu dữ liệu hóa đơn điện tử của cơ quan thuế.

**[Cách ly, 25 giây]**
> *Thách thức:* nhiều giám khảo dùng chung một máy chủ, chứng từ là file thù địch, và người ghi được database có thể sửa nhật ký.
> *Cơ chế:* mỗi phiên demo là một file SQLite riêng; cookie tự đặt không tạo được database mới. XML có DOCTYPE bị từ chối. Chứng từ trả về kèm CSP sandbox (trừ PDF). Nhật ký chỉ ghi thêm, nối chuỗi SHA-256, có HMAC và điểm neo.
> *Bằng chứng:* **S1**, **S2**, **S3**; `audit.hmac: true` trên /api/health (chỉ nói khi live đã bật khóa).
> *Giới hạn:* đây là cách ly logic: cùng tiến trình, cùng khóa HMAC. Tiến trình đọc PDF đã không thừa hưởng biến bí mật nhưng vẫn chạy cùng người dùng hệ điều hành. Production cần đưa việc đọc file vào worker container không mạng, không secret.

**[Chốt, 5 giây]**
> Chúng tôi không tin mô hình; chúng tôi giới hạn nó, và chứng minh bằng phép thử chạy trên chính mã đang deploy, kể cả phần chưa chặn được.

### A3. Bảng tra cứu nhanh 4 trụ (khi giám khảo hỏi sâu)

| Trụ | Cơ chế (file · hàm) | Bấm để chứng minh | Giới hạn trung thực |
|---|---|---|---|
| Định danh | `PRINCIPALS` (`lib/capabilities.ts`); `recordAction` ghi `actorRole SYSTEM_REFEREE`, `policyHash`, `inputHash`, `contractVersion`, `commit` (`services/workflowService.ts`); `provenance` của Vision, lưu thành `llmProvenance` (`services/geminiService.ts`, `evaluateWorkflow`) | **I1** (`actorRole=SYSTEM_REFEREE, actorId=null`), **I2** (KTT tự nhập rồi tự xác minh → 403); `/api/health` → `commit`, `ai.visionAgent` | Vai trò mô phỏng; đổi vai chỉ trong sandbox (`app/api/auth/switch/route.ts`, sự kiện `ROLE_SWITCHED`); token phiên lưu thô trong bảng `sessions` (`lib/server/auth.ts`) |
| Đặc quyền tối thiểu | `applyWorkflowAction`, `approvalBlock`; bánh cóc `cfoFloor`/`authorityFloor` trong `evaluateWorkflow`; `RELEASE_TAX_HOLD`: lệnh giữ do CFO đặt thì chỉ CFO gỡ; nới lỏng hoặc rollback policy cần CFO (`publishPolicy`, `rollbackPolicy`); `allowVisionCall`, `allowGroundingCall` | **L1** (Kế toán viên gọi thẳng `TAX_HOLD` → 403), **L2** (KTT `OVERRIDE` ca 330 triệu → 403), **L3** (`WAITING_CFO · ROUTINE_HELD_AUTHORITY_FLOOR`); ma trận do `tests/unit/authzMatrix.test.ts` kiểm | Dữ kiện nghiệp vụ (`hasBankSlip`, `sellerStatus`) do người nhập khai vẫn được tin cho ca dưới 200 triệu; được bù bằng hậu kiểm, không chặn trước |
| Ranh giới thực thi | `decisionAuthority: 'LOCAL_POLICY_ENGINE'` (`services/jevService.ts`); `WORKFLOW_ACTIONS`; `filterVisionInvoice`; `buildVisionPrompt` (không có tên file, có `VISION_PROMPT_SHA256`); fence `revision` + `attemptId`; `undoCandidate` không nới lỏng; chỉ duyệt từ `WAITING_*` hoặc `FORWARDED` | **D1** (`APPROVE_ALL` → 400), **D2** (`tin AI: ROUTINE → có ranh giới: ESCALATED; loại: hasBankSlip, sellerStatus, status`), **D3** (không hoàn tác được lệnh giữ theo luật, kể cả CFO), **D4** (chèn lệnh vào tên hàng, quyết định không đổi) | Agent bị chiếm vẫn kiểm soát được giá trị 14 trường. Trường VLM cân đối số học đang bị gắn nhãn `VERIFIED` (độ tin 0,85) trong `app/api/documents/parse/route.ts`; nghĩa thật chỉ là "đọc được, khớp số học" |
| Cách ly | `withDemoDatabase`, `withRequestDatabase` (`demoExists`); `runIsolated` (DB `:memory:`); `parseXml`; CSP sandbox + `nosniff` (`app/api/documents/artifacts/[id]/route.ts`, PDF không có CSP); trigger append-only; `verifyAuditChain`, `auditAnchor` (`lib/server/audit.ts`); CSRF theo `sec-fetch-site` (`middleware.ts`) | **S1** (DB phiên ≠ DB thử, số hồ sơ của phiên không đổi), **S2** (gỡ trigger rồi sửa một sự kiện → `hợp lệ=false`), **S3** (XXE bị từ chối) | Cùng tiến trình Node, cùng khóa HMAC; `execSync` chạy python3/PyMuPDF trên file người dùng, cùng UID, thừa hưởng `process.env` (`lib/server/pdfToImage.ts`) |

**Khung lý thuyết** (chỉ nói khi được hỏi; đều là chuẩn tham chiếu tự nguyện):
- Dual LLM (Willison 2023) và Action-Selector (Beurer-Kellner và cộng sự 2025): LLM bị cách ly không có công cụ; luồng điều khiển là phần mềm thường.
- CaMeL (Debenedetti và cộng sự 2025): tách luồng điều khiển khỏi dữ liệu. Chỗ hệ thống chưa đạt: chưa gắn capability/nguồn gốc cho từng giá trị như CaMeL.
- Agents Rule of Two (Meta, 31/10/2025): mỗi agent chỉ có tối đa hai trong ba thuộc tính: đầu vào không tin cậy, dữ liệu nhạy cảm, đổi trạng thái/giao tiếp ra ngoài. Áp vào hệ thống:
  - Vision chỉ đọc, không ghi, không gọi ra ngoài.
  - Agent tra cứu MST có đầu vào không tin cậy và gọi ra ngoài, nhưng bị bọc: chỉ nhận nguồn `*.gov.vn` có trích dẫn.
  - Engine có quyền ghi nhưng không chạy LLM.
- Ánh xạ OWASP Top 10 LLM 2025: LLM01 Prompt Injection, LLM06 Excessive Agency, LLM10 Unbounded Consumption (đã có `lib/server/aiBudget.ts`).

---

## B. Q2: Kiến trúc, đánh đổi, từ demo lên production

### B1. Bản 60 giây

> **Bảy lớp, nói một hơi:** nạp chứng từ, chuẩn hóa và nguồn gốc, quyết định tất định, workflow, người trong vòng lặp, bằng chứng, vận hành. AI chỉ có mặt ở hai lớp đầu (đọc chứng từ, tra danh tính bên bán), và chỉ để đọc; AI diễn đạt câu hỏi ở lớp 5 tắt mặc định.
>
> **Ba đánh đổi chúng tôi tự chọn.**
> - Quy tắc thay vì LLM quyết định: đổi độ linh hoạt lấy khả năng kiểm toán.
> - Mỗi phiên một file SQLite: cách ly đơn giản nhưng chỉ chạy trên một máy; khi cần hơn một instance thì chuyển sang PostgreSQL.
> - Gọi Vision đồng bộ qua proxy: nhanh ra demo, nhưng dữ liệu đi ra nước ngoài; có khách hàng thật là phải có hợp đồng xử lý dữ liệu, hoặc chạy chế độ chỉ XML.
>
> **Cái vỡ đầu tiên khi mở rộng** là khâu đọc ảnh và PDF trên một instance, rồi đến hạn mức đang nằm trong bộ nhớ của từng tiến trình.
>
> **Lộ trình:** hôm nay đã đóng các lỗ ranh giới, có test; 30 ngày tới: SSO, MFA, worker đọc file cô lập, hàng đợi; 90 ngày: nguồn sự thật là XML hóa đơn điện tử có chữ ký số, đối chiếu dữ liệu của cơ quan thuế. Trên VNG Cloud: VKS, vDB PostgreSQL, vStorage có Object Lock, KMS và IAM.
>
> AI viết được code. Còn chọn đánh đổi nào, và khi nào thì đổi, là phán đoán của đội.

### B2. Bản 2 phút 30 giây

**[Bảy lớp, 25 giây]**
> Một chứng từ đi qua bảy lớp.
> 1. **Nạp:** XML đọc tất định; PDF có lớp chữ thì đọc chữ; ảnh và PDF scan qua Vision.
> 2. **Chuẩn hóa và nguồn gốc:** allowlist 14 trường, Zod, kiểm số học, checksum MST, tra danh tính bên bán bằng grounding chỉ nhận nguồn *.gov.vn.
> 3. **Quyết định tất định:** policy engine, phân loại ba kiểu dừng, căn cứ pháp lý theo ngày lập; policy có version và hash.
> 4. **Workflow:** máy trạng thái, khóa theo revision, bất kiêm nhiệm, bánh cóc thẩm quyền, công tắc dừng toàn hệ thống.
> 5. **Người trong vòng lặp:** câu hỏi chuyển tiếp có đáp án mang hệ quả, hậu kiểm ngẫu nhiên kèm khoảng tin cậy Wilson.
> 6. **Bằng chứng:** nhật ký chỉ ghi thêm, chuỗi hash, HMAC, điểm neo.
> 7. **Vận hành:** /api/health, /trust, CI chạy trên Ubuntu và Windows.

**[Ba đánh đổi, 50 giây]**
> **Thứ nhất, quy tắc thay vì để LLM quyết định.** Được: tái lập, giải trình được với cơ quan thuế, không tốn lời gọi AI trên đường quyết định. Mất: độ phủ ngữ nghĩa. Danh sách từ khóa đã không bắt được ca "tiệc cưới người thân giám đốc" cho tới khi bổ sung từ khóa. Đây là ca bẫy U2; đội cố ý giữ nguyên đến sau buổi thử rồi mới đóng. Điều kiện đổi: không giao quyền quyết định cho AI; nếu thêm AI thì chỉ một chiều, AI được làm chặt (đẩy ca sang người), không bao giờ được nới.
>
> **Thứ hai, mỗi phiên một file SQLite.** Được: cách ly không phụ thuộc câu WHERE nào, sao lưu và xóa theo từng file. Mất: WAL buộc mọi tiến trình nằm trên cùng một máy, và chỉ có một writer. Điều kiện đổi: khi cần hơn một instance hoặc cần HA, chuyển sang PostgreSQL có RLS, tenant lớn dùng database riêng.
>
> **Thứ ba, gọi Vision đồng bộ qua proxy bên thứ ba.** Được: đơn giản, rẻ, nhanh ra demo. Mất: dữ liệu đi ra nước ngoài, và một request có thể bị giữ tới 35 giây. Điều kiện đổi: có khách hàng có dữ liệu cá nhân thì bắt buộc có hợp đồng xử lý dữ liệu, hoặc chế độ chỉ XML và nhập tay; p95 đọc ảnh vượt SLO thì chuyển sang hàng đợi và worker, idempotency theo hash nội dung.
>
> **Một ví dụ phán đoán nhỏ:** ngân sách AI tính theo phiên chứ không theo IP, vì giám khảo dùng chung NAT của hội trường.

**[Cái vỡ trước tiên, 30 giây]**
> Vỡ trước không phải engine, vì engine chạy cục bộ và không gọi mạng. Vỡ trước là khâu nạp: đọc PDF chạy đồng bộ, chặn event loop tới 3 giây; Vision giữ request tới 35 giây, trên một instance duy nhất. Thêm instance để gánh tải thì vỡ tiếp ba chỗ: hạn mức và ngân sách AI nằm trong bộ nhớ từng tiến trình; chuỗi nhật ký giả định chỉ có một writer; WAL không chia sẻ được qua mạng. Khi dữ liệu lớn lên: mỗi lần ghi đang tính lại tổng của cả bảng, và lệnh kiểm chuỗi nhật ký đọc toàn bộ chuỗi vào RAM.

**[Lộ trình D0/30/90, 35 giây]**
> **D0, đã làm hôm qua, có test:** allowlist cho Vision, bỏ tên file khỏi prompt, bánh cóc thẩm quyền, hoàn tác không nới lỏng, ngân sách AI, nới lỏng policy (kể cả rollback) phải do CFO, chống hạ cấp HMAC, trang /trust; thêm cảnh báo cấu hình trên health (kiểm bằng checklist, chưa có test riêng). Ngoài ra, khóa audit và commit thật đã được đặt trên live. *(Chỉ nói câu cuối nếu `/api/health` xác nhận `hmac:true` và commit khác `unknown`.)*
> **30 ngày:** SSO và MFA cho CFO; băm token phiên; worker đọc file trong container không mạng, không secret; hàng đợi; key_id cho khóa audit và đưa khóa vào KMS; hạn mức chuyển ra kho dùng chung; sao lưu liên tục và diễn tập khôi phục; trace theo evaluationId.
> **90 ngày:** nguồn sự thật là XML có chữ ký số, đối chiếu dữ liệu hóa đơn điện tử của cơ quan thuế; sao kê ngân hàng thay cho ô "đã có ủy nhiệm chi"; PostgreSQL đa tenant; chạy shadow khi đổi policy; neo nhật ký lên kho WORM.

**[VNG Cloud, 10 giây]**
> Trên VNG Cloud, web và worker đọc chứng từ chạy tách namespace trên VKS, phía sau vLB và vWAF. Dữ liệu chuyển sang vDB PostgreSQL Cluster. Chứng từ gốc và điểm neo nhật ký lưu trên vStorage có Object Lock. Khóa nằm trong KMS. Mỗi workload có một service account IAM. Giám sát bằng vMonitor, sao lưu bằng Backup Center.

### B3. Bảng tra cứu cho Q2

**Bảy lớp, kèm file trong mã**

| Lớp | Thành phần | File |
|---|---|---|
| L1 Nạp | XML tất định, lớp chữ PDF, Vision cho ảnh/scan, giới hạn 15 MB | `app/api/documents/parse/route.ts`, `lib/documentParser.ts`, `lib/server/pdfToImage.ts` |
| L2 Chuẩn hóa | `filterVisionInvoice`, Zod (`lib/schemas.ts`), kiểm số học, tra danh tính bên bán (grounding chỉ nhận nguồn `*.gov.vn`) | `services/geminiService.ts`, `services/supplierIdentityResolver.ts`, `services/officialSupplierLookupService.ts` |
| L3 Quyết định | `evaluateInvoiceLocally`, 3 kiểu dừng OUT_OF_POLICY > EXCEED_AUTHORITY > UNCERTAIN_INFO, căn cứ theo ngày lập | `services/policyEngine.ts`, `lib/riskTaxonomy.ts`, `lib/legalBasis.ts`, `data/regulatoryRegistry.ts` |
| L4 Workflow | máy trạng thái, fence revision/attemptId, bánh cóc thẩm quyền, công tắc dừng | `services/workflowService.ts`, `services/automationControl.ts` |
| L5 Người | câu hỏi chuyển tiếp, `answerHandoff`, hậu kiểm chọn mẫu phân tầng (tham chiếu ISA 530) kèm Wilson 95% | `services/questionBuilder.ts`, `services/handoffService.ts`, `services/postAuditService.ts` |
| L6 Bằng chứng | append-only (trigger), chuỗi SHA-256, HMAC, điểm neo, mốc `TAX_REFEREE_AUDIT_SIGNED_SINCE` | `lib/server/audit.ts`, `lib/server/db.ts` |
| L7 Vận hành | `/api/health` (commit, policyHash, ai, warnings), `/trust`, CI Ubuntu + Windows | `app/api/health/route.ts`, `lib/server/runtimeInfo.ts`, `.github/workflows/ci.yml` |

**Cái vỡ khi mở rộng**

| Kịch bản | Vỡ ở đâu | Bằng chứng trong mã |
|---|---|---|
| Tải ảnh/PDF tăng | Event loop bị chặn, request dài | `execSync` (timeout 3 s) trong `pdfToImage.ts`; `VISION_TIMEOUT_MS = 35_000` |
| Hơn 1 instance | Mỗi instance một quota riêng; chuỗi audit giả định một writer; WAL chỉ chạy trên cùng máy | `lib/server/rateLimit.ts` ("trong bộ nhớ, một tiến trình"); `appendAuditEvent` đọc bản ghi cuối trong transaction |
| Nhiều hóa đơn | Tính lại tổng toàn bảng mỗi lần ghi; kiểm chuỗi đọc hết vào RAM | `recomputeMacro`; `verifyAuditChain` dùng `.all()` |
| Cấu hình fail-open | Thiếu một biến môi trường là HMAC tắt âm thầm (live ngày 16/10: `hmac:false`, `commit:"unknown"`) | Đã thêm `configWarnings`. Bước tiếp theo: readiness trả 503 khi thiếu khóa |

**VNG Cloud: chỉ dùng dịch vụ có trong tài liệu docs.greennode.ai** (luồng nghiên cứu 16/10 đã tra; nguồn nhà cung cấp, chưa qua vòng kiểm trích dẫn độc lập, cần VNG xác nhận)

| Nhu cầu | Dịch vụ | Ghi chú |
|---|---|---|
| Chạy web + worker | VKS, vLB, vWAF | Tính năng chi tiết của vWAF chưa xác minh |
| Database | vDB PostgreSQL Cluster | 1 writer + 1–9 reader, tự failover; Multi-AZ chỉ ở HCM |
| Hàng đợi / hạn mức dùng chung | vDB MemoryStore, Kafka | |
| Chứng từ gốc, điểm neo WORM | vStorage (S3-compatible) + Object Lock | Object Lock theo tài liệu mới có ở HAN02 |
| Khóa, danh tính workload | KMS (CMK), IAM service account | **Không** nói "Secret Manager" vì chưa thấy trong tài liệu |
| Vận hành | vMonitor, Backup Center, vContainer Registry | Chưa xác minh vMonitor hỗ trợ trace/OTel |
| Gọi AI | AI Gateway, MaaS | Chỉ xác minh là có dịch vụ; nơi lưu dữ liệu của MaaS chưa rõ |

---

## C. Phần bổ sung vào demo (thao tác chính xác)

### C1. Đoạn /trust (khoảng 60 giây)

1. Mở tab đã chuẩn bị sẵn: `https://limegreen-salamander-517622.hostingersite.com/trust`. Nếu chưa có phiên, nút "Chạy" sẽ tự tạo phiên demo rồi chạy (`postProbes` trong `components/TrustCenter.tsx`).
2. Chỉ dòng **"Bản đang chạy: commit … · policy … · nhật ký N sự kiện · HMAC bật"** trong khung "Thiết kế".
   *Thoại:* "Trang này cho biết đang chạy commit nào, nên giám khảo biết phép thử thuộc bản mã nào."
3. Bấm **"Chạy 12 phép thử tấn công"** → chờ dòng `12/12 đạt · … ms · <giờ> · commit …`.
   *Thoại:* "Mỗi phép thử chạy trong một database riêng trong bộ nhớ, không gọi mạng, không chạm dữ liệu của phiên. Cùng hàm này chạy trong CI."
4. Cuộn đến **D2 · Ranh giới thực thi**. Đọc dòng *Quan sát*: `tin AI: ROUTINE → có ranh giới: ESCALATED; loại: hasBankSlip, sellerStatus, status`.
   *Thoại:* "Đây là agent đọc ảnh bị chiếm. Nó tự khai đã có ủy nhiệm chi, MST đang hoạt động, và trạng thái 'đã duyệt' cho hóa đơn 55 triệu. Nếu tin nguyên đầu ra thì máy tự duyệt. Qua ranh giới, ba khai báo đó bị loại vì không thể nhìn thấy trên ảnh, và ca phải hỏi người."
5. Cuộn đến **L3 · Đặc quyền tối thiểu**: `WAITING_CFO · ROUTINE_HELD_AUTHORITY_FLOOR`.
   *Thoại:* "Kế toán trưởng hạ ca 330 triệu xuống 198 triệu, kèm xác nhận, để né CFO. Ca vẫn chờ CFO. Lỗ hổng này đội tự tìm ra và đã đóng bằng test."
6. (Nếu còn thời gian) **S1**: `DB phiên … · DB thử … · số hồ sơ phiên N → N`.
7. Cuộn qua mục **"Ma trận quyền — kiểm bằng test trên hàm thật"** (1 câu), rồi **"Giới hạn đã biết — nói thẳng"** (1 câu: "chúng tôi in giới hạn ngay trên trang").
8. Chỉ bấm hai link tài liệu ở cuối trang nếu đã kiểm ở mục 0 là không bị 404.

> Gọi đúng tên khi bị vặn: đây là **phép thử hồi quy mô phỏng tấn công**, chạy trên chính mã đang deploy. Đây không phải pentest độc lập.

### C2. /api/health (khoảng 15 giây)

Mở tab mới: `https://limegreen-salamander-517622.hostingersite.com/api/health`. Chỉ lần lượt:

| Trường | Kỳ vọng | Câu nói |
|---|---|---|
| `commit` | Trùng merge commit PR #6 trên GitHub | "Truy được bản mã đang chạy." |
| `audit.hmac` | `true` | "Nhật ký có HMAC, khóa nằm ngoài database." |
| `audit.events` | ≥ số ghi lại trước deploy | "Nhật ký sống sót qua restart." |
| `warnings` | `[]` | "Thiếu khóa hay thiếu commit thì trường này tự báo." |
| `ai.decisionPathLlmCalls` | `0` | "Không có LLM trên đường quyết định." |
| `ai.ingestionMaxLlmCalls` / `ai.visionTimeoutMs` / `ai.groundingBudgetMs` / `ai.qgenEnabled` | `3` / `35000` / `18000` / `false` | "Số đọc từ hằng số trong mã, không viết tay." |

### C3. Dự phòng khi mạng chậm (chuẩn bị sáng 17/10, trước giờ trình bày)

Chạy trong Git Bash ở thư mục repo. **Không** lưu file cookie vào `docs/` vì nó chứa token phiên.

```bash
TS=$(date +%Y%m%d-%H%M)
BASE=https://limegreen-salamander-517622.hostingersite.com
OUT=docs/evidence/demo-day-2026-10-17
JAR=$(mktemp)
mkdir -p "$OUT"
curl -s "$BASE/api/health" > "$OUT/health-$TS.json"
curl -s -c "$JAR" -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/demo/session" > /dev/null
curl -s -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/security/probes" > "$OUT/probes-$TS.json"
rm -f "$JAR"
```

- Chụp màn hình (Win+Shift+S) trang `/trust` sau khi chạy xong, gồm dòng `12/12 đạt` cùng hai dòng D2 và L3, lưu thành `$OUT/trust-<TS>.png`. Chụp thêm `/api/health`, lưu thành `$OUT/health-<TS>.png`.
- Mở file `probes-*.json` và kiểm: `summary.passed == summary.total == 12`, `commit` khác `"unknown"`.
- Trên sân khấu, nói rõ: *"Đây là bản chụp lúc HH:MM sáng nay, commit X; các file JSON có trong docs/evidence."*
- Nếu cả `/trust` lẫn bản chụp đều không dùng được, làm tay 3 phép thử trên live, mỗi phép khoảng 20 giây:
  1. Đổi vai **Kế toán trưởng**, mở ca mẫu **MAU-0009004** (10 laptop, 330 triệu). Hệ thống không cho duyệt, lý do `Hồ sơ cần CFO.` (`approvalBlock`). **Thử trước trên live.**
  2. `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'sec-fetch-site: cross-site' "$BASE/api/evaluate"` → `403` (`middleware.ts`).
  3. Mở hai trình duyệt (thường và ẩn danh): hai phiên khác nhau, dữ liệu không thấy nhau (`withRequestDatabase`).

---

## D. 12 câu hỏi khó của giám khảo kỹ thuật VNG

**1. Vì sao không dùng NeMo Guardrails, Llama Guard hay LlamaFirewall?**
Rủi ro của bài toán là đổi trạng thái tài chính sai, không phải nội dung độc hại, nên cổng an toàn nằm ở kiến trúc:
- AI không có quyền ghi.
- Đầu ra của AI phải qua allowlist 14 trường (`filterVisionInvoice`).
- Quyết định do `services/policyEngine.ts` đưa ra.

Bộ phân loại guardrail là xác suất và bị tấn công thích ứng vượt qua: "The Attacker Moves Second" (Nasr, Carlini và cộng sự 2025) vượt qua 12 cơ chế phòng thủ, đa số với tỉ lệ trên 90%. Các công cụ đó có thể làm tín hiệu phụ, ví dụ đánh dấu ảnh nghi chèn lệnh là "cần người xem". Chúng không bao giờ là cổng duy nhất, và hiện chưa tích hợp.

**2. Agent đọc ảnh bị chiếm hoàn toàn thì thiệt hại tối đa là bao nhiêu?**
- **Những gì nó không làm được:** chọn hành động, chọn người duyệt, đặt trạng thái, gọi công cụ, ghi database (D2). Nó chỉ điều khiển được giá trị của 14 trường nhìn thấy.
- **Nhưng:** 14 trường đó gồm cả số tiền. Đọc 280 triệu thành 150 triệu mà vẫn cân đối thì ca có thể không sang CFO. Vì vậy câu đúng là "ảnh hưởng gián tiếp tới định tuyến", không phải "vô hại".
- **Lớp chặn hiện có:** kiểm số học, checksum MST, danh tính bên bán chỉ nhận nguồn `*.gov.vn`, người nhập chịu trách nhiệm đối chiếu với ảnh, hậu kiểm 10% (gấp 3 khi sát ngưỡng).
- **Giới hạn chi phí:** nó cũng không đốt tiền vô hạn được nhờ `allowVisionCall` (60 lần/giờ mỗi người, 600 lần/giờ toàn tiến trình).
- **Production:** đối chiếu dữ liệu hóa đơn điện tử của cơ quan thuế thay cho việc tin ảnh.

**3. Prompt injection qua ảnh thì sao?**
- Chữ trong ảnh là dữ liệu. Prompt Vision cố định, không chứa tên file hay dữ liệu người dùng (`buildVisionPrompt`, có hash `VISION_PROMPT_SHA256` ghi theo hồ sơ).
- Mô hình có làm theo lệnh chèn thì mọi key ngoài 14 trường cũng bị loại và được ghi lại (`droppedKeys` trong `extraction_reviews`).
- D2 và D4 trên /trust mô phỏng đúng hai đường này: đầu ra AI bị chiếm, và lệnh chèn trong tên hàng.
- Điểm chưa tốt, tự nói ra: trường Vision cân đối số học đang bị gắn nhãn `VERIFIED` với độ tin 0,85 (`app/api/documents/parse/route.ts`). Nghĩa đúng chỉ là "đọc được, khớp số học", nên nhãn này cần đổi.
- Chúng tôi chưa đo tỉ lệ mô hình nghe theo lệnh chèn trong ảnh. Thiết kế không dựa vào con số đó.

**4. Tại sao không để LLM quyết định cho linh hoạt?**
- Quyết định khấu trừ thuế phải tái lập và giải trình được: cùng dữ liệu, cùng phiên bản policy, cùng ngữ cảnh sổ sách thì ra cùng kết quả. Mỗi kết quả trỏ về quy tắc và căn cứ theo ngày lập (`lib/legalBasis.ts`).
- Để LLM quyết định là mở thêm một bề mặt chiếm quyền. Đánh giá của NIST CAISI cho thấy tỉ lệ chiếm quyền agent tăng từ 11% lên 81% với đòn tấn công mới.
- Cái giá phải trả là độ phủ ngữ nghĩa: danh sách từ khóa đã không bắt được ca "tiệc cưới người thân giám đốc" cho tới khi bổ sung từ khóa. Đây là ca bẫy U2, cố ý giữ nguyên đến sau buổi thử 16/10 rồi mới đóng (`services/policyEngine.ts`, `tests/unit/keywordCoverage.test.ts`).
- Hướng đi nếu thêm AI: chỉ một chiều. AI được đẩy ca sang người, không được nới.

**5. Một người đóng ba vai thì phân quyền còn ý nghĩa gì?**
- Trong demo, đổi vai là chuyển sang ba tài khoản khác nhau của phiên (`switchRole` lấy user theo vai). Thao tác này chỉ được phép trong phiên demo (`app/api/auth/switch/route.ts` trả 403 ngoài sandbox), và mỗi lần đổi là một sự kiện `ROLE_SWITCHED`.
- Thứ demo chứng minh là **cơ chế**: server so người nhập với người duyệt theo tài khoản (`approvalBlock`, `created_by_user_id`, phép thử I2). Độ tin cậy của danh tính thì demo không chứng minh được.
- Ở production, mỗi người một tài khoản qua SSO/OIDC, có MFA khi CFO duyệt và thu hồi quyền tự động. Khi đó bất kiêm nhiệm mới có giá trị thật.

**6. Khóa HMAC nằm cùng máy thì chống được gì?**
- **Chống được** người chỉ có file database hoặc bản sao lưu:
  - Sửa một sự kiện thì vỡ chuỗi SHA-256 (S2).
  - Tính lại cả chuỗi thì không giả được HMAC, vì khóa nằm ngoài database.
  - Khi đã đặt mốc `TAX_REFEREE_AUDIT_SIGNED_SINCE`, cách xóa hết chữ ký rồi tính lại cũng bị `verifyAuditChain` bắt.
- **Không chống được** người chiếm cả máy, vì họ đọc được khóa. Lúc đó bằng chứng là điểm neo đã lưu ra ngoài (`/api/audit/anchor`, có chữ ký khi có khóa): nhật ký bị cắt đuôi hay viết lại sẽ không khớp điểm neo (`verifyAgainstAnchor`).
- **Production:** khóa trong KMS, chữ ký bất đối xứng, điểm neo ghi lên kho WORM.

**7. Xoay khóa thế nào?**
- Nói thẳng: hiện chưa xoay khóa an toàn được. Sự kiện không mang `key_id`, và `verifyAuditChain` chỉ kiểm bằng một khóa (`lib/server/audit.ts`), nên đổi khóa thì chữ ký cũ không kiểm được. Vì vậy hướng dẫn vận hành yêu cầu giữ khóa cố định và lưu bản sao ngoài host.
- Khóa này đang dùng cho ba việc: MAC sự kiện, ký điểm neo và chọn mẫu hậu kiểm (`services/postAuditService.ts`).
- Thiết kế production:
  - Mỗi sự kiện ghi `key_id` hoặc kỷ nguyên khóa; khóa mới ký từ một mốc, khóa cũ chỉ còn dùng để kiểm.
  - Mỗi mục đích dùng một khóa dẫn xuất riêng.
  - Khóa nằm trong KMS, chu kỳ dùng khóa theo NIST SP 800-57 (chuẩn tham chiếu tự nguyện).

**8. RPO/RTO là bao nhiêu?**
- Hiện chưa cam kết RPO/RTO. Dữ liệu là file SQLite trên một máy; hướng dẫn bàn giao có bước sao lưu thủ công trước buổi demo (`deployment/backup.sh`); chưa diễn tập khôi phục trên production.
- Đã có kiểm thử cục bộ `npm run test:recovery`, kiểm ba việc:
  - Khởi động lại mà phiên, revision, chứng từ, nhật ký còn nguyên.
  - Phục hồi lượt đánh giá đang dở.
  - Snapshot và khôi phục offline.
- Production: sao chép WAL liên tục ra object storage (Litestream v0.5 hỗ trợ khôi phục theo thời điểm), hoặc PostgreSQL có backup tự động. Sau đó mới chốt RPO/RTO cùng khách hàng và diễn tập định kỳ.

**9. Hóa đơn giám khảo tải lên lưu ở đâu, khi nào xóa?**
- **Nơi lưu:** mỗi phiên demo có một file SQLite (`<thư mục dữ liệu>/demo/<mã phiên>.sqlite`) và một thư mục chứng từ (`<thư mục dữ liệu>/artifacts/<mã phiên>/`) trên máy chủ Hostinger.
- **Thời hạn:** cookie sống 8 giờ, nhưng file còn trên đĩa cho đến khi chạy `scripts/ops/cleanup-demo.py`. Script này yêu cầu dừng app và giữ tối thiểu 1 ngày.
- **XML:** nội dung đọc trên máy chủ, không qua AI. Riêng tên và MST bên bán có thể được gửi đi tra cứu có grounding (qua cùng proxy) khi chưa có bản ghi cục bộ.
- **Ảnh và PDF scan:** gửi tới Gemini qua proxy ShopAIKey, tức là đi ra nước ngoài. Theo tài liệu Gemini API, prompt và đầu ra có thể được lưu 55 ngày để giám sát lạm dụng. Chúng tôi chưa có cam kết lưu trữ nào từ proxy.
- **Với khách hàng thật:** cần hợp đồng xử lý dữ liệu và đánh giá tác động chuyển dữ liệu ra nước ngoài theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và NĐ 356/2025/NĐ-CP (đã kiểm qua nguồn thứ cấp, cần đối chiếu Công báo trước khi trích nguyên văn). Nếu không có, dùng chế độ chỉ XML và nhập tay.
- **Lưu ý thêm:** MST 12 số của cá nhân/hộ kinh doanh là số định danh cá nhân (TT 86/2024; nguồn thứ cấp, cần đối chiếu Công báo).
- **Cam kết:** dọn dữ liệu demo sau Demo Day. *Cần Khánh xác nhận trước khi hứa.*

**10. Vì sao chọn SQLite?**
- Vì đơn vị cách ly của demo là phiên: mỗi phiên một file, không có câu `WHERE tenant` nào để quên, sao lưu và xóa theo file. Giao dịch ACID và WAL là đủ cho quy mô demo; với một doanh nghiệp vừa và nhỏ trên một máy, đội đánh giá là đủ nhưng chưa đo tải.
- Phản hồi doanh nghiệp Sprint 1 chỉ ra "dữ liệu trên RAM, restart là mất". Nay dữ liệu nằm trên đĩa, kiểm được bằng `audit.events` trước và sau restart.
- Giới hạn đã biết: theo tài liệu SQLite, WAL buộc mọi tiến trình trên cùng một máy; chỉ có một writer; hạn mức nằm trong bộ nhớ tiến trình. Nghĩa là không mở rộng ngang được.
- Điều kiện chuyển: cần hơn một instance hoặc cần HA thì chuyển sang PostgreSQL (vDB PostgreSQL Cluster), RLS cho tenant nhỏ, database riêng cho tenant lớn, hạn mức chuyển ra kho dùng chung.

**11. Nếu luật đổi ngày mai thì sao?**
Có ba lớp:
1. **Căn cứ pháp lý được phiên bản hóa theo ngày lập** (`lib/legalBasis.ts`; `effectiveFrom`/`effectiveTo` trong `data/regulatoryRegistry.ts`). Hóa đơn cũ vẫn xét theo luật cũ.
2. **Tham số là policy có version và hash.** Gồm ngưỡng tiền mặt, hạn mức KTT, ngưỡng trọng yếu. Bản nháp phải qua bộ kiểm an toàn và chạy lại trên 200 hồ sơ gần nhất để thấy ca nào đổi kết quả (`validatePolicyBundle`). Bản làm lỏng kiểm soát phải do một CFO khác người soạn công bố (`publishPolicy`); rollback về bản lỏng hơn cũng cần CFO.
3. **Webhook pháp lý chỉ tạo ứng viên `NEEDS_REVIEW`** (`services/legal/legalUpdateService.ts`).

Nếu luật đẻ ra một loại quy tắc mới thì phải sửa mã, viết test rồi deploy. Đó là chủ ý.

**12. Sau khi khóa repo, các bạn vẫn sửa code. Như vậy có hợp lệ không?**
- Bản khóa 15/10 vẫn nguyên vẹn: commit `a7dec46` trên `main` (15/10, 20:28) cùng gói nộp bài. Đội không squash, không force-push.
- Kế hoạch bàn giao đã có sẵn bước "nhận phản hồi 16/10, rồi commit cải tiến". README cũng ghi kết quả và cải tiến từ phản hồi sẽ đi kèm commit riêng.
- Phần sau khóa là 9 commit ngày 16/10 (21:24–21:43). Mỗi commit một mục đích, ghi rõ lý do. Phần lớn là lỗ hổng ranh giới đội tự tìm ra khi chuẩn bị câu hỏi bảo mật của BTC, cộng một commit đóng ca bẫy U2 sau buổi thử.
- Giám khảo xem được chính xác phần thêm bằng `git diff a7dec46..<commit trên /api/health>`. Đội tôn trọng quyết định của BTC về bản nào được dùng để chấm.
- *Việc phải làm trước khi nói câu này:* xác nhận với BTC, và thêm dòng 16/10 vào `docs/evidence/improvement-trace.csv` (hiện chưa có).

### Câu dự phòng (trả lời 1–2 câu)

- **"KTT có vượt quyền CFO được không?"** Trước 16/10 thì có: hạ số tiền rồi tự xác nhận. Đội tự tìm ra lỗ này; nay đã đóng bằng bánh cóc thẩm quyền, có phép thử L3 và test trong `tests/unit/executionBoundaries.test.ts`.
- **"Bật lại công tắc dừng thì ca đang chờ có được duyệt theo kết quả cũ không?"** Không. Từ commit `98ea813`, `releaseHeldRoutineCases` chạy lại `evaluateInvoiceLocally` theo policy hiện hành cho từng ca; không còn thường quy thì giữ chờ KTT và ghi `ROUTINE_RECHECK_FAILED_AFTER_RESUME` (test trong `tests/unit/automationSwitch.test.ts`). Lỗ này do audit nội bộ tìm ra ngày 16/10.
- **"Khóa API AI có lộ không?"** Khóa ShopAIKey đang được gửi cả trong query `?key=` lẫn header (`services/geminiService.ts`), nên có thể lộ qua log proxy. Tiến trình đọc PDF thì từ 16/10 đã không còn nhận biến bí mật (`pdfChildEnv`). Việc gửi khóa qua query là nợ kỹ thuật; sau Demo Day sẽ chỉ gửi qua header và xoay khóa (không đổi trước Demo Day vì sợ proxy trả 401).
- **"Spam upload hoặc đốt tiền AI thì sao?"** Có ngân sách AI fail-closed (`lib/server/aiBudget.ts`), tối đa 30 phiên demo/giờ/IP theo mặc định (`TAX_REFEREE_DEMO_PER_HOUR`), probes tối đa 10 lần/10 phút. Hạn mức nằm trong bộ nhớ một tiến trình, nên production phải chuyển ra kho dùng chung.
- **"'Tất định' nghĩa là gì?"** Cùng dữ liệu đầu vào, cùng policy, cùng ngữ cảnh sổ sách trong ngày thì ra cùng kết quả. Hiện chưa lưu ảnh chụp ngữ cảnh sổ sách theo từng lần đánh giá, nên chưa replay được từng byte; việc này nằm trong lộ trình.
- **"Phản hồi Sprint 1 về XXE và vòng lặp agent không có trần?"** XXE đã bị chặn (S3). Không còn vòng lặp agent: tối đa 3 lời gọi AI mỗi lần nạp, 0 lời gọi trên đường quyết định.

---

## Nguồn được phép trích (đã qua kiểm chứng trích dẫn)

| Ý | Nguồn |
|---|---|
| Mẫu thiết kế chống prompt injection (Action-Selector, Dual LLM, Context-Minimization…) | Beurer-Kellner và cộng sự (2025), arXiv:2506.08837 |
| Tách luồng điều khiển khỏi dữ liệu | Debenedetti và cộng sự (2025), CaMeL, arXiv:2503.18813 |
| Dual LLM; lethal trifecta | simonwillison.net (25/4/2023; 16/6/2025) |
| Rule of Two | Meta AI, "Agents Rule of Two" (31/10/2025) |
| Danh mục rủi ro | OWASP Top 10 for LLM Applications 2025; OWASP Top 10 for Agentic Applications 2026 (9/12/2025) |
| 11% → 81% | NIST CAISI, "Strengthening AI Agent Hijacking Evaluations" (17/1/2025) |
| Vượt 12 cơ chế phòng thủ | Nasr, Carlini và cộng sự (2025), arXiv:2510.09023 |
| 1,8 triệu đòn, 22 agent, thường trong 10–100 truy vấn | Zou và cộng sự (2025), arXiv:2507.20526 |
| 208.095 đòn do người viết | Abdelnabi và cộng sự (2025), LLMail-Inject, arXiv:2506.09956 |
| Guardrail của Meta | Chennabasappa và cộng sự (2025), LlamaFirewall, arXiv:2505.03574 |
| Cedar | Cutler và cộng sự (2024), OOPSLA, arXiv:2403.04651 |
| WAL chỉ chạy trên cùng máy | sqlite.org/wal.html |
| Quản lý khóa | NIST SP 800-57 Part 1 Rev.5 |
| Lưu 55 ngày để giám sát lạm dụng | ai.google.dev/gemini-api/docs/abuse-monitoring |
| Lỗi bộ nhớ MuPDF | CVE-2026-3308, **CERT/CC VU#951662** (không dùng vuln.today) |
| Khôi phục theo thời điểm | Litestream v0.5.0 (fly.io blog) |
| Cấu hình nằm trong môi trường | 12factor.net/config |
| Canary | Google SRE Workbook, ch.16 |
| Dịch vụ VNG Cloud | docs.greennode.ai (llms.txt; trang vDB PostgreSQL Cluster). Nguồn nhà cung cấp, **chưa qua vòng kiểm trích dẫn độc lập**; tính năng và nơi đặt dữ liệu cần VNG xác nhận |
| Pháp lý | Luật 91/2025/QH15 Điều 8; NĐ 356/2025/NĐ-CP (đã kiểm qua nguồn thứ cấp). Mọi văn bản khác (Luật AI 134/2025, NĐ 142/2026, TT 86/2024, NĐ 53/2022): **nguồn thứ cấp, cần đối chiếu Công báo** |
