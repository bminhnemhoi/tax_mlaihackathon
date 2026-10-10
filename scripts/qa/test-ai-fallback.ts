import assert from 'node:assert/strict';
import {runIsolated} from '../../lib/server/db';
import {queryJevReferee} from '../../services/jevService';
import {challengeCases} from '../../data/verification/challengeCases';
import {GEMINI_API_CONFIG,QWEN_API_CONFIG,OPENROUTER_API_CONFIG} from '../../lib/constants';
async function main(){await runIsolated(async()=>{
 const inv={...challengeCases[4].invoice,id:'AI-FALLBACK',invoiceNumber:'AI-FALLBACK',buyerTaxCode:'0100109106'};
 const baseline=await queryJevReferee(inv,{forceLocalOnly:true});
 const g=GEMINI_API_CONFIG.API_KEY,q=QWEN_API_CONFIG.API_KEY,o=OPENROUTER_API_CONFIG.API_KEY,f=globalThis.fetch,w=console.warn,err=console.error;
 try{console.warn=()=>{};console.error=()=>{};let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Không được gọi mạng khi thiếu key');};GEMINI_API_CONFIG.API_KEY='';QWEN_API_CONFIG.API_KEY='';OPENROUTER_API_CONFIG.API_KEY='';const missing=await queryJevReferee(inv);assert.equal(calls,0);assert.equal(missing.engineUsed,'LOCAL_FALLBACK');assert.equal(missing.decision.status,'ESCALATED');assert.ok(missing.decision.status==='ESCALATED' && missing.decision.actionableQuestion);console.log('PASS thiếu AI key: dùng template, giữ quyết định local');
 GEMINI_API_CONFIG.API_KEY='synthetic-test-key';QWEN_API_CONFIG.API_KEY='synthetic-test-key';globalThis.fetch=async()=>{throw new DOMException('Synthetic timeout','TimeoutError');};const timeout=await queryJevReferee(inv);assert.equal(timeout.engineUsed,'LOCAL_FALLBACK');assert.equal(timeout.decision.status,baseline.decision.status);assert.deepEqual(timeout.decision.options,baseline.decision.options);console.log('PASS AI timeout giả lập: giữ câu hỏi và phương án local');
 }finally{GEMINI_API_CONFIG.API_KEY=g;QWEN_API_CONFIG.API_KEY=q;OPENROUTER_API_CONFIG.API_KEY=o;globalThis.fetch=f;console.warn=w;console.error=err;}
 });}
main().catch(e=>{console.error(e);process.exitCode=1;});
