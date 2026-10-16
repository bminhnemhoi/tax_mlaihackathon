import {NextResponse} from 'next/server';
import {getActivePolicy,getDatabase} from '@/lib/server/db';
import {runningCommit,startedAt} from '@/lib/server/buildInfo';
import {POLICY_CONTRACT_VERSION} from '@/data/policyContract';
import {auditHead} from '@/lib/server/audit';
import {aiRuntimeInfo,configWarnings} from '@/lib/server/runtimeInfo';
export const dynamic='force-dynamic';
/** Cho giám khảo/vận hành biết đúng phiên bản đang chạy: commit, policy, contract quy tắc, agent AI và cảnh báo cấu hình. */
export async function GET(){
  try{
    getDatabase().prepare('SELECT 1').get();
    const policy=getActivePolicy();
    const audit=auditHead();
    const commit=runningCommit() || 'unknown';
    return NextResponse.json({status:'ok',timestamp:new Date().toISOString(),commit,policyVersion:policy.version,policyHash:policy.contentHash,contractVersion:POLICY_CONTRACT_VERSION,startedAt,audit:{events:audit.count,headHash:audit.headHash,hmac:audit.keyed},ai:aiRuntimeInfo(),warnings:configWarnings(audit.keyed,commit)},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({status:'unavailable'},{status:503});}
}
