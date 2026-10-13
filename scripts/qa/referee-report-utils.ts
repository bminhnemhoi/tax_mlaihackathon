import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {csvCell} from '../../lib/refereeDataset';
function hashWorkingDiff():string {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'referee-code-diff-'));
  const file=path.join(directory,'working.diff');
  let descriptor:number|undefined;
  try {
    descriptor=fs.openSync(file,'w',0o600);
    // Large working trees must not exceed child_process's stdout buffer.
    execFileSync('git',['diff','HEAD'],{stdio:['ignore',descriptor,'pipe']});
    fs.closeSync(descriptor);descriptor=undefined;descriptor=fs.openSync(file,'r');
    const hash=crypto.createHash('sha256');const buffer=Buffer.alloc(64*1024);
    let count:number;
    while((count=fs.readSync(descriptor,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count));
    return hash.digest('hex');
  } finally {
    if(descriptor!==undefined)fs.closeSync(descriptor);
    if(fs.existsSync(file))fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
}
export function sourceMetadata():{sourceTreeSHA256:string;codeCommit:string;workingDiffSHA256:string}{
  const hash=crypto.createHash('sha256');
  const walk=(directory:string):void=>{for(const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(directory,item.name);if(item.isDirectory()){if(!['runtime','uploads','node_modules'].includes(item.name))walk(file);}else if(/\.(tsx?|js|json|ya?ml)$/.test(file))hash.update(file+'\0').update(fs.readFileSync(file)).update('\0');}};
  for(const dir of ['app','components','data','lib','services','scripts'])walk(dir);
  for(const file of ['package.json','package-lock.json','next.config.ts','tsconfig.json'])if(fs.existsSync(file))hash.update(file+'\0').update(fs.readFileSync(file));
  return {sourceTreeSHA256:hash.digest('hex'),codeCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingDiffSHA256:hashWorkingDiff()};
}
export function writeReport(report:{runId:string;results:object[]},output:string):void{
  const rows:Record<string,unknown>[]=report.results.map(r=>({...r}));
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  const fields=['id','name','expected','actual','expectedRiskGroup','actualRiskGroup','expectedRequiresCFO','requiresCFO','workflow','match','approvedTax','voucher','auditCount','workflowValid','questionCheck','durationMs','question','provenance','error'];
  fs.writeFileSync(output.replace(/\.json$/,'')+'.csv',[fields.map(csvCell).join(','),...rows.map(r=>fields.map(f=>csvCell(r[f])).join(','))].join('\n')+'\n');
  fs.writeFileSync(output.replace(/\.json$/,'')+'-question-scoring.csv',['runId,caseId,score_0_3_6,reviewerId,scoredAt,notes',...rows.filter(r=>r.actual==='ESCALATED').map(r=>[report.runId,r.id,'','','',''].map(csvCell).join(','))].join('\n')+'\n');
}
