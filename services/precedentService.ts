import crypto from 'node:crypto';
import { getDatabase, jsonNow } from '@/lib/server/db';
import { CorporatePrecedent, CorporatePrecedentSchema, InvoiceInput } from '@/lib/schemas';

export const STATUTORY_PATTERNS = new Set([
  'RULE_NON_CASH_5M',
  'RULE_VAT_8_EXCLUDED',
  'RULE_SELLER_CLOSED',
  'RULE_DUPLICATE_INVOICE',
  'RULE_LINE_ITEM_MISMATCH',
  'OUT_OF_POLICY_STATUTORY',
  'STATUTORY_LAW_48_CASH_PAYMENT',
  'STATUTORY_RES_204_VAT_8_EXCLUDED',
  'STATUTORY_DECREE_254_CLOSED_SELLER'
]);

/**
 * Tìm tiền lệ hợp lệ của CFO cho nhà cung cấp và mẫu rủi ro (IMP-12)
 * Nghiêm cấm áp dụng tiền lệ cho các quy định Luật Thuế định chế cứng (Statutory Law)
 */
export function findPrecedentForInvoice(
  invoice: InvoiceInput,
  riskPattern: string
): CorporatePrecedent | null {
  try {
    // Tường lửa pháp lý: Luật cứng tuyệt đối không có tiền lệ
    if (STATUTORY_PATTERNS.has(riskPattern) || riskPattern.startsWith('STATUTORY_')) {
      return null;
    }

    const db = getDatabase();
    const currentDate = invoice.invoiceDate || new Date().toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT 
        id, supplier_tax_code as supplierTaxCode, supplier_name as supplierName,
        risk_pattern as riskPattern, sop_clause as sopClause,
        approved_option as approvedOption, rationale, approved_by as approvedBy,
        effective_from as effectiveFrom, effective_to as effectiveTo,
        status, created_at as createdAt
      FROM corporate_precedents
      WHERE supplier_tax_code = ?
        AND status = 'ACTIVE'
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY datetime(created_at) DESC
    `).all(invoice.supplierTaxCode, currentDate, currentDate) as any[];

    for (const row of rows) {
      // Khớp chính xác riskPattern cụ thể, loại bỏ khớp bao quát để tránh bypass sai luật
      if (row.riskPattern === riskPattern) {
        const scope = db.prepare('SELECT purpose, maximum_amount maximumAmount, current_threshold currentThreshold, version thresholdVersion FROM precedent_scopes WHERE precedent_id=?').get(row.id) as {purpose:string;maximumAmount:number;currentThreshold:number;thresholdVersion:number}|undefined;
        if (!scope || Math.abs(invoice.totalAmount) > scope.currentThreshold || !invoice.itemName.toLocaleLowerCase('vi-VN').includes(scope.purpose.toLocaleLowerCase('vi-VN'))) continue;
        return CorporatePrecedentSchema.parse({...row,...scope});
      }
    }

    return null;
  } catch (err) {
    console.warn('Lỗi tra cứu tiền lệ doanh nghiệp:', err);
    return null;
  }
}

/**
 * Tạo mới tiền lệ ngoại lệ được CFO phê duyệt
 */
export function createPrecedent(params: {
  supplierTaxCode: string;
  supplierName: string;
  riskPattern: string;
  sopClause: string;
  approvedOption: string;
  rationale: string;
  approvedBy: string;
  effectiveMonths?: number;
  purpose?: string;
  maximumAmount?: number;
  currentThreshold?: number;
  originEventId?: string;
}): CorporatePrecedent {
  // 1. Chỉ CFO mới có quyền tạo tiền lệ quy chế nội bộ
  const isCfo = params.approvedBy === 'CFO' || params.approvedBy.includes('(CFO)') || params.approvedBy.toUpperCase().includes('CFO');
  if (!isCfo) {
    throw new Error('Chỉ CFO mới có quyền tạo tiền lệ quy chế nội bộ');
  }

  // 2. Chặn tạo tiền lệ cho các vi phạm luật định chế cứng
  if (
    STATUTORY_PATTERNS.has(params.riskPattern) ||
    params.riskPattern?.startsWith('STATUTORY_') ||
    /5M|NQ\s*204|8%|tiền\s*mặt|đóng\s*mst|chấm\s*dứt\s*mst|luật\s*48/i.test(
      `${params.sopClause || ''} ${params.rationale || ''} ${params.riskPattern || ''}`
    )
  ) {
    throw new Error('Vi phạm Tường lửa Pháp lý: Tuyệt đối không được phép tạo tiền lệ cho quy định Luật thuế định chế cứng (Statutory Tax Law)');
  }

  if(!params.riskPattern.startsWith('INTERNAL_POLICY_')) throw new Error('Chỉ tạo tiền lệ cho quy tắc nội bộ cụ thể.');
  const db = getDatabase();
  const id = `PREC-${crypto.randomUUID()}`;
  const now = jsonNow();
  const effectiveFrom = now.slice(0, 10);

  const months = params.effectiveMonths || 6;
  if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error('Thời hạn tiền lệ từ 1 đến 12 tháng.');
  const maximumAmount = params.maximumAmount ?? 0;
  const threshold = params.currentThreshold ?? 0;
  if (!Number.isFinite(maximumAmount) || maximumAmount < 0 || !Number.isFinite(threshold) || threshold < 0 || threshold > maximumAmount) throw new Error('Ngưỡng phải nằm trong hạn mức CFO.');
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const effectiveTo = d.toISOString().slice(0, 10);

  const precedent: CorporatePrecedent = {
    id,
    supplierTaxCode: params.supplierTaxCode,
    supplierName: params.supplierName,
    riskPattern: params.riskPattern,
    sopClause: params.sopClause,
    approvedOption: params.approvedOption,
    rationale: params.rationale,
    approvedBy: params.approvedBy,
    effectiveFrom,
    effectiveTo,
    status: 'ACTIVE',
    createdAt: now
  };

  db.prepare(`
    INSERT INTO corporate_precedents (
      id, supplier_tax_code, supplier_name, risk_pattern, sop_clause,
      approved_option, rationale, approved_by, effective_from, effective_to,
      status, created_at
    ) VALUES (
      @id, @supplierTaxCode, @supplierName, @riskPattern, @sopClause,
      @approvedOption, @rationale, @approvedBy, @effectiveFrom, @effectiveTo,
      @status, @createdAt
    )
  `).run(precedent);

  db.prepare('INSERT INTO precedent_scopes (precedent_id,purpose,maximum_amount,current_threshold,origin_event_id) VALUES (?,?,?,?,?)').run(id,params.purpose?.trim() || 'CHƯA CẤP PHẠM VI',maximumAmount,threshold,params.originEventId || null);
  return {...precedent,purpose:params.purpose,maximumAmount,currentThreshold:threshold,thresholdVersion:1};
}

/**
 * Lấy toàn bộ danh sách tiền lệ cho trang quản trị
 */
export function listCorporatePrecedents(): CorporatePrecedent[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id, supplier_tax_code as supplierTaxCode, supplier_name as supplierName,
        risk_pattern as riskPattern, sop_clause as sopClause,
        approved_option as approvedOption, rationale, approved_by as approvedBy,
        effective_from as effectiveFrom, effective_to as effectiveTo,
        status, created_at as createdAt
      FROM corporate_precedents
      ORDER BY datetime(created_at) DESC
    `).all() as any[];

    return rows.map(r => { const scope=db.prepare('SELECT purpose,maximum_amount maximumAmount,current_threshold currentThreshold,version thresholdVersion FROM precedent_scopes WHERE precedent_id=?').get(r.id) as object|undefined; return CorporatePrecedentSchema.parse({...r,...scope}); });
  } catch (err) {
    console.warn('Lỗi lấy danh sách tiền lệ:', err);
    return [];
  }
}

/**
 * Thu hồi một tiền lệ
 */
export function revokeCorporatePrecedent(id: string): boolean {
  try {
    const db = getDatabase();
    const res = db.prepare(`
      UPDATE corporate_precedents
      SET status = 'REVOKED'
      WHERE id = ?
    `).run(id);
    return res.changes > 0;
  } catch (err) {
    console.warn('Lỗi thu hồi tiền lệ:', err);
    return false;
  }
}
