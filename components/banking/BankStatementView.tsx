'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  ArrowRight,
  ShieldAlert,
  Zap,
  Check
} from 'lucide-react';
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
  const [toastMsg, setToastMsg] = useState('');

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
        setToastMsg(`Đã đồng bộ ${result.importedCount} giao dịch và khớp tự động ${result.autoMatchedCount} hóa đơn!`);
        await loadTransactions();
      } else {
        setError(result.error || 'Lỗi xử lý sao kê');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi gửi dữ liệu sao kê');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Nhập Sao Kê Ngân Hàng & Khớp Ủy Nhiệm Chi (Luật 48/2024/QH15)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tự động chứng minh điều kiện thanh toán không dùng tiền mặt, phòng chống gian lận và kiểm tra quy tắc gộp trong ngày.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTransactions}
            disabled={loading}
            className="text-xs h-9 font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            size="sm"
            onClick={handleSimulateSync}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-bold shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Nạp Sao Kê Mẫu & Khớp Tự Động
          </Button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-emerald-700 font-bold hover:underline cursor-pointer">
            Đóng
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* Warning Box: Quy tắc Gộp nhiều HĐ trong ngày */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            Quy định Bắt buộc: Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15
          </p>
          <p className="text-slate-700 leading-relaxed">
            Trường hợp mua hàng hóa, dịch vụ của một người bán có giá trị dưới 5.000.000 VNĐ nhưng mua nhiều lần trong cùng một ngày có tổng giá trị từ 5.000.000 VNĐ trở lên thì chỉ được khấu trừ thuế đối với trường hợp có chứng từ thanh toán không dùng tiền mặt (sao kê ngân hàng/ủy nhiệm chi). Hệ thống tự động quét và gắn cờ cảnh báo nếu vi phạm!
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng giao dịch sao kê</span>
          <div className="text-2xl font-extrabold font-numeric text-slate-950 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đã khớp hóa đơn (Score ≥ 80đ)</span>
          <div className="text-2xl font-extrabold font-numeric text-emerald-700 mt-1">{stats.matchedCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Chưa gắn hóa đơn</span>
          <div className="text-2xl font-extrabold font-numeric text-slate-700 mt-1">{stats.unmatchedCount}</div>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
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
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    {loading ? 'Đang tải sao kê...' : 'Chưa có giao dịch sao kê ngân hàng nào. Hãy bấm "Nạp Sao Kê Mẫu & Khớp Tự Động".'}
                  </td>
                </tr>
              ) : (
                transactions.map(t => {
                  const isMatched = Boolean(t.matchedInvoiceId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4">
                        <span className="font-numeric font-bold text-slate-900 block">{t.transactionDate}</span>
                        <span className="text-[10px] text-slate-500 font-numeric font-medium">{t.bankCode}</span>
                      </td>

                      <td className="py-3 px-4 font-numeric font-medium text-slate-700 text-xs">
                        {t.referenceNo}
                      </td>

                      <td className="py-3 px-4 text-right font-numeric font-bold text-slate-950 whitespace-nowrap">
                        {formatVND(t.debitAmount)}
                      </td>

                      <td className="py-3 px-4 max-w-[200px] truncate">
                        <span className="font-bold text-slate-900 block truncate">
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
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
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
