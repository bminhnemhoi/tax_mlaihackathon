'use client';

import React from 'react';
import { Activity, AlertTriangle, CheckCircle, ShieldAlert, TrendingUp } from 'lucide-react';
import { MacroState } from '@/lib/schemas';
import { formatVND } from '@/lib/utils';

interface MacroHealthWidgetProps {
  macroState: MacroState;
}

export const MacroHealthWidget: React.FC<MacroHealthWidgetProps> = ({ macroState }) => {
  const { kFactor, zone, totalSales, totalPurchases, totalDeductibleTax } = macroState;

  // Cấu hình nhãn và màu sắc theo vùng
  const zoneConfig = {
    SAFE_GREEN: {
      label: 'VÙNG XANH AN TOÀN',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800',
      barColor: 'bg-emerald-500',
      icon: CheckCircle,
      description: 'Hệ số K nằm trong ngưỡng chuẩn (1.0 - 1.3). Theo dõi theo cấu hình nội bộ.'
    },
    WARNING_YELLOW: {
      label: 'VÙNG VÀNG CẢNH BÁO',
      bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-800',
      barColor: 'bg-amber-500',
      icon: AlertTriangle,
      description: 'Hệ số K chạm ngưỡng rủi ro (1.3 - 1.5). Kế toán trưởng cần kiểm soát tỷ lệ hàng mua vào.'
    },
    DANGER_RED: {
      label: 'VÙNG ĐỎ NGUY HIỂM',
      bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-800',
      barColor: 'bg-rose-500',
      icon: ShieldAlert,
      description: 'Hệ số K vượt trần an toàn (> 1.5). Cần rà soát dữ liệu và ngưỡng cấu hình nội bộ.'
    }
  }[zone];

  const ZoneIcon = zoneConfig.icon;

  // Tính phần trăm trên thanh đo (tối đa hiển thị K = 2.0 ứng với 100%)
  const percentage = Math.min(Math.max((kFactor / 2.0) * 100, 0), 100);

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-5  space-y-4">
      {/* Header Widget */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/30 text-foreground border border-border">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Giám sát Rủi ro Toàn cục & Hệ số K
            </h3>
            <p className="text-xs text-muted-foreground">
              Công văn 2392/TCT-QLRR · Chu kỳ giám sát Q3/2026
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${zoneConfig.bgColor}`}>
          <ZoneIcon className="w-4 h-4" />
          <span>{zoneConfig.label}</span>
        </div>
      </div>

      {/* Main Metric Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Metric 1: K-Factor */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Chỉ số Hệ số K:</span>
            <span className="font-numeric text-slate-500">Chuẩn: 1.0 - 1.3</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-4xl font-numeric font-semibold ${zone === 'SAFE_GREEN' ? 'text-emerald-800' : zone === 'WARNING_YELLOW' ? 'text-amber-800' : 'text-rose-800'}`}>
              {kFactor.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground font-numeric">/ 2.0 max</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-colors duration-500 ${zoneConfig.barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {zoneConfig.description}
          </p>
        </div>

        {/* Metric 2: Deductible VAT Total */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Thuế GTGT Đầu vào Được Khấu trừ:</span>
              <span className="font-numeric text-emerald-800 font-medium">Chỉ tiêu [25]</span>
            </div>
            <p className="text-2xl sm:text-3xl font-numeric font-semibold text-emerald-800 mt-2">
              {formatVND(totalDeductibleTax)}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>Doanh số bán ra: <span className="text-foreground font-numeric font-semibold">{formatVND(totalSales)}</span></span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-800" />
          </div>
        </div>
      </div>
    </div>
  );
};
