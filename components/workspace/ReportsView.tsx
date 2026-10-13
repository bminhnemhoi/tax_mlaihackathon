'use client';
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import type { MacroState } from '@/lib/schemas';
import type { WorkspaceInvoice } from '@/lib/workspaceTypes';
import { formatVND } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function ReportsView({macro,items,policyVersion}:{macro:MacroState;items:WorkspaceInvoice[];policyVersion:string}):ReactElement {
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
  const approved=items.filter(item=>item.status==='APPROVED');
  return <section className="space-y-6">
    <div className="grid gap-6 rounded-2xl border bg-card p-5 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Thuế GTGT được duyệt nội bộ</p><p className="mt-2 text-2xl font-semibold font-numeric">{formatVND(macro.totalDeductibleTax)}</p><p className="mt-2 text-xs text-muted-foreground">Theo dữ liệu máy chủ, gồm số dư khởi tạo.</p></div><div><p className="text-sm text-muted-foreground">Hồ sơ đã hoàn tất trong danh sách tải</p><p className="mt-2 text-2xl font-semibold font-numeric">{approved.length}</p><p className="mt-2 text-xs text-muted-foreground">Danh sách giới hạn 200 hồ sơ gần nhất.</p></div></div>
    <div className="rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Tờ khai nháp</h2><div className="mt-4 flex flex-wrap items-end gap-3"><label htmlFor="report-period" className="text-sm font-medium">Kỳ báo cáo<input id="report-period" type="month" value={period} onChange={event=>setPeriod(event.target.value)} className="mt-2 block h-11 rounded-[10px] border bg-transparent px-3"/></label><Button disabled={!/^\d{4}-\d{2}$/.test(period)} onClick={()=>window.open('/api/tax-forms?'+new URLSearchParams({form:'01/GTGT',format:'html',period}), '_blank','noopener,noreferrer')}>Mở tờ khai 01/GTGT</Button></div><p className="mt-3 text-xs text-muted-foreground">Bản nháp để đối chiếu, chưa nộp tới cơ quan thuế.</p></div>
    <details className="rounded-2xl border bg-card p-5"><summary className="cursor-pointer text-sm font-medium">Quy chế và hệ số K</summary><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Phiên bản đang áp dụng</dt><dd className="mt-1 break-words">{policyVersion}</dd></div><div><dt className="text-xs text-muted-foreground">Hệ số K theo máy chủ</dt><dd className="mt-1 font-numeric">{macro.kFactor.toFixed(2)}</dd></div></dl><Link href="/workspace/policy" className="mt-4 inline-block text-sm underline underline-offset-4">Mở Quy chế</Link></details>
  </section>;
}
