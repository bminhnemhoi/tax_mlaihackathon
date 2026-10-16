/**
 * Các ca "ngoài quy định" từng bị tự duyệt trong đợt chấm nghiêm khắc 15/10 (gõ không dấu, quà tặng, chi cá nhân,
 * thép/xăng/bia áp 8%), cùng các ca không được chặn nhầm (bìa hồ sơ, đồng hồ, mũ bảo hiểm, nước uống).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { userStudyCases } from '../../data/verification/userStudyCases';
import type { RefereeDecision } from '../../lib/schemas';
import { checkHandoff } from '../../services/handoffService';
import { invoiceFrameworkAt } from '../../lib/legalBasis';

const COMPANY = '0102030405';
const accountant = { id: 'kw-accountant', role: 'ACCOUNTANT' as const, email: 'kw@test', displayName: 'Kiểm thử từ khóa' };
let seq = 0;
async function judge(itemName: string, extra: Record<string, unknown> = {}): Promise<RefereeDecision> {
  return runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = COMPANY;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const n = String(++seq).padStart(7, '0');
    return (await evaluateWorkflow({ id: `KW-${n}`, invoiceNumber: n, invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Minh An',
      itemName, preTaxAmount: 3_000_000, taxRate: 10, taxAmount: 300_000, totalAmount: 3_300_000, paymentMethod: 'BANK_TRANSFER', ...extra }, accountant, { forceLocalOnly: true })).decision as RefereeDecision;
  });
}
const at8 = { taxRate: 8, preTaxAmount: 3_000_000, taxAmount: 240_000, totalAmount: 3_240_000 };

test('ngoài quy định được nhận ra cả khi gõ không dấu, tiếng Anh, quà tặng, chi cá nhân', async () => {
  for (const item of ['tiep khach ruou', 'Chi phi tiep khach nha hang', 'Rượu vang tiếp đối tác', 'Giỏ quà Tết biếu đối tác', 'Quà tặng sinh nhật khách hàng', 'Charity donation',
    'Mỹ phẩm cá nhân', 'Tour du lịch Đà Lạt cho gia đình giám đốc', 'Học phí con giám đốc', 'Đồ chơi trẻ em', 'Sponsorship giải golf', 'Tien phat cham nop']) {
    const d = await judge(item);
    assert.equal(d.status, 'ESCALATED', item);
    assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY', item);
  }
});

test('hàng không được giảm thuế 8% theo NQ 204/2025 (kim loại, hàng chịu TTĐB trừ xăng, viễn thông) bị chặn khi áp 8%', async () => {
  for (const item of ['Thép hộp mạ kẽm', 'Ống đồng máy lạnh', 'Bia lon Hà Nội', 'Thuốc lá', 'thep tam can nong', 'Cước Internet cáp quang tháng 9']) {
    const d = await judge(item, at8);
    assert.equal(d.status, 'ESCALATED', item);
    assert.ok(d.status === 'ESCALATED' && d.findings?.some(f => f.ruleId === 'STATUTORY_RES_204_VAT_8_EXCLUDED' || f.ruleId === 'INTERNAL_POLICY_GUEST_ENTERTAINMENT'), item);
  }
});

test('NQ 204/2025 (từ 01/7/2025): xăng, dầu nhiên liệu, than, hóa chất, CNTT được giảm 8% — không chặn; trước 01/7/2025 vẫn chặn theo NQ 174/2024', async () => {
  for (const item of ['Xăng RON95', 'Dầu diesel', 'Than đá cám', 'Hóa chất tẩy rửa công nghiệp', 'Laptop Dell Latitude', 'Dịch vụ công nghệ thông tin']) {
    const d = await judge(item, at8);
    assert.equal(d.status, 'ROUTINE', `${item} (10/2026, NQ 204/2025)`);
  }
  for (const item of ['Xăng RON95', 'Laptop Dell Latitude', 'Hóa chất tẩy rửa công nghiệp']) {
    const d = await judge(item, { ...at8, invoiceDate: '2025-03-10' });
    assert.equal(d.status, 'ESCALATED', `${item} (03/2025)`);
    const f = d.status === 'ESCALATED' ? d.findings?.find(x => x.ruleId === 'STATUTORY_RES_204_VAT_8_EXCLUDED') : undefined;
    assert.ok(f, `${item} (03/2025) bị chặn vì danh mục loại trừ`);
    assert.match(f!.legalBasis, /180\/2024\/NĐ-CP/, 'căn cứ đúng kỳ: NĐ 180/2024 (NQ 174/2024)');
    assert.doesNotMatch(f!.legalBasis, /174\/2025/, 'không viện dẫn văn bản chưa có hiệu lực');
  }
});

test('8% ngoài mọi kỳ giảm thuế (03/2023) bị chặn; căn cứ hóa đơn và cộng dồn tiền mặt theo văn bản còn hiệu lực', async () => {
  const gap = await judge('Văn phòng phẩm', { ...at8, invoiceDate: '2023-03-15' });
  assert.ok(gap.status === 'ESCALATED' && gap.findings?.some(f => f.ruleId === 'RULE_SCOPE_VAT8_PERIOD'));
  assert.deepEqual(invoiceFrameworkAt('2026-10-05'), { decree: 'Nghị định 254/2026/NĐ-CP', circular: 'Thông tư 91/2026/TT-BTC', legacy: false });
  assert.equal(invoiceFrameworkAt('2025-09-01').circular, 'Thông tư 32/2025/TT-BTC');
  assert.equal(invoiceFrameworkAt('2025-03-01').circular, 'Thông tư 78/2021/TT-BTC');
  const series = await judge('Văn phòng phẩm', { invoiceSeries: '1C25TAA', invoiceDate: '2026-10-05' });
  const f = series.status === 'ESCALATED' ? series.findings?.find(x => x.ruleId === 'RULE_SERIES_YEAR_MISMATCH') : undefined;
  if (f) { assert.doesNotMatch(f.legalBasis, /78\/2021|123\/2020/); assert.match(f.legalBasis, /254\/2026|91\/2026/); }
});

test('không chặn nhầm hàng thông thường', async () => {
  for (const [item, extra] of [['Bìa hồ sơ nhựa', {}], ['Đồng hồ treo tường', at8], ['Mũ bảo hiểm cho nhân viên', at8], ['Nước uống đóng bình 20L', at8], ['Máy tính cá nhân cho kế toán', {}], ['Biểu mẫu in sẵn', {}], ['Phi chuyen phat nhanh tai lieu', {}], ['Bieu mau in san', {}]] as const) {
    const d = await judge(item, extra);
    assert.equal(d.status, 'ROUTINE', item);
  }
});

test('sau buổi thử 16/10: ca bẫy U2 (tiệc cưới người thân giám đốc) đã đóng — chuyển người, ngoài phạm vi SOP', async () => {
  const u2 = userStudyCases.find(c => c.id === 'U2')!;
  assert.equal(u2.designedAs.trap, true, 'thiết kế buổi thử giữ nguyên làm hồ sơ lịch sử');
  const d = await runIsolated(async () => (await evaluateWorkflow({ id: 'U2', ...u2.invoice }, accountant, { forceLocalOnly: true })).decision as RefereeDecision);
  assert.equal(d.status, 'ESCALATED');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'OUT_OF_POLICY');
});

test('không báo nhầm 8%: thuê xe ô tô, điện thoại 5G, quảng cáo trên Internet được 8%; xe ô tô con và cước 4G vẫn bị chặn', async () => {
  for (const item of ['Thuê xe ô tô 7 chỗ đi công tác', 'Điện thoại Samsung 5G cho nhân viên', 'Quảng cáo trên Internet tháng 9', 'Bảo dưỡng xe ô tô công ty'])
    assert.equal((await judge(item, at8)).status, 'ROUTINE', item);
  for (const item of ['Xe ô tô con Toyota Vios', 'Gói cước 4G tháng 9'])
    assert.equal((await judge(item, at8)).status, 'ESCALATED', item);
});

test('ngày lập muộn hơn hôm nay quá 6 tháng (nhập sai năm) không được tự duyệt; câu hỏi hợp lệ', async () => {
  const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const d = await judge('Giấy in A4', { invoiceDate: future });
  assert.equal(d.status, 'ESCALATED');
  assert.equal(d.status === 'ESCALATED' && d.riskGroup, 'UNCERTAIN_INFO');
  assert.deepEqual(checkHandoff(d).errors, []);
});
