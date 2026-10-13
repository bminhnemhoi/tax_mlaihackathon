import { withRequestDatabase } from '@/lib/server/db';
import { lookupOfficialSupplierIdentity } from '@/services/officialSupplierLookupService';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taxCode = (searchParams.get('taxCode') || '').trim();
    const name = (searchParams.get('name') || '').trim();
    const address = (searchParams.get('address') || '').trim();
    if (!taxCode && !name) {
      return NextResponse.json({ error: 'Vui lòng cung cấp tên nhà cung cấp hoặc MST.' }, { status: 400 });
    }

    const identity = await lookupOfficialSupplierIdentity({ supplierName: name, supplierTaxCode: taxCode, address });
    if (identity.status === 'VERIFIED') {
      return NextResponse.json({
        found: true,
        lookupStatus: identity.status,
        supplierIdentity: identity,
        data: {
          taxCode: identity.supplierTaxCode,
          legalName: identity.legalName,
          supplierName: identity.legalName,
          isVerified: true,
          sources: identity.sources
        }
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      found: false,
      lookupStatus: identity.status,
      supplierIdentity: identity,
      message: identity.message || 'Chưa xác minh được nhà cung cấp từ nguồn chính thống.'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      found: false,
      lookupStatus: 'SOURCE_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Không thể tra cứu nhà cung cấp.'
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) {
  return withRequestDatabase(args[0], () => handleGET(...args));
}
