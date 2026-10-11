'use client';

import {useEffect,useState} from 'react';
import type {CorporatePrecedent, InvoiceInput, SourceConfirmation} from '@/lib/schemas';
import {eventLabels,workflowStatusLabels} from '@/lib/workflowPresentation';
import {formatVND} from '@/lib/utils';
import WorkflowAuditHistory from './WorkflowAuditHistory';
import SourceReviewForm, {SourceReview} from './SourceReviewForm';

type Rights = {pause?:boolean;resume?:boolean;requestInformation?:boolean;taxHold?:boolean;undo?:boolean;blockedReason?:string;undoTarget?:{eventType:string;targetStatus:string}};
type Props={item:{id:string;invoice:unknown;revision?:number;evaluationId:string|null;status:string;taxHold?:boolean;allowedActions?:Rights;review?:SourceReview},user:{role:string},onRefresh:()=>Promise<void>};
export default function WorkflowControls({item,user,onRefresh}:Props){
 const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const [precedents,setPrecedents]=useState<CorporatePrecedent[]>([]);const [precedentId,setPrecedentId]=useState('');const [label,setLabel]=useState('escalate');
 const [calibration,setCalibration]=useState<{status:string;sampleCount?:number;threshold:number;previousThreshold?:number;version?:number}|null>(null);
 const [precedentError,setPrecedentError]=useState('');
 const loadPrecedents=()=>fetch('/api/precedents').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setPrecedents(d.precedents||[]);setPrecedentError('');}).catch(e=>setPrecedentError(e.message));
 useEffect(()=>{if(user.role!=='ACCOUNTANT')void loadPrecedents();},[user.role]);
 const run=async(url:string,body:unknown)=>{
  setBusy(true);setMessage('Đang lưu…');setError('');
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();
   if(!r.ok){if(r.status===409)await onRefresh();throw new Error(d.error || 'Không thể lưu');}
   if(url==='/api/feedback'){setCalibration(d);await loadPrecedents();}
   setMessage('Đã lưu. Trạng thái mới đã được cập nhật.');await onRefresh();
  }catch(e){setError(e instanceof Error?e.message:'Không thể lưu');setMessage('');}finally{setBusy(false);}
 };
 const action=(action:string)=>run(`/api/invoices/${encodeURIComponent(item.id)}/audit-action`,{action,reason,revision:item.revision,evaluationId:item.evaluationId,targetStatus:action==='REQUEST_INFORMATION'?'ON_HOLD':undefined});
 const disabled=busy || reason.trim().length<8;const rights=item.allowedActions || {};
 const invoice=item.invoice as InvoiceInput;
 const scoped=precedents.filter(p=>p.status==='ACTIVE' && p.supplierTaxCode===invoice.supplierTaxCode && p.purpose && invoice.itemName.toLocaleLowerCase('vi-VN').includes(p.purpose.toLocaleLowerCase('vi-VN')) && invoice.invoiceDate>=p.effectiveFrom && (!p.effectiveTo || invoice.invoiceDate<=p.effectiveTo));
 const selected=scoped.find(p=>p.id===precedentId);
 return <section className="space-y-4 rounded-xl border bg-white p-4" aria-label="Can thiệp và bổ sung hồ sơ">
  <div><h3 className="font-semibold">Can thiệp và bổ sung hồ sơ</h3><p className="mt-1 text-sm text-slate-600">{workflowStatusLabels[item.status] || item.status} · Phiên bản hồ sơ {item.revision}</p></div>
  {rights.blockedReason && !['APPROVED','REJECTED'].includes(item.status) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Chưa thể phê duyệt: {rights.blockedReason}</p>}
  <label htmlFor="workflow-reason" className="block text-sm font-medium">Lý do / nguồn bằng chứng<textarea id="workflow-reason" className="mt-1 w-full rounded-lg border p-3 font-normal" disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ghi nguồn xác minh và nội dung can thiệp" aria-describedby="workflow-reason-hint"/></label>
  <p id="workflow-reason-hint" className="text-xs text-slate-600">Cần ít nhất 8 ký tự để ghi nhận trách nhiệm của thao tác.</p>
  <div className="flex flex-wrap gap-2">
   {rights.pause && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={()=>void action('PAUSE')}>Dừng xử lý</button>}
   {rights.resume && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={()=>void action('RESUME')}>Tiếp tục</button>}
   {rights.requestInformation && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={()=>void action('REQUEST_INFORMATION')}>Yêu cầu bổ sung</button>}
   {rights.taxHold && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={()=>void action(item.taxHold?'RELEASE_TAX_HOLD':'TAX_HOLD')}>{item.taxHold?'Giải phóng giữ thuế':'Tạm giữ thuế'}</button>}
   {rights.undo && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={()=>void action('UNDO')}>Hoàn tác: {eventLabels[rights.undoTarget?.eventType || ''] || 'thao tác gần nhất'}</button>}
  </div>
  {rights.undoTarget && <p className="text-xs text-slate-600">Hoàn tác sẽ đưa hồ sơ về “{workflowStatusLabels[rights.undoTarget.targetStatus] || rights.undoTarget.targetStatus}” và cập nhật chứng từ/thuế nội bộ tương ứng. Không đảo giao dịch ERP bên ngoài.</p>}
  {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
  <details open={Boolean(item.review?.unresolvedFields?.length)} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">Bổ sung dữ liệu và đánh giá lại</summary><div className="mt-4"><SourceReviewForm invoice={item.invoice} review={item.review} disabled={busy || ['PAUSED','EVALUATING'].includes(item.status) || user.role==='ACCOUNTANT'} reason={reason} onSubmit={(invoice,confirmations:SourceConfirmation[])=>run('/api/evaluate',{invoice,expectedRevision:item.revision,confirmations,evidence:reason})}/></div></details>
  {user.role!=='ACCOUNTANT' && <details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">Phản hồi hậu kiểm tiền lệ</summary><div className="mt-3 space-y-3">
   <p className="text-sm text-slate-600">Chỉ hiệu chỉnh quy chế nội bộ sau ít nhất 10 hồ sơ cùng phạm vi. Phản hồi này riêng với lần bấm duyệt; không dùng để chứng minh độ chính xác độc lập.</p>
   {precedentError && <p role="alert" className="text-sm text-red-700">{precedentError}<button type="button" className="ml-2 underline" onClick={()=>void loadPrecedents()}>Thử lại</button></p>}
   <label className="block text-sm">Tiền lệ phù hợp với hồ sơ<select className="mt-1 w-full rounded-lg border p-2" value={precedentId} onChange={e=>{setPrecedentId(e.target.value);setCalibration(null);}}><option value="">{scoped.length?'Chọn tiền lệ':'Chưa có tiền lệ cùng nhà cung cấp / mục đích / thời hạn'}</option>{scoped.map(p=><option key={p.id} value={p.id}>{p.supplierName} · {p.purpose}</option>)}</select></label>
   {selected && <p className="rounded-lg bg-slate-50 p-3 text-sm">Ngưỡng {formatVND(selected.currentThreshold || 0)} / trần CFO {formatVND(selected.maximumAmount || 0)} · Phiên bản {selected.thresholdVersion} · Hiệu lực {selected.effectiveFrom}–{selected.effectiveTo || 'không giới hạn'}</p>}
   <label className="block text-sm">Kết luận hậu kiểm<select className="mt-1 w-full rounded-lg border p-2" value={label} onChange={e=>setLabel(e.target.value)}><option value="escalate">Nên chuyển tiếp</option><option value="routine">Nên tự xử lý trong phạm vi</option></select></label>
   <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled || !selected} onClick={()=>void run('/api/feedback',{precedentId,invoiceId:item.id,evaluationId:item.evaluationId,shouldEscalate:label==='escalate',reason})}>Lưu phản hồi hậu kiểm</button>{user.role==='CFO' && <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled || !selected} onClick={()=>void run('/api/feedback',{action:'ROLLBACK',precedentId,reason})}>Phục hồi ngưỡng trước</button>}</div>
   {calibration && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{calibration.status==='ADAPTED'?'Đã điều chỉnh':calibration.status==='INSUFFICIENT_FEEDBACK'?'Chưa đủ 10 hồ sơ':calibration.status==='ROLLED_BACK'?'Đã phục hồi ngưỡng':'Giữ nguyên ngưỡng'}{calibration.sampleCount!==undefined?` · ${calibration.sampleCount} hồ sơ`:''} · {calibration.previousThreshold!==undefined?`${formatVND(calibration.previousThreshold)} → `:''}{formatVND(calibration.threshold)}</p>}
  </div></details>}
  <details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">Xem lịch sử trước/sau và dữ liệu nguồn</summary><div className="mt-3"><WorkflowAuditHistory invoiceId={item.id}/></div></details>
 </section>;
}
