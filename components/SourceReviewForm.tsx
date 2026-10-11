'use client';

import { useRef, useState } from 'react';
import { InvoiceInputSchema, SourceConfirmation } from '@/lib/schemas';
import { displayFieldValue, fieldLabels, reviewFields } from '@/lib/workflowPresentation';

export type SourceReview = {
  unresolvedFields?: string[]; sourceValues?: Record<string, unknown> | null;
  rawInput?: Record<string, unknown>; confirmations?: Array<{field:string;evidence:string;confirmedAt:string;confirmedBy:string}>;
};
type Props = { invoice: unknown; review?: SourceReview; disabled?: boolean; reason: string;
  onSubmit: (invoice: unknown, confirmations: SourceConfirmation[]) => Promise<void> };

export default function SourceReviewForm({ invoice, review, disabled, reason, onSubmit }: Props) {
  const original = invoice as Record<string, unknown>;
  const unresolved = review?.unresolvedFields || [];
  const [values,setValues] = useState<Record<string,string>>(() => Object.fromEntries(reviewFields.map(field => {
    const missing = field.required && unresolved.includes(field.key) && review?.rawInput && review.rawInput[field.key] === undefined;
    return [field.key, missing || original[field.key] === undefined ? '' : String(original[field.key])];
  })));
  const [selected,setSelected] = useState<Set<string>>(new Set());
  const [evidence,setEvidence] = useState<Record<string,string>>({});
  const [errors,setErrors] = useState<Record<string,string>>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const [advanced,setAdvanced] = useState(JSON.stringify(invoice,null,2));
  const visible = reviewFields.filter(field => field.required || ['paymentMethod','hasBankSlip','hasItemManifest','sellerStatus'].includes(field.key) || unresolved.includes(field.key) || original[field.key] !== undefined);
  const prefix = `review-${String(original.id).replace(/[^a-z0-9-]/gi,'')}`;

  async function submit(useAdvanced=false) {
    const next:Record<string,unknown> = {...original};
    const issues:Record<string,string> = {};
    if(useAdvanced){
      try { Object.assign(next,JSON.parse(advanced)); } catch {issues.JSON='JSON sai cấu trúc.';}
    } else for(const field of visible){
      const value=values[field.key];
      if(value===''){delete next[field.key];continue;}
      next[field.key]=field.type==='number' || field.key==='taxRate' ? Number(value)
        : ['hasBankSlip','hasItemManifest','isImageBlurry'].includes(field.key) ? value==='true' : value;
    }
    const parsed=InvoiceInputSchema.safeParse(next);
    if(!parsed.success) for(const issue of parsed.error.issues) issues[String(issue.path[0])]=issue.message;
    const confirmations:SourceConfirmation[]=[];
    for(const field of selected){
      if((evidence[field] || '').trim().length<8)issues[field]= 'Ghi nguồn bằng chứng ít nhất 8 ký tự trước khi xác nhận.';
      if(next[field] === undefined || next[field]==='UNKNOWN')issues[field]='Cần giá trị xác định trước khi xác nhận.';
      confirmations.push({field,evidence:(evidence[field] || '').trim()});
    }
    if(reason.trim().length<8)issues.reason='Ghi lý do đánh giá lại ít nhất 8 ký tự ở ô phía trên.';
    setErrors(issues);
    if(Object.keys(issues).length){requestAnimationFrame(()=>errorRef.current?.focus());return;}
    if(parsed.success)await onSubmit(parsed.data,confirmations);
  }

  return <form onSubmit={e=>{e.preventDefault();void submit();}} className="space-y-4" noValidate>
    <p className="text-sm text-slate-600">Sửa dữ liệu từ chứng từ gốc, rồi xác nhận riêng các trường đã đối chiếu. Trường chưa xác nhận vẫn được giữ lại để xử lý tiếp.</p>
    {Object.keys(errors).length>0 && <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none focus:ring-2 focus:ring-red-600"><p className="font-semibold">Cần bổ sung trước khi đánh giá lại</p><ul className="mt-2 list-disc pl-5">{Object.entries(errors).map(([field,message])=><li key={field}><a className="underline" href={`#${field==='reason' ? 'workflow-reason' : `${prefix}-${field}`}`}>{fieldLabels[field] || field}: {message}</a></li>)}</ul></div>}
    <div className="grid gap-4 sm:grid-cols-2">{visible.map(field=>{
      const pending=unresolved.includes(field.key);
      const changed=String(original[field.key] ?? '') !== values[field.key];
      const prior=review?.confirmations?.find(c=>c.field===field.key);
      const inputId=`${prefix}-${field.key}`;
      const common={id:inputId,disabled, 'aria-invalid':Boolean(errors[field.key]),'aria-describedby':errors[field.key]?`${inputId}-error`:undefined,
        className:'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100',
        value:values[field.key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setValues(v=>({...v,[field.key]:e.target.value}))};
      return <div key={field.key} className={`rounded-lg border p-3 ${pending?'border-amber-200 bg-amber-50/40':'border-slate-200'}`}>
        <label htmlFor={inputId} className="text-sm font-medium">{field.label}{field.required?' *':''}</label>
        {field.type==='select'?<select {...common}><option value="">Chưa xác định</option>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input {...common} type={field.type} onInput={field.type==='date'?e=>{const value=e.currentTarget.value;setValues(v=>({...v,[field.key]:value}));}:undefined} step={field.type==='number'?'any':undefined}/>}
        <p className="mt-2 text-xs text-slate-600">{pending?'Cần xác minh':prior && !changed?'Đã xác nhận từ bằng chứng':changed?'Dữ liệu đã sửa; cần đối chiếu nguồn':'Dữ liệu hồ sơ'}{review?.sourceValues && field.key in review.sourceValues?` · Nguồn đọc: ${displayFieldValue(field.key,review.sourceValues[field.key])}`:''}</p>
        {(pending || changed || selected.has(field.key)) && <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={disabled} className="mt-1" checked={selected.has(field.key)} onChange={e=>setSelected(current=>{const next=new Set(current);e.target.checked?next.add(field.key):next.delete(field.key);return next;})}/>Tôi đã đối chiếu trường này với nguồn</label>
          {selected.has(field.key) && <label className="block text-xs" htmlFor={`${inputId}-evidence`}>Nguồn bằng chứng<input id={`${inputId}-evidence`} disabled={disabled} value={evidence[field.key] || ''} onChange={e=>setEvidence(v=>({...v,[field.key]:e.target.value}))} placeholder="Ví dụ: dòng Tổng cộng, trang 1 chứng từ gốc" className="mt-1 w-full rounded border bg-white p-2 text-sm"/></label>}
        </div>}
        {errors[field.key] && <p id={`${inputId}-error`} className="mt-2 text-sm text-red-700">{errors[field.key]}</p>}
      </div>;
    })}</div>
    {unresolved.filter(key=>!reviewFields.some(f=>f.key===key)).map(key=><p key={key} className="text-sm text-amber-800">Cần đối chiếu thêm {fieldLabels[key] || key}; dữ liệu chi tiết có trong mục nâng cao.</p>)}
    <p className="text-sm text-slate-600">Đã chọn xác minh {selected.size} trường. Việc xác nhận không bỏ qua các phát hiện nghiệp vụ khác.</p>
    <button type="submit" disabled={disabled} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Lưu dữ liệu và đánh giá lại toàn bộ quy tắc</button>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Nâng cao: dữ liệu JSON</summary><label htmlFor={`${prefix}-JSON`} className="mt-3 block text-sm">Dữ liệu hồ sơ JSON</label><textarea id={`${prefix}-JSON`} disabled={disabled} value={advanced} onChange={e=>setAdvanced(e.target.value)} className="mt-2 min-h-64 w-full rounded border p-2 font-mono text-xs"/><button type="button" disabled={disabled} onClick={()=>void submit(true)} className="mt-2 rounded border px-3 py-2 text-sm">Đánh giá lại dữ liệu JSON</button><p className="mt-2 text-xs text-slate-600">JSON không tự xác minh các trường nghi vấn. Những trường đã chọn vẫn cần nguồn bằng chứng riêng.</p></details>
  </form>;
}
