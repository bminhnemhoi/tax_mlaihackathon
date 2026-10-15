/**
 * Kiểm thử thuộc tính (property-based, QuickCheck — Claessen & Hughes 2000) bằng fast-check: sinh ngẫu nhiên hàng trăm hóa đơn
 * và kiểm tra các bất biến của engine thay vì vài ca viết tay. Mục tiêu: ca giám khảo tự gõ (dữ liệu chưa từng thấy) không làm
 * lộ lỗ hổng kiểu "tiền mặt lớn vẫn tự duyệt" hoặc "ca thường quy bị chuyển tiếp thừa". Seed cố định để tái lập được.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { evaluateWorkflow } from '../../services/workflowService';
import { RefereeDecisionSchema, type InvoiceInput, type RefereeDecision } from '../../lib/schemas';

const COMPANY = '0102030405';
const SEED = 20261017;
const SAFE_ITEMS = ['Phí chuyển phát tài liệu', 'Văn phòng phẩm', 'Giấy in A4', 'Bảo dưỡng máy lạnh văn phòng', 'Mực in laser', 'Bìa hồ sơ nhựa', 'Biểu mẫu in sẵn', 'Dịch vụ vệ sinh văn phòng'];
const OUT_OF_SCOPE_ITEMS = ['Tài trợ giải chạy từ thiện', 'Tiền phạt chậm nộp', 'Giỏ quà Tết biếu đối tác', 'Mỹ phẩm cá nhân', 'Học phí con giám đốc', 'Tiếp khách đối tác - rượu vang'];
const GROUPS = ['OUT_OF_POLICY', 'EXCEED_AUTHORITY', 'UNCERTAIN_INFO'];

const day = fc.integer({ min: 0, max: 280 }).map(n => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10));
/** Hóa đơn hợp lệ về số học, thuế suất 10%, MST người mua đúng; số tiền làm tròn nghìn đồng. */
const invoice = (amount: fc.Arbitrary<number>, items: string[] = SAFE_ITEMS) => fc.record({
  invoiceNumber: fc.integer({ min: 1, max: 9_999_999 }).map(n => String(n).padStart(7, '0')),
  invoiceDate: day,
  itemName: fc.constantFrom(...items),
  preTaxAmount: amount.map(n => Math.round(n / 1000) * 1000),
  paymentMethod: fc.constantFrom('BANK_TRANSFER' as const, 'CASH' as const),
  hasBankSlip: fc.boolean(),
}).map(r => ({ id: `P-${r.invoiceNumber}`, supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Minh An', buyerTaxCode: COMPANY, sellerStatus: 'ACTIVE' as const,
  taxRate: 10, taxAmount: r.preTaxAmount / 10, totalAmount: r.preTaxAmount * 1.1, ...r }) as InvoiceInput);

function engine(inv: InvoiceInput): RefereeDecision {
  const policy = getActivePolicy();
  return evaluateInvoiceLocally(inv, { ...policy.config, companyTaxCode: COMPANY }, policy.version, undefined, []);
}
const ruleIds = (d: RefereeDecision) => (d.findings || []).map(f => f.ruleId).sort();
const groupsOf = (d: RefereeDecision) => d.status === 'ESCALATED' ? (d.riskGroups?.length ? d.riskGroups : [d.riskGroup]) : [];
const prop = <T>(arb: fc.Arbitrary<T>, check: (v: T) => void, numRuns = 200) => fc.assert(fc.property(arb, check), { seed: SEED, numRuns });

test('bất biến đầu ra: đúng schema, tất định, chuyển tiếp luôn có nhóm hợp lệ và đúng 2 lựa chọn A/B, thuế duyệt không vượt thuế hóa đơn', async () => {
  await runIsolated(async () => {
    const anyInvoice = fc.tuple(invoice(fc.integer({ min: 10_000, max: 400_000_000 }), [...SAFE_ITEMS, ...OUT_OF_SCOPE_ITEMS]), fc.boolean(), fc.integer({ min: -50_000, max: 50_000 }))
      .map(([inv, blurry, skew]) => ({ ...inv, isImageBlurry: blurry, totalAmount: inv.totalAmount + skew }));
    prop(anyInvoice, inv => {
      const d = engine(inv);
      assert.ok(RefereeDecisionSchema.safeParse(d).success, 'đúng schema');
      const again = engine(inv);
      assert.deepEqual([again.status, groupsOf(again), ruleIds(again)], [d.status, groupsOf(d), ruleIds(d)], 'cùng đầu vào → cùng kết quả');
      if (d.status === 'ESCALATED') {
        assert.ok(GROUPS.includes(d.riskGroup), `nhóm ${d.riskGroup}`);
        assert.ok(groupsOf(d).includes(d.riskGroup));
        assert.deepEqual(d.options.map(o => o.id), ['A', 'B']);
      } else {
        assert.ok(d.approvedTaxAmount >= 0 && d.approvedTaxAmount <= inv.taxAmount + 1, 'thuế duyệt trong [0, thuế hóa đơn]');
      }
    }, 300);
  });
});

test('tiền mặt từ ngưỡng 5.000.000₫ trở lên không bao giờ được tự duyệt', async () => {
  await runIsolated(async () => {
    prop(invoice(fc.integer({ min: 4_546_000, max: 180_000_000 })).map(inv => ({ ...inv, paymentMethod: 'CASH' as const })).filter(inv => inv.totalAmount >= 5_000_000), inv => {
      const d = engine(inv);
      assert.equal(d.status, 'ESCALATED', `${inv.itemName} ${inv.totalAmount}`);
      assert.ok(d.findings?.some(f => f.kind === 'STATUTORY'), 'có phát hiện theo luật');
    });
  });
});

