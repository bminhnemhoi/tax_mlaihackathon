'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Fingerprint, KeyRound, Lock, Boxes, ShieldCheck, XCircle, Play } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import type { Capability, Principal, PrincipalInfo } from '@/lib/capabilities';

type Ai = { decisionPathLlmCalls: number; visionAgent: string; visionTimeoutMs: number; ingestionMaxLlmCalls: number; groundingBudgetMs: number; qgenEnabled: boolean; qgenTimeoutMs: number;
  budgets: { visionPerUserHour: number; visionGlobalHour: number; groundingPerSessionHour: number; groundingGlobalHour: number } };
type Info = { principals: PrincipalInfo[]; capabilities: Capability[]; visionAllowedKeys: string[]; commit: string; policyVersion: string; policyHash: string;
  audit: { events: number; headHash: string | null; hmac: boolean }; ai: Ai; warnings: string[] };
type Probe = { id: string; pillar: string; attack: string; expected: string; observed: string; pass: boolean; enforcedBy: string; ms: number };
type Run = { runAt: string; commit: string; summary: { passed: number; total: number; ms: number }; results: Probe[] };

const PILLARS: Array<{ name: string; icon: typeof Fingerprint; question: string }> = [
  { name: 'Định danh', icon: Fingerprint, question: 'Ai (người, hệ thống hay agent AI) đang hành động, với danh tính nào?' },
  { name: 'Đặc quyền tối thiểu', icon: KeyRound, question: 'Mỗi bên chỉ có đúng quyền cần thiết — kể cả agent AI?' },
  { name: 'Ranh giới thực thi', icon: Lock, question: 'Hành động nào được phép, trong điều kiện nào — AI có vượt được không?' },
  { name: 'Cách ly', icon: Boxes, question: 'Sự cố hay dữ liệu độc hại có lan sang phiên, dữ liệu, nhật ký khác không?' },
];
const COLUMNS: Array<{ id: Principal | 'AUTO'; label: string }> = [
  { id: 'ACCOUNTANT', label: 'Kế toán viên' }, { id: 'CHIEF_ACCOUNTANT', label: 'Kế toán trưởng' }, { id: 'CFO', label: 'CFO' }, { id: 'AUTO', label: 'Hệ thống / AI' },
];
const WARNING_TEXT: Record<string, string> = {
  audit_key_missing: 'Chưa đặt khóa audit: nhật ký không có HMAC, điểm neo không có chữ ký, mẫu hậu kiểm đoán trước được.',
  commit_unknown: 'Không xác định được commit đang chạy.',
  qgen_ai_enabled: 'Đang bật AI diễn đạt câu hỏi (mặc định tắt).',
};
const GITHUB = 'https://github.com/khanhle1406/Tax-Referee/blob/main';

