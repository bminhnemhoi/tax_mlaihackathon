'use client';

import React from 'react';
import { ShieldCheck, Printer, CheckCircle2, FileText, Building2, Calendar, Award } from 'lucide-react';
import { AuditEntry } from '@/lib/schemas';
import { formatVND, formatDateTime } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TaxDefenseModalProps {
  entry: AuditEntry | null;
  onClose: () => void;
}

export const TaxDefenseModal: React.FC<TaxDefenseModalProps> = ({ entry, onClose }) => {
  if (!entry) return null;

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-200 bg-white shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                Hồ sơ Giải trình Thuế 1-Click (Tax Defense Dossier)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-numeric mt-0.5">
                Mã tham chiếu kiểm toán: <span className="text-emerald-700 font-medium">{entry.id}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Dossier Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* Certificate Banner */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3.5">
            <div className="p-2 bg-emerald-100/70 rounded-lg text-emerald-700 mt-0.5">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-emerald-900 flex items-center gap-2">
                Hồ sơ giải trình đã ghi nhận hợp lệ
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </h4>
              <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                Hồ sơ này là snapshot phục vụ kiểm tra và giải trình nội bộ. Mọi thao tác đã được lưu vết; giá trị pháp lý cuối cùng vẫn thuộc người có thẩm quyền và quy trình ký số của doanh nghiệp.
              </p>
            </div>
          </div>

          {/* Invoice Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90">
              <span className="text-xs text-slate-500 font-medium">Hóa đơn kiểm toán:</span>
              <p className="text-sm font-medium text-slate-900 mt-1 flex items-center gap-2 font-numeric">
                <FileText className="w-4 h-4 text-blue-600" />
                Mã HĐ: {entry.invoiceId}
              </p>
              <p className="text-xs text-slate-700 mt-1.5 flex items-center gap-2 font-medium">
                <Building2 className="w-4 h-4 text-slate-500" />
                Đơn vị bán: {entry.supplierName}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90">
              <span className="text-xs text-slate-500 font-medium">Giá trị thanh toán:</span>
              <p className="text-xl font-numeric font-semibold text-emerald-700 mt-1">
                {formatVND(entry.totalAmount)}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 font-numeric font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Thời điểm ghi nhận: {formatDateTime(entry.timestamp)}
              </p>
            </div>
          </div>

          {/* Action Taken & Plain Explanation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
            <span className="text-xs text-slate-500 font-medium">Quyết định xử lý của người có thẩm quyền:</span>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200 font-medium">
                Người duyệt: {entry.actor === 'CHIEF_ACCOUNTANT' ? 'Kế toán trưởng (KTT)' : entry.actor === 'CFO' ? 'Giám đốc Tài chính (CFO)' : 'Hệ thống AI Referee'}
              </Badge>
              <span className="text-xs font-medium text-slate-800">
                Hành động: {entry.actionTaken}
              </span>
            </div>
            <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed italic">
              {entry.plainExplanation}
            </p>
          </div>

          {/* Legal Basis & Digital Signature */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
            <h5 className="text-[11px] uppercase tracking-wider font-medium text-slate-500">
              Căn cứ pháp lý và trạng thái chứng thực
            </h5>
            <div className="space-y-1.5 text-xs text-slate-700 font-medium">
              <p>• Căn cứ quy chế nội bộ: <span className="text-purple-700 font-medium font-numeric">{entry.sopVersion || 'Tax-SOP-2026 v2.1'}</span></p>
              {entry.applicableRegulations && entry.applicableRegulations.length > 0 ? (
                <p>• Văn bản pháp quy Nhà nước có hiệu lực: <span className="text-blue-700 font-medium font-numeric">{entry.applicableRegulations.join(' · ')}</span></p>
              ) : (
                <p>• Căn cứ pháp quy Nhà nước: Nghị định 123/2020/NĐ-CP, Nghị định 72/2024/NĐ-CP & Thông tư 219/2013/TT-BTC</p>
              )}
              <p>• Audit hash: <span className="font-numeric text-slate-600">Được lưu vết bảo mật trong chuỗi kiểm toán hệ thống</span></p>
              <p>• Trạng thái ký số: <span className="text-amber-700 font-medium">Lưu vết xác thực điện tử nội bộ</span></p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium text-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>In / Xuất PDF Giải trình</span>
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
          >
            Đóng cửa sổ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
