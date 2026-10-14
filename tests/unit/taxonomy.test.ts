import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULE_CATALOG, groupOf, orderFindings, riskGroupsOf, hasNonAcceptableFinding } from '../../lib/riskTaxonomy';
import { policyRuleMatrix } from '../../data/policyContract';
import { SystemPolicyConfigSchema } from '../../lib/schemas';

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
