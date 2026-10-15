/**
 * Đo trước/sau trên cùng 11 ca diễn tập kiểu giám khảo (do đội viết, không độc lập).
 * Chạy: TAX_REFEREE_DATA_DIR=<tmp> npx tsx scripts/qa/compare-rehearsal.ts <repoRoot>
 */
import path from 'node:path';
const root = process.argv[2];
const req = (p: string) => require(path.join(root, p));
const db = req('lib/server/db.ts');
const wf = req('services/workflowService.ts');
const acc = { id: 'a', role: 'ACCOUNTANT', email: 'a@t', displayName: 'A' };
const base = { invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Dịch vụ Minh An' };
const cases: Array<[string, string, string | null, Record<string, unknown>]> = [
  ['R1', 'ROUTINE', null, { itemName: 'Nước uống đóng bình 20L', preTaxAmount: 500000, taxRate: 8, taxAmount: 40000, totalAmount: 540000 }],
  ['R2', 'ROUTINE', null, { itemName: 'Phí chuyển phát tài liệu tháng 9', preTaxAmount: 2000000, taxRate: 10, taxAmount: 200000, totalAmount: 2200000, paymentMethod: 'BANK_TRANSFER' }],
  ['R3', 'ROUTINE', null, { itemName: 'Bảo dưỡng máy lạnh văn phòng', preTaxAmount: 8000000, taxRate: 10, taxAmount: 800000, totalAmount: 8800000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }],
  ['E1', 'ESCALATED', 'UNCERTAIN_INFO', { itemName: 'Bộ lưu điện UPS 3kVA', preTaxAmount: 11000000, taxRate: 10, taxAmount: 1100000, totalAmount: 12100000 }],
  ['E2', 'ESCALATED', 'OUT_OF_POLICY', { itemName: 'Cước điện thoại di động tháng 9', preTaxAmount: 1000000, taxRate: 8, taxAmount: 80000, totalAmount: 1080000, paymentMethod: 'BANK_TRANSFER' }],
  ['E3', 'ESCALATED', 'EXCEED_AUTHORITY', { itemName: '10 laptop Dell Latitude', preTaxAmount: 300000000, taxRate: 10, taxAmount: 30000000, totalAmount: 330000000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }],
  ['E4', 'ESCALATED', 'OUT_OF_POLICY', { itemName: 'Tiếp khách đối tác - rượu vang', preTaxAmount: 3000000, taxRate: 10, taxAmount: 300000, totalAmount: 3300000, paymentMethod: 'BANK_TRANSFER' }],
  ['E5', 'ESCALATED', 'UNCERTAIN_INFO', { itemName: 'Mực in laser', preTaxAmount: 450000, taxRate: 10, taxAmount: 45000, totalAmount: 480000, paymentMethod: 'BANK_TRANSFER' }],
  ['E6', 'ESCALATED', 'OUT_OF_POLICY', { itemName: 'Tài trợ giải chạy từ thiện', preTaxAmount: 15000000, taxRate: 10, taxAmount: 1500000, totalAmount: 16500000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true }],
  ['E7', 'ESCALATED', 'UNCERTAIN_INFO', { itemName: 'Văn phòng phẩm', preTaxAmount: 1000000, taxRate: 7, taxAmount: 70000, totalAmount: 1070000, paymentMethod: 'BANK_TRANSFER' }],
  ['E8', 'ESCALATED', 'OUT_OF_POLICY', { itemName: 'Bàn ghế phòng họp', preTaxAmount: 20000000, taxRate: 10, taxAmount: 2000000, totalAmount: 22000000, paymentMethod: 'CASH', sellerStatus: 'ACTIVE' }]
];
(async () => {
  const rows: string[] = [];
  let correct = 0, falseEsc = 0, missed = 0, wrongGroup = 0, errors = 0, concrete = 0, escalations = 0;
  for (const [id, expStatus, expGroup, fields] of cases) {
    await db.runIsolated(async () => {
      const p = db.getActivePolicy(); p.config.companyTaxCode = '0102030405';
      db.getDatabase().prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(p), p.version);
      try {
        const r = await wf.evaluateWorkflow({ ...base, ...fields, id, invoiceNumber: id }, acc, { forceLocalOnly: true });
        const d = r.decision;
        const ok = d.status === expStatus && (expStatus === 'ROUTINE' || d.riskGroup === expGroup);
        if (ok) correct++;
        if (expStatus === 'ROUTINE' && d.status === 'ESCALATED') falseEsc++;
        if (expStatus === 'ESCALATED' && d.status === 'ROUTINE') missed++;
        if (expStatus === 'ESCALATED' && d.status === 'ESCALATED' && d.riskGroup !== expGroup) wrongGroup++;
        if (d.status === 'ESCALATED') {
          escalations++;
          const q: string = d.actionableQuestion;
          // "Một câu trả lời": có số tiền cụ thể và không yêu cầu mở lại chứng từ gốc / xem danh sách.
          if (/\d[\d.]*\s?₫/.test(q) && !/chứng từ gốc|xem danh sách|xem xét lại/i.test(q)) concrete++;
        }
        rows.push(`${id} | kỳ vọng ${expStatus}${expGroup ? ' ' + expGroup : ''} | thực tế ${d.status} ${d.riskGroup || ''} | ${ok ? 'ĐÚNG' : 'SAI'}`);
      } catch (e) { errors++; rows.push(`${id} | LỖI ${(e as Error).message.slice(0, 80)}`); }
    });
  }
  console.log(rows.join('\n'));
  console.log(JSON.stringify({ correct, total: cases.length, falseEscalations: falseEsc, missed, wrongGroup, errors, escalations, questionsWithAmountAndNoSourceLookup: concrete }));
})();
