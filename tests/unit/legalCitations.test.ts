/**
 * Căn cứ pháp lý phải đúng văn bản và đúng điều khoản (luật cứng: không bịa). Bảng docid dưới đây đã mở và đối chiếu trên
 * vanban.chinhphu.vn ngày 17/10/2026; căn cứ cấp điều/khoản chọn theo NGÀY LẬP hóa đơn.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOVERNMENT_REGULATORY_REGISTRY, listLegalCitations } from '../../data/regulatoryRegistry';
import { buyerTaxCodeBasis, cashPaymentBasis, closedSellerBasis, sameDayCashBasis, seriesYearBasis, taxAuthorityCodeBasis } from '../../lib/legalBasis';
import { getActivePolicy, runIsolated } from '../../lib/server/db';
import { describeRuleEvidence } from '../../services/handoffService';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import type { InvoiceInput } from '../../lib/schemas';

const VERIFIED_DOCID: Record<string, string> = {
  '48/2024/QH15': '212476', '181/2025/NĐ-CP': '214336', '204/2025/QH15': '214209', '123/2020/NĐ-CP': '201365',
  '78/2021/TT-BTC': '204200', '32/2025/TT-BTC': '213855', '254/2026/NĐ-CP': '218689', '219/2013/TT-BTC': '209521',
  '70/2025/NĐ-CP': '213179', '174/2025/NĐ-CP': '214310', '144/2026/NĐ-CP': '218020', '91/2026/TT-BTC': '219006',
};
const docidOf = (url?: string) => url?.match(/[?&]docid=(\d+)/)?.[1];

test('mọi URL vanban.chinhphu.vn trong sổ văn bản và trích dẫn trỏ đúng docid đã đối chiếu', () => {
  for (const doc of GOVERNMENT_REGULATORY_REGISTRY) {
    const id = docidOf(doc.officialUrl);
    if (id) assert.equal(id, VERIFIED_DOCID[doc.code], `${doc.code}: docid ${id}`);
  }
  for (const c of listLegalCitations()) {
    const id = docidOf(c.officialSourceUrl);
    if (id) assert.equal(id, VERIFIED_DOCID[c.documentCode], `${c.documentCode}: docid ${id}`);
  }
  for (const wrong of ['212450', '213890', '201509', '204090', '171954', '214020'])
    assert.ok(!JSON.stringify(GOVERNMENT_REGULATORY_REGISTRY).includes(`docid=${wrong}`) && !JSON.stringify(listLegalCitations()).includes(`docid=${wrong}`), `docid sai ${wrong}`);
});

test('không còn trích dẫn hay quy tắc không có trong văn bản gốc; văn bản chưa đối chiếu được gắn nhãn', () => {
  const all = JSON.stringify([GOVERNMENT_REGULATORY_REGISTRY, listLegalCitations()]);
  assert.ok(!all.includes('bất hợp pháp 100%'));
  assert.ok(!all.includes('ghi đúng tên, địa chỉ, mã số thuế người mua.'), 'câu gán sai cho Luật 48');
  const law48 = listLegalCitations().find(c => c.documentCode === '48/2024/QH15')!;
  assert.ok(!law48.exactQuote.includes('05 triệu'), 'Luật 48 không ghi con số 5 triệu');
  const mccqt = listLegalCitations().find(c => c.exactQuote.includes('Hóa đơn điện tử có mã của cơ quan thuế'))!;
  assert.equal(mccqt.article, 'Điều 3', 'mã của cơ quan thuế ở điểm a khoản 2 Điều 3, không phải Điều 14');
  for (const doc of GOVERNMENT_REGULATORY_REGISTRY.filter(d => ['89/2026/TT-BTC', '67/2025/QH15', '109/2025/QH15', '2392/TCT-QLRR', '255/2026/NĐ-CP'].includes(d.code)))
    assert.match(doc.summary, /chưa đối chiếu nguyên văn/, doc.code);
});

test('căn cứ cấp điều/khoản đổi đúng tại các mốc ngày lập', () => {
  assert.match(cashPaymentBasis('2025-06-30'), /Khoản 2 Điều 15 Thông tư 219\/2013/);
  assert.match(cashPaymentBasis('2025-07-01'), /Điểm b khoản 2 Điều 14 Luật Thuế GTGT 48\/2024.*Điều 26 Nghị định 181\/2025/);
  assert.match(sameDayCashBasis('2025-06-30'), /Khoản 5 Điều 15 Thông tư 219\/2013/);
  assert.match(sameDayCashBasis('2025-07-01'), /Khoản 3 Điều 26 Nghị định 181\/2025/);
  assert.match(seriesYearBasis('2025-05-31'), /Điểm b khoản 1 Điều 4 Thông tư 78\/2021/);
  assert.match(seriesYearBasis('2025-06-01'), /Điểm b khoản 1 Điều 5 Thông tư 32\/2025/);
  assert.match(seriesYearBasis('2026-07-01'), /Thông tư 91\/2026/);
  assert.match(taxAuthorityCodeBasis('2026-06-30'), /Điểm a khoản 2 Điều 3 và khoản 10 Điều 10 Nghị định 123\/2020/);
  assert.match(taxAuthorityCodeBasis('2026-07-01'), /Nghị định 254\/2026/);
  assert.match(buyerTaxCodeBasis('2025-06-30'), /Thông tư 219\/2013.*khoản 5 Điều 10 Nghị định 123\/2020/);
  assert.match(buyerTaxCodeBasis('2025-07-01'), /Điểm a khoản 2 Điều 14 Luật Thuế GTGT 48\/2024/);
  assert.match(closedSellerBasis('2025-05-31'), /^Điều 16 Nghị định 123\/2020\/NĐ-CP$/);
  assert.match(closedSellerBasis('2025-06-01'), /Nghị định 70\/2025/);
  assert.match(closedSellerBasis('2026-07-01'), /Nghị định 254\/2026/);
  // Ngày cuối của khung cũ vẫn dùng văn bản cũ (so sánh >= tại mốc hiệu lực, không lệch một ngày).
  assert.match(seriesYearBasis('2026-06-30'), /Thông tư 32\/2025/);
  assert.match(closedSellerBasis('2026-06-30'), /Nghị định 70\/2025/);
  assert.match(buyerTaxCodeBasis('2026-06-30'), /khoản 5 Điều 10 Nghị định 123\/2020/);
  assert.match(buyerTaxCodeBasis('2026-07-01'), /Nghị định 254\/2026/);
});

test('liên kết nguồn của phát hiện trỏ đúng văn bản được ghi trong căn cứ, ở mọi khung ngày lập', () => {
  const rules = ['STATUTORY_LAW_48_CASH_PAYMENT', 'STATUTORY_SAME_DAY_CASH_5M', 'RULE_BUYER_TAX_CODE_MISMATCH', 'RULE_MCCQT_INVALID', 'RULE_SERIES_YEAR_MISMATCH', 'STATUTORY_DECREE_254_CLOSED_SELLER'];
  for (const date of ['2025-05-31', '2025-06-01', '2025-06-30', '2025-07-01', '2026-06-30', '2026-07-01'])
    for (const ruleId of rules) {
      const f = describeRuleEvidence({ ruleId, kind: 'STATUTORY', severity: 'HIGH', riskGroup: 'OUT_OF_POLICY', flaggedReason: '-', plainExplanation: '-', legalBasis: '' }, date);
      const code = Object.keys(VERIFIED_DOCID).find(k => VERIFIED_DOCID[k] === docidOf(f.sourceUrl));
      assert.ok(code, `${ruleId} @ ${date}: nguồn ${f.sourceUrl} không thuộc bảng đã đối chiếu`);
      assert.ok(f.legalBasis.includes(code.split('/').slice(0, 2).join('/')), `${ruleId} @ ${date}: nguồn ${code} không có trong căn cứ "${f.legalBasis}"`);
    }
});

test('sổ văn bản ghi đúng tên chính thức của NĐ 181/2025 và có NĐ 144/2026 sửa đổi', () => {
  const nd181 = GOVERNMENT_REGULATORY_REGISTRY.find(d => d.code === '181/2025/NĐ-CP')!;
  assert.equal(nd181.title, 'Nghị định quy định chi tiết thi hành một số điều của Luật Thuế giá trị gia tăng');
  const nd144 = GOVERNMENT_REGULATORY_REGISTRY.find(d => d.code === '144/2026/NĐ-CP');
  assert.ok(nd144 && nd144.effectiveFrom === '2026-06-20', 'NĐ 144/2026 hiệu lực 20/6/2026');
});

test('phát hiện của engine hiển thị căn cứ theo ngày lập: cụm tiền mặt trước/sau 01/7/2025, MST người mua, mã cơ quan thuế', async () => {
  await runIsolated(async () => {
    const policy = getActivePolicy();
    const config = { ...policy.config, companyTaxCode: '0102030405' };
    const base: InvoiceInput = { id: 'L1', invoiceNumber: '0000001', invoiceDate: '2025-07-01', supplierTaxCode: '0312345678', supplierName: 'Công ty A',
      buyerTaxCode: '0102030405', sellerStatus: 'ACTIVE', itemName: 'Văn phòng phẩm', preTaxAmount: 2_727_273, taxRate: 10, taxAmount: 272_727, totalAmount: 3_000_000, paymentMethod: 'CASH', isImageBlurry: false, isAdjustment: false };
    const basisOf = (inv: InvoiceInput, others: InvoiceInput[], rule: string) =>
      (evaluateInvoiceLocally(inv, config, policy.version, undefined, others).findings ?? []).find(f => f.ruleId === rule)?.legalBasis ?? '';
    assert.match(basisOf(base, [{ ...base, id: 'L2', invoiceNumber: '0000002' }], 'STATUTORY_SAME_DAY_CASH_5M'), /Khoản 3 Điều 26 Nghị định 181\/2025/);
    const old = { ...base, invoiceDate: '2025-06-30', preTaxAmount: 9_090_909, taxAmount: 909_091, totalAmount: 10_000_000 };
    assert.match(basisOf(old, [{ ...old, id: 'L2', invoiceNumber: '0000002' }], 'STATUTORY_SAME_DAY_CASH_5M'), /Khoản 5 Điều 15 Thông tư 219\/2013/);
    assert.match(basisOf({ ...base, paymentMethod: 'BANK_TRANSFER', buyerTaxCode: '0200200200' }, [], 'RULE_BUYER_TAX_CODE_MISMATCH'), /Điểm a khoản 2 Điều 14.*khoản 5 Điều 10/);
    assert.match(basisOf({ ...base, paymentMethod: 'BANK_TRANSFER', invoiceSeries: '1C25TAA', invoiceDate: '2025-08-01' }, [], 'RULE_MCCQT_INVALID'), /Điểm a khoản 2 Điều 3 và khoản 10 Điều 10/);
    // Biên ngưỡng tiền mặt không đổi: dưới 5 triệu không phát quy tắc từng tờ, đúng 5 triệu thì phát và ghi căn cứ Điều 26 NĐ 181.
    const cash = (total: number) => ({ ...base, id: `C${total}`, preTaxAmount: Math.round(total / 1.1), taxAmount: total - Math.round(total / 1.1), totalAmount: total });
    assert.equal(basisOf(cash(4_999_999), [], 'STATUTORY_LAW_48_CASH_PAYMENT'), '');
    assert.match(basisOf(cash(5_000_000), [], 'STATUTORY_LAW_48_CASH_PAYMENT'), /Điều 26 Nghị định 181\/2025/);
  });
});
