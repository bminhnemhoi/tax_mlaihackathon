import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULE_CATALOG, groupOf, orderFindings, riskGroupsOf, hasNonAcceptableFinding } from '../../lib/riskTaxonomy';
import { policyRuleMatrix } from '../../data/policyContract';
import { SystemPolicyConfigSchema } from '../../lib/schemas';
import { runIsolated } from '../../lib/server/db';
import { evaluateInvoiceLocally } from '../../services/policyEngine';
import { RULE_PROBE_BASE, RULE_PROBES } from '../../data/verification/ruleProbes';

const config = SystemPolicyConfigSchema.parse({});
const finding = (ruleId: string, kind: 'STATUTORY' | 'DATA_QUALITY' | 'INTERNAL_POLICY' | 'AUTHORITY', severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'HIGH') => ({ ruleId, kind, severity });

test('mọi quy tắc trong SOP có đúng một nhóm dừng trong bảng phân loại, SOP và engine không lệch nhau', () => {
  for (const rule of policyRuleMatrix(config)) {
    assert.ok(RULE_CATALOG[rule.id], `thiếu phân loại cho ${rule.id}`);
    assert.equal(rule.group, groupOf(rule.id), rule.id);
  }
  const groups = new Set(Object.values(RULE_CATALOG).map(r => r.group));
  assert.deepEqual([...groups].sort(), ['EXCEED_AUTHORITY', 'OUT_OF_POLICY', 'UNCERTAIN_INFO']);
});

test('engine thật: mỗi quy tắc khi bị kích hoạt gắn đúng nhóm dừng trong bảng phân loại và dừng hóa đơn', async () => {
  await runIsolated(async () => {
    const probeConfig = { ...config, companyTaxCode: RULE_PROBE_BASE.buyerTaxCode };
    const baseline = evaluateInvoiceLocally(RULE_PROBE_BASE, probeConfig);
    assert.equal(baseline.status, 'ROUTINE', 'hóa đơn nền phải thường quy, nếu không đầu dò vô nghĩa');
    const seen = new Set<string>();
    for (const [ruleId, changes] of Object.entries(RULE_PROBES)) {
      const decision = evaluateInvoiceLocally({ ...RULE_PROBE_BASE, ...changes }, probeConfig);
      const hit = decision.findings?.find(f => f.ruleId === ruleId);
      assert.ok(hit, `${ruleId}: đầu dò không kích hoạt quy tắc`);
      assert.ok(RULE_CATALOG[ruleId], `${ruleId}: engine phát hiện nhưng bảng phân loại không có`);
      assert.equal(hit.riskGroup, RULE_CATALOG[ruleId].group, `${ruleId}: engine gắn nhóm khác bảng phân loại`);
      assert.equal(decision.status, 'ESCALATED', `${ruleId}: có phát hiện mà vẫn tự duyệt`);
      assert.ok(decision.riskGroups?.includes(hit.riskGroup), `${ruleId}: nhóm không có trong danh sách nhóm của quyết định`);
      for (const f of decision.findings || []) assert.ok(RULE_CATALOG[f.ruleId], `${f.ruleId}: quy tắc chưa phân loại`);
      seen.add(ruleId);
    }
    // Quy tắc cần ngữ cảnh database được thử trong test-referee-core; phần còn lại phải có đầu dò ở đây.
    const contextOnly = new Set(['RULE_SOURCE_REVIEW', 'RULE_SOURCE_CONFLICT', 'RULE_DUPLICATE_INVOICE', 'STATUTORY_SAME_DAY_CASH_5M', 'RULE_HIGH_RISK_SUPPLIER', 'AUTHORITY_SPLIT_PURCHASE']);
    for (const ruleId of Object.keys(RULE_CATALOG)) if (!contextOnly.has(ruleId)) assert.ok(seen.has(ruleId), `${ruleId}: thiếu đầu dò engine`);
  });
});

test('nhóm chính: ngoài quy định > vượt quyền > chưa rõ thông tin; ca nhiều nhóm báo đủ các nhóm', () => {
  const findings = [finding('RULE_SOURCE_REVIEW', 'DATA_QUALITY'), finding('AUTHORITY_EXCEED_KTT_LIMIT', 'AUTHORITY'), finding('STATUTORY_LAW_48_CASH_PAYMENT', 'STATUTORY', 'CRITICAL')];
  assert.deepEqual(riskGroupsOf(findings), ['OUT_OF_POLICY', 'EXCEED_AUTHORITY', 'UNCERTAIN_INFO']);
});

test('không kết luận vi phạm/vượt quyền trên dữ kiện chưa xác minh: tổng tiền chưa chắc → nhóm chính là chưa rõ thông tin', () => {
  const findings = [finding('AUTHORITY_EXCEED_KTT_LIMIT', 'AUTHORITY'), finding('RULE_SOURCE_REVIEW', 'DATA_QUALITY')];
  assert.equal(orderFindings(findings, ['totalAmount'])[0].ruleId, 'RULE_SOURCE_REVIEW');
  assert.equal(orderFindings(findings, ['sellerStatus'])[0].ruleId, 'AUTHORITY_EXCEED_KTT_LIMIT');
});

test('người có thẩm quyền chỉ được duyệt khi mọi phát hiện còn mở thuộc loại được chấp nhận kèm chứng từ', () => {
  assert.equal(hasNonAcceptableFinding([finding('AUTHORITY_EXCEED_KTT_LIMIT', 'AUTHORITY'), finding('INTERNAL_POLICY_GUEST_ENTERTAINMENT', 'INTERNAL_POLICY')]), false);
  assert.equal(hasNonAcceptableFinding([finding('AUTHORITY_EXCEED_KTT_LIMIT', 'AUTHORITY'), finding('STATUTORY_LAW_48_CASH_PAYMENT', 'STATUTORY')]), true);
});
