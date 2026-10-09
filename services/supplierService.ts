import fs from 'fs';
import path from 'path';
import { getDatabase, jsonNow } from '@/lib/server/db';
import { SupplierMaster, SupplierMasterSchema } from '@/lib/schemas';

const EVIDENCE_DIR = path.join(process.cwd(), 'data', 'runtime', 'verification_evidence');

function ensureEvidenceDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

export function listSuppliers(filters?: {
  status?: string;
  riskLevel?: string;
  query?: string;
}): SupplierMaster[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM supplier_master WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.riskLevel) {
    sql += ' AND risk_level = ?';
    params.push(filters.riskLevel);
  }
  if (filters?.query) {
    sql += ' AND (tax_code LIKE ? OR legal_name LIKE ? OR trade_name LIKE ?)';
    const q = `%${filters.query.trim()}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY legal_name ASC';

  const rows = db.prepare(sql).all(...params) as Array<{
    tax_code: string;
    legal_name: string;
    trade_name: string | null;
    address: string | null;
    status: string;
    established_date: string | null;
    risk_level: string;
    default_expense_account: string | null;
    last_verified_at: string;
    verification_source: string;
    evidence_snapshot_path: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) =>
    SupplierMasterSchema.parse({
      taxCode: r.tax_code,
      legalName: r.legal_name,
      tradeName: r.trade_name || undefined,
      address: r.address || undefined,
      status: r.status,
      establishedDate: r.established_date || undefined,
      riskLevel: r.risk_level,
      defaultExpenseAccount: r.default_expense_account || undefined,
      lastVerifiedAt: r.last_verified_at,
      verificationSource: r.verification_source,
      evidenceSnapshotPath: r.evidence_snapshot_path || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })
  );
}

export function getSupplier(taxCode: string): SupplierMaster | null {
  const cleanMst = taxCode.trim().replace(/[^0-9-]/g, '');
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM supplier_master WHERE tax_code = ?').get(cleanMst) as {
    tax_code: string;
    legal_name: string;
    trade_name: string | null;
    address: string | null;
    status: string;
    established_date: string | null;
    risk_level: string;
    default_expense_account: string | null;
    last_verified_at: string;
    verification_source: string;
    evidence_snapshot_path: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!r) return null;

  return SupplierMasterSchema.parse({
    taxCode: r.tax_code,
    legalName: r.legal_name,
    tradeName: r.trade_name || undefined,
    address: r.address || undefined,
    status: r.status,
    establishedDate: r.established_date || undefined,
    riskLevel: r.risk_level,
    defaultExpenseAccount: r.default_expense_account || undefined,
    lastVerifiedAt: r.last_verified_at,
    verificationSource: r.verification_source,
    evidenceSnapshotPath: r.evidence_snapshot_path || undefined,
    notes: r.notes || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  });
}

export function upsertSupplier(data: {
  taxCode: string;
  legalName: string;
  tradeName?: string;
  address?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'RELOCATED';
  establishedDate?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH_RISK_INVOICE';
  defaultExpenseAccount?: string;
  verificationSource?: 'TCT_PORTAL' | 'NATIONAL_BIZ_REGISTRY' | 'MANUAL';
  evidenceSnapshotPath?: string;
  notes?: string;
}): SupplierMaster {
  const cleanMst = data.taxCode.trim().replace(/[^0-9-]/g, '');
  const db = getDatabase();
  const now = jsonNow();

  const existing = getSupplier(cleanMst);
  const status = data.status ?? existing?.status ?? 'ACTIVE';
  const riskLevel = data.riskLevel ?? existing?.riskLevel ?? 'LOW';
  const verificationSource = data.verificationSource ?? existing?.verificationSource ?? 'MANUAL';
  const lastVerifiedAt = now;
  const createdAt = existing?.createdAt ?? now;

  db.prepare(`
    INSERT INTO supplier_master (
      tax_code, legal_name, trade_name, address, status,
      established_date, risk_level, default_expense_account,
      last_verified_at, verification_source, evidence_snapshot_path,
      notes, created_at, updated_at
    ) VALUES (
      @taxCode, @legalName, @tradeName, @address, @status,
      @establishedDate, @riskLevel, @defaultExpenseAccount,
      @lastVerifiedAt, @verificationSource, @evidenceSnapshotPath,
      @notes, @createdAt, @updatedAt
    )
    ON CONFLICT(tax_code) DO UPDATE SET
      legal_name = excluded.legal_name,
      trade_name = COALESCE(excluded.trade_name, supplier_master.trade_name),
      address = COALESCE(excluded.address, supplier_master.address),
      status = excluded.status,
      established_date = COALESCE(excluded.established_date, supplier_master.established_date),
      risk_level = excluded.risk_level,
      default_expense_account = COALESCE(excluded.default_expense_account, supplier_master.default_expense_account),
      last_verified_at = excluded.last_verified_at,
      verification_source = excluded.verification_source,
      evidence_snapshot_path = COALESCE(excluded.evidence_snapshot_path, supplier_master.evidence_snapshot_path),
      notes = COALESCE(excluded.notes, supplier_master.notes),
      updated_at = excluded.updated_at
  `).run({
    taxCode: cleanMst,
    legalName: data.legalName.trim(),
    tradeName: data.tradeName?.trim() || null,
    address: data.address?.trim() || null,
    status,
    establishedDate: data.establishedDate || null,
    riskLevel,
    defaultExpenseAccount: data.defaultExpenseAccount?.trim() || null,
    lastVerifiedAt,
    verificationSource,
    evidenceSnapshotPath: data.evidenceSnapshotPath || null,
    notes: data.notes?.trim() || null,
    createdAt,
    updatedAt: now
  });

  return getSupplier(cleanMst)!;
}

export function recordVerificationEvidence(
  taxCode: string,
  evidence: {
    source: 'TCT_PORTAL' | 'NATIONAL_BIZ_REGISTRY' | 'MANUAL';
    rawPayload: unknown;
    notes?: string;
    newStatus?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'RELOCATED';
    newRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH_RISK_INVOICE';
  }
): { supplier: SupplierMaster; snapshotPath: string } {
  ensureEvidenceDir();
  const cleanMst = taxCode.trim().replace(/[^0-9-]/g, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${cleanMst}_${timestamp}.json`;
  const fullPath = path.join(EVIDENCE_DIR, fileName);
  const relativePath = path.join('data', 'runtime', 'verification_evidence', fileName);

  const snapshotContent = {
    taxCode: cleanMst,
    verificationSource: evidence.source,
    verifiedAt: jsonNow(),
    rawPayload: evidence.rawPayload,
    notes: evidence.notes
  };

  fs.writeFileSync(fullPath, JSON.stringify(snapshotContent, null, 2), 'utf-8');

  const existing = getSupplier(cleanMst);
  const legalName = existing?.legalName || `Nhà cung cấp MST ${cleanMst}`;

  const updatedSupplier = upsertSupplier({
    taxCode: cleanMst,
    legalName,
    status: evidence.newStatus || existing?.status || 'ACTIVE',
    riskLevel: evidence.newRiskLevel || existing?.riskLevel || 'LOW',
    verificationSource: evidence.source,
    evidenceSnapshotPath: relativePath,
    notes: evidence.notes || existing?.notes
  });

  return { supplier: updatedSupplier, snapshotPath: relativePath };
}

