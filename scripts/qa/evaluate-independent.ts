import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {z} from 'zod';
import {runIsolated,getDatabase,getActivePolicy,hashPayload} from '../../lib/server/db';
import {evaluateWorkflow,readRecord} from '../../services/workflowService';
import {InvoiceInputSchema} from '../../lib/schemas';
import {challengeCases,commonCases,regressionCases} from '../../data/verification/challengeCases';
const CaseSchema=z.object({id:z.string().min(1),invoice:InvoiceInputSchema,expectedStatus:z.enum(['ROUTINE','ESCALATED']),expectedRiskGroup:z.enum(['UNCERTAIN_INFO','OUT_OF_POLICY','EXCEED_AUTHORITY']).optional(),expectedRequiresCFO:z.boolean(),rationale:z.string().min(8),labeledBy:z.string().min(1),labeledAt:z.string().datetime(),provenance:z.string().min(8)}).superRefine((c,ctx)=>{if(c.expectedStatus==='ESCALATED'&&!c.expectedRiskGroup)ctx.addIssue({code:'custom',message:'Ca chuyển tiếp cần nhãn nhóm'});});
const SetSchema=z.object({status:z.literal('LOCKED'),lockedAt:z.string().datetime(),companyTaxCode:z.string().min(1),trainingInvoiceHashes:z.array(z.string()).default([]),cases:z.array(CaseSchema).min(20)});
function fingerprint(invoice:Record<string,unknown>){const {id,invoiceNumber,...fields}=invoice;return hashPayload(fields);}
function sourceTreeHash(){
 const hash=crypto.createHash('sha256'),files:string[]=[];
 const walk=(directory:string)=>{if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory()){if(!['runtime','uploads','node_modules'].includes(entry.name))walk(file);}else if(entry.isFile()&&/\.(tsx?|js|json|ya?ml)$/.test(file))files.push(file);}};
 for(const directory of ['app','components','lib','services','data','scripts'])walk(directory);
 for(const file of ['package.json','package-lock.json','next.config.ts','tsconfig.json'])if(fs.existsSync(file))files.push(file);
 for(const file of [...new Set(files)].sort())hash.update(file+'\0').update(fs.readFileSync(file)).update('\0');
 return hash.digest('hex');
}
async function main(){
 const input=process.argv[2];if(!input)throw new Error('Cần file nhãn độc lập đã khóa, >=20 ca.');
 const bytes=fs.readFileSync(input),set=SetSchema.parse(JSON.parse(bytes.toString()));
 const seenIds=new Set<string>(),seenInvoices=new Set<string>();
 const training=new Set([...challengeCases,...commonCases,...regressionCases].map(c=>fingerprint(c.invoice)));
 set.trainingInvoiceHashes.forEach(h=>training.add(h));
 for(const c of set.cases){
  const hash=fingerprint(c.invoice);
  if(seenIds.has(c.id)||seenIds.has(c.invoice.id)||seenInvoices.has(hash))throw new Error(`Ca trùng: ${c.id}`);
  if(training.has(hash))throw new Error(`Ca ${c.id} trùng fixture/tập học; không phải holdout độc lập.`);
  if(Date.parse(c.labeledAt)>Date.parse(set.lockedAt))throw new Error(`Nhãn ${c.id} được ghi sau lúc khóa.`);
  seenIds.add(c.id);seenIds.add(c.invoice.id);seenInvoices.add(hash);
 }
 const start=Date.now();
 const report=await runIsolated(async()=>{
  const policy=getActivePolicy();policy.config.companyTaxCode=set.companyTaxCode;
  getDatabase().prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy),policy.version);
  const results=[];
  for(const c of set.cases){try{
   const r=await evaluateWorkflow(c.invoice,null,{forceLocalOnly:true}),d=r.decision;
   results.push({id:c.id,expected:c.expectedStatus,actual:d.status,expectedRiskGroup:c.expectedRiskGroup,actualRiskGroup:d.status==='ESCALATED'?d.riskGroup:null,requiresCFO:d.status==='ESCALATED'?d.requiresCFO:false,workflow:readRecord(c.invoice.id).status,match:d.status===c.expectedStatus && (d.status==='ROUTINE'||d.riskGroup===c.expectedRiskGroup&&d.requiresCFO===c.expectedRequiresCFO),question:d.status==='ESCALATED'?d.actionableQuestion:null,provenance:c.provenance});
  }catch(e){results.push({id:c.id,expected:c.expectedStatus,actual:'ERROR',match:false,error:e instanceof Error?e.message:'ERROR'});}}
  const e=results.filter(r=>r.expected==='ESCALATED').length,n=results.length-e;
  const fn=results.filter(r=>r.expected==='ESCALATED'&&r.actual==='ROUTINE').length,fp=results.filter(r=>r.expected==='ROUTINE'&&r.actual==='ESCALATED').length;
  const auto=results.filter(r=>r.actual==='ROUTINE'&&r.workflow==='APPROVED').length;
  const count=(value:number,denominator:number)=>({count:value,denominator,rate:denominator?value/denominator:null});
  return {policyVersion:policy.version,policyHash:hashPayload(policy.config),total:results.length,passed:results.filter(r=>r.match).length,errors:results.filter(r=>r.actual==='ERROR').length,falseNegative:count(fn,e),falsePositive:count(fp,n),stp:count(auto,results.length),routineCompletion:count(results.filter(r=>r.expected==='ROUTINE'&&r.workflow==='APPROVED').length,n),classificationAndRouting:count(results.filter(r=>r.expected==='ESCALATED'&&r.match).length,e),results};
 });
 const git=(args:string[])=>{try{return execFileSync('git',args,{encoding:'utf8'}).trim();}catch{return 'UNAVAILABLE';}};
 console.log(JSON.stringify({runId:crypto.randomUUID(),timestamp:new Date().toISOString(),durationMs:Date.now()-start,lockedAt:set.lockedAt,labelSHA256:hashPayload(JSON.parse(bytes.toString())),sourceFileSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceTreeSHA256:sourceTreeHash(),codeCommit:git(['rev-parse','HEAD']),workingDiffSHA256:crypto.createHash('sha256').update(git(['diff','HEAD'])).digest('hex'),executionMode:'DETERMINISTIC_LOCAL',questionRubricStatus:'AWAITING_BLIND_HUMAN_SCORING',...report},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
