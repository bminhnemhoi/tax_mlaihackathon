import fs from 'node:fs';
import crypto from 'node:crypto';
import {getActivePolicy,runIsolated,hashPayload} from '../../lib/server/db';
import {IndependentSetSchema,caseFingerprint} from '../../lib/refereeDataset';
import {challengeCases,commonCases,regressionCases} from '../../data/verification/challengeCases';
import {developmentCases} from '../../data/verification/developmentCases';
import {evaluateRefereeCases} from '../../services/refereeEvaluationService';
import {sourceMetadata,writeReport} from './referee-report-utils';
async function main():Promise<void>{
 const input=process.argv[2];if(!input)throw new Error('Cần file nhãn độc lập đã khóa, >=20 ca.');
 const bytes=fs.readFileSync(input),set=IndependentSetSchema.parse(JSON.parse(bytes.toString()));
 const sourceHash=crypto.createHash('sha256').update(bytes).digest('hex');
 const sealPath=input+'.sha256';
 if(set.schemaVersion===2 && !fs.existsSync(sealPath))throw new Error('Thiếu dấu khóa SHA-256. Chạy labels:lock trước khi đánh giá.');
 if(fs.existsSync(sealPath) && fs.readFileSync(sealPath,'utf8').trim()!==sourceHash)throw new Error('Tập nhãn đã thay đổi sau khi khóa.');
 if(Date.parse(set.lockedAt)>Date.now())throw new Error('Mốc khóa nhãn nằm trong tương lai.');
 const training=new Set([...challengeCases,...commonCases,...regressionCases,...developmentCases].map(c=>caseFingerprint(c)));
 set.trainingInvoiceHashes.forEach(h=>training.add(h));
 const seenIds=new Set<string>(),seenInvoiceIds=new Set<string>(),seenInvoices=new Set<string>();
 for(const c of set.cases){
  const fingerprint=caseFingerprint(c);
  if(seenIds.has(c.id)||seenInvoices.has(fingerprint)||(c.invoice.id&&seenInvoiceIds.has(c.invoice.id)))throw new Error('Ca trùng: '+c.id);
  if(training.has(fingerprint))throw new Error('Ca '+c.id+' trùng fixture/tập phát triển; không phải holdout độc lập.');
  if(Date.parse(c.labeledAt)>Date.parse(set.lockedAt))throw new Error('Nhãn '+c.id+' được ghi sau lúc khóa.');
  seenIds.add(c.id);seenInvoices.add(fingerprint);
  if(c.invoice.id)seenInvoiceIds.add(c.invoice.id);
 }
 const policy=set.policySnapshot || await runIsolated(async()=>getActivePolicy());
 if(set.policySnapshot && policy.config.companyTaxCode!==set.companyTaxCode)throw new Error('MST tập nhãn không khớp snapshot policy.');
 policy.config.companyTaxCode=set.companyTaxCode;
 const started=performance.now();const evaluation=await evaluateRefereeCases(set.cases,policy);
 const report={runId:crypto.randomUUID(),timestamp:new Date().toISOString(),durationMs:Math.round(performance.now()-started),dataset:'LOCKED_HUMAN_LABELS',lockedAt:set.lockedAt,
  labelSHA256:hashPayload(JSON.parse(bytes.toString())),sourceFileSHA256:sourceHash,labelSealStatus:fs.existsSync(sealPath)?'SEALED':'LEGACY_UNSEALED',...sourceMetadata(),executionMode:'DETERMINISTIC_LOCAL_PER_CASE',
  questionRubricStatus:'AWAITING_BLIND_HUMAN_SCORING',...evaluation};
 const out=process.argv.indexOf('--out');if(out>=0){if(!process.argv[out+1])throw new Error('Thiếu đường dẫn --out');writeReport(report,process.argv[out+1]);}
 console.log(JSON.stringify(report,null,2));
 if(report.errors>0 || report.passed!==report.total)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
