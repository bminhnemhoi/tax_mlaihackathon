import type {EscalatedDecision,RefereeHandoff} from '@/lib/schemas';
import type {ReactElement} from 'react';
export function HandoffContext({decision,handoff,showIssues=true}:{decision?:EscalatedDecision;handoff?:RefereeHandoff;showIssues?:boolean}):ReactElement|null {
  const h=handoff || decision?.handoff;
  if(!h)return null;
  return <div className="space-y-3 text-sm">
    <details className="border-b border-slate-200 pb-2"><summary className="cursor-pointer text-xs font-medium text-slate-700">Dữ kiện đối chiếu</summary>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {h.facts.filter(f=>!['invoiceNumber','supplierName','totalAmount'].includes(f.field)).map(f=><div key={f.field} className="min-w-0"><dt className="text-xs text-slate-500">{f.label}</dt><dd className="break-words font-medium font-numeric text-slate-900">{f.value}{f.source==='Chưa xác minh'&&<span className="ml-1 text-xs font-normal text-amber-700">· cần xác minh</span>}</dd></div>)}
    </dl></details>
    {showIssues&&h.openIssues.length>1&&<div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Vấn đề cần xử lý ({h.openIssues.length})</p><ul className="space-y-2 text-xs text-slate-700">{h.openIssues.map(i=><li key={i.ruleId} className="border-l-2 border-amber-300 pl-3"><span className="font-medium">{i.sopClause}: </span>{i.flaggedReason}</li>)}</ul></div>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span>Người nhận: {h.requiredRole==='CFO'?'CFO':'Kế toán trưởng'}</span>
      {h.evidenceRefs.filter(e=>e.kind==='ARTIFACT').map(e=><a key={e.ref} href={`/api/documents/artifacts/${encodeURIComponent(e.ref)}`} target="_blank" rel="noreferrer" className="font-medium underline">Mở chứng từ nguồn</a>)}</div>
    {h.evidenceRefs.some(e=>e.kind==='CONFIRMATION')&&<ul className="space-y-1 text-xs text-slate-600">{h.evidenceRefs.filter(e=>e.kind==='CONFIRMATION').map(e=><li key={e.ref}>{e.ref}: {e.description}</li>)}</ul>}
    {h.openIssues.some(i=>i.legalVerification!=='INTERNAL_POLICY')&&<p className="text-xs text-slate-500">Căn cứ pháp lý còn cần xác minh ở cấp điều khoản; quyết định trong ứng dụng dựa trên SOP.</p>}
    {h.openIssues.filter(i=>i.sourceUrl).map(i=><a key={i.ruleId} href={i.sourceUrl} target="_blank" rel="noreferrer" className="mr-3 inline-block text-xs text-slate-600 underline">Nguồn · {i.sopClause}</a>)}
  </div>;
}
