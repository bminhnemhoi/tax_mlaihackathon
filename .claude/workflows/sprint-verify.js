export const meta = {
  name: 'sprint-verify',
  description: 'Vòng thi 4 giờ: phản biện đối kháng thay đổi trên nhánh hiện tại, rồi kiểm chứng tuần tự (tsc, lint, referee:diff, 16 bộ test, build)',
  whenToUse: 'Sau khi làm xong các lát của một yêu cầu BTC, trước khi mở PR. args: { base?: "origin/main", goal: "<yêu cầu BTC 1-2 câu>", expectedDecisionChanges?: "<danh sách ca được phép đổi hoặc rỗng>" }',
  phases: [
    { title: 'Review', detail: 'phản biện đối kháng (chỉ đọc) trên diff' },
    { title: 'Verify', detail: 'qa-verifier chạy tuần tự lưới an toàn' },
  ],
}

const base = (args && args.base) || 'origin/main'
const goal = (args && args.goal) || '(chưa ghi yêu cầu)'
const allowed = (args && args.expectedDecisionChanges) || 'không ca nào'

const REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['SHIP', 'FIX_FIRST', 'DO_NOT_SHIP'] },
    blockers: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, problem: { type: 'string' }, repro: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'problem', 'fix'] } },
    should_fix: { type: 'array', items: { type: 'string' } },
    meets_goal: { type: 'string' },
  },
  required: ['verdict', 'blockers', 'should_fix', 'meets_goal'],
}

phase('Review')
const review = await agent(`Repo D:\\TAX_MLAI. Vòng thi cải tiến 4 giờ, yêu cầu của Ban tổ chức: "${goal}".
Phản biện đối kháng thay đổi trên nhánh hiện tại: \`git diff ${base}...HEAD\`. CHỈ ĐỌC (không sửa file, không git write, không server/build; không đọc env_*/.env*). Được chạy probe tsx nhỏ với runIsolated (TAX_REFEREE_DATA_DIR=$(mktemp -d) NODE_ENV=test), đặt trong thư mục tạm của hệ điều hành.
Tìm bằng ví dụ chạy thật: (1) thay đổi có đáp ứng đúng yêu cầu không, phần nào thiếu; (2) hồi quy quyết định — chạy \`npm run referee:diff\`; ca được phép đổi: ${allowed}; (3) lỗ hổng bảo mật/quyền (middleware CSRF, phiên, capabilities, audit), (4) dữ liệu nghi vấn có bị kết luận không, có chuyển tiếp thừa không; (5) căn cứ pháp lý bịa hoặc sai ngày; (6) chữ hiển thị tiếng Việt sai/cụt. Trả verdict và blocker kèm cách sửa tối thiểu.`, { label: 'review:adversarial', phase: 'Review', schema: REVIEW })

phase('Verify')
const verify = await agent(`Repo D:\\TAX_MLAI, nhánh hiện tại. Chạy TUẦN TỰ (máy ít RAM), dừng ở bước đầu lỗi và báo nguyên văn: \`npx tsc --noEmit\` → \`npm run lint\` (lỗi chỉ nằm trong thư mục Python/ cục bộ thì ghi chú và bỏ qua) → \`npm run referee:diff\` (ca được phép đổi: ${allowed}) → \`npm test\` (16/16 bộ) → \`npm run build\`. Không khởi động server. Báo bảng kết quả từng bước, số kiểm tra unit, và thời gian.`, { label: 'verify:qa', phase: 'Verify', agentType: 'qa-verifier' })

return { review, verify }
