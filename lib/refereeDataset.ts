import {z} from 'zod';
import {InvoiceInputSchema,PolicyBundleSchema,SystemPolicyConfigSchema} from './schemas';
import {hashPayload} from './server/db';
export const RefereeContextSchema=z.object({history:z.array(InvoiceInputSchema).max(100).optional(),config:SystemPolicyConfigSchema.partial().optional(),macroBaseline:z.object({totalSales:z.number().finite().nonnegative(),openingInventory:z.number().finite().nonnegative(),totalPurchases:z.number().finite().nonnegative()}).optional()});
export const RefereeCaseSchema=z.object({
  id:z.string().min(1),name:z.string().default('Tình huống độc lập'),
  invoice:InvoiceInputSchema.partial().extend({sourceUncertainFields:z.array(z.string()).optional()}),
  expectedStatus:z.enum(['ROUTINE','ESCALATED']),expectedRiskGroup:z.enum(['UNCERTAIN_INFO','OUT_OF_POLICY','EXCEED_AUTHORITY']).optional(),expectedRequiresCFO:z.boolean(),
  rationale:z.string().min(8),labeledBy:z.string().min(1),labeledAt:z.string().datetime(),provenance:z.string().min(8),
  context:RefereeContextSchema.optional(),
}).superRefine((c,ctx)=>{
  if(c.expectedStatus==='ESCALATED'&&!c.expectedRiskGroup)ctx.addIssue({code:'custom',message:'Ca chuyển tiếp cần nhãn nhóm'});
  if(c.expectedStatus==='ROUTINE'&&(c.expectedRiskGroup||c.expectedRequiresCFO))ctx.addIssue({code:'custom',message:'Ca thường quy không có nhóm ngoại lệ hoặc người duyệt CFO'});
});
export const IndependentSetSchema=z.object({schemaVersion:z.union([z.literal(1),z.literal(2)]).default(1),status:z.literal('LOCKED'),lockedAt:z.string().datetime(),companyTaxCode:z.string().min(1),trainingInvoiceHashes:z.array(z.string()).default([]),policySnapshot:PolicyBundleSchema.optional(),cases:z.array(RefereeCaseSchema).min(20)});
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
export function caseFingerprint(c:{invoice:Record<string,unknown>;context?:unknown}):string {
  const {id,invoiceNumber,...fields}=c.invoice;
  return hashPayload(canonical({invoice:fields,...(c.context?{context:c.context}:{})}));
}
export function csvCell(value:unknown):string {
  const text=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);
  return '"'+(/^[=+\-@]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"';
}
