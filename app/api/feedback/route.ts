import {NextRequest,NextResponse} from 'next/server';
import {getRequestUser} from '@/lib/server/auth';
import {withRequestDatabase} from '@/lib/server/db';
import {submitFeedback,rollbackThreshold} from '@/services/feedbackService';
import {WorkflowError} from '@/services/workflowService';
export async function POST(req:NextRequest){return withRequestDatabase(req,async()=>{try{const user=getRequestUser(req);if(!user)return NextResponse.json({error:'Vui lòng đăng nhập.'},{status:401});const body=await req.json();return NextResponse.json(body.action==='ROLLBACK'?rollbackThreshold(body.precedentId,user,String(body.reason || '')):submitFeedback(body,user));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Không thể hậu kiểm.'},{status:error instanceof WorkflowError?error.status:400});}});}
