'use client';
import { useState, type ReactElement } from 'react';
import type { policyRuleMatrix } from '@/data/policyContract';
import { fieldLabels, riskGroupLabels } from '@/lib/workflowPresentation';

export function PolicyRuleReference({rules}:{rules:ReturnType<typeof policyRuleMatrix>}):ReactElement {
  const [query,setQuery]=useState('');const [group,setGroup]=useState('ALL');
  const normalize=(value:string):string=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const visible=rules.filter(rule=>(group==='ALL'||rule.group===group)&&normalize(rule.label+' '+rule.clause+' '+rule.condition+' '+rule.id).includes(normalize(query)));
  return <section id="rules" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><h2 className="text-xl font-semibold">Tra cứu quy tắc</h2><span className="text-xs text-muted-foreground">{visible.length} / {rules.length} quy tắc</span></div>
    <div className="flex flex-col gap-3 sm:flex-row"><label className="flex-1"><span className="sr-only">Tìm quy tắc</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tên quy tắc, điều khoản hoặc vấn đề" className="h-11 w-full rounded-[10px] border bg-card px-3 text-sm"/></label><label><span className="sr-only">Nhóm ngoại lệ</span><select value={group} onChange={event=>setGroup(event.target.value)} className="h-11 w-full rounded-[10px] border bg-card px-3 text-sm"><option value="ALL">Mọi nhóm</option>{Object.entries(riskGroupLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="rounded-2xl border bg-card">{visible.map(rule=><details key={rule.id} id={rule.id} className="border-b p-5 last:border-b-0"><summary className="cursor-pointer text-sm font-medium"><span className="mr-3 text-muted-foreground">{rule.clause}</span>{rule.label}</summary><div className="mt-4 space-y-4 text-sm leading-6"><p>{rule.condition}</p><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Dữ kiện cần</dt><dd>{rule.requiredFields.map(field=>fieldLabels[field]||field).join(', ')}</dd></div><div><dt className="text-xs text-muted-foreground">Người xử lý</dt><dd>{rule.recipient}</dd></div></dl><p>{rule.actions}</p>{rule.source?<div><a href={rule.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{rule.source.code}</a><p className="mt-1 text-xs text-muted-foreground">Đã đối chiếu văn bản; diễn giải điều khoản cần nghiệp vụ xác minh.</p></div>:<p className="text-xs text-muted-foreground">Kiểm soát nội bộ theo SOP.</p>}<details><summary className="cursor-pointer text-xs text-muted-foreground">Tham chiếu kỹ thuật</summary><p className="mt-2 break-all font-mono text-xs">{rule.id} / {rule.testTags.join(', ')}</p></details></div></details>)}{visible.length===0&&<p className="p-6 text-sm text-muted-foreground">Không tìm thấy quy tắc phù hợp.</p>}</div>
  </section>;
}
