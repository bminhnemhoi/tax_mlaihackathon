import { NextRequest, NextResponse } from 'next/server';
import { withRequestDatabase } from '@/lib/server/db';
import { requireRequestUser } from '@/lib/server/auth';
import { readInboxItems } from '@/services/inboxReadService';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}):Promise<NextResponse> {
  return withRequestDatabase(request,async()=>{
    try {
      const user=requireRequestUser(request);
      const {id}=await params;
      const item=readInboxItems(user,id)[0];
      if(!item)return NextResponse.json({error:'Không tìm thấy hồ sơ trong workspace này.'},{status:404});
      return NextResponse.json({item},{headers:{'Cache-Control':'no-store'}});
    } catch(error) {
      const auth=error instanceof Error&&error.message==='AUTH_REQUIRED';
      return NextResponse.json({error:auth?'Phiên đã kết thúc.':'Không thể tải hồ sơ.'},{status:auth?401:500});
    }
  });
}
