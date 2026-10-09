'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  AlertOctagon,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ReconciliationReport, ReconciliationItem } from '@/lib/schemas';

export function TctReconciliationView({
  onNavigateToInvoice
}: {
  onNavigateToInvoice?: (invoiceId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReconciliationReport | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [error, setError] = useState<string>('');

  const formatVND = (amt: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amt);
  };

  const loadReconciliation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reconciliation/tct');
      const result = await res.json();
      if (result.success && result.reconciliation) {
        setData(result.reconciliation);
      } else {
        setError(result.error || 'Không thể tải dữ liệu đối soát');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReconciliation();
  }, []);

  const handleSimulateUpload = async () => {
    setLoading(true);
    setError('');
    try {
      const sampleTctPayload = {
        taxPeriod: '2026-10',
        format: 'json',
        content: JSON.stringify({
          period: '2026-10',
          invoices: [
            {
              series: '1C26TBB',
              number: '0000001',
              date: '2026-10-02',
              sellerTaxCode: '0100109106',
              sellerName: 'TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI',
              preTaxAmount: 10000000,
              taxRate: 10,
              taxAmount: 1000000,
              totalAmount: 11000000,
              taxAuthorityCode: '0100109106260000001889988776655443',
              status: 'APPROVED'
            },
            {
              series: '1C26TBB',
              number: '0000002',
              date: '2026-10-03',
              sellerTaxCode: '0100109106',
              sellerName: 'TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI',
              preTaxAmount: 5000000,
              taxRate: 10,
              taxAmount: 500000,
              totalAmount: 5500000,
              taxAuthorityCode: '0100109106260000002889988776655443',
              status: 'CANCELLED'
            },
            {
              series: '1C26TBB',
              number: '0000099',
              date: '2026-10-04',
              sellerTaxCode: '0101243150',
              sellerName: 'CÔNG TY CỔ PHẦN MISA',
              preTaxAmount: 15000000,
              taxRate: 10,
              taxAmount: 1500000,
              totalAmount: 16500000,
              taxAuthorityCode: '0101243150260000099889988776655443',
              status: 'APPROVED'
            }
          ]
        })
      };

      const res = await fetch('/api/reconciliation/tct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleTctPayload)
      });
      const result = await res.json();
      if (result.success && result.reconciliation) {
        setData(result.reconciliation);
      } else {
        setError(result.error || 'Lỗi khi nhập dữ liệu bảng kê TCT');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi gửi dữ liệu bảng kê TCT');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (data?.items || []).filter((item: ReconciliationItem) => {
    if (selectedGroup === 'ALL') return true;
    return item.status === selectedGroup;
  });

  const matchedTaxAmount = React.useMemo(() => {
    return (data?.items || [])
      .filter(i => i.status === 'MATCHED')
      .reduce((sum, i) => sum + (i.systemInvoice?.taxAmount || i.tctInvoice?.taxAmount || 0), 0);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Đối Soát 3 Chiều Với Cổng Thuế TCT (hoadondientu.gdt.gov.vn)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tự động đối chiếu hóa đơn lưu trữ nội bộ với dữ liệu kê khai thực tế của bên bán trên Tổng cục Thuế.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReconciliation}
            disabled={loading}
            className="text-xs h-9 font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            size="sm"
            onClick={handleSimulateUpload}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-bold shadow-sm"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
            Nạp Bảng Kê TCT Mẫu
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Nhóm Đối Soát Thống Kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* MATCHED */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle hover:border-emerald-500 transition">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>Khớp 100% (Matched)</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-numeric text-slate-950 mt-1">
            {data?.matchedCount || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Thuế GTGT an toàn: <span className="font-bold text-emerald-700">{formatVND(matchedTaxAmount)}</span>
          </p>
        </div>

        {/* MISSING IN VAULT */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle hover:border-amber-500 transition">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700">
            <span>Sót Hóa Đơn (Missing)</span>
            <FileQuestion className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-numeric text-amber-800 mt-1">
            {data?.missingInVaultCount || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Có trên TCT nhưng chưa nhập kho nội bộ
          </p>
        </div>

        {/* UNREPORTED BY SELLER */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle hover:border-rose-500 transition">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-700">
            <span>Chưa Truyền TCT (Rủi ro)</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-numeric text-rose-700 mt-1">
            {data?.unreportedBySellerCount || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Người bán chưa gửi TCT (Nghi HĐ ma)
          </p>
        </div>

        {/* DATA DISCREPANCY */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-subtle hover:border-purple-500 transition">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-700">
            <span>Sai Lệch Dữ Liệu</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-numeric text-purple-800 mt-1">
            {data?.discrepancyCount || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Lệch tiền thuế hoặc HĐ bị bên bán hủy
          </p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'MATCHED', label: 'Khớp hợp lệ' },
            { id: 'MISSING_IN_VAULT', label: 'Sót hóa đơn' },
            { id: 'UNREPORTED_BY_SELLER', label: 'Chưa truyền thuế' },
            { id: 'DATA_DISCREPANCY', label: 'Sai lệch / Hủy' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedGroup(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedGroup === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono font-bold text-slate-500">
          Hiển thị: {filteredItems.length} kết quả
        </div>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Số HĐ / Ký hiệu</th>
                <th className="py-3 px-4">Ngày lập</th>
                <th className="py-3 px-4">Bên Bán (Nhà cung cấp)</th>
                <th className="py-3 px-4 text-right">Tổng tiền</th>
                <th className="py-3 px-4 text-right">Tiền thuế GTGT</th>
                <th className="py-3 px-4 text-center">Phân loại Đối soát</th>
                <th className="py-3 px-4">Khuyến nghị xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    {loading ? 'Đang phân tích đối chiếu...' : 'Không có hóa đơn nào trong nhóm này.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: ReconciliationItem) => {
                  const inv = item.systemInvoice || item.tctInvoice;
                  const groupConfig: Record<string, { label: string; badgeVariant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
                    MATCHED: { label: 'Khớp 100%', badgeVariant: 'success' },
                    MISSING_IN_VAULT: { label: 'Sót hóa đơn', badgeVariant: 'warning' },
                    UNREPORTED_BY_SELLER: { label: 'Chưa truyền thuế', badgeVariant: 'destructive' },
                    DATA_DISCREPANCY: { label: 'Sai lệch dữ liệu', badgeVariant: 'secondary' }
                  };
                  const badge = groupConfig[item.status] || { label: item.status, badgeVariant: 'secondary' };

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {item.invoiceNumber}
                        <span className="block text-[10px] text-slate-500 font-normal">
                          {item.systemInvoice?.invoiceSeries || item.tctInvoice?.invoiceSeries || '---'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {inv?.invoiceDate || '---'}
                      </td>

                      <td className="py-3 px-4 max-w-[200px] truncate">
                        <span className="font-bold text-slate-900 block truncate">
                          {inv?.supplierName || '---'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 block">
                          MST: {inv?.supplierTaxCode || '---'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-numeric font-bold text-slate-900 whitespace-nowrap">
                        {formatVND(inv?.totalAmount || 0)}
                      </td>

                      <td className="py-3 px-4 text-right font-numeric font-bold text-slate-900 whitespace-nowrap">
                        {formatVND(inv?.taxAmount || 0)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge variant={badge.badgeVariant} className="text-[10px] uppercase font-bold tracking-wider">
                          {badge.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-[280px]">
                        <p className="text-[11px] leading-tight font-medium text-slate-800">
                          {item.recommendedAction}
                        </p>
                        {item.discrepancyReasons && item.discrepancyReasons.length > 0 && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {item.discrepancyReasons.join('; ')}
                          </span>
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
