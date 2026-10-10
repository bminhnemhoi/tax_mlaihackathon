import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,ChildProcess} from 'node:child_process';
import {challengeCases} from '../../data/verification/challengeCases';
async function main(){
const build=path.resolve(process.env.NEXT_BUILD_DIR || '.next');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'tax-referee-recovery-'));const runtime=path.join(root,'runtime'),backup=path.join(root,'backup');const port='3002',origin=`http://127.0.0.1:${port}`;let child:ChildProcess|undefined;
async function stop(){if(!child || child.exitCode!==null)return;const c=child;await new Promise<void>(resolve=>{c.once('exit',()=>resolve());c.kill('SIGTERM');});child=undefined;}
async function start(){child=spawn(process.execPath,[path.join(build,'standalone/server.js')],{env:{...process.env,PORT:port,HOSTNAME:'127.0.0.1',TAX_REFEREE_DATA_DIR:runtime,TAX_REFEREE_DB_PATH:path.join(runtime,'internal.sqlite')},stdio:'ignore'});for(let i=0;i<50;i++){if(child.exitCode!==null)throw new Error('Standalone không khởi động.');try{const r=await fetch(origin+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Standalone health timeout.');}
try{
 await start();let response=await fetch(origin+'/api/demo/session',{method:'POST'});assert.equal(response.status,200);const cookie=response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');const headers={cookie,'Content-Type':'application/json'};
 const inv={...challengeCases[0].invoice,id:'RECOVERY',invoiceNumber:'RECOVERY',buyerTaxCode:'0100109106'};
 response=await fetch(origin+'/api/evaluate',{method:'POST',headers,body:JSON.stringify({invoice:inv,forceLocalOnly:true})});assert.equal(response.status,200);
 response=await fetch(origin+'/api/documents/parse',{method:'POST',headers,body:JSON.stringify({rawText:'Hóa đơn số RESTORE123; Tổng tiền 1.100.000'})});assert.equal(response.status,200);const artifact=(await response.json()).artifactId;assert.ok(artifact);
 const check=async()=>{const r=await fetch(origin+'/api/inbox',{headers});assert.equal(r.status,200);const row=(await r.json()).items[0];assert.equal(row.status,'APPROVED');assert.ok(row.internalVoucherId);assert.equal(row.revision,1);const source=await fetch(origin+`/api/documents/artifacts/${artifact}`,{headers});assert.equal(source.status,200);assert.ok((await source.text()).includes('RESTORE123'));const audit=await fetch(origin+'/api/audit',{headers});assert.equal(audit.status,200);};
 await check();await stop();await start();await check();console.log('PASS standalone restart: session, invoice revision, voucher, audit, artifact');
 await stop();await fs.cp(runtime,backup,{recursive:true});await fs.rm(runtime,{recursive:true});await fs.cp(backup,runtime,{recursive:true});await start();await check();console.log('PASS standalone offline snapshot/restore');
}finally{await stop();await fs.rm(root,{recursive:true,force:true});}

}
main().catch(e=>{console.error(e);process.exitCode=1;});
