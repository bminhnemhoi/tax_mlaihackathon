'use client';
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppUser } from '@/lib/server/auth';
import { ProductionWorkspace } from '@/components/ProductionWorkspace';
import { ScreenState, WorkspaceSkeleton } from './ScreenState';
import { toast } from 'sonner';
import { workspaceRoutes, invoiceIdForPath } from '@/lib/workspaceNavigation';

export function WorkspaceSession({children}:{children:ReactNode}):ReactElement {
  const router=useRouter();
  const pathname=usePathname();
  const [user,setUser]=useState<AppUser|null>(null);
  const [scope,setScope]=useState('');
  const ready=useRef(false);
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const logout=useCallback(():void=>{void fetch('/api/auth/logout',{method:'POST'}).finally(()=>{setUser(null);router.replace('/?expired=1');});},[router]);
  useEffect(()=>{
    const controller=new AbortController();setError(false);
    const check=():void=>{void fetch('/api/auth/me',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(response.status===401){router.replace('/?expired=1');return;}
      if(!response.ok)throw new Error('Session unavailable');
      const data:{user:AppUser;workspaceScope:string}=await response.json();if(controller.signal.aborted)return;setUser(data.user);setScope(data.workspaceScope);ready.current=true;
    }).catch(()=>{if(!controller.signal.aborted){if(ready.current)toast.error('Chưa kiểm tra được phiên.');else setError(true);}});};
    const visible=():void=>{if(document.visibilityState==='visible')check();};check();document.addEventListener('visibilitychange',visible);
    return ()=>{controller.abort();document.removeEventListener('visibilitychange',visible);};
  },[router,attempt]);
  if(error)return <main className="mx-auto w-full max-w-5xl p-6"><ScreenState error title="Không thể mở workspace" description="Kiểm tra kết nối rồi thử lại." onRetry={()=>setAttempt(a=>a+1)}/></main>;
  if(!user)return <main className="mx-auto w-full max-w-5xl p-6"><WorkspaceSkeleton/></main>;
  const validRoute=Object.values(workspaceRoutes).some(route=>route.path===pathname)||Boolean(invoiceIdForPath(pathname));
  if(!validRoute)return <>{children}</>;
  return <><ProductionWorkspace key={scope} user={user} onLogout={logout} onRoleSwitched={setUser}/>{children}</>;
}
