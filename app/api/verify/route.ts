import {NextRequest,NextResponse} from 'next/server';
import {runVerification} from '@/services/verificationService';
import {evaluateWorkflow} from '@/services/workflowService';
import {runIsolated,getDatabase,getActivePolicy} from '@/lib/server/db';
import {challengeCases,demoCompanyTaxCode} from '@/data/verification/challengeCases';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{return NextResponse.json(await runVerification(req.nextUrl.searchParams.get('mode') || 'challenge_a'));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Không thể kiểm thử'},{status:500});}}
export async function POST(req:NextRequest){try{const body=await req.json();const invoice=body.sampleType==='CUSTOM'?body.customInvoice:body.sampleType==='ROUTINE'?challengeCases[0].invoice:challengeCases[3].invoice;const start=Date.now();const r=await runIsolated(()=>{const p=getActivePolicy();p.config.companyTaxCode=demoCompanyTaxCode;getDatabase().prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(p),p.version);return evaluateWorkflow(invoice,null,{forceLocalOnly:true});});return NextResponse.json({success:true,sampleType:body.sampleType,invoice,decision:r.decision,workflow:r.workflow,executionTimeMs:Date.now()-start,schemaValid:true,timestamp:new Date().toISOString()});}catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:'Dữ liệu không hợp lệ'},{status:400});}}
