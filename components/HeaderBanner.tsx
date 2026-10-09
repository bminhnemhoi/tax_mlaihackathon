'use client';

import React from 'react';
import { BookOpen, RotateCcw, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface HeaderBannerProps {
  onOpenPolicy: () => void;
  onResetData: () => void;
  sopVersion?: string;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({ onOpenPolicy, onResetData, sopVersion = 'v2.5' }) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Banner content & 3-Step Compliance Stepper */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-xl text-slate-800 shrink-0 hidden sm:block border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-slate-900" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider font-numeric">
                Quy trình Nghiệm thu Đề bài A
              </span>
              <span className="text-xs text-slate-500 font-medium font-numeric">
                MLAI Hackathon 2026 · The Escalation Referee
              </span>
            </div>

            {/* Stepper Flow */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-wrap pt-0.5">
              <span className="inline-flex items-center gap-1 font-numeric font-bold text-[11px] bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-200">
                1. RUN VERIFY 90s
              </span>
              <span className="text-slate-400 text-[10px]">→</span>
              <span className="inline-flex items-center gap-1 font-numeric font-bold text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                2. Phán quyết Thẻ A/B (HITL)
              </span>
              <span className="text-slate-400 text-[10px]">→</span>
              <span className="inline-flex items-center gap-1 font-numeric font-bold text-[11px] bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                3. Xuất Hồ sơ Thuế 1-Click
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={onOpenPolicy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="Mở Trung tâm Quản trị Quy chế nội bộ và Pháp lý Thuế"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-700" />
            <span>Quy chế Tax-SOP ({sopVersion})</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 text-[10px] font-numeric font-bold">
              GROUND TRUTH
            </span>
          </button>

          <button
            onClick={onResetData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="Khôi phục toàn bộ dữ liệu kiểm thử về trạng thái ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
            <span>Reset Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
