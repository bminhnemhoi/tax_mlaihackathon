import {NextRequest,NextResponse} from 'next/server';
import {getRequestUser} from '@/lib/server/auth';
import {withRequestDatabase} from '@/lib/server/db';
import {applyWorkflowAction,WorkflowError} from '@/services/workflowService';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}) {
 return withRequestDatabase(req,async()=>{try{
 const user=getRequestUser(req);if(!user)return NextResponse.json({error:'Vui lòng đăng nhập.'},{status:401});
 const {id}=await context.params;const body=await req.json();
 return NextResponse.json(applyWorkflowAction(id,user,body));
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Không thể xử lý.'},{status:error instanceof WorkflowError?error.status:400});}});
}
