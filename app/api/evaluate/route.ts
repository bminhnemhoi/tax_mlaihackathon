import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { isSandbox, runIsolated, withRequestDatabase } from '@/lib/server/db';
import { evaluateWorkflow, WorkflowError } from '@/services/workflowService';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  return withRequestDatabase(req, async () => {
    try {
      const body=await req.json(); const user=getRequestUser(req);
      if(!user && body.demo!==true) return NextResponse.json({error:'Vui lòng đăng nhập.'},{status:401});
      const run=()=>evaluateWorkflow(body.invoice || body,user,{forceLocalOnly:body.forceLocalOnly===true,confirmedFields:body.confirmedFields,confirmations:body.confirmations,evidence:body.evidence,expectedRevision:body.expectedRevision});
      const result=body.demo===true && !isSandbox() ? await runIsolated(run) : await run();
      return NextResponse.json(result);
    } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Không thể đánh giá.'},{status:error instanceof WorkflowError?error.status:400});}
  });
}
