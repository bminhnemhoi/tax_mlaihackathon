'use client';
import { Children, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { usePathname,useSearchParams } from 'next/navigation';
import {replaceWorkspaceQuery} from '@/lib/workspaceNavigation';

/** Tabs alter presentation only; inputs and the source stay mounted. */
export function ReceptionLayout({children}:{children:ReactNode}):ReactElement {
  const [pane,setPane]=useState<'source'|'fields'>('source');
  const pathname=usePathname();const params=useSearchParams();
  useEffect(()=>{if(pathname==='/workspace/receive')setPane(params.get('pane')==='fields'?'fields':'source');},[pathname,params]);
  const choose=(next:'source'|'fields'):void=>{setPane(next);if(pathname==='/workspace/receive'){const query=new URLSearchParams(params.toString());query.set('pane',next);replaceWorkspaceQuery(pathname,query);}};
  const parts=Children.toArray(children);
  return <div className="reception-layout">
    <div className="reception-mobile-tabs" role="tablist" aria-label="Tiếp nhận chứng từ">{(['source','fields'] as const).map(id=><button key={id} id={'reception-tab-'+id} type="button" role="tab" tabIndex={pane===id?0:-1} aria-selected={pane===id} aria-controls={'reception-panel-'+id} onClick={()=>choose(id)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'source':event.key==='End'?'fields':pane==='source'?'fields':'source';choose(next);document.getElementById('reception-tab-'+next)?.focus();}}>{id==='source'?'Chứng từ':'Thông tin'}</button>)}</div>
    {parts.map((part,index)=>{const id=index===0?'source':'fields';return <div id={'reception-panel-'+id} key={id} className={`reception-panel ${pane===id?'is-active':''}`} role="tabpanel" aria-labelledby={'reception-tab-'+id}>{part}</div>;})}
  </div>;
}
