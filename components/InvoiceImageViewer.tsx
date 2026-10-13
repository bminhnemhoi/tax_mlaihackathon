'use client';
import { useEffect, useRef, useState, type ReactElement, type ReactNode, type PointerEvent } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ZoomIn, ZoomOut, Scan, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceScanOverlay } from '@/components/InvoiceScanOverlay';
import { containImage, type ImageDimensions } from '@/lib/imageViewport';

interface InvoiceImageViewerProps { src:string; alt?:string; busy?:boolean; children?:ReactNode; toolbar?:boolean; className?:string }
export function InvoiceImageViewer({src,alt='Chứng từ hóa đơn',busy=false,children,toolbar=true,className=''}:InvoiceImageViewerProps):ReactElement {
  const frame=useRef<HTMLDivElement>(null);const stage=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
  const offset=useRef({x:0,y:0});
  const [natural,setNatural]=useState<ImageDimensions & {src:string}>({src:'',width:0,height:0});
  const [bounds,setBounds]=useState<ImageDimensions>({width:1,height:1});
  const [multiplier,setMultiplier]=useState(1);const [fullscreen,setFullscreen]=useState(false);
  const [imageError,setImageError]=useState(false);
  const loaded=natural.src===src&&natural.width>0;
  const fit=loaded?containImage(natural,bounds):null;
  const percentage=fit?Math.round(fit.width/natural.width*multiplier*100):100;
  function reset():void {setMultiplier(1);offset.current={x:0,y:0};if(stage.current)stage.current.style.transform='translate(0px,0px) scale(1)';}
  useEffect(()=>{reset();setImageError(false);},[src]);
  useEffect(()=>{const element=frame.current;if(!element)return;const observer=new ResizeObserver(()=>{setBounds({width:Math.max(1,element.clientWidth-24),height:Math.max(1,element.clientHeight-24)});});observer.observe(element);return ()=>observer.disconnect();},[]);
  useEffect(()=>{const element=frame.current;if(!element)return;const wheel=(event:WheelEvent):void=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();setMultiplier(value=>Math.min(8,Math.max(.5,value+(event.deltaY<0?.2:-.2))));};element.addEventListener('wheel',wheel,{passive:false});return ()=>element.removeEventListener('wheel',wheel);},[]);
  useEffect(()=>{if(multiplier<=1)offset.current={x:0,y:0};if(stage.current)stage.current.style.transform=`translate(${offset.current.x}px,${offset.current.y}px) scale(${multiplier})`;},[multiplier]);
  useEffect(()=>{if(!fullscreen)return;const key=(event:KeyboardEvent):void=>{if(event.key==='Escape')setFullscreen(false);};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[fullscreen]);
  function pointerDown(event:PointerEvent<HTMLDivElement>):void {
    if(!toolbar||multiplier<=1||event.button!==0||!(event.target instanceof Element)||event.target.closest('button,a'))return;
    drag.current={x:offset.current.x,y:offset.current.y,startX:event.clientX,startY:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:PointerEvent<HTMLDivElement>):void {
    if(!drag.current||!stage.current)return;offset.current={x:drag.current.x+event.clientX-drag.current.startX,y:drag.current.y+event.clientY-drag.current.startY};stage.current.style.transform=`translate(${offset.current.x}px,${offset.current.y}px) scale(${multiplier})`;
  }
  return <div className={`invoice-image-viewer ${fullscreen?'is-fullscreen':''} ${className}`}>
    {toolbar&&<div className="flex shrink-0 flex-wrap items-center justify-end gap-1 border-b px-3 py-2">
      <Button type="button" variant="ghost" size="icon" aria-label="Thu nhỏ ảnh" title="Thu nhỏ; Ctrl hoặc Cmd + cuộn chuột" onClick={()=>setMultiplier(v=>Math.max(.5,v-.2))}><ZoomOut className="h-4 w-4"/></Button>
      <output className="w-12 text-center text-xs font-numeric" aria-label="Tỷ lệ ảnh">{percentage}%</output>
      <Button type="button" variant="ghost" size="icon" aria-label="Phóng to ảnh" onClick={()=>setMultiplier(v=>Math.min(8,v+.2))}><ZoomIn className="h-4 w-4"/></Button>
      <Button type="button" variant="ghost" size="sm" title="Hiện toàn bộ ảnh; kéo ảnh để xem chi tiết khi phóng to" onClick={reset}><Scan className="mr-1.5 h-4 w-4"/>Vừa khung</Button>
      <Button type="button" variant="ghost" size="icon" aria-label={fullscreen?'Đóng toàn màn hình':'Xem toàn màn hình'} onClick={()=>setFullscreen(v=>!v)}>{fullscreen?<Minimize2 className="h-4 w-4"/>:<Maximize2 className="h-4 w-4"/>}</Button>
    </div>}
    <div ref={frame} className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-muted/60 p-3" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div ref={stage} className="relative shrink-0" style={fit?{width:fit.width,height:fit.height}:{width:'100%',height:'100%'}}>
        {imageError?<p className="flex h-full items-center justify-center text-sm text-muted-foreground">Ảnh không khả dụng.</p>:<Image src={src} alt={alt} width={loaded?natural.width:1} height={loaded?natural.height:1} unoptimized draggable={false} className="block h-full w-full rounded object-contain" onLoad={event=>setNatural({src,width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>{setImageError(true);toast.error('Không tải được ảnh. Hãy thử ảnh khác.');}}/>}
        {loaded&&!imageError&&children}{busy&&loaded&&!imageError&&<InvoiceScanOverlay/>}
      </div>
    </div>
    {busy&&<span role="status" className="sr-only">Đang xử lý chứng từ</span>}
  </div>;
}
