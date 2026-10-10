import fs from 'node:fs/promises';
import path from 'node:path';
import {parseReceiptEntities} from '../../lib/receiptEntityParser';
async function main(){
 const endpoint=process.env.LOCAL_OCR_URL || 'http://127.0.0.1:3004';
 const output=path.resolve(process.env.LOCAL_OCR_BENCH_DIR || 'docs/qa-2026-10-10/local-ocr-evidence');await fs.mkdir(output,{recursive:true});
 const truth=JSON.parse(await fs.readFile('docs/qa-2026-10-10/real-sample-truth.json','utf8'));
 const health=await (await fetch(endpoint+'/health')).json();const records=[];
 for(let round=1;round<=3;round++)for(const c of truth.cases){
  const bytes=await fs.readFile(path.join('input-sample',c.file));const start=performance.now();
  const response=await fetch(endpoint+'/ocr',{method:'POST',body:bytes,headers:{'Content-Type':'application/octet-stream'}});if(!response.ok)throw new Error(`Worker ${response.status}`);
  const raw=await response.json();const parsed=parseReceiptEntities(raw.lines);const elapsedMs=Math.round(performance.now()-start);
  const checks=Object.entries(c).filter(([k])=>!['file','absent','supplierNameContains'].includes(k)).map(([field,expected])=>({field,expected,actual:parsed.invoice[field]??null,pass:parsed.invoice[field]===expected}));
  for(const field of c.absent)checks.push({field,expected:null,actual:parsed.invoice[field]??null,pass:parsed.invoice[field]===undefined});
  const record={file:c.file,round,elapsedMs,performance:raw.performance,invoice:parsed.invoice,uncertainFields:parsed.uncertainFields,checks};records.push(record);
  await fs.writeFile(path.join(output,`${round}-${c.file}.json`),JSON.stringify({record,raw,parsed},null,2));console.log(c.file,round,elapsedMs+'ms',checks.filter(x=>x.pass).length+'/'+checks.length);
 }
 const sorted=records.map(r=>r.elapsedMs).sort((a,b)=>a-b);const summary={health,n:records.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted[sorted.length-1],records};await fs.writeFile(path.join(output,'benchmark.json'),JSON.stringify(summary,null,2));console.log({medianMs:summary.medianMs,p95Ms:summary.p95Ms,maxMs:summary.maxMs});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
