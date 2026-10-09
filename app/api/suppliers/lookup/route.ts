import { NextRequest, NextResponse } from 'next/server';
import { lookupByTaxCode, lookupByName, validateTaxCode } from '@/services/taxLookupService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taxCode = searchParams.get('taxCode');
    const name = searchParams.get('name');
    const address = searchParams.get('address') || undefined;

    // Chiều 1: Tra theo Mã số thuế -> Lấy Tên NCC & Địa chỉ
    if (taxCode) {
      const val = validateTaxCode(taxCode);
      const result = await lookupByTaxCode(taxCode);

      if (!result) {
        return NextResponse.json({
          found: false,
          taxCode,
          validation: val,
          message: 'Không tìm thấy thông tin đăng ký thuế cho MST này'
        });
      }

      return NextResponse.json({
        found: true,
        data: result,
        validation: val
      });
    }

    // Chiều 2: Tra theo Tên NCC -> Lấy Mã số thuế & Xác thực chéo
    if (name) {
      const result = await lookupByName(name, { address });

      if (!result) {
        return NextResponse.json({
          found: false,
          name,
          message: 'Chưa đủ cơ sở xác thực chính xác mã số thuế cho tên đơn vị này'
        });
      }

      return NextResponse.json({
        found: true,
        data: result
      });
    }

    return NextResponse.json(
      { error: 'Vui lòng cung cấp tham số "taxCode" hoặc "name" để tra cứu' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Lỗi hệ thống khi tra cứu dữ liệu thuế' },
      { status: 500 }
    );
  }
}
