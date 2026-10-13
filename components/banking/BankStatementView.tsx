'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ScreenState } from '@/components/workspace/ScreenState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Landmark, RefreshCw, Upload, Check } from 'lucide-react';
import { BankTransaction } from '@/lib/schemas';

export function BankStatementView({
  onNavigateToInvoice
}: {
  onNavigateToInvoice?: (invoiceId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [stats, setStats] = useState({ total: 0, matchedCount: 0, unmatchedCount: 0 });
  const [error, setError] = useState('');

  const formatVND = (amt: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amt);
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/banking/sync');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setStats({
          total: data.summary?.total || 0,
          matchedCount: data.summary?.matchedCount || 0,
          unmatchedCount: data.summary?.unmatchedCount || 0
        });
      } else {
        setError(data.error || 'Không thể tải sao kê ngân hàng');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions();
  }, []);

  const handleSimulateSync = async () => {
    setLoading(true);
    setError('');
    try {
      // Mẫu sao kê Vietcombank & Techcombank chuẩn
      const sampleCsv = `date,referenceNo,debitAmount,beneficiaryAccount,description,beneficiaryTaxCode
2026-10-02,QA-VCB-001,11000000,1029384756,"Chuyen khoan thanh toan tien cuoc vien thong Viettel HD 0000001",0100109106
2026-10-03,QA-VCB-002,5500000,9988776655,"Thanh toan tien thiet bi may in van phong MISA MST 0101243150",0101243150
2026-10-04,QA-VCB-003,3300000,1122334455,"Thanh toan tien giay in van phong pham cho tap hoa Minh Hang",0109988776`;

      const res = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode: 'VIETCOMBANK',
          content: sampleCsv,
          mimeType: 'text/csv',
          autoApply: true
        })
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Đã nhập ${result.importedCount} giao dịch, khớp ${result.autoMatchedCount} hóa đơn.`);
        await loadTransactions();
      } else {
        toast.error('Không thể xử lý sao kê.');
      }
    } catch (err: any) {
      toast.error('Không gửi được sao kê. Hãy thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if(error)return <ScreenState error title="Không thể tải sao kê" onRetry={()=>void loadTransactions()}/>;
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-slate-950 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Giao dịch sao kê
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Đối chiếu chứng từ thanh toán với hóa đơn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTransactions}
            disabled={loading}
            className="text-xs h-9 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            size="sm"
            onClick={handleSimulateSync}
            disabled={loading}
            className="bg-primary hover:bg-slate-800 text-white text-xs h-9 font-medium shadow-none"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Nạp sao kê mẫu
          </Button>
        </div>
      </div>



      <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Quy tắc thanh toán áp dụng</summary><p className="mt-2 max-w-3xl">Hệ thống kiểm tra chứng từ thanh toán và các giao dịch cùng ngày theo cấu hình SOP. Căn cứ điều khoản cần được nghiệp vụ đối chiếu trước khi kết luận pháp lý.</p></details>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng giao dịch sao kê</span>
          <div className="text-2xl font-semibold font-numeric text-slate-950 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-700">Đã khớp hóa đơn (Score ≥ 80đ)</span>
          <div className="text-2xl font-semibold font-numeric text-emerald-700 mt-1">{stats.matchedCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Chưa gắn hóa đơn</span>
          <div className="text-2xl font-semibold font-numeric text-slate-700 mt-1">{stats.unmatchedCount}</div>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Ngày GD / Ngân hàng</th>
                <th className="py-3 px-4">Mã tham chiếu</th>
                <th className="py-3 px-4 text-right">Số tiền ghi nợ</th>
                <th className="py-3 px-4">Người thụ hưởng & MST</th>
                <th className="py-3 px-4">Nội dung chuyển khoản</th>
                <th className="py-3 px-4 text-center">Trạng thái Khớp HĐ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    {loading ? 'Đang tải sao kê...' : 'Chưa có giao dịch. Nạp sao kê mẫu để thử đối soát.'}
                  </td>
                </tr>
              ) : (
                transactions.map(t => {
                  const isMatched = Boolean(t.matchedInvoiceId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4">
                        <span className="font-numeric font-medium text-slate-900 block">{t.transactionDate}</span>
                        <span className="text-[10px] text-slate-500 font-numeric font-medium">{t.bankCode}</span>
                      </td>

                      <td className="py-3 px-4 font-numeric font-medium text-slate-700 text-xs">
                        {t.referenceNo}
                      </td>

                      <td className="py-3 px-4 text-right font-numeric font-medium text-slate-950 whitespace-nowrap">
                        {formatVND(t.debitAmount)}
                      </td>

                      <td className="py-3 px-4 max-w-[200px] truncate">
                        <span className="font-medium text-slate-900 block truncate">
                          {t.beneficiaryName || '---'}
                        </span>
                        <span className="font-numeric text-[10px] text-slate-500 block font-medium">
                          MST: {t.beneficiaryTaxCode || '---'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-[260px] truncate" title={t.description}>
                        {t.description}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isMatched ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Khớp HĐ ({t.matchScore || 100}đ)</span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Chưa khớp
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
