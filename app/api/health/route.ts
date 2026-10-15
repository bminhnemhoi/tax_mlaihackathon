import {NextResponse} from 'next/server';
import {getActivePolicy,getDatabase} from '@/lib/server/db';
import {runningCommit,startedAt} from '@/lib/server/buildInfo';
import {POLICY_CONTRACT_VERSION} from '@/data/policyContract';
import {auditHead} from '@/lib/server/audit';
export const dynamic='force-dynamic';
/** Cho giám khảo/vận hành biết đúng phiên bản đang chạy: commit, policy và contract quy tắc. */
export async function GET(){
  try{
    getDatabase().prepare('SELECT 1').get();
    const policy=getActivePolicy();
    const audit=auditHead();
    return NextResponse.json({status:'ok',timestamp:new Date().toISOString(),commit:runningCommit() || 'unknown',policyVersion:policy.version,policyHash:policy.contentHash,contractVersion:POLICY_CONTRACT_VERSION,startedAt,audit:{events:audit.count,headHash:audit.headHash,hmac:audit.keyed}},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({status:'unavailable'},{status:503});}
}