export function seedDefaultSuppliers(): void {
  const defaultSuppliers = [
    {
      taxCode: '0100109106',
      legalName: 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)',
      tradeName: 'VIETTEL',
      address: 'Số 1 Trần Hữu Dực, Phường Mỹ Đình 2, Quận Nam Từ Liêm, Hà Nội',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6422',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Nhà cung cấp viễn thông chuẩn quốc gia'
    },
    {
      taxCode: '0101243150',
      legalName: 'Công ty Cổ phần MISA',
      tradeName: 'MISA',
      address: 'Tầng 9, Tòa nhà Technosoft, Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6422',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Nhà cung cấp phần mềm kế toán và hóa đơn điện tử'
    },
    {
      taxCode: '0100684378',
      legalName: 'Tập đoàn Bưu chính Viễn thông Việt Nam (VNPT)',
      tradeName: 'VNPT',
      address: 'Tòa nhà VNPT, số 57 phố Huỳnh Thúc Kháng, Phường Láng Hạ, Quận Đống Đa, Hà Nội',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6422',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Nhà cung cấp dịch vụ Internet và chữ ký số'
    },
    {
      taxCode: '0101248141',
      legalName: 'Công ty Cổ phần Viễn thông FPT',
      tradeName: 'FPT Telecom',
      address: 'Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6422',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Đường truyền Internet văn phòng'
    },
    {
      taxCode: '0309129418',
      legalName: 'Công ty TNHH Vòng Tròn Đỏ (Circle K)',
      tradeName: 'Circle K Vietnam',
      address: '160 Bùi Thị Xuân, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6428',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Chuỗi cửa hàng tiện lợi phục vụ văn phòng phẩm và đồ uống tiếp khách'
    },
    {
      taxCode: '0313158739',
      legalName: 'Công ty TNHH MTV Thực phẩm Saigon Co.op (Co.op Food)',
      tradeName: 'Co.op Food',
      address: '199-205 Nguyễn Thái Học, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
      status: 'ACTIVE' as const,
      riskLevel: 'LOW' as const,
      defaultExpenseAccount: '6428',
      verificationSource: 'TCT_PORTAL' as const,
      notes: 'Cung cấp nhu yếu phẩm và văn phòng phẩm'
    }
  ];

  for (const s of defaultSuppliers) {
    upsertSupplier(s);
  }
}
