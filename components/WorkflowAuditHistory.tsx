'use client';
import {useEffect,useState} from 'react';
import {displayFieldValue,fieldLabels} from '@/lib/workflowPresentation';

type AuditEvent={id:string;createdAt:string;eventHash:string;payload:{invoice?:Record<string,unknown>;review?:{unresolvedFields?:string[];confirmations?:Array<{field:string;evidence:string;confirmedAt:string}>}};presentation:{title:string;actorName:string;actorRole:string;reason:string;changes:Array<{field:string;label:string;before:unknown;after:unknown}>;artifactId?:string;policyVersion?:string;policyHash?:string;revision?:number;evaluationId?:string;reversesEventId?:string}};
export default function WorkflowAuditHistory({invoiceId}:{invoiceId:string}){
 const [events,setEvents]=useState<AuditEvent[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');setEvents([]);const controller=new AbortController();
  fetch(`/api/audit?entityId=${encodeURIComponent(invoiceId)}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setEvents(d.events || []);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[invoiceId,attempt]);
 return <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-semibold">Lịch sử xử lý hồ sơ</h3>
  {loading && <p role="status" className="text-sm text-slate-600">Đang tải lịch sử…</p>}
  {error && <p role="alert" className="text-sm text-red-700">{error}<button type="button" onClick={()=>setAttempt(n=>n+1)} className="ml-2 underline">Thử lại</button></p>}
  {!loading && !error && !events.length && <p className="text-sm text-slate-600">Hồ sơ chưa có sự kiện kiểm toán.</p>}
  <ol className="space-y-3">{events.map(event=>{
   const p=event.presentation;
   return <li key={event.id} id={`audit-${event.id}`} className="rounded-lg border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-semibold">{p.title}</h4><time dateTime={event.createdAt} className="text-xs text-slate-600">{new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(event.createdAt))}</time></div>
    <p className="mt-1 text-xs text-slate-600">{p.actorName} · {p.actorRole} · Phiên bản hồ sơ {p.revision || 'chưa ghi nhận'}</p>
    <p className="mt-3 text-sm leading-relaxed">{p.reason}</p>
    {p.changes.length>0 && <dl className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">{p.changes.map(change=><div key={change.field} className="grid gap-1 sm:grid-cols-[140px_1fr]"><dt className="font-medium">{change.label}</dt><dd className="break-words">{displayFieldValue(change.field,change.before)} <span aria-label="chuyển thành">→</span> {displayFieldValue(change.field,change.after)}</dd></div>)}</dl>}
    {p.reversesEventId && <p className="mt-3 text-sm">Hoàn tác sự kiện <a className="underline" href={`#audit-${p.reversesEventId}`}>{events.find(e=>e.id===p.reversesEventId)?.presentation.title || p.reversesEventId}</a>.</p>}
    <p className="mt-3 text-xs text-slate-600">Quy chế {p.policyVersion || 'chưa ghi nhận'}{p.evaluationId?` · Lượt đánh giá ${p.evaluationId}`:''}</p>
    {p.artifactId && <a href={`/api/documents/artifacts/${encodeURIComponent(p.artifactId)}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium underline">Mở chứng từ nguồn</a>}
    <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Dữ liệu đầu vào và xác minh</summary>
     <dl className="mt-3 space-y-2 text-sm">{Object.entries(event.payload.invoice || {}).filter(([field])=>field in fieldLabels).map(([field,value])=><div key={field} className="grid gap-1 sm:grid-cols-[140px_1fr]"><dt className="text-slate-600">{fieldLabels[field]}</dt><dd className="break-words">{event.payload.review?.unresolvedFields?.includes(field)?'Chưa xác minh · ':''}{displayFieldValue(field,value)}</dd></div>)}</dl>
     {event.payload.review?.confirmations?.map(c=><p key={c.field} className="mt-2 text-sm">Đã xác minh {fieldLabels[c.field] || c.field}: {c.evidence}.</p>)}
    </details>
    <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs text-slate-600">Nâng cao: dấu vết kỹ thuật</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({eventId:event.id,eventHash:event.eventHash,policyHash:p.policyHash,...event.payload},null,2)}</pre></details>
   </li>;
  })}</ol>
 </section>;
}
