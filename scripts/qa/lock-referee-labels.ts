import fs from 'node:fs';
import crypto from 'node:crypto';
import {IndependentSetSchema} from '../../lib/refereeDataset';
function main():void {
 const [input,output]=process.argv.slice(2);
 if(!input||!output||input===output)throw new Error('Cần file nhãn nháp và đường dẫn file khóa mới, khác file nháp.');
 if(fs.existsSync(output)||fs.existsSync(output+'.sha256'))throw new Error('File khóa đã tồn tại; không ghi đè tập đã khóa.');
 const draft:unknown=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!draft||typeof draft!=='object')throw new Error('Tập nhãn không phải đối tượng JSON.');
 const locked=IndependentSetSchema.parse({...draft,schemaVersion:2,status:'LOCKED',lockedAt:new Date().toISOString()});
 if(locked.cases.some(c=>Date.parse(c.labeledAt)>Date.parse(locked.lockedAt)))throw new Error('Có nhãn nằm trong tương lai.');
 const bytes=JSON.stringify(locked,null,2)+'\n';const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(output,bytes,{flag:'wx'});fs.writeFileSync(output+'.sha256',hash+'\n',{flag:'wx'});
 console.log(`Đã khóa ${locked.cases.length} nhãn; SHA-256: ${hash}`);
}
try{main();}catch(error){console.error(error);process.exitCode=1;}
