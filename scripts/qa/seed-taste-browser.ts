import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDatabase,getActivePolicy,artifactRoot } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { challengeCases,demoCompanyTaxCode } from '../../data/verification/challengeCases';
import { createInvoiceImageFixture } from './invoice-image-fixture';
async function main():Promise<void> {
  if(process.env.TAX_REFEREE_DATA_DIR!=='/tmp/tax-referee-taste-browser-runtime'||process.env.TAX_REFEREE_DB_PATH!=='/tmp/tax-referee-taste-browser-runtime/tax-referee.sqlite')throw new Error('Browser fixtures require the dedicated temporary database.');
  const db=getDatabase();const policy=getActivePolicy();policy.config.companyTaxCode=demoCompanyTaxCode;db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy),policy.version);
  const image=await createInvoiceImageFixture();await fs.mkdir(artifactRoot(),{recursive:true});const file=path.join(artifactRoot(),'taste-receipt.png');await fs.writeFile(file,image);
  const hash=crypto.createHash('sha256').update(image).digest('hex');
  db.prepare('INSERT INTO document_artifacts (id,invoice_id,revision,original_file_name,source_type,mime_type,storage_path,content_hash,byte_size,created_at) VALUES (?,?,1,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run('TASTE-SOURCE','pending:TASTE-SOURCE','test-receipt.png','IMAGE','image/png',file,hash,image.byteLength,new Date().toISOString());
  const importer={id:'taste-fixture-importer',role:'ACCOUNTANT' as const,email:'fixture@example.test',displayName:'Dữ liệu kiểm thử'};
  for(let i=0;i<challengeCases.length;i++){
    const source=i===1?{sourceArtifactId:'TASTE-SOURCE',sourceHash:hash}:{};
    const invoice={...challengeCases[i].invoice,...source,id:'TASTE-'+i,invoiceNumber:'000012'+i};
    const outcome=await evaluateWorkflow(invoice,importer,{forceLocalOnly:true});console.log(invoice.id,outcome.workflow.status);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
