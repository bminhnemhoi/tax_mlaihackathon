import {NextRequest,NextResponse} from 'next/server';
import {runVerification} from '@/services/verificationService';
import {evaluateWorkflow} from '@/services/workflowService';
import {runIsolated,getDatabase,getActivePolicy} from '@/lib/server/db';
import {challengeCases,demoCompanyTaxCode} from '@/data/verification/challengeCases';
import {RefereeContextSchema} from '@/lib/refereeDataset';
import {evaluateRefereeCases} from '@/services/refereeEvaluationService';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){if(!['common_4','challenge_a','regression_15','development_60'].includes(req.nextUrl.searchParams.get('mode') || 'challenge_a'))return NextResponse.json({error:'Bộ kiểm thử không hợp lệ'},{status:400});try{return NextResponse.json(await runVerification(req.nextUrl.searchParams.get('mode') || 'challenge_a'));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Không thể kiểm thử'},{status:500});}}
export async function POST(req:NextRequest){
 try{
  const body=await req.json();const invoice=body.sampleType==='CUSTOM'?body.customInvoice:body.sampleType==='ROUTINE'?challengeCases[0].invoice:challengeCases[3].invoice;
  const context=RefereeContextSchema.optional().parse(body.context);const started=performance.now();
  const policy=await runIsolated(async()=>{const p=getActivePolicy();p.config.companyTaxCode=demoCompanyTaxCode;return p;});
  const report=await evaluateRefereeCases([{id:'SANDBOX',name:'Dữ liệu mới',invoice,context,expectedStatus:'ROUTINE',expectedRequiresCFO:false,rationale:'Sandbox không có nhãn kỳ vọng.',provenance:'USER_INPUT_SANDBOX'}],policy);
  const r=report.results[0];if(r.actual==='ERROR')return NextResponse.json({success:false,error:r.error},{status:400});
  return NextResponse.json({success:true,sampleType:body.sampleType,invoice,decision:r.decision,workflow:{status:r.workflow,autoApproved:r.actual==='ROUTINE',internalVoucherCreated:r.voucher},questionCheck:r.questionCheck,executionTimeMs:Math.round(performance.now()-started),schemaValid:true,timestamp:new Date().toISOString()});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'Dữ liệu không hợp lệ'},{status:400});}
}
