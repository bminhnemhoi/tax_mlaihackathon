import { requireRequestUser } from '@/lib/server/auth';
import { RequestError, requestErrorResponse } from '@/lib/server/http';
import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, jsonNow } from '@/lib/server/db';
import { parseTctExport } from '@/lib/reconciliation/tctParser';
import { reconcileTctWithSystem } from '@/lib/reconciliation/reconciliationEngine';
import { InvoiceInput, InvoiceInputSchema, TctInvoice, TctInvoiceSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAllSystemInvoices(): InvoiceInput[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT payload_json FROM invoices').all() as Array<{ payload_json: string }>;
  return rows.map(r => InvoiceInputSchema.parse(JSON.parse(r.payload_json)));
}

function getAllTctInvoices(taxPeriod?: string): TctInvoice[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM tct_invoices';
  const params: unknown[] = [];
  if (taxPeriod) {
    sql += ' WHERE tax_period = ?';
    params.push(taxPeriod);
  }
  sql += ' ORDER BY invoice_date DESC';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    tax_period: string;
    invoice_series: string;
    invoice_template: string | null;
    invoice_number: string;
    invoice_date: string;
    supplier_tax_code: string;
    supplier_name: string;
    buyer_tax_code: string | null;
    pre_tax_amount: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
    tax_authority_code: string | null;
    tct_status: string;
    imported_at: string;
  }>;

  return rows.map(r =>
    TctInvoiceSchema.parse({
      id: r.id,
      taxPeriod: r.tax_period,
      invoiceSeries: r.invoice_series,
      invoiceTemplate: r.invoice_template || undefined,
      invoiceNumber: r.invoice_number,
      invoiceDate: r.invoice_date,
      supplierTaxCode: r.supplier_tax_code,
      supplierName: r.supplier_name,
      buyerTaxCode: r.buyer_tax_code || undefined,
      preTaxAmount: r.pre_tax_amount,
      taxRate: r.tax_rate as 0 | 5 | 8 | 10,
      taxAmount: r.tax_amount,
      totalAmount: r.total_amount,
      taxAuthorityCode: r.tax_authority_code || undefined,
      tctStatus: r.tct_status as any,
      importedAt: r.imported_at
    })
  );
}

function saveTctInvoices(invoices: TctInvoice[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO tct_invoices (
      id, tax_period, invoice_series, invoice_template,
      invoice_number, invoice_date, supplier_tax_code,
      supplier_name, buyer_tax_code, pre_tax_amount,
      tax_rate, tax_amount, total_amount,
      tax_authority_code, tct_status, imported_at
    ) VALUES (
      @id, @taxPeriod, @invoiceSeries, @invoiceTemplate,
      @invoiceNumber, @invoiceDate, @supplierTaxCode,
      @supplierName, @buyerTaxCode, @preTaxAmount,
      @taxRate, @taxAmount, @totalAmount,
      @taxAuthorityCode, @tctStatus, @importedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      tct_status = excluded.tct_status,
      tax_amount = excluded.tax_amount,
      total_amount = excluded.total_amount,
      tax_authority_code = excluded.tax_authority_code,
      imported_at = excluded.imported_at
  `);

  const tx = db.transaction((items: TctInvoice[]) => {
    for (const inv of items) {
      stmt.run({
        id: inv.id,
        taxPeriod: inv.taxPeriod,
        invoiceSeries: inv.invoiceSeries,
        invoiceTemplate: inv.invoiceTemplate || null,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        supplierTaxCode: inv.supplierTaxCode,
        supplierName: inv.supplierName,
        buyerTaxCode: inv.buyerTaxCode || null,
        preTaxAmount: inv.preTaxAmount,
        taxRate: inv.taxRate,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        taxAuthorityCode: inv.taxAuthorityCode || null,
        tctStatus: inv.tctStatus,
        importedAt: inv.importedAt
      });
    }
  });

  tx(invoices);
}

async function handleGET(req: NextRequest) {
  try {
    requireRequestUser(req);
    const { searchParams } = new URL(req.url);
    const taxPeriod = searchParams.get('taxPeriod') || undefined;

    const tctInvoices = getAllTctInvoices(taxPeriod);
    const systemInvoices = getAllSystemInvoices();
    const report = reconcileTctWithSystem(tctInvoices, systemInvoices);

    return NextResponse.json({
      success: true,
      report,
      tctInvoicesCount: tctInvoices.length,
      systemInvoicesCount: systemInvoices.length
    });
  } catch (error: any) {
    return requestErrorResponse(error, 'Lỗi đối soát bảng kê Cổng Thuế');
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = requireRequestUser(req);
    const body = await req.json();
    const content = body.content as string;
    const taxPeriod = (body.taxPeriod as string) || '2026-Q1';

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Nội dung bảng kê Cổng Thuế không được để trống' }, { status: 400 });
    }

    let tctInvoices: TctInvoice[];
    try { tctInvoices = parseTctExport(content, taxPeriod); }
    catch { throw new RequestError('Bảng kê TCT sai cấu trúc hoặc thiếu dữ liệu bắt buộc.'); }
    if (tctInvoices.length === 0) {
      return NextResponse.json({ error: 'Không trích xuất được hóa đơn nào từ tệp dữ liệu đã tải lên' }, { status: 400 });
    }

    const result = getDatabase().transaction(() => {
      saveTctInvoices(tctInvoices);
      const systemInvoices = getAllSystemInvoices();
      const report = reconcileTctWithSystem(tctInvoices, systemInvoices);
      return { success: true, importedCount: tctInvoices.length, report };
    })();
    return NextResponse.json(result);
  } catch (error: any) {
    return requestErrorResponse(error, 'Lỗi bóc tách bảng kê Cổng Thuế');
  }
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestDatabase(args[0], () => handleGET(...args)); }

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
