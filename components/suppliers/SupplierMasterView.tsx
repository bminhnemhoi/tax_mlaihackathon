'use client';

import React, { useState, useEffect } from 'react';

import { ScreenState } from '@/components/workspace/ScreenState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Building2, ShieldCheck, AlertTriangle, RefreshCw, Eye, FileCode } from 'lucide-react';
import { SupplierMaster } from '@/lib/schemas';

export function SupplierMasterView() {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [error, setError] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<{ supplier: SupplierMaster; evidenceData?: unknown } | null>(null);

  const verificationSourceLabel = (source: string) => ({
    TCT_PORTAL: 'Cổng Thuế',
    NATIONAL_BIZ_REGISTRY: 'Đăng ký doanh nghiệp',
    XINVOICE_TAX_API: 'Xinvoice · tra cứu thuế',
    MANUAL: 'Nhập thủ công'
  }[source] || source);

  const loadSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/suppliers?autoSeed=true');
      const data = await res.json();
      if (data.suppliers) {
        setSuppliers(data.suppliers);
      } else {
        setError(data.error || 'Không thể tải danh bạ nhà cung cấp');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const handleViewEvidence = (supplier: SupplierMaster) => {
    // Show only the persisted supplier record; do not fabricate a source snapshot.
    setSelectedEvidence({
      supplier,
      evidenceData: {
        taxCode: supplier.taxCode,
        legalName: supplier.legalName,
        internationalName: supplier.internationalName,
        tradeName: supplier.tradeName,
        address: supplier.address,
        status: supplier.status,
        lastVerifiedAt: supplier.lastVerifiedAt,
        verificationSource: verificationSourceLabel(supplier.verificationSource),
        evidenceSnapshotPath: supplier.evidenceSnapshotPath,
        rawResponseStored: Boolean(supplier.evidenceSnapshotPath)
      }
    });
  };

  if(error)return <ScreenState error title="Không thể tải nhà cung cấp" onRetry={()=>void loadSuppliers()}/>;
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-slate-950 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Danh bạ nhà cung cấp & nguồn xác minh
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý trạng thái MST, mức độ rủi ro hóa đơn và thời điểm tra cứu gần nhất.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSuppliers}
            disabled={loading}
            className="text-xs h-9 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>


      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng Nhà Cung Cấp</span>
          <div className="text-2xl font-semibold font-numeric text-slate-950 mt-1">{suppliers.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-700">Đang Hoạt Động (Active)</span>
          <div className="text-2xl font-semibold font-numeric text-emerald-700 mt-1">
            {suppliers.filter(s => s.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-none">
          <span className="text-xs font-medium uppercase tracking-wider text-rose-700">Rủi Ro Cao (Cảnh Báo TCT)</span>
          <div className="text-2xl font-semibold font-numeric text-rose-700 mt-1">
            {suppliers.filter(s => s.riskLevel === 'HIGH_RISK_INVOICE').length}
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Mã số thuế (MST)</th>
                <th className="py-3 px-4">Tên pháp lý & Tên thương mại</th>
                <th className="py-3 px-4 text-center">Trạng thái MST</th>
                <th className="py-3 px-4 text-center">Phân loại Rủi ro</th>
                <th className="py-3 px-4 text-center">TK Định khoản mặc định</th>
                <th className="py-3 px-4">Nguồn xác minh</th>
                <th className="py-3 px-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map(s => {
                const isHighRisk = s.riskLevel === 'HIGH_RISK_INVOICE';
                const isActive = s.status === 'ACTIVE';

                return (
                  <tr key={s.taxCode} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-numeric font-medium text-slate-900">
                      {s.taxCode}
                    </td>

                    <td className="py-3 px-4 max-w-[260px]">
                      <span className="font-medium text-slate-900 block truncate" title={s.legalName}>
                        {s.legalName}
                      </span>
                      {s.tradeName && (
                        <span className="text-[10px] text-slate-500 font-numeric block">
                          ({s.tradeName})
                        </span>
                      )}
                      {s.address && (
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={s.address}>
                          {s.address}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge variant={isActive ? 'success' : 'destructive'} className="text-[10px] font-medium">
                        {isActive ? 'ĐANG HOẠT ĐỘNG' : s.status}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isHighRisk ? (
                        <Badge variant="destructive" className="text-[10px] font-medium gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          RỦI RO CAO
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-medium text-slate-700">
                          AN TOÀN
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap font-numeric font-medium text-slate-800">
                      {s.defaultExpenseAccount ? (
                        <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                          TK {s.defaultExpenseAccount}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">Chưa cấu hình</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <span className="text-[11px] block">{verificationSourceLabel(s.verificationSource)}</span>
                      <span className="text-[10px] text-slate-500 block">{s.lastVerifiedAt?.slice(0, 10)}</span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => { event.currentTarget.focus(); handleViewEvidence(s); }}
                        className="h-7 px-2.5 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200 gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Evidence Snapshot Modal */}
      {selectedEvidence && (
        <Dialog open={Boolean(selectedEvidence)} onOpenChange={() => setSelectedEvidence(null)}>
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-medium text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Thông tin nhà cung cấp
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dữ liệu hiện được lưu trong danh bạ nhà cung cấp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Nhà cung cấp:</span>
                  <span className="font-medium text-slate-900">{selectedEvidence.supplier.legalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Mã số thuế:</span>
                  <span className="font-numeric font-medium text-slate-900">{selectedEvidence.supplier.taxCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Thời điểm tra cứu:</span>
                  <span className="font-numeric text-slate-800">{selectedEvidence.supplier.lastVerifiedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Nguồn dữ liệu:</span>
                  <span className="font-medium text-blue-700">{verificationSourceLabel(selectedEvidence.supplier.verificationSource)}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <FileCode className="h-4 w-4 text-slate-500" />
                  Dữ liệu bản ghi (JSON):
                </span>
                <pre className="p-3 bg-slate-50 text-slate-800 font-mono text-[11px] rounded-xl overflow-x-auto max-h-[220px]">
                  {JSON.stringify(selectedEvidence.evidenceData, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
