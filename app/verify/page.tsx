'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { VerifyHarness } from '@/components/VerifyHarness';
import { InteractiveInputForm } from '@/components/InteractiveInputForm';
import { DEFAULT_POLICY_CONFIG } from '@/lib/constants';
import { InvoiceInput, RefereeDecision } from '@/lib/schemas';
import { formatVND } from '@/lib/utils';

// Share the pending request across Strict Mode mounts to avoid creating two sessions.
let pendingSession: Promise<boolean> | null = null;
function initializeSession(): Promise<boolean> {
  if (!pendingSession) {
    pendingSession = fetch('/api/demo/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preserveExisting: true })
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể khởi tạo phiên thử nghiệm.');
      return data.demo === true;
    }).finally(() => { pendingSession = null; });
  }
  return pendingSession;
}

export default function VerifyPage() {
  const [sessionState, setSessionState] = useState<'loading' | 'demo' | 'internal' | 'error'>('loading');
  const [sessionError, setSessionError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSessionState('loading');
    initializeSession().then(demo => {
      if (active) setSessionState(demo ? 'demo' : 'internal');
    }).catch(error => {
      if (active) {
        setSessionState('error');
        setSessionError(error instanceof Error ? error.message : 'Không thể mở demo.');
      }
    });
    return () => { active = false; };
  }, [sessionAttempt]);
  const [decision, setDecision] = useState<RefereeDecision | null>(null);
  const [invoice, setInvoice] = useState<InvoiceInput | null>(null);

  return (
    <main className="min-h-screen bg-slate-100/70 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* Top Header - To & Rõ */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-brand-lime shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Verify Harness · Benchmark
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kiểm định chất lượng thẩm tra phân luồng SOP 2026
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>VỀ WORKSPACE</span>
          </Link>
        </header>

        {/* Verify Harness Section */}
        <VerifyHarness />

        {/* Thử nghiệm đơn lẻ (Single Form Test) */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
            <h2 className="text-lg font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
              Nhập Hóa Đơn Thử Nghiệm
            </h2>
            {sessionState === 'loading' && <p role="status">Đang chuẩn bị phiên thử nghiệm…</p>}
            {sessionState === 'error' && <div role="alert"><p>{sessionError}</p><button type="button" className="mt-3 rounded-lg border px-4 py-2 font-semibold" onClick={() => setSessionAttempt(attempt => attempt + 1)}>Thử lại</button></div>}
            {sessionState === 'internal' && <p>Phiên đăng nhập nội bộ được giữ nguyên. Dùng khung nhập JSON phía trên để thử dữ liệu trong sandbox độc lập.</p>}
            {sessionState === 'demo' && <InteractiveInputForm
              demoMode
              onEvaluateResult={(nextDecision, nextInvoice) => {
                setDecision(nextDecision);
                setInvoice(nextInvoice);
              }}
              dynamicConfig={DEFAULT_POLICY_CONFIG}
            />}
          </div>

          {/* Test Case Outcome Display */}
          {decision && invoice ? (
            <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Kết Quả Phân Luồng
                  </span>
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                      decision.status === 'ROUTINE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {decision.status === 'ROUTINE' ? 'ROUTINE' : 'ESCALATED'}
                  </span>
                </div>
                
                <h3 className="mt-4 text-xl font-bold text-slate-950">
                  {invoice.supplierName}
                </h3>
                <div className="text-sm font-mono font-bold text-slate-900 mt-1">
                  HĐ: {invoice.invoiceNumber} · {formatVND(invoice.totalAmount)}
                </div>

                <div
                  className={`mt-4 rounded-xl border p-4 ${
                    decision.status === 'ROUTINE'
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                      : 'border-amber-200 bg-amber-50/70 text-amber-950'
                  }`}
                >
                  <p className="text-sm font-semibold leading-relaxed">
                    {decision.plainExplanation}
                  </p>
                  <p className="mt-2 text-xs font-mono font-bold text-slate-600">
                    Căn cứ: {decision.status === 'ESCALATED' ? decision.sopClause : 'Thông tư 219/2013/TT-BTC & Nghị định 123/2020/NĐ-CP'}
                  </p>
                </div>
              </div>

              {decision.status === 'ESCALATED' && <div className="mt-4 rounded-lg bg-amber-50 p-4"><p className="font-semibold">{decision.actionableQuestion}</p><p className="mt-2 text-sm">Người nhận: {decision.requiresCFO ? 'CFO' : 'Kế toán trưởng'} · Chưa xác định số thuế được duyệt.</p></div>}
              {decision.status === 'ESCALATED' && decision.options && decision.options.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Phương án phán quyết:
                  </span>
                  {decision.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50"
                    >
                      <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{opt.actionDescription}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
              <p className="text-sm font-semibold text-slate-500">
                Nhập hoặc chọn hóa đơn mẫu bên cạnh để xem kết quả tức thì.
              </p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
