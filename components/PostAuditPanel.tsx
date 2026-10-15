'use client';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { toast } from 'sonner';

type Item = { invoiceId: string; invoiceNumber: string; supplierName: string; totalAmount: number; taxAmount: number; status: 'PENDING' | 'REVIEWED'; result: 'CONFIRMED' | 'DISAGREE' | null; reason: string | null };
type Data = { items: Item[]; stats: { sampled: number; pending: number; reviewed: number; agreed: number; disagreed: number; agreement: { rate: number | null; low: number | null; high: number | null } } };
const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';
const pct = (x: number | null) => x === null ? '—' : `${Math.round(x * 100)}%`;

/** Hậu kiểm ngẫu nhiên ca máy tự duyệt: Kế toán trưởng/CFO xem lại mẫu, đo tỉ lệ đồng thuận người–máy (Wilson 95%). */
export function PostAuditPanel({ canReview, onChanged }: { canReview: boolean; onChanged?: () => void | Promise<void> }): ReactElement | null {
  const [data, setData] = useState<Data | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const r = await fetch('/api/post-audits', { cache: 'no-store' });
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return null;
  async function review(item: Item, result: 'CONFIRMED' | 'DISAGREE'): Promise<void> {
    if (reason.trim().length < 8) { toast.error('Ghi lý do ít nhất 8 ký tự.'); return; }
    setBusy(item.invoiceId);
    try {
      const r = await fetch(`/api/post-audits/${encodeURIComponent(item.invoiceId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result, reason }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Không thể ghi kết quả hậu kiểm.');
      toast.success(result === 'CONFIRMED' ? 'Đã xác nhận quyết định tự duyệt. Đã ghi nhật ký.' : 'Đã ghi không đồng ý: hồ sơ được giữ thuế để xem lại.');
      setReason(''); await load(); await onChanged?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể ghi kết quả hậu kiểm.'); } finally { setBusy(''); }
  }
  const { stats } = data;
  const pending = data.items.filter(i => i.status === 'PENDING');
  return <section aria-label="Hậu kiểm ngẫu nhiên" className="space-y-3 rounded-xl border border-lime-300 bg-lime-50/40 p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-semibold">Hậu kiểm ngẫu nhiên ca máy tự duyệt</h3>
      <p className="text-sm text-slate-700" data-testid="post-audit-stats">
        Đã chọn {stats.sampled} · đã xem {stats.reviewed} · đồng thuận người–máy <strong>{pct(stats.agreement.rate)}</strong>
        {stats.reviewed > 0 && <> (KTC 95%: {pct(stats.agreement.low)}–{pct(stats.agreement.high)})</>}
      </p>
    </div>
    <p className="text-xs text-slate-600">Một tỉ lệ nhỏ ca thường quy đã tự duyệt được chọn ngẫu nhiên để người có thẩm quyền xem lại: chống tin máy quá mức và phát hiện quy tắc cần chỉnh. Không đồng ý thì hồ sơ được giữ thuế để xem lại.</p>
    {pending.length === 0 ? <p className="text-sm text-slate-600">Không có ca nào chờ hậu kiểm.</p> : <>
      <ul className="space-y-2">{pending.map(item => <li key={item.invoiceId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm">
        <span><strong>HĐ {item.invoiceNumber}</strong> · {item.supplierName} · {vnd(item.totalAmount)} (thuế {vnd(item.taxAmount)})</span>
        {canReview && <span className="flex gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => void review(item, 'CONFIRMED')} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 disabled:opacity-50">Đồng ý với máy</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void review(item, 'DISAGREE')} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 font-medium text-rose-800 disabled:opacity-50">Không đồng ý — giữ thuế</button>
        </span>}
      </li>)}</ul>
      {canReview
        ? <label className="block text-sm">Lý do / bằng chứng (ít nhất 8 ký tự)<textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-white p-2" placeholder="VD: Đã đối chiếu hợp đồng chuyển phát và UNC" /></label>
        : <p className="text-xs text-slate-600">Kế toán viên không hậu kiểm ca do hệ thống duyệt. Trong demo, đổi vai trò sang Kế toán trưởng ở góc trên.</p>}
    </>}
  </section>;
}
