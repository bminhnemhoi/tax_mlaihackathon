import type { EscalatedDecision, InvoiceInput,ActionOption } from '@/lib/schemas';

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi-VN').replace(/\s+/g,' ').trim();
/** Generated wording cannot introduce amounts, permissions or new actions. */
export function isGroundedQuestion(invoice:InvoiceInput,decision:EscalatedDecision,generated:{actionableQuestion:string;plainExplanation:string;requiresCFO?:boolean;options?:ActionOption[]}):boolean {
  const question=normalize(generated.actionableQuestion),explanation=normalize(generated.plainExplanation);
  if(!question.includes(normalize(invoice.invoiceNumber)))return false;
  if(decision.requiresCFO ? !/\bcfo\b/.test(question) : !/(ke toan truong|\bktt\b)/.test(question))return false;
  if(generated.requiresCFO!==undefined && generated.requiresCFO!==decision.requiresCFO)return false;
  if(decision.options.some(o=>!question.includes(normalize(o.label))))return false;
  if(generated.options && (generated.options.length!==2 || generated.options.some((o,i)=>o.id!==decision.options[i].id || o.resultingAction!==decision.options[i].resultingAction || normalize(o.label)!==normalize(decision.options[i].label))))return false;
  if(!question.includes(normalize(invoice.supplierName)) || !question.includes(normalize(decision.sopClause)))return false;
  if(!question.includes(normalize(decision.findings?.[0]?.flaggedReason || decision.flaggedReason)))return false;
  if(/da (?:duyet|phe duyet)|chac chan hop le|khong can (?:xac minh|bang chung)|bo qua (?:quy dinh|xac minh|bang chung)/.test(question+' '+explanation))return false;
  const numbers=(s:string)=>s.match(/\d[\d.,]*/g)?.map(n=>n.replace(/[.,]/g,'')) || [];
  const allowed=new Set(numbers([JSON.stringify(invoice),decision.actionableQuestion,decision.plainExplanation,...decision.options.map(o=>o.label+' '+o.actionDescription)].join(' ')));
  if(numbers(generated.actionableQuestion+' '+generated.plainExplanation).some(n=>!allowed.has(n)))return false;
  // Multiple findings need the deterministic checklist, not a paraphrase of only the first.
  if((decision.findings?.length || 0)>1)return false;
  return question.length>=30 && question.length<=2000;
}
