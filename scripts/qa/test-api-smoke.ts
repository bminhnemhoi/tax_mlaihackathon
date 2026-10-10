import assert from 'node:assert/strict';
import {challengeCases} from '../../data/verification/challengeCases';
const origin=process.env.TEST_BASE_URL || 'http://localhost:3000';
async function main(){
 const session=async()=>{const r=await fetch(origin+'/api/demo/session',{method:'POST'});assert.equal(r.status,200);return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');};
 const cookie=await session();const other=await session();
 const call=async(path:string,body?:unknown,auth=cookie)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:auth,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {code:r.status,data:await r.json()};};
 const inv={...challengeCases[0].invoice,id:'API-'+Date.now(),invoiceNumber:'API-'+Date.now(),buyerTaxCode:'0100109106'};
 const evaluated=await call('/api/evaluate',{invoice:inv,forceLocalOnly:true});assert.equal(evaluated.code,200);assert.equal(evaluated.data.workflow.status,'APPROVED');
 const inbox=await call('/api/inbox');assert.equal(inbox.data.items.length,1);assert.equal((await call('/api/inbox',undefined,other)).data.items.length,0);
 const row=inbox.data.items[0];assert.equal(row.allowedActions.pause,true);
 let r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'PAUSE',reason:'Kiểm tra API dừng hồ sơ',revision:row.revision,evaluationId:row.evaluationId});assert.equal(r.code,200);
 r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'RESUME',reason:'Kiểm tra phiên bản cũ',revision:row.revision,evaluationId:row.evaluationId});assert.equal(r.code,409);
 const paused=(await call('/api/inbox')).data.items[0];assert.equal(paused.status,'PAUSED');
 r=await call(`/api/invoices/${inv.id}/audit-action`,{action:'UNDO',reason:'Kiểm tra API hoàn tác',revision:paused.revision,evaluationId:paused.evaluationId});assert.equal(r.code,200);assert.equal(r.data.status,'APPROVED');
 const extracted=await call('/api/documents/parse',{rawText:'Hóa đơn số ABC123\nTên bên bán: Nhà cung cấp kiểm thử\nMã số thuế: 0100100100\nNgày: 10/10/2026\nTổng tiền: 1.100.000'});assert.equal(extracted.code,200);assert.ok(extracted.data.artifactId);
 for(const [mode,count] of [['common_4',4],['challenge_a',5],['regression_15',15]] as const){const v=await call('/api/verify?mode='+mode);assert.equal(v.code,200);assert.equal(v.data.summary.passedCases,count);}
 const chain=await call('/api/audit?verify=1');assert.equal(chain.code,200);assert.equal(chain.data.valid,true);const history=await call('/api/audit?entityId='+inv.id);assert.ok(history.data.events.length>=4);
 const custom=await call('/api/verify',{sampleType:'CUSTOM',customInvoice:{invoiceNumber:'MISSING-API'}});assert.equal(custom.code,200);assert.equal(custom.data.decision.status,'ESCALATED');assert.ok(custom.data.decision.actionableQuestion);
 assert.equal((await call('/api/inbox')).data.items.length,1);
 console.log('PASS API: demo isolation, routine voucher, pause, stale 409, undo, text source, Verify 4/5/15, new uncertain input.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
