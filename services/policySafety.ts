import type {InvoiceInput,RiskGroup,SystemPolicyConfig} from '@/lib/schemas';
import { withIsolatedDatabase } from '@/lib/server/db';
import { challengeCases, demoCompanyTaxCode } from '@/data/verification/challengeCases';
import { evaluateInvoiceLocally } from './policyEngine';
import {checkHandoff} from './handoffService';

/** Semantic expectations follow proposed config boundaries, independent of operational invoices and precedents. */
export function validatePolicySafety(config:SystemPolicyConfig,version:string):{errors:string[];tested:number} {
  return withIsolatedDatabase(()=>{
    const errors:string[]=[];
    if(config.kttApprovalLimit<=0)errors.push('Trần KTT phải lớn hơn 0 để có luồng thường quy.');
    if(config.nonCashThreshold>5_000_000)errors.push('Không nới ngưỡng thanh toán sau 01/07/2025 quá 5 triệu trong profile hiện tại.');
    if(config.kFactorSafeMin>=config.kFactorSafeMax)errors.push('Khoảng K phải có cận dưới nhỏ hơn cận trên.');
    if(config.kFactorSafeMin<.95 || config.kFactorSafeMax>1.35)errors.push('Khoảng K xanh không được chồng vùng đỏ cố định của profile (0,95 đến 1,35).');
    if(config.vatReductionRate!==8 || config.vatStandardRate!==10)errors.push('Profile này chỉ thực thi mức giảm 8% và mức chuẩn 10%; cần cập nhật quy tắc trước khi đổi hai tham số này.');
    const candidate={...config,companyTaxCode:demoCompanyTaxCode};
    const base={...challengeCases[0].invoice,invoiceDate:'2026-08-15'};
    const amount=(total:number):InvoiceInput=>({...base,totalAmount:total,preTaxAmount:total/1.1,taxAmount:total-total/1.1});
    const probes:Array<{name:string;invoice:InvoiceInput;group?:RiskGroup;cfo?:boolean}>=[
      {name:'ROUTINE',invoice:amount(Math.max(.1,Math.min(1_100_000,config.kttApprovalLimit/2)))},
      {name:'LIMIT-BELOW',invoice:amount(Math.max(.1,config.kttApprovalLimit-1))},
      {name:'LIMIT-AT',invoice:amount(config.kttApprovalLimit),group:'EXCEED_AUTHORITY',cfo:true},
      {name:'LIMIT-ABOVE',invoice:amount(config.kttApprovalLimit+1),group:'EXCEED_AUTHORITY',cfo:true},
      {name:'LIMIT-NEGATIVE',invoice:{...amount(-config.kttApprovalLimit),isAdjustment:true,originalInvoiceRef:'ORIGINAL-GATE'},group:'EXCEED_AUTHORITY',cfo:true},
      {name:'MONEY',invoice:{...base,totalAmount:base.totalAmount+100},group:'UNCERTAIN_INFO',cfo:base.totalAmount>=config.kttApprovalLimit},
      {name:'BLUR',invoice:{...base,isImageBlurry:true},group:'UNCERTAIN_INFO',cfo:base.totalAmount>=config.kttApprovalLimit},
      {name:'UNKNOWN-SELLER',invoice:{...base,sellerStatus:'UNKNOWN'},group:'UNCERTAIN_INFO',cfo:base.totalAmount>=config.kttApprovalLimit},
      {name:'CASH-AT',invoice:{...amount(Math.max(1,config.nonCashThreshold)),paymentMethod:'CASH',hasBankSlip:false},group:'OUT_OF_POLICY',cfo:Math.max(1,config.nonCashThreshold)>=config.kttApprovalLimit},
      {name:'BANK-MISSING',invoice:{...amount(Math.max(1,config.nonCashThreshold)),hasBankSlip:undefined},group:'UNCERTAIN_INFO',cfo:Math.max(1,config.nonCashThreshold)>=config.kttApprovalLimit},
    ];
    for(const c of probes){
      const d=evaluateInvoiceLocally(c.invoice,candidate,version,undefined,[]);
      const expected=c.group?'ESCALATED':'ROUTINE';
      if(d.status!==expected || (d.status==='ESCALATED' && (d.riskGroup!==c.group || d.requiresCFO!==Boolean(c.cfo))))errors.push(`${c.name}: sai kết quả theo tham số đề xuất`);
      if(!checkHandoff(d).valid)errors.push(`${c.name}: câu hỏi chuyển tiếp không đủ cấu trúc`);
    }
    return {errors,tested:probes.length};
  });
}
