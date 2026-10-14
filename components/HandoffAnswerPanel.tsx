'use client';
import { useMemo, useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import type { EscalatedDecision } from '@/lib/schemas';
import { fieldLabels, riskGroupLabels } from '@/lib/workflowPresentation';

type Item = NonNullable<NonNullable<EscalatedDecision['handoff']>['questionSpec']>['items'][number];
type Effect = NonNullable<Item['effects']>[number];

const GROUP_STYLE: Record<string, string> = {
  UNCERTAIN_INFO: 'border-amber-300 bg-amber-50 text-amber-900',
  OUT_OF_POLICY: 'border-rose-300 bg-rose-50 text-rose-900',
  EXCEED_AUTHORITY: 'border-violet-300 bg-violet-50 text-violet-900'
};

function effectHint(effect?: Effect): string {
  if (!effect) return '';
  switch (effect.kind) {
    case 'SET_FIELDS': return `→ ghi ${Object.entries(effect.values).map(([k, v]) => `${fieldLabels[k] || k} = ${typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v}`).join(', ')} rồi đánh giá lại`;
    case 'CONFIRM_FIELDS': return `→ xác nhận ${effect.fields.map(f => fieldLabels[f] || f).join(', ')} rồi đánh giá lại`;
    case 'NEED_VALUE': return `→ nhập ${fieldLabels[effect.field] || effect.field} rồi đánh giá lại`;
    case 'RESOLVE': return '→ chấp nhận phát hiện; duyệt khi mọi vấn đề đã được giải quyết';
    case 'REQUEST_INFO': return '→ giữ hồ sơ chờ bổ sung, chưa duyệt thuế';
    case 'REJECT': return '→ từ chối khấu trừ, lưu lý do';
  }
}

/** Trả lời câu hỏi chuyển tiếp một lần ("1A, 2B"): mỗi ý có đúng hai đáp án như trong câu hỏi, hệ thống áp dụng phía máy chủ. */
export function HandoffAnswerPanel({ invoiceId, decision, revision, evaluationId, canAnswer, blockedHint, onDone }: {
  invoiceId: string; decision: EscalatedDecision; revision?: number; evaluationId: string | null; canAnswer: boolean; blockedHint?: string; onDone: () => Promise<void> | void;
}): ReactElement | null {
  const items = useMemo(() => decision.handoff?.questionSpec?.items?.filter(item => item.effects) ?? [], [decision]);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B'>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [quick, setQuick] = useState('');
  const [busy, setBusy] = useState(false);
  if (!items.length || items.length !== (decision.handoff?.questionSpec?.items?.length ?? 0)) return null;
  const pick = (n: number, answer: 'A' | 'B') => setAnswers(prev => ({ ...prev, [String(n)]: answer }));
  const applyQuick = (text: string) => {
    setQuick(text);
    const parsed: Record<string, 'A' | 'B'> = {};
    for (const match of text.toUpperCase().matchAll(/(\d+)\s*([AB])/g)) parsed[match[1]] = match[2] as 'A' | 'B';
    if (items.length === 1 && /^\s*[AB]\s*$/i.test(text)) parsed['1'] = text.trim().toUpperCase() as 'A' | 'B';
    if (Object.keys(parsed).length) setAnswers(prev => ({ ...prev, ...parsed }));
  };
  const needs = items.flatMap(item => { const a = answers[String(item.n)]; const e = a ? item.effects![a === 'A' ? 0 : 1] : undefined; return e?.kind === 'NEED_VALUE' ? [e.field] : []; });
  const complete = items.every(item => answers[String(item.n)]) && needs.every(field => values[field]?.trim()) && reason.trim().length >= 8;
  async function submit(): Promise<void> {
    if (!complete || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, values: Object.fromEntries(needs.map(field => [field, values[field]])), reason, revision, evaluationId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể ghi câu trả lời.');
      const outcome: Record<string, string> = { APPROVED: 'đã duyệt', REJECTED: 'đã từ chối khấu trừ', ON_HOLD: 'đang giữ chờ bổ sung', RE_EVALUATED_ROUTINE: 'đánh giá lại: hợp lệ, đã tự hoàn tất', RE_EVALUATED_ESCALATED: 'đánh giá lại: còn vấn đề, có câu hỏi mới' };
      toast.success(`Đã ghi trả lời ${data.reply}: ${outcome[data.outcome] || data.status}. Đã lưu vào nhật ký.`);
      setAnswers({}); setValues({}); setReason(''); setQuick('');
      await onDone();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể ghi câu trả lời.'); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-4" aria-label="Trả lời câu hỏi chuyển tiếp">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-950">Trả lời một lần {items.length > 1 ? `(${items.length} ý)` : ''}</h3>
      <label className="flex items-center gap-2 text-xs text-slate-600">Gõ nhanh
        <input value={quick} onChange={e => applyQuick(e.target.value)} placeholder={items.map(i => `${i.n}A`).join(', ')} className="h-8 w-32 rounded border px-2 font-mono text-xs" aria-label="Gõ nhanh câu trả lời" />
      </label>
    </div>
    <ol className="space-y-3">
      {items.map(item => {
        const chosen = answers[String(item.n)];
        return <li key={item.n} className="space-y-2">
          <p className="text-sm leading-6 text-slate-900"><span className="mr-2 font-semibold">{item.n}.</span><span className={`mr-2 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${GROUP_STYLE[item.riskGroup] || ''}`}>{riskGroupLabels[item.riskGroup]}</span>{item.text}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['A', 'B'] as const).map((id, index) => <button key={id} type="button" disabled={!canAnswer || busy} onClick={() => pick(item.n, id)} aria-pressed={chosen === id}
              className={`rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${chosen === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-500'}`}>
              <span className="block text-[11px] font-semibold opacity-70">{item.n}{id}</span>
              <span className="block font-medium">{item.answers[index]}</span>
              <span className={`mt-1 block text-[11px] ${chosen === id ? 'text-slate-200' : 'text-slate-500'}`}>{effectHint(item.effects?.[index])}</span>
            </button>)}
          </div>
          {chosen && item.effects?.[chosen === 'A' ? 0 : 1]?.kind === 'NEED_VALUE' && (() => { const field = (item.effects![chosen === 'A' ? 0 : 1] as { field: string }).field; return <label className="block text-xs text-slate-700">{fieldLabels[field] || field}
            <input value={values[field] || ''} onChange={e => setValues(prev => ({ ...prev, [field]: e.target.value }))} type={field.toLowerCase().includes('date') ? 'date' : 'text'} className="mt-1 h-9 w-full rounded border px-2 text-sm" /></label>; })()}
        </li>;
      })}
    </ol>
    <label className="block text-xs text-slate-700">Lý do / bằng chứng (ít nhất 8 ký tự, lưu vào nhật ký)
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded border p-2 text-sm" disabled={!canAnswer || busy} />
    </label>
    {!canAnswer && blockedHint && <p className="text-xs text-amber-800">{blockedHint}</p>}
    <button type="button" onClick={() => void submit()} disabled={!canAnswer || !complete || busy} className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
      {busy ? 'Đang ghi…' : `Gửi câu trả lời${Object.keys(answers).length ? ` (${items.map(i => answers[String(i.n)] ? `${i.n}${answers[String(i.n)]}` : `${i.n}?`).join(', ')})` : ''}`}
    </button>
  </section>;
}
