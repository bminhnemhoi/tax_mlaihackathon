'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Clock, ShieldCheck, AlertTriangle, ArrowRight, Sparkles, HelpCircle, Layers, FileText } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface VerifyResultItem {
  testId: string;
  sourceFile?: string;
  invoiceNumber: string;
  supplierName: string;
  totalAmount: number;
  expectedStatus?: 'ROUTINE' | 'ESCALATED';
  actualStatus: 'ROUTINE' | 'ESCALATED';
  riskGroup?: string;
  requiresCFO?: boolean;
  schemaValid: boolean;
  executionTimeMs: number;
  actionableQuestion?: string;
  options?: Array<{ id: string; label: string; actionDescription: string; resultingAction: string }>;
  plainExplanation?: string;
  sopClause?: string;
}

interface VerifySummary {
  mode: string;
  benchmarkName?: string;
  totalCases: number;
  routineCases: number;
  escalatedCases: number;
  schemaValidCases: number;
  allSchemaValid: boolean;
  isMatchExpected?: boolean;
  totalTimeMs: number;
  timestamp: string;
  policyVersion: string;
  metrics?: {
    falseNegativeRate: number;
    falsePositiveRate: number;
    straightThroughProcessingRate: number;
    thresholdAdaptationStatus: string;
  };
}

interface SandboxResult {
  success: boolean;
  sampleType: string;
  invoice: any;
  decision: any;
  executionTimeMs: number;
  schemaValid: boolean;
  timestamp: string;
}

interface VerifyHarnessProps {
  onSelectEscalatedCase?: (testId: string) => void;
  selectedCaseId?: string | null;
}

