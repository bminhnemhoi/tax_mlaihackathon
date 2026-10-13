'use client';
import { useEffect, useState, type ReactElement } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { InvoiceInput } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { InvoiceImageViewer } from '@/components/InvoiceImageViewer';
import { InvoiceDataSummary } from '@/components/InvoiceDataSummary';
import { ScreenState, WorkspaceSkeleton } from '@/components/workspace/ScreenState';
interface DocumentViewerProps {invoice:InvoiceInput;className?:string;onClose?:()=>void}
interface SourcePreview {url:string;mime:string;text:string}
export function DocumentViewer({invoice,className='',onClose}:DocumentViewerProps):ReactElement {
  const [source,setSource]=useState<SourcePreview|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
  const [showData,setShowData]=useState(!invoice.sourceArtifactId);
  useEffect(()=>{
    setSource(null);setError(false);setShowData(!invoice.sourceArtifactId);
    if(!invoice.sourceArtifactId){setLoading(false);return;}
    const controller=new AbortController();let objectUrl='';setLoading(true);
    fetch('/api/documents/artifacts/'+encodeURIComponent(invoice.sourceArtifactId),{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Source unavailable');
      const blob=await response.blob();if(controller.signal.aborted)return;
      if(blob.type.startsWith('image/')||blob.type==='application/pdf'){objectUrl=URL.createObjectURL(blob);setSource({url:objectUrl,mime:blob.type,text:''});}
      else {const text=await blob.text();if(!controller.signal.aborted)setSource({url:'',mime:blob.type,text});}
    }).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[invoice.sourceArtifactId,attempt]);
  return <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card ${className}`}>
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><div><h2 className="text-sm font-semibold">{showData?'Bản trình bày dữ liệu':'Chứng từ nguồn'}</h2>{!invoice.sourceArtifactId&&<p className="mt-1 text-xs text-muted-foreground">Hồ sơ nhập trực tiếp, chưa có tệp nguồn.</p>}</div><div className="flex items-center gap-1">
      {invoice.sourceArtifactId&&<Button variant="ghost" size="sm" onClick={()=>setShowData(v=>!v)}>{showData?'Xem nguồn':'Xem dữ liệu'}</Button>}
      <a href={invoice.sourceArtifactId?'/api/documents/artifacts/'+encodeURIComponent(invoice.sourceArtifactId):undefined} download aria-disabled={!invoice.sourceArtifactId} className={`inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs hover:bg-muted ${!invoice.sourceArtifactId?'pointer-events-none opacity-40':''}`}><Download className="h-4 w-4"/>Tải</a>
      <Button size="icon" variant="ghost" aria-label="In chứng từ" onClick={()=>window.print()}><Printer className="h-4 w-4"/></Button>{onClose&&<Button size="icon" variant="ghost" aria-label="Đóng chứng từ" onClick={onClose}><X className="h-4 w-4"/></Button>}
    </div></header>
    {showData?<InvoiceDataSummary invoice={invoice}/>:<div className="h-[min(680px,75dvh)] min-h-[320px]">
      {loading?<WorkspaceSkeleton/>:error?<ScreenState error title="Không thể tải chứng từ" onRetry={()=>setAttempt(v=>v+1)}/>:source?.mime.startsWith('image/')?<InvoiceImageViewer src={source.url}/>:source?.mime==='application/pdf'?<iframe title="Chứng từ PDF gốc" src={source.url} className="h-full w-full border-0"/>:source?<pre className="h-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs">{source.text}</pre>:null}
    </div>}
  </section>;
}