async function postProbes(): Promise<Response> {
  let r = await fetch('/api/security/probes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (r.status === 401) {
    await fetch('/api/demo/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preserveExisting: true }) });
    r = await fetch('/api/security/probes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }
  return r;
}

export function TrustCenter() {
  const [info, setInfo] = useState<Info | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/system/capabilities', { cache: 'no-store' }).then(r => r.json()).then(setInfo).catch(() => setError('Không tải được bảng quyền.')); }, []);
  async function runProbes() {
    setBusy(true); setError('');
    try { const r = await postProbes(); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Không chạy được phép thử.'); setRun(data); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không chạy được phép thử.'); } finally { setBusy(false); }
  }
  const humanCaps = info?.capabilities.filter(c => c.allowed.some(p => ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO'].includes(p))) ?? [];
  const machineCaps = info?.capabilities.filter(c => !c.allowed.some(p => ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'CFO'].includes(p))) ?? [];

  return (
    <main className="min-h-[100dvh] bg-slate-100/70 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-slate-950">Trung tâm tin cậy</h1>
              <p className="text-sm text-slate-500">Bảo mật hệ có agent AI trong doanh nghiệp: chứng minh bằng phép thử chạy trên mã đang deploy.</p>
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />Trang chủ</Link>
        </header>

        <section className="rounded-2xl border bg-white p-5 text-sm leading-6">
          <p><strong>Thiết kế:</strong> Tax Referee cố ý <em>không</em> để agent AI quyết định. Quyền ghi trạng thái tài chính nằm trong bộ quy tắc tất định; AI chỉ đọc chứng từ (Vision, không công cụ, không quyền ghi) và tra cứu nguồn chính thống trong ngân sách. Vì vậy rủi ro “agentic” chuyển sang <strong>dữ liệu</strong>: mỗi trường AI viết ra mà quy tắc dùng tới là một quyền — và được kiểm soát như quyền.</p>
          {info && <p className="mt-2 text-xs text-slate-600">Bản đang chạy: commit <code>{info.commit.slice(0, 12)}</code> · policy {info.policyVersion} (<code>{info.policyHash?.slice(0, 10)}</code>) · nhật ký {info.audit.events} sự kiện · HMAC {info.audit.hmac ? 'bật' : <strong className="text-rose-700">tắt</strong>}</p>}
          {info?.warnings.length ? <ul className="mt-2 space-y-1">{info.warnings.map(w => <li key={w} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">Cảnh báo cấu hình: {WARNING_TEXT[w] || w}</li>)}</ul> : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ name, icon: Icon, question }) => {
            const rows = run?.results.filter(r => r.pillar === name) ?? [];
            return <div key={name} className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4" />{name}</div>
              <p className="mt-1 text-xs text-slate-600">{question}</p>
              {run && <p className={`mt-2 text-sm font-semibold ${rows.every(r => r.pass) ? 'text-emerald-700' : 'text-rose-700'}`}>{rows.filter(r => r.pass).length}/{rows.length} phép thử đạt</p>}</div>;
          })}
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="Phép thử tấn công">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-medium">Phép thử tấn công — chạy ngay trên hệ thống này</h2>
              <p className="text-xs text-slate-600">Mỗi phép thử chạy trong một database :memory: riêng, không gọi mạng, không chạm dữ liệu của phiên. Cùng mã này chạy trong CI (tests/unit/securityProbes.test.ts).</p></div>
            <button type="button" onClick={() => void runProbes()} disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"><Play className="h-4 w-4" />{busy ? 'Đang chạy…' : 'Chạy 12 phép thử tấn công'}</button>
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {run && <p role="status" className="text-sm"><strong className={run.summary.passed === run.summary.total ? 'text-emerald-700' : 'text-rose-700'}>{run.summary.passed}/{run.summary.total} đạt</strong> · {run.summary.ms} ms · {new Date(run.runAt).toLocaleString('vi-VN')} · commit <code>{run.commit.slice(0, 12)}</code></p>}
          {run && <ol className="space-y-2" data-testid="probe-results">{run.results.map(r => <li key={r.id} className="rounded-xl border p-3 text-sm">
            <div className="flex items-start gap-2">{r.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
              <div className="min-w-0"><p className="font-medium"><span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.id} · {r.pillar}</span>{r.attack}</p>
                <p className="mt-1 text-xs text-slate-600">Kỳ vọng: {r.expected}</p>
                <p className="mt-0.5 break-words text-xs">Quan sát: <code className="break-words">{r.observed}</code></p>
                <p className="mt-0.5 text-xs text-slate-500">Thực thi bởi: {r.enforcedBy} · {r.ms} ms</p></div></div></li>)}</ol>}
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="Định danh">
          <h2 className="text-lg font-medium">Ai đang hành động — người, hệ thống và agent AI</h2>
          <div className="grid gap-3 md:grid-cols-2">{info?.principals.map(p => <div key={p.id} className="rounded-xl border p-3 text-sm">
            <p className="font-medium"><span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.kind}</span>{p.label}</p>
            <p className="mt-1 text-xs text-slate-600">Danh tính: {p.identity}</p>
            <p className="mt-1 text-xs"><span className="text-emerald-700">Được:</span> {p.mayDo}</p>
            <p className="text-xs"><span className="text-rose-700">Không được:</span> {p.mayNot}</p></div>)}</div>
          {info && <p className="text-xs text-slate-600">Ngân sách agent: đường quyết định <strong>{info.ai.decisionPathLlmCalls}</strong> lần gọi LLM · khâu nạp chứng từ tối đa {info.ai.ingestionMaxLlmCalls} lần (Vision {info.ai.visionTimeoutMs / 1000} giây + tra cứu {info.ai.groundingBudgetMs / 1000} giây) · AI diễn đạt câu hỏi {info.ai.qgenEnabled ? 'BẬT' : 'tắt'} · {info.ai.budgets.visionPerUserHour} lần đọc ảnh/giờ mỗi người · {info.ai.budgets.groundingPerSessionHour} lần tra cứu/giờ mỗi phiên · agent đọc ảnh <code>{info.ai.visionAgent}</code> chỉ được khai {info.visionAllowedKeys.length} trường: {info.visionAllowedKeys.join(', ')}.</p>}
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="Ma trận quyền">
          <h2 className="text-lg font-medium">Ma trận quyền — kiểm bằng test trên hàm thật</h2>
          <p className="text-xs text-slate-600">tests/unit/authzMatrix.test.ts gọi chính hàm thực thi với từng vai trò và so với bảng này; bảng lệch mã thì CI đỏ.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs">
            <thead><tr className="border-b text-slate-500"><th className="py-2 pr-2">Quyền</th>{COLUMNS.slice(0, 3).map(c => <th key={c.id} className="px-2 text-center">{c.label}</th>)}<th className="px-2">Điều kiện</th><th className="px-2">Thực thi bởi</th></tr></thead>
            <tbody>{humanCaps.map(c => <tr key={c.action} className="border-b align-top"><td className="py-2 pr-2 font-medium">{c.label}</td>
              {COLUMNS.slice(0, 3).map(col => <td key={col.id} className="px-2 text-center">{c.allowed.includes(col.id as Principal) ? '✓' : '—'}</td>)}
              <td className="px-2">{c.conditions.join('; ')}</td><td className="px-2 text-slate-500">{c.enforcedBy}</td></tr>)}</tbody>
          </table></div>
          <h3 className="pt-2 text-sm font-medium">Quyền của hệ thống và agent AI</h3>
          <ul className="space-y-1 text-xs">{machineCaps.map(c => <li key={c.action}><strong>{c.label}</strong> — {c.allowed.join(', ')}: {c.conditions.join('; ')} <span className="text-slate-500">({c.enforcedBy})</span></li>)}</ul>
        </section>

        <section className="space-y-2 rounded-2xl border bg-white p-5 text-sm" aria-label="Giới hạn đã biết">
          <h2 className="text-lg font-medium">Giới hạn đã biết — nói thẳng</h2>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
            <li>Định danh trong demo là <strong>vai trò mô phỏng</strong>: một người đổi được 3 vai (chỉ trong phiên demo; ngoài sandbox bị chặn). Production cần SSO/OIDC, MFA khi CFO duyệt, SCIM thu hồi quyền.</li>
            <li>Tiến trình đọc PDF chạy cùng máy, cùng người dùng hệ điều hành với ứng dụng; chưa cô lập bằng container/UID riêng.</li>
            <li>Khóa HMAC nằm cùng host với database: chống được người chỉ ghi được DB, không chống được người chiếm cả máy — vì vậy cần điểm neo lưu ra ngoài (<code>/api/audit/anchor</code>) và mốc bắt buộc ký.</li>
            <li>Một instance SQLite; giới hạn tần suất nằm trong bộ nhớ một tiến trình.</li>
            <li>Ảnh/PDF scan đi qua proxy AI bên thứ ba (dữ liệu ra nước ngoài); XML không qua AI. Chưa xác thực mật mã chữ ký số XML.</li>
            <li>Agent đọc ảnh vẫn có thể đọc sai số tiền một cách cân đối; lớp phòng vệ là kiểm tra số học, ngưỡng trọng yếu, xác minh của người và hậu kiểm ngẫu nhiên — không phải bảo đảm tuyệt đối.</li>
          </ul>
          <p className="pt-1 text-xs">Tài liệu: <a className="underline" href={`${GITHUB}/docs/security/threat-model.md`}>mô hình mối đe dọa</a> · <a className="underline" href={`${GITHUB}/docs/architecture/demo-to-production.md`}>kiến trúc và lộ trình production</a> · <Link className="underline" href="/verify">Kiểm chứng đề A</Link> · <Link className="underline" href="/sop">Quy tắc SOP</Link></p>
        </section>
        <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Số liệu trên trang lấy từ hằng số trong mã và kết quả chạy thật; không có số viết tay.</p>
      </div>
    </main>
  );
}
