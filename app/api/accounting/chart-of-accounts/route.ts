import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, getAccount, CHART_OF_ACCOUNTS } from '@/lib/accounting/chartOfAccounts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const regime = (searchParams.get('regime') as 'CIRCULAR_99_200' | 'CIRCULAR_133') || 'CIRCULAR_99_200';
    const category = searchParams.get('category') as any;

    if (code) {
      const account = getAccount(code, regime);
      if (!account) {
        return NextResponse.json({ error: `Không tìm thấy tài khoản ${code} trong chế độ ${regime}` }, { status: 404 });
      }
      return NextResponse.json({ account });
    }

    const accounts = listAccounts(regime, category);
    return NextResponse.json({
      success: true,
      regime,
      total: accounts.length,
      accounts
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi truy vấn danh mục tài khoản' }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }
