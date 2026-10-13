'use client';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import type { AppRole } from '@/lib/server/auth';

export default function HomePage():ReactElement {
  const router=useRouter();
  const [busy,setBusy]=useState(true);
  const [role,setRole]=useState<AppRole>('CHIEF_ACCOUNTANT');
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/auth/me',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(response.ok){router.replace('/workspace/inbox');return;}
      if(response.status!==401)throw new Error('Không thể kết nối máy chủ.');
      if(new URLSearchParams(window.location.search).get('expired'))toast.info('Phiên đã kết thúc. Hãy đăng nhập lại.');
    }).catch(()=>{if(!controller.signal.aborted)toast.error('Không thể kết nối máy chủ.');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[router]);
  async function enter(demo:boolean):Promise<void> {
    if(busy)return;setBusy(true);
    try {
      const response=await fetch(demo?'/api/demo/session':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(demo?{}:{role})});
      if(!response.ok){const data=await response.json();throw new Error(data.error || 'Không thể đăng nhập.');}
      router.replace('/workspace/inbox');
    } catch(error){toast.error(error instanceof Error?error.message:'Không thể đăng nhập.');setBusy(false);}
  }
  return <main className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
    <section className="w-full max-w-md space-y-8">
      <div><div className="flex items-center gap-3"><BrandMark size={44}/><h1 className="text-3xl font-semibold tracking-tight">Tax Referee</h1></div><p className="mt-4 text-base text-muted-foreground">Thẩm định hóa đơn. Xử lý đúng ngoại lệ.</p></div>
      <form className="space-y-4 rounded-2xl border bg-card p-6" onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void enter(false);}}>
        <label htmlFor="login-role" className="block text-sm font-medium">Vai trò</label>
        <select id="login-role" value={role} onChange={event=>{const value=event.target.value;if(value==='ACCOUNTANT'||value==='CHIEF_ACCOUNTANT'||value==='CFO')setRole(value);}} className="h-11 w-full rounded-[10px] border bg-transparent px-3 text-sm"><option value="ACCOUNTANT">Kế toán viên</option><option value="CHIEF_ACCOUNTANT">Kế toán trưởng</option><option value="CFO">Giám đốc tài chính</option></select>
        <Button type="submit" disabled={busy} className="w-full gap-2">{busy?'Đang kết nối…':'Vào làm việc'}<ArrowRight className="h-4 w-4"/></Button>
        <p className="text-xs leading-5 text-muted-foreground">MVP cuộc thi: chọn vai trò, không cần mật khẩu.</p>
      </form>
      <div className="flex items-center justify-between gap-4 text-sm"><button type="button" disabled={busy} onClick={()=>void enter(true)} className="font-medium underline underline-offset-4 disabled:opacity-50">Mở demo riêng</button><Link href="/verify" className="text-muted-foreground hover:text-foreground">Kiểm chứng đề A →</Link></div>
    </section>
  </main>;
}
