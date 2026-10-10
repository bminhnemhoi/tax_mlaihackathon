import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server/auth';
import { getDatabase, withRequestDatabase } from '@/lib/server/db';
import { applyWorkflowAction, WorkflowError, readRecord } from '@/services/workflowService';
import { createPrecedent } from '@/services/precedentService';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest) {
 return withRequestDatabase(req,async()=>{try{
  const user=getRequestUser(req);if(!user)return NextResponse.json({error:'Vui lòng đăng nhập.'},{status:401});
  const body=await req.json();
  const result=getDatabase().transaction(()=>{
   const result=applyWorkflowAction(String(body.invoiceId),user,{action:'RESOLVE',evaluationId:body.evaluationId,revision:body.revision,optionId:body.optionId,resolvedFindingIds:body.resolvedFindingIds,reason:String(body.reason || '')});
   let precedent=null;
   if(body.saveAsPrecedent){
    if(user.role!=='CFO' || result.status!=='APPROVED')throw new WorkflowError('Chỉ CFO tạo tiền lệ từ hồ sơ đã duyệt.',403);
    const row=readRecord(body.invoiceId);const invoice=JSON.parse(row.payload_json);const decision=JSON.parse(row.decision_json!);
    const finding=decision.findings?.find((f:{kind:string})=>f.kind==='INTERNAL_POLICY');if(!finding)throw new WorkflowError('Hồ sơ không có quy tắc nội bộ phù hợp.',400);
    if(!body.purpose?.trim() || !Number.isFinite(body.maximumAmount) || body.maximumAmount<Math.abs(invoice.totalAmount))throw new WorkflowError('Trần tiền lệ phải bao phủ khoản chi và có mục đích cụ thể.',400);
    precedent=createPrecedent({supplierTaxCode:invoice.supplierTaxCode,supplierName:invoice.supplierName,riskPattern:finding.ruleId,sopClause:decision.sopClause,approvedOption:body.optionId,rationale:body.reason,approvedBy:`${user.displayName} (CFO)`,purpose:body.purpose,maximumAmount:body.maximumAmount,currentThreshold:Math.min(Math.abs(invoice.totalAmount),Number(body.maximumAmount)),originEventId:result.auditEventId});
   }
   return {...result,accepted:result.status==='APPROVED',precedent};
  })();return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Không thể xử lý.'},{status:error instanceof WorkflowError?error.status:400});}});
}
