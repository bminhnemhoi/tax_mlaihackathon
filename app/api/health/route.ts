import {NextResponse} from 'next/server';
import {getActivePolicy,getDatabase} from '@/lib/server/db';
import {runningCommit,startedAt} from '@/lib/server/buildInfo';
import {POLICY_CONTRACT_VERSION} from '@/data/policyContract';
import {auditHead} from '@/lib/server/audit';
import {SHOPAIKEY_GEMINI_API_CONFIG} from '@/lib/constants';
import {VISION_PROMPT_SHA256,VISION_TIMEOUT_MS,QGEN_TIMEOUT_MS} from '@/services/geminiService';
import {GROUNDING_BUDGET_MS,GROUNDING_MAX_CALLS} from '@/services/officialSupplierLookupService';
import {aiBudgetConfig} from '@/lib/server/aiBudget';
export const dynamic='force-dynamic';
/** Cho giám khảo/vận hành biết đúng phiên bản đang chạy: commit, policy và contract quy tắc. */
export async function GET(){
  try{
    getDatabase().prepare('SELECT 1').get();
    const policy=getActivePolicy();
    const audit=auditHead();
    const commit=runningCommit() || 'unknown';
    // Cấu hình "fail-open" phải hiện ra, không im lặng: thiếu khóa audit thì không có HMAC/chữ ký điểm neo và mẫu hậu kiểm đoán trước được.
    const warnings=process.env.NODE_ENV==='production'?[...(audit.keyed?[]:['audit_key_missing']),...(commit==='unknown'?['commit_unknown']:[]),...(process.env.QGEN_AI==='1'?['qgen_ai_enabled']:[])]:[];
    // Danh tính và ngân sách của các agent AI (số liệu lấy từ hằng số trong mã, không viết tay).
    const ai={decisionPathLlmCalls:0,visionAgent:`agent:vision@${SHOPAIKEY_GEMINI_API_CONFIG.MODEL}#${VISION_PROMPT_SHA256.slice(0,12)}`,visionTimeoutMs:VISION_TIMEOUT_MS,
      ingestionMaxLlmCalls:1+GROUNDING_MAX_CALLS,groundingBudgetMs:GROUNDING_BUDGET_MS,qgenEnabled:process.env.QGEN_AI==='1',qgenTimeoutMs:QGEN_TIMEOUT_MS,budgets:aiBudgetConfig()};
    return NextResponse.json({status:'ok',timestamp:new Date().toISOString(),commit,policyVersion:policy.version,policyHash:policy.contentHash,contractVersion:POLICY_CONTRACT_VERSION,startedAt,audit:{events:audit.count,headHash:audit.headHash,hmac:audit.keyed},ai,warnings},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({status:'unavailable'},{status:503});}
}
