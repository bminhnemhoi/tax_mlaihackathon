import fs from 'node:fs';
import {z} from 'zod';
const ScoresSchema=z.object({runId:z.string(),scores:z.array(z.object({caseId:z.string(),score:z.union([z.literal(0),z.literal(3),z.literal(6)]),reviewerId:z.string().min(1),scoredAt:z.string().datetime(),notes:z.string().min(8)}))});
function main():void{
 const report=z.object({runId:z.string(),results:z.array(z.object({id:z.string(),actual:z.string()}))}).parse(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),scores=ScoresSchema.parse(JSON.parse(fs.readFileSync(process.argv[3],'utf8')));
 if(scores.runId!==report.runId)throw new Error('Run ID không khớp');
 const cases=new Set<string>(report.results.filter(r=>r.actual==='ESCALATED').map(r=>r.id));
 const seen=new Set<string>();
 for(const s of scores.scores){if(!cases.has(s.caseId)||seen.has(s.caseId))throw new Error('Nhãn câu hỏi trùng hoặc ngoài lần chạy: '+s.caseId);seen.add(s.caseId);}
 if(seen.size!==cases.size)throw new Error('Chưa chấm đủ câu hỏi chuyển tiếp');
 console.log(JSON.stringify({runId:report.runId,status:'HUMAN_SCORED',count:scores.scores.length,meanScore:scores.scores.length?scores.scores.reduce((sum,s)=>sum+s.score,0)/scores.scores.length:null,scores:scores.scores},null,2));
}
try{main();}catch(error){console.error(error);process.exitCode=1;}