test('từ hạn mức Kế toán trưởng trở lên luôn chuyển CFO (EXCEED_AUTHORITY), bất kể hàng hóa và thanh toán', async () => {
  await runIsolated(async () => {
    const limit = getActivePolicy().config.kttApprovalLimit;
    prop(invoice(fc.integer({ min: Math.ceil(limit / 1.1) + 1000, max: 2_000_000_000 })), inv => {
      const d = engine(inv);
      assert.equal(d.status, 'ESCALATED');
      assert.ok(d.status === 'ESCALATED' && d.requiresCFO, 'cần CFO');
      assert.ok(groupsOf(d).includes('EXCEED_AUTHORITY'), groupsOf(d).join(','));
    });
  });
});

test('dữ liệu nghi vấn (ảnh mờ, tổng tiền lệch quá 1.000₫) không bao giờ được tự duyệt', async () => {
  await runIsolated(async () => {
    const base = invoice(fc.integer({ min: 100_000, max: 150_000_000 })).map(inv => ({ ...inv, paymentMethod: 'BANK_TRANSFER' as const }));
    prop(base.map(inv => ({ ...inv, isImageBlurry: true })), inv => assert.equal(engine(inv).status, 'ESCALATED'));
    prop(fc.tuple(base, fc.integer({ min: 1_001, max: 5_000_000 }), fc.boolean()).map(([inv, d, up]) => ({ ...inv, totalAmount: inv.totalAmount + (up ? d : -d) })), inv => {
      const d = engine(inv);
      assert.equal(d.status, 'ESCALATED', `tổng ${inv.totalAmount} ≠ ${inv.preTaxAmount} + ${inv.taxAmount}`);
    });
  });
});

test('khoản chi ngoài phạm vi SOP luôn chuyển người với nhóm OUT_OF_POLICY, kể cả số tiền nhỏ và chuyển khoản', async () => {
  await runIsolated(async () => {
    prop(invoice(fc.integer({ min: 50_000, max: 150_000_000 }), OUT_OF_SCOPE_ITEMS).map(inv => ({ ...inv, paymentMethod: 'BANK_TRANSFER' as const })), inv => {
      const d = engine(inv);
      assert.equal(d.status, 'ESCALATED', inv.itemName);
      assert.ok(groupsOf(d).includes('OUT_OF_POLICY'), `${inv.itemName}: ${groupsOf(d).join(',')}`);
    });
  });
});

test('quan hệ biến đổi: đổi tiền mặt dưới ngưỡng sang chuyển khoản không làm ca thường quy bị chuyển tiếp; đổi số hóa đơn không đổi kết quả', async () => {
  await runIsolated(async () => {
    prop(invoice(fc.integer({ min: 10_000, max: 4_500_000 })), inv => {
      const cash = engine({ ...inv, paymentMethod: 'CASH' });
      const bank = engine({ ...inv, paymentMethod: 'BANK_TRANSFER' });
      if (cash.status === 'ROUTINE') assert.equal(bank.status, 'ROUTINE', 'chuyển khoản an toàn hơn tiền mặt');
      const renumbered = engine({ ...inv, invoiceNumber: '0000001', id: 'P-renumbered' });
      assert.deepEqual([renumbered.status, groupsOf(renumbered)], [engine(inv).status, groupsOf(engine(inv))]);
    });
  });
});

test('ca thường quy gõ tay tối thiểu qua toàn bộ luồng (chuyển khoản — từ 5.000.000₫ thì kèm UNC theo luật, dưới 20.000.000₫, hàng thông thường) luôn tự xử lý — không chuyển tiếp thừa', async () => {
  await runIsolated(async () => {
    const db = getDatabase(), policy = getActivePolicy();
    policy.config.companyTaxCode = COMPANY;
    db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
    const accountant = { id: 'prop-accountant', role: 'ACCOUNTANT' as const, email: 'prop@test', displayName: 'Kiểm thử thuộc tính' };
    let n = 0;
    await fc.assert(fc.asyncProperty(fc.record({ itemName: fc.constantFrom(...SAFE_ITEMS), preTax: fc.integer({ min: 20, max: 18_000 }).map(k => k * 1000) }), async ({ itemName, preTax }) => {
      n += 1; // mỗi lần chạy một ngày khác nhau để không cộng dồn cùng bên bán cùng ngày
      const invoiceNumber = String(9_000_000 + n);
      const input = { id: `PW-${invoiceNumber}`, invoiceNumber, invoiceDate: new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10), supplierTaxCode: '0312345678',
        supplierName: 'Công ty TNHH Minh An', itemName, preTaxAmount: preTax, taxRate: 10, taxAmount: preTax / 10, totalAmount: preTax * 1.1, paymentMethod: 'BANK_TRANSFER', ...(preTax * 1.1 >= 5_000_000 ? { hasBankSlip: true } : {}) };
      const d = (await evaluateWorkflow(input, accountant, { forceLocalOnly: true })).decision as RefereeDecision;
      assert.equal(d.status, 'ROUTINE', `${itemName} ${input.totalAmount}₫: ${d.status === 'ESCALATED' ? d.flaggedReason : ''}`);
    }), { seed: SEED, numRuns: 40 });
  });
});
