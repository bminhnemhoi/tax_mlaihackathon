import { requireRequestUser } from '@/lib/server/auth';
import { RequestError, requestErrorResponse } from '@/lib/server/http';
import { isSandbox, withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { listSuppliers, getSupplier, upsertSupplier, recordVerificationEvidence, seedDefaultSuppliers } from '@/services/supplierService';
import { SupplierMasterSchema } from '@/lib/schemas';
import { TAX_CODE_FORMAT_REGEX } from '@/lib/taxCode';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpsertSupplierBodySchema = z.object({
  taxCode: z.string().trim().regex(TAX_CODE_FORMAT_REGEX, 'MST phải có 10, 12 hoặc 13 chữ số'),
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

async function handleGET(req: NextRequest) {
  try {
    requireRequestUser(req);
    const { searchParams } = new URL(req.url);
    const taxCode = searchParams.get('taxCode');
    const query = searchParams.get('query') || undefined;
    const status = searchParams.get('status') || undefined;
    const riskLevel = searchParams.get('riskLevel') || undefined;
    const autoSeed = searchParams.get('autoSeed');

    if (autoSeed === 'true') {
      if (!isSandbox()) throw new RequestError('Chỉ tạo dữ liệu mẫu trong demo.', 403);
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
    return requestErrorResponse(error, 'Lỗi xử lý yêu cầu');
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = requireRequestUser(req);
    if (user.role === 'ACCOUNTANT') throw new RequestError('Cần Kế toán trưởng hoặc CFO để cập nhật nhà cung cấp.', 403);
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
    return requestErrorResponse(error, 'Lỗi cập nhật nhà cung cấp');
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
