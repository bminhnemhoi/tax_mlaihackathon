'use client';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkspaceInvoice } from '@/lib/workspaceTypes';
import { formatVND, formatDate } from '@/lib/utils';
import { ScreenState } from './ScreenState';
import { readListPage, replaceWorkspaceQuery } from '@/lib/workspaceNavigation';

interface InvoiceListProps {
  items:WorkspaceInvoice[];empty:boolean;href:(id:string)=>string;
  statusLabel:(item:WorkspaceInvoice)=>string;variant:(item:WorkspaceInvoice)=>BadgeProps['variant'];
  deadline:(item:WorkspaceInvoice)=>ReactNode;
  scrollPositions?:Map<string,number>;
}
export function InvoiceList({items,empty,href,statusLabel,variant,deadline,scrollPositions}:InvoiceListProps):ReactElement {
  const params=useSearchParams();const pathname=usePathname();
  const locationKey=pathname+'?'+params.toString();
  useEffect(()=>{const saved=scrollPositions?.get(locationKey);if(saved===undefined)return;const frame=requestAnimationFrame(()=>window.scrollTo({top:saved,behavior:'instant'}));return ()=>cancelAnimationFrame(frame);},[locationKey,scrollPositions]);
  const page=Math.min(readListPage(new URLSearchParams(params.toString()))-1,Math.max(0,Math.ceil(items.length/25)-1));
  const setPage=(next:number):void=>{const query=new URLSearchParams(params.toString());if(next===0)query.delete('page');else query.set('page',String(next+1));replaceWorkspaceQuery(pathname,query);};
  if(!items.length)return <ScreenState title={empty?'Chưa có hóa đơn':'Không có kết quả phù hợp'} description={empty?'Bấm Tiếp nhận để bắt đầu.':'Thử thay đổi từ khóa hoặc bộ lọc.'}/>;
  const pages=Math.ceil(items.length/25);const rows=items.slice(page*25,(page+1)*25);
  return <div className="overflow-hidden rounded-2xl border bg-card">
    <div className="hidden grid-cols-[1fr_1.4fr_1fr_1fr] gap-4 border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground md:grid"><span>Hóa đơn</span><span>Nhà cung cấp</span><span className="text-right">Tổng thanh toán</span><span className="text-right">Trạng thái / người nhận</span></div>
    {rows.map(item=><Link key={item.id} href={href(item.id)} onClick={()=>scrollPositions?.set(locationKey,window.scrollY)} className="invoice-list-row" aria-label={'Mở hóa đơn '+item.invoiceNumber}>
      <div><p className="flex flex-wrap items-center gap-2 text-sm font-medium">{item.invoiceNumber}{deadline(item)}</p><p className="mt-1 text-xs text-muted-foreground">{item.review?.unresolvedFields?.includes('invoiceDate')?'Ngày chưa xác minh':formatDate(item.invoiceDate)}</p></div>
      <div className="min-w-0"><p className="truncate text-sm">{item.supplierName}</p><p className="mt-1 text-xs text-muted-foreground font-numeric">{item.supplierTaxCode}</p></div>
      <p className="text-right text-sm font-medium font-numeric">{formatVND(item.totalAmount)}</p>
      <div className="text-right"><Badge variant={variant(item)}>{statusLabel(item)}</Badge>{item.status.startsWith('WAITING_')||item.status==='FORWARDED'?<p className="mt-1 text-xs text-muted-foreground">{item.decision?.status==='ESCALATED'&&item.decision.requiresCFO?'CFO':'Kế toán trưởng'}</p>:null}{item.taxHold&&<p className="mt-1 text-xs text-amber-800">Đang giữ thuế</p>}</div>
    </Link>)}
    {pages>1&&<nav className="flex items-center justify-between gap-3 border-t px-4 py-3" aria-label="Trang danh sách"><span className="text-xs text-muted-foreground">{page*25+1}-{Math.min((page+1)*25,items.length)} / {items.length}</span><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={page===0} onClick={()=>setPage(page-1)}>Trước</Button><Button variant="ghost" size="sm" disabled={page===pages-1} onClick={()=>setPage(page+1)}>Sau</Button></div></nav>}
  </div>;
}
