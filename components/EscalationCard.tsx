'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { EscalatedDecision, ActionOption } from '@/lib/schemas';
import { formatVND } from '@/lib/utils';
import {HandoffContext} from './HandoffContext';

interface EscalationCardProps {
  decision: EscalatedDecision | null;
  onResolve: (option: ActionOption) => void;
  onDismiss?: () => void;
  onSelectPreset?: (testId: string) => void;
}

export const EscalationCard: React.FC<EscalationCardProps> = ({ decision, onResolve, onSelectPreset }) => {
  if (!decision) {
    return (
      <div className="w-full bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-4">
        <p className="text-sm font-medium text-slate-700">
          Không có hồ sơ nào đang chờ duyệt ngoại lệ.
        </p>
        {onSelectPreset && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => onSelectPreset('TC-07')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium transition cursor-pointer"
            >
              Xem ca nghi ngờ MST (KTT)
            </button>
            <button
              onClick={() => onSelectPreset('TC-14')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium transition cursor-pointer"
            >
              Xem ca vượt trần Hệ số K (CFO)
            </button>
          </div>
        )}
      </div>
    );
  }

  const riskLabels = {
    UNCERTAIN_INFO: { name: 'Chưa rõ thông tin thực tế', badge: 'bg-slate-100 text-slate-900 border-slate-300' },
    OUT_OF_POLICY: { name: 'Ngoài chính sách quy định', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
    EXCEED_AUTHORITY: { name: 'Vượt thẩm quyền phê duyệt', badge: 'bg-rose-100 text-rose-900 border-rose-300' }
  }[decision.riskGroup];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-none space-y-5">
      {/* Top Tag & Approver Role */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider border ${riskLabels.badge}`}>
          {riskLabels.name}
        </span>

        <span className="text-xs font-medium text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
          Cấp thẩm quyền: <strong className="text-slate-950 font-semibold">{decision.requiresCFO ? 'CFO' : 'Kế toán trưởng'}</strong>
        </span>
      </div>

      {/* Invoice Overview */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 border border-slate-200">
        <div>
          <span className="text-xs text-slate-500 font-numeric font-medium tracking-tight">HĐ #{decision.invoiceId}</span>
          <h4 className="text-base font-medium text-slate-950 mt-0.5">{decision.supplierName}</h4>
          <p className="text-xs font-semibold text-rose-700 mt-0.5">{decision.flaggedReason}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng tiền</div>
          <div className="text-xl font-numeric font-semibold text-slate-950 mt-0.5">
            {formatVND(decision.totalAmount)}
          </div>
        </div>
      </div>

      {/* Actionable Question Display */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-amber-900 block">
          Câu hỏi thẩm định trách nhiệm:
        </span>
        <p className="text-sm font-medium text-slate-950 leading-snug">
          {decision.actionableQuestion}
        </p>
        <p className="text-xs font-medium text-slate-700 pt-1 flex items-center gap-1.5">
          <span className="text-slate-500">Căn cứ SOP:</span>
          <span className="font-semibold text-slate-900 bg-white/80 px-2 py-0.5 rounded border border-slate-200/80">{decision.sopClause}</span>
        </p>
      </div>

      {/* Binary Choice Buttons: Option A & Option B */}
      <HandoffContext decision={decision} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {decision.options.slice(0, 2).map((opt, idx) => (
          <button
            key={opt.id}
            onClick={() => onResolve(opt)}
            className={`flex flex-col text-left p-4 rounded-xl border bg-white transition-colors cursor-pointer group shadow-none hover:shadow-none ${
              idx === 0
                ? 'border-emerald-200/90 hover:border-emerald-600 hover:bg-emerald-50/30'
                : 'border-amber-200/90 hover:border-amber-600 hover:bg-amber-50/30'
            }`}
          >
            <div className="flex items-center justify-between w-full text-xs font-medium mb-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                idx === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                PHƯƠNG ÁN {idx === 0 ? 'A' : 'B'}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-950 group-hover:translate-x-0.5 transition-colors" />
            </div>
            <div className="text-sm font-medium text-slate-950 leading-snug">
              {opt.label}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1.5 leading-relaxed">
              {opt.actionDescription}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
