import { NextRequest, NextResponse } from 'next/server';
import { listSuppliers, getSupplier, upsertSupplier, recordVerificationEvidence, seedDefaultSuppliers } from '@/services/supplierService';
import { SupplierMasterSchema } from '@/lib/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpsertSupplierBodySchema = z.object({
  taxCode: z.string().trim().regex(/^\d{10}(?:-\d{3})?$/, 'MST phải có 10 hoặc 13 chữ số'),
  legalName: z.string().trim().min(1, 'Tên pháp lý không được để trống'),
  tradeName: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED', 'RELOCATED']).optional(),
  establishedDate: z.string().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH_RISK_INVOICE']).optional(),
  defaultExpenseAccount: z.string().optional(),
  verificationSource: z.enum(['TCT_PORTAL', 'NATIONAL_BIZ_REGISTRY', 'MANUAL']).optional(),
  notes: z.string().optional(),
  evidence: z.object({
    source: z.enum(['TCT_PORTAL', 'NATIONAL_BIZ_REGISTRY', 'MANUAL']),
    rawPayload: z.unknown(),
    notes: z.string().optional()
  }).optional()
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taxCode = searchParams.get('taxCode');
    const query = searchParams.get('query') || undefined;
    const status = searchParams.get('status') || undefined;
    const riskLevel = searchParams.get('riskLevel') || undefined;
    const autoSeed = searchParams.get('autoSeed');

    if (autoSeed === 'true') {
      seedDefaultSuppliers();
    }

    if (taxCode) {
      const supplier = getSupplier(taxCode);
      if (!supplier) {
        return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp với MST ' + taxCode }, { status: 404 });
      }
      return NextResponse.json({ supplier });
    }

    const suppliers = listSuppliers({ query, status, riskLevel });
    return NextResponse.json({ suppliers, count: suppliers.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi xử lý yêu cầu' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpsertSupplierBodySchema.parse(body);

    if (parsed.evidence) {
      const res = recordVerificationEvidence(parsed.taxCode, {
        source: parsed.evidence.source,
        rawPayload: parsed.evidence.rawPayload,
        notes: parsed.evidence.notes,
        newStatus: parsed.status,
        newRiskLevel: parsed.riskLevel
      });
      return NextResponse.json({ success: true, supplier: res.supplier, snapshotPath: res.snapshotPath });
    }

    const supplier = upsertSupplier(parsed);
    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Lỗi cập nhật nhà cung cấp' }, { status: 500 });
  }
}
