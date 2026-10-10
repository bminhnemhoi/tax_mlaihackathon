import { requireRequestUser } from '@/lib/server/auth';
import { RequestError, requestErrorResponse } from '@/lib/server/http';
import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, jsonNow } from '@/lib/server/db';
import { parseBankStatement } from '@/lib/banking/bankStatementParser';
import { matchInvoicesWithBankTransactions, applyAutoMatchToDatabase } from '@/services/bankMatcherService';
import { BankTransaction, BankTransactionSchema, InvoiceInput, InvoiceInputSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAllBankTransactions(): BankTransaction[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM bank_transactions ORDER BY transaction_date DESC').all() as Array<{
    id: string;
    bank_code: string;
    account_number: string;
    transaction_date: string;
    reference_no: string;
    debit_amount: number;
    credit_amount: number;
    beneficiary_name: string | null;
    beneficiary_account: string | null;
    beneficiary_tax_code: string | null;
    description: string;
    matched_invoice_id: string | null;
    match_score: number | null;
    matched_at: string | null;
    created_at: string;
  }>;

  return rows.map(r =>
    BankTransactionSchema.parse({
      id: r.id,
      bankCode: r.bank_code,
      accountNumber: r.account_number,
      transactionDate: r.transaction_date,
      referenceNo: r.reference_no,
      debitAmount: r.debit_amount,
      creditAmount: r.credit_amount,
      beneficiaryName: r.beneficiary_name || undefined,
      beneficiaryAccount: r.beneficiary_account || undefined,
      beneficiaryTaxCode: r.beneficiary_tax_code || undefined,
      description: r.description,
      matchedInvoiceId: r.matched_invoice_id || undefined,
      matchScore: r.match_score ?? undefined,
      matchedAt: r.matched_at || undefined,
      createdAt: r.created_at
    })
  );
}

function saveBankTransactions(transactions: BankTransaction[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO bank_transactions (
      id, bank_code, account_number, transaction_date,
      reference_no, debit_amount, credit_amount,
      beneficiary_name, beneficiary_account, beneficiary_tax_code,
      description, matched_invoice_id, match_score, matched_at, created_at
    ) VALUES (
      @id, @bankCode, @accountNumber, @transactionDate,
      @referenceNo, @debitAmount, @creditAmount,
      @beneficiaryName, @beneficiaryAccount, @beneficiaryTaxCode,
      @description, @matchedInvoiceId, @matchScore, @matchedAt, @createdAt
    )
    ON CONFLICT(id) DO UPDATE SET
      debit_amount = excluded.debit_amount,
      description = excluded.description,
      beneficiary_name = COALESCE(excluded.beneficiary_name, bank_transactions.beneficiary_name)
  `);

  const tx = db.transaction((items: BankTransaction[]) => {
    for (const t of items) {
      stmt.run({
        id: t.id,
        bankCode: t.bankCode,
        accountNumber: t.accountNumber,
        transactionDate: t.transactionDate,
        referenceNo: t.referenceNo,
        debitAmount: t.debitAmount,
        creditAmount: t.creditAmount || 0,
        beneficiaryName: t.beneficiaryName || null,
        beneficiaryAccount: t.beneficiaryAccount || null,
        beneficiaryTaxCode: t.beneficiaryTaxCode || null,
        description: t.description,
        matchedInvoiceId: t.matchedInvoiceId || null,
        matchScore: t.matchScore || null,
        matchedAt: t.matchedAt || null,
        createdAt: t.createdAt
      });
    }
  });

  tx(transactions);
}

function getAllSystemInvoices(): InvoiceInput[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT payload_json FROM invoices').all() as Array<{ payload_json: string }>;
  return rows.map(r => InvoiceInputSchema.parse(JSON.parse(r.payload_json)));
}

async function handleGET(req: NextRequest) {
  try {
    requireRequestUser(req);
    const transactions = getAllBankTransactions();
    const matchedCount = transactions.filter(t => Boolean(t.matchedInvoiceId)).length;
    const unmatchedCount = transactions.length - matchedCount;

    return NextResponse.json({
      success: true,
      transactions,
      summary: {
        total: transactions.length,
        matchedCount,
        unmatchedCount
      }
    });
  } catch (error: any) {
    return requestErrorResponse(error, 'Lỗi truy vấn sao kê ngân hàng');
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = requireRequestUser(req);
    const body = await req.json();
    const content = body.content as string;
    const defaultBankCode = (body.bankCode as string) || 'VCB';

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Nội dung sao kê ngân hàng không được để trống' }, { status: 400 });
    }

    const transactions = parseBankStatement(content, defaultBankCode);
    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Không trích xuất được giao dịch nào từ tệp sao kê' }, { status: 400 });
    }

    const result = getDatabase().transaction(() => {
      saveBankTransactions(transactions);
      const systemInvoices = getAllSystemInvoices();
      const allTransactions = getAllBankTransactions();
      const matchResult = matchInvoicesWithBankTransactions(systemInvoices, allTransactions);
      const autoMatchedApplied = applyAutoMatchToDatabase(matchResult.matchedPairs, user);
      return { success: true, importedCount: transactions.length,
        autoMatchedCount: matchResult.matchedPairs.length, autoMatchedApplied,
        suggestedCount: matchResult.suggestedPairs.length, matchResult };
    })();
    return NextResponse.json(result);
  } catch (error: any) {
    return requestErrorResponse(error, 'Lỗi xử lý sao kê ngân hàng');
  }
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }

export async function GET(req: NextRequest) { return withRequestDatabase(req, () => handleGET(req)); }