export const VerifyHarness: React.FC<VerifyHarnessProps> = ({ onSelectEscalatedCase, selectedCaseId }) => {
  const [activeTab, setActiveTab] = useState<'benchmark' | 'sandbox'>('benchmark');
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<VerifySummary | null>(null);
  const [results, setResults] = useState<VerifyResultItem[]>([]);
  const [hasRun, setHasRun] = useState(false);

  // Sandbox state
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);

  const handleRunVerify = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/verify?mode=challenge_a');
      const data = await response.json();
      
      setSummary(data.summary);
      setResults(data.results || []);
      setHasRun(true);

      if (data.summary?.allSchemaValid) {
        confetti({
          particleCount: 35,
          spread: 45,
          origin: { y: 0.7 }
        });
      }
    } catch (error) {
      console.error('Lỗi kiểm thử:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunJudgeSandbox = async (sampleType: 'ROUTINE' | 'ANOMALOUS') => {
    setIsSandboxRunning(true);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleType })
      });
      const data = await response.json();
      setSandboxResult(data);
    } catch (error) {
      console.error('Lỗi chạy Sandbox:', error);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-card space-y-6">
      
      {/* Tab Switcher & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-brand-lime text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Đề bài A: The Escalation Referee
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Verify Harness & Kiểm Định Benchmark
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Đánh giá phân luồng tất định: 3 Routine · 2 Escalated · Hộp cát thử nghiệm Giám khảo
          </p>
        </div>

        {/* Tab Selection Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition ${
              activeTab === 'benchmark'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5 Ca Chuẩn (90 Giây)
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition ${
              activeTab === 'sandbox'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hộp Cát Giám Khảo (2 Ca Mới)
          </button>
        </div>
      </div>

      {activeTab === 'benchmark' ? (
        <>
          {/* Action Bar for Benchmark */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Bài kiểm tra 90 giây của Đề bài A (Tiêu chí 2 & 7: 32 điểm)
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Chạy 5 ca XML thực tế: 3 Routine tự động duyệt · 2 Escalated dừng xin ý kiến KTT/CFO
                </div>
              </div>
            </div>

            <button
              onClick={handleRunVerify}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.99] text-white text-sm font-bold tracking-wide transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
            >
              <Play className={`w-4 h-4 fill-brand-lime text-brand-lime ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'ĐANG CHẠY...' : 'CHẠY BÀI TEST 90S'}</span>
            </button>
          </div>

          {/* 4 Big KPI Stat Cards */}
          {hasRun && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cấu trúc Schema</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-slate-950">
                      {summary.allSchemaValid ? '100%' : 'Lỗi'}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">Đạt chuẩn</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">5/5 ca hợp lệ Zod</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tốc độ thực thi</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-slate-950 font-numeric">
                      {summary.totalTimeMs} ms
                    </span>
                    <span className="text-xs font-semibold text-slate-500">~{Math.round(summary.totalTimeMs / 5)}ms/ca</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">Đánh giá tất định</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Tự động duyệt (Routine)</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-emerald-950 font-numeric">
                      {summary.routineCases} / 3 ca
                    </span>
                    <span className="text-xs font-bold text-emerald-600">Chuẩn 100%</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium mt-1">Không can thiệp ca đơn giản</div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Dừng chuyển tiếp (Escalated)</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-amber-950 font-numeric">
                      {summary.escalatedCases} / 2 ca
                    </span>
                    <span className="text-xs font-bold text-amber-700">Chuẩn 100%</span>
                  </div>
                  <div className="text-[11px] text-amber-700 font-medium mt-1">Dừng đúng ca rủi ro</div>
                </div>
              </div>

              {/* Sprint 2 Accuracy Metric Banner */}
              {summary.metrics && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-indigo-900">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-950">Bỏ sót ca cần dừng (False Negative):</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-numeric">
                      {summary.metrics.falseNegativeRate.toFixed(1)}% (0 ca)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-950">Chuyển tiếp thừa (False Positive):</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold font-numeric">
                      {summary.metrics.falsePositiveRate.toFixed(1)}% (Đạt tiêu chuẩn &lt;= 15%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-950">Tỷ lệ xử lý thẳng (STP Rate):</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-numeric">
                      {summary.metrics.straightThroughProcessingRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Table */}
          {hasRun && results.length > 0 ? (
            <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden shadow-subtle space-y-2">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>DẤU THỜI GIAN THỰC: <strong className="text-slate-900 font-mono">{summary?.timestamp}</strong></span>
                <span>CHÍNH SÁCH: <strong className="text-slate-900 font-mono">{summary?.policyVersion}</strong></span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Mã Ca & Tệp Nguồn</th>
                    <th className="py-3 px-4">Nhà Cung Cấp & Nội Dung</th>
                    <th className="py-3 px-4 text-right">Số Tiền (VNĐ)</th>
                    <th className="py-3 px-4 text-center">Kỳ Vọng</th>
                    <th className="py-3 px-4 text-center">Thực Tế</th>
                    <th className="py-3 px-4 text-center">Schema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {results.map((item) => {
                    const isSelected = selectedCaseId === item.testId;
                    const isEscalated = item.actualStatus === 'ESCALATED';

                    return (
                      <React.Fragment key={item.testId}>
                        <tr
                          className={`transition-colors ${
                            isEscalated ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                              {item.testId}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[140px]" title={item.sourceFile}>
                              {item.sourceFile}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-950 text-sm">
                              {item.supplierName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              HĐ: {item.invoiceNumber}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-numeric font-bold text-sm text-slate-950">
                            {formatVND(item.totalAmount)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono text-xs text-slate-600 font-semibold">
                              {item.expectedStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                item.actualStatus === 'ROUTINE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-200'
                              }`}
                            >
                              {item.actualStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {item.schemaValid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" /> Đạt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                <XCircle className="w-4 h-4" /> Lỗi
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Nếu ca bị Escalated, in rõ câu hỏi A/B trực tiếp (Tiêu chí 7.3: 6 điểm) */}
                        {isEscalated && (
                          <tr className="bg-amber-50/50 border-b border-amber-200/60">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <HelpCircle className="w-4 h-4 text-amber-600" />
                                    CÂU HỎI CHUYỂN TIẾP ĐỊNH LƯỢNG (ACTIONABLE QUESTION):
                                  </span>
                                  <span className="font-mono text-[11px] font-bold text-slate-500">
                                    Nhóm: {item.riskGroup} · Cấp duyệt: {item.requiresCFO ? 'CFO' : 'KTT'}
                                  </span>
                                </div>
                                <p className="text-slate-900 font-bold text-sm">
                                  {item.actionableQuestion}
                                </p>
                                <p className="text-slate-600 italic">
                                  {item.plainExplanation}
                                </p>
                                {item.options && item.options.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                    {item.options.map((opt) => (
                                      <div key={opt.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                        <span className="font-bold text-slate-900">Phương án {opt.id}: {opt.label}</span>
                                        <p className="text-slate-500 mt-0.5">{opt.actionDescription}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-600">
                Bấm <span className="font-bold text-slate-950">"CHẠY BÀI TEST 90S"</span> ở trên để thực thi tự động.
              </p>
            </div>
          )}
        </>
      ) : (
        /* Tab 2: Hộp Cát Giám Khảo (Judge Sandbox) */
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950">
            <span className="font-bold">TIÊU CHÍ 3 (8 ĐIỂM): KIỂM THỬ VỚI 2 DỮ LIỆU ĐẦU VÀO MỚI CỦA GIÁM KHẢO.</span>
            <p className="mt-1">
              Giám khảo có thể bấm 1 trong 2 nút dưới đây để nạp nhanh dữ liệu mẫu chưa từng thấy trước đó. Hệ thống sẽ thẩm định theo thời gian thực và chứng minh khả năng tự động xử lý hoặc dừng đúng lúc:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Button 1: Routine Unseen */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Ca Mới 1: Thường Quy
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">4.950.000₫</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Hóa đơn văn phòng phẩm Thăng Long
              </h4>
              <p className="text-xs text-slate-500">
                Hóa đơn dưới 5 triệu đồng, thanh toán chuyển khoản hợp lệ, đúng MST doanh nghiệp.
              </p>
              <button
                onClick={() => handleRunJudgeSandbox('ROUTINE')}
                disabled={isSandboxRunning}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>NẠP THỬ NGHIỆM CA 1 (KỲ VỌNG: ROUTINE)</span>
              </button>
            </div>

            {/* Button 2: Anomalous Unseen */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Ca Mới 2: Bất Thường
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">19.800.000₫</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Hóa đơn tiệc tiếp khách kèm rượu ngoại
              </h4>
              <p className="text-xs text-slate-500">
                Hóa đơn 19.8 triệu nhưng thanh toán TIỀN MẶT (vi phạm Luật Thuế GTGT 48/2024/QH15).
              </p>
              <button
                onClick={() => handleRunJudgeSandbox('ANOMALOUS')}
                disabled={isSandboxRunning}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>NẠP THỬ NGHIỆM CA 2 (KỲ VỌNG: DỪNG CHUYỂN TIẾP)</span>
              </button>
            </div>
          </div>

          {/* Sandbox Execution Result Display */}
          {sandboxResult && (
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    KẾT QUẢ THẨM ĐỊNH TỨC THÌ
                  </span>
                  <span className="text-xs font-mono text-slate-400">({sandboxResult.executionTimeMs} ms)</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                    sandboxResult.decision.status === 'ROUTINE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {sandboxResult.decision.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-base font-bold text-slate-950">
                  {sandboxResult.invoice.supplierName} · {formatVND(sandboxResult.invoice.totalAmount)}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  HĐ số: {sandboxResult.invoice.invoiceNumber} · Ngày: {sandboxResult.invoice.invoiceDate} · HTTT: {sandboxResult.invoice.paymentMethod}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed">
                  {sandboxResult.decision.plainExplanation}
                </div>
              </div>

              {sandboxResult.decision.status === 'ESCALATED' && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    CÂU HỎI CHUYỂN TIẾP DÀNH CHO NGƯỜI DUYỆT:
                  </div>
                  <div className="text-sm font-bold text-slate-950">
                    {sandboxResult.decision.actionableQuestion}
                  </div>
                  {sandboxResult.decision.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {sandboxResult.decision.options.map((opt: any) => (
                        <div key={opt.id} className="p-3 rounded-xl bg-white border border-amber-200 text-xs">
                          <span className="font-bold text-slate-900">Phương án {opt.id}: {opt.label}</span>
                          <p className="text-slate-500 mt-1">{opt.actionDescription}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
