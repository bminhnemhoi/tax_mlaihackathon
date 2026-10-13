'use client';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { WorkspaceInvoice } from '@/lib/workspaceTypes';
import type { MacroState, SystemPolicyConfig } from '@/lib/schemas';
import { DEFAULT_POLICY_CONFIG } from '@/lib/constants';

export interface DuplicateGroup {supplierTaxCode:string;invoiceNumber:string;count:number;invoiceIds:string}
interface RuntimeResponse {demo:boolean;policy?:{version:string;config:SystemPolicyConfig};macroState:MacroState}
interface InboxResponse {items:WorkspaceInvoice[];counts:Record<string,number>}
export interface WorkspaceData {
  items:WorkspaceInvoice[];counts:Record<string,number>;isDemo:boolean;config:SystemPolicyConfig;setConfig:Dispatch<SetStateAction<SystemPolicyConfig>>;
  policyVersion:string;setPolicyVersion:Dispatch<SetStateAction<string>>;macro:MacroState;duplicateGroups:DuplicateGroup[];
  unreadNotifCount:number;setUnreadNotifCount:Dispatch<SetStateAction<number>>;loading:boolean;error:string;revision:number;loadWorkspace:()=>Promise<void>;
}
export function useWorkspaceData(onExpired:()=>void):WorkspaceData {
  const [items,setItems]=useState<WorkspaceInvoice[]>([]);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [isDemo,setIsDemo]=useState(false);
  const [config,setConfig]=useState<SystemPolicyConfig>(DEFAULT_POLICY_CONFIG);
  const [policyVersion,setPolicyVersion]=useState('');
  const [macro,setMacro]=useState<MacroState>({totalSales:0,openingInventory:0,totalPurchases:0,kFactor:0,zone:'SAFE_GREEN',totalDeductibleTax:0});
  const [duplicateGroups,setDuplicateGroups]=useState<DuplicateGroup[]>([]);
  const [unreadNotifCount,setUnreadNotifCount]=useState(0);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const activeRequest=useRef<AbortController|null>(null);
  const loadWorkspace=useCallback(async():Promise<void>=>{
    activeRequest.current?.abort();const controller=new AbortController();activeRequest.current=controller;setLoading(true);setError('');
    try {
      const [inboxResponse,runtimeResponse,duplicateResponse,notificationResponse]=await Promise.all(['/api/inbox','/api/runtime','/api/invoices/duplicates','/api/notifications'].map(url=>fetch(url,{signal:controller.signal,cache:'no-store'})));
      if(inboxResponse.status===401||runtimeResponse.status===401){onExpired();return;}
      if(!inboxResponse.ok||!runtimeResponse.ok)throw new Error('Không thể tải workspace.');
      const inbox:InboxResponse=await inboxResponse.json();const runtime:RuntimeResponse=await runtimeResponse.json();
      if(controller.signal.aborted)return;
      setItems(inbox.items);setCounts(inbox.counts);setIsDemo(runtime.demo);setMacro(runtime.macroState);
      if(runtime.policy){setConfig(runtime.policy.config);setPolicyVersion(runtime.policy.version);}
      if(duplicateResponse.ok){const duplicate:{groups:DuplicateGroup[]}=await duplicateResponse.json();if(!controller.signal.aborted)setDuplicateGroups(duplicate.groups);}
      if(notificationResponse.ok){const notification:{unreadCount:number}=await notificationResponse.json();if(!controller.signal.aborted)setUnreadNotifCount(notification.unreadCount);}
      if(!controller.signal.aborted)setRevision(value=>value+1);
    } catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Không thể tải workspace.');}
    finally{if(!controller.signal.aborted)setLoading(false);}
  },[onExpired]);
  useEffect(()=>{void loadWorkspace();return ()=>activeRequest.current?.abort();},[loadWorkspace]);
  return {items,counts,isDemo,config,setConfig,policyVersion,setPolicyVersion,macro,duplicateGroups,unreadNotifCount,setUnreadNotifCount,loading,error,revision,loadWorkspace};
}
