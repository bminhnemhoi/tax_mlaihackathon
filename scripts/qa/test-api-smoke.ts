import assert from 'node:assert/strict';
import {challengeCases} from '../../data/verification/challengeCases';
const origin=process.env.TEST_BASE_URL || 'http://localhost:3000';
async function main(){
 const session=async()=>{const r=await fetch(origin+'/api/demo/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'CHIEF_ACCOUNTANT'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');};
 const cookie=await session();const other=await session();
 const call=async(path:string,body?:unknown,auth=cookie)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:auth,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {code:r.status,data:await r.json()};};
 const inv={...challengeCases[0].invoice,id:'API-'+Date.now(),invoiceNumber:'API-'+Date.now(),buyerTaxCode:'0100109106'};
 const evaluated=await call('/api/evaluate',{invoice:inv,forceLocalOnly:true});assert.equal(evaluated.code,200);assert.equal(evaluated.data.workflow.status,'APPROVED');
 const runtime=await call('/api/runtime');assert.equal(runtime.code,200);assert.equal(runtime.data.demo,true);assert.ok(runtime.data.policy.version);
 for(const path of ['/api/notifications','/api/invoices/duplicates'])assert.equal((await call(path)).code,200);
 // Mỗi phiên demo mới có 4 ca mẫu riêng; phiên khác không thấy ca vừa nhập.
 const SEEDED=4;const byId=(items:any[],id:string)=>items.find(i=>i.id===id);
 const inbox=await call('/api/inbox');assert.equal(inbox.data.items.length,SEEDED+1);const otherInbox=(await call('/api/inbox',undefined,other)).data.items;assert.equal(otherInbox.length,SEEDED);assert.equal(byId(otherInbox,inv.id),undefined);
 const row=byId(inbox.data.items,inv.id);assert.equal(row.allowedActions.pause,true);
 let r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'PAUSE',reason:'Kiểm tra API dừng hồ sơ',revision:row.revision,evaluationId:row.evaluationId});assert.equal(r.code,200);
 r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'RESUME',reason:'Kiểm tra phiên bản cũ',revision:row.revision,evaluationId:row.evaluationId});assert.equal(r.code,409);
 const paused=byId((await call('/api/inbox')).data.items,inv.id);assert.equal(paused.status,'PAUSED');
 r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'UNDO',reason:'Kiểm tra API hoàn tác',revision:paused.revision,evaluationId:paused.evaluationId});assert.equal(r.code,200);assert.equal(r.data.status,'APPROVED');
 const extracted=await call('/api/documents/parse',{rawText:'Hóa đơn số ABC123\nTên bên bán: Nhà cung cấp kiểm thử\nMã số thuế: 0100100100\nNgày: 10/10/2026\nTổng tiền: 1.100.000'});assert.equal(extracted.code,200);assert.ok(extracted.data.artifactId);
 for(const [mode,count] of [['common_4',4],['challenge_a',5],['regression_15',15]] as const){const v=await call('/api/verify?mode='+mode);assert.equal(v.code,200);assert.equal(v.data.summary.passedCases,count);}
 const chain=await call('/api/audit?verify=1');assert.equal(chain.code,200);assert.equal(chain.data.valid,true);const history=await call('/api/audit?entityId='+inv.id);assert.ok(history.data.events.length>=4);
 const custom=await call('/api/verify',{sampleType:'CUSTOM',customInvoice:{invoiceNumber:'MISSING-API'}});assert.equal(custom.code,200);assert.equal(custom.data.decision.status,'ESCALATED');assert.ok(custom.data.decision.actionableQuestion);
 assert.equal((await call('/api/inbox')).data.items.length,SEEDED+1);
 // Bộ Verify lớn cần phiên; bộ giám khảo công khai.
 assert.equal((await fetch(origin+'/api/verify?mode=regression_15')).status,401);
 const judge=await (await fetch(origin+'/api/verify?mode=judge')).json();assert.equal(judge.summary.passedCases,9);
 const health=await (await fetch(origin+'/api/health')).json();assert.equal(health.status,'ok');assert.ok(health.policyVersion);
 // Trả lời "1A, 2A" trên ca mẫu CFO (10 laptop 330 triệu): gán trạng thái bên bán, đánh giá lại, CFO chấp nhận vượt hạn mức → duyệt.
 let jar=cookie;
 const switchTo=async(role:string)=>{const res=await fetch(origin+'/api/auth/switch',{method:'POST',headers:{cookie:jar,'Content-Type':'application/json'},body:JSON.stringify({role})});assert.equal(res.status,200);const token=res.headers.getSetCookie().map(s=>s.split(';')[0]).find(s=>s.startsWith('tax_referee_session='))!;jar=jar.split('; ').filter(s=>!s.startsWith('tax_referee_session=')).concat(token).join('; ');};
 await switchTo('CFO');
 const cfoCase=byId((await call('/api/inbox',undefined,jar)).data.items,'MAU-0009004');assert.equal(cfoCase.status,'WAITING_CFO');
 const answered=await call('/api/invoices/MAU-0009004/answer',{answers:{'1':'A','2':'A'},reason:'CFO duyệt mua laptop theo kế hoạch',revision:cfoCase.revision,evaluationId:cfoCase.evaluationId},jar);assert.equal(answered.code,200,JSON.stringify(answered.data));
 assert.equal(byId((await call('/api/inbox',undefined,jar)).data.items,'MAU-0009004').status,'APPROVED');
 // Công tắc dừng: ca thường quy mới bị giữ chờ duyệt tay; bật lại thì tự hoàn tất.
 assert.equal((await call('/api/system/automation',{paused:true,reason:'Kiểm tra công tắc dừng'},jar)).code,200);
 await switchTo('ACCOUNTANT');
 const held={...inv,id:'HELD-'+Date.now(),invoiceNumber:'HELD-'+Date.now()};
 const heldResult=await call('/api/evaluate',{invoice:held,forceLocalOnly:true},jar);assert.equal(heldResult.code,200);assert.equal(heldResult.data.workflow.status,'WAITING_CHIEF_ACCOUNTANT');
 await switchTo('CFO');
 const resumed=await call('/api/system/automation',{paused:false,reason:'Bật lại sau kiểm tra'},jar);assert.equal(resumed.code,200);assert.equal(resumed.data.released,1);
 assert.equal(byId((await call('/api/inbox',undefined,jar)).data.items,held.id).status,'APPROVED');
 console.log('PASS API: demo isolation + 4 seeded cases, routine voucher, pause, stale 409, undo, text source, Verify 4/5/15/judge, heavy suite needs session, answer "1A, 2A", kill switch hold/release.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
