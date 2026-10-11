import type { SystemPolicyConfig } from '@/lib/schemas';
import { withIsolatedDatabase } from '@/lib/server/db';
import { challengeCases, commonCases, regressionCases, demoCompanyTaxCode } from '@/data/verification/challengeCases';
import { evaluateInvoiceLocally } from './policyEngine';

/** Fixed semantic expectations, independent of operational invoices and precedents. */
export function validatePolicySafety(config:SystemPolicyConfig,version:string) {
  return withIsolatedDatabase(()=>{
    const errors:string[]=[];
    const fixtures=[...challengeCases,...commonCases,...regressionCases];
    const candidate={...config,companyTaxCode:demoCompanyTaxCode};
    for(const c of fixtures){
      const d=evaluateInvoiceLocally(c.invoice,candidate,version);
      if(d.status!==c.expectedStatus || (d.status==='ESCALATED' && (d.riskGroup!==c.expectedRiskGroup || d.requiresCFO!==c.expectedRequiresCFO)))
        errors.push(`${c.id}: kỳ vọng ${c.expectedStatus}/${c.expectedRiskGroup || 'NONE'}, nhận ${d.status}/${d.status==='ESCALATED'?d.riskGroup:'NONE'}`);
    }
    // Tighten input checks without requiring a particular authority threshold.
    const base=challengeCases[0].invoice;
    const probes=[{...base,totalAmount:base.totalAmount+100},{...base,isImageBlurry:true}];
    probes.forEach((invoice,i)=>{const d=evaluateInvoiceLocally(invoice,candidate,version);if(d.status!=='ESCALATED' || !d.findings?.some(f=>f.kind==='DATA_QUALITY'))errors.push(`DATA-${i}: dữ liệu lỗi được tự duyệt`);});
    return {errors,tested:fixtures.length+probes.length};
  });
}
