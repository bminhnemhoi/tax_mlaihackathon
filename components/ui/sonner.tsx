'use client';
import { useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import { Toaster as Sonner } from 'sonner';
type ToasterProps = ComponentProps<typeof Sonner>;
const safeOffset={top:'calc(env(safe-area-inset-top, 0px) + 16px)',left:'calc(env(safe-area-inset-left, 0px) + 16px)',right:'calc(env(safe-area-inset-right, 0px) + 16px)',bottom:'calc(env(safe-area-inset-bottom, 0px) + 16px)'};
export function Toaster(props:ToasterProps):ReactElement {
  const [mobile,setMobile]=useState(false);
  useEffect(()=>{const query=window.matchMedia('(max-width: 767px)');const update=():void=>setMobile(query.matches);update();query.addEventListener('change',update);return ()=>query.removeEventListener('change',update);},[]);
  return <Sonner theme="light" position={mobile?'top-left':'bottom-left'} offset={safeOffset} mobileOffset={safeOffset} duration={4000} visibleToasts={2} closeButton toastOptions={{classNames:{toast:'!bg-card !text-foreground !border-border !rounded-xl !shadow-modal',description:'!text-muted-foreground'}}} {...props}/>;
}
