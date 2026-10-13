import type { EscalatedDecision, InvoiceInput, RefereeHandoff, RefereeDecision, RuleFinding } from '@/lib/schemas';
import {ruleContract} from '@/data/policyContract';
const labels:Record<string,string>={invoiceNumber:'Số hóa đơn',invoiceDate:'Ngày lập',supplierName:'Nhà cung cấp',supplierTaxCode:'MST bên bán',itemName:'Hàng hóa / dịch vụ',totalAmount:'Tổng thanh toán',preTaxAmount:'Tiền trước thuế',taxAmount:'Tiền thuế',taxRate:'Thuế suất',buyerTaxCode:'MST bên mua',invoiceSeries:'Ký hiệu',taxAuthorityCode:'Mã CQT',signingDate:'Ngày ký',isAdjustment:'Điều chỉnh/thay thế',isImageBlurry:'Ảnh chưa rõ',isStaffReimbursed:'Hoàn ứng nhân viên',items:'Chi tiết dòng hàng',paymentMethod:'Thanh toán',sellerStatus:'Trạng thái bên bán',hasBankSlip:'Chứng từ thanh toán',hasItemManifest:'Bảng kê',sellerSuspensionDate:'Ngày đóng MST',originalInvoiceRef:'Hóa đơn gốc'};
const value=(v:unknown,field?:string):string=>{
  const words:Record<string,string>={BANK_TRANSFER:'Chuyển khoản',CASH:'Tiền mặt',ACTIVE:'Đang hoạt động',SUSPENDED:'Tạm ngừng',CLOSED:'Đã đóng MST',UNKNOWN:'Chưa xác định'};
  if(typeof v==='string'&&words[v])return words[v];
  if(field==='taxRate'&&typeof v==='number')return `${v}%`;
  if(field==='items'&&Array.isArray(v))return `${v.length} dòng hàng`;
  if(typeof v==='number')return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(v)+' ₫';
  return v===true?'Có':v===false?'Chưa có':v===undefined?'Chưa xác định':typeof v==='object'?JSON.stringify(v):String(v);
};
export function buildHandoff(invoice:InvoiceInput,decision:EscalatedDecision,context:{policyHash?:string;unresolvedFields?:string[];missingFields?:string[];confirmations?:Array<{field:string;evidence:string}>}={}):EscalatedDecision {
  const issues=decision.findings?.length?decision.findings:[{ruleId:'RULE_SOURCE_REVIEW',kind:'DATA_QUALITY' as const,severity:'HIGH' as const,riskGroup:decision.riskGroup,flaggedReason:decision.flaggedReason,plainExplanation:decision.plainExplanation,legalBasis:decision.sopClause}];
  const primary=issues[0], role=decision.requiresCFO?'CFO':'Kế toán trưởng';
  const unknown=new Set(context.unresolvedFields || []);
  const missing=new Set(context.missingFields || []);
  const factFields=[...new Set(['invoiceNumber','invoiceDate','supplierName','supplierTaxCode','itemName','totalAmount','taxAmount','paymentMethod','sellerStatus',...(context.unresolvedFields||[]),...issues.flatMap(i=>ruleContract(i.ruleId).requiredFields).filter(field=>field in invoice)])];
  const facts=factFields.map(field=>({field,label:labels[field]||field,value:missing.has(field)?'Chưa có dữ liệu':value((invoice as unknown as Record<string,unknown>)[field],field),source:unknown.has(field)?'Chưa xác minh':'Dữ liệu hồ sơ'}));
  const invoiceRef=`Hóa đơn ${invoice.invoiceNumber} · ${invoice.supplierName} · ${missing.has('totalAmount')?'chưa có tổng thanh toán':value(invoice.totalAmount)}${unknown.has('totalAmount')?' (chưa xác minh)':''}`;
  const question=`${invoiceRef}. ${primary.flaggedReason} Căn cứ: ${primary.legalBasis}. ${role} chọn A: ${decision.options[0].label}; hoặc B: ${decision.options[1].label}?${issues.length>1?` Còn ${issues.length-1} phát hiện cần xử lý; xem danh sách bên dưới.`:''}`;
  const handoff:RefereeHandoff={requiredRole:decision.requiresCFO?'CFO':'CHIEF_ACCOUNTANT',invoiceNumber:invoice.invoiceNumber,primaryRuleId:primary.ruleId,question,facts,options:decision.options,openIssues:issues,
    evidenceRefs:[{kind:'POLICY',ref:decision.sopVersion||'TAX-SOP-2026',description:primary.legalBasis},
      ...(invoice.sourceArtifactId?[{kind:'ARTIFACT' as const,ref:invoice.sourceArtifactId,description:'Chứng từ nguồn đã tiếp nhận'}]:[]),
      ...(context.confirmations||[]).map(c=>({kind:'CONFIRMATION' as const,ref:c.field,description:c.evidence}))],
    policyRef:{version:decision.sopVersion||'TAX-SOP-2026',hash:context.policyHash,clause:decision.sopClause},questionSource:'POLICY_TEMPLATE',automatedCheck:{valid:true,errors:[]}};
  return {...decision,actionableQuestion:question,handoff};
}
export function checkHandoff(decision:RefereeDecision):{valid:boolean;errors:string[]} {
  if(decision.status==='ROUTINE')return {valid:true,errors:[]};
  const h=decision.handoff, errors:string[]=[];
  if(!h)return {valid:false,errors:['Thiếu cấu trúc chuyển tiếp']};
  if(h.requiredRole!==(decision.requiresCFO?'CFO':'CHIEF_ACCOUNTANT'))errors.push('Sai người nhận');
  if(!h.question.includes(h.invoiceNumber))errors.push('Thiếu số hóa đơn');
  if(!h.question.includes(decision.requiresCFO?'CFO':'Kế toán trưởng'))errors.push('Thiếu người xử lý');
  if(h.question!==decision.actionableQuestion)errors.push('Câu hỏi không nhất quán');
  if(JSON.stringify(h.options)!==JSON.stringify(decision.options))errors.push('Phương án không nhất quán');
  if(!decision.options.every(o=>h.question.includes(o.label)))errors.push('Thiếu phương án trong câu hỏi');
  if(!h.evidenceRefs.some(r=>r.kind==='POLICY') || !h.policyRef.clause)errors.push('Thiếu căn cứ');
  if((decision.findings || []).some(f=>!h.openIssues.some(i=>i.ruleId===f.ruleId)))errors.push('Bỏ sót phát hiện');
  return {valid:errors.length===0,errors};
}
export function describeRuleEvidence(finding:RuleFinding,invoiceDate?:string):RuleFinding {
  const rule=ruleContract(finding.ruleId,invoiceDate);
  return {...finding,legalBasis:`${rule.clause} · Tax-SOP-2026${rule.source?` · ${rule.source.code} (văn bản đã đối chiếu; diễn giải quy tắc chưa xác minh)`:rule.legalVerification==='INTERNAL_POLICY'?' · kiểm soát nội bộ':' · căn cứ pháp lý chưa xác minh'}`,
    sopClause:rule.clause,legalVerification:rule.legalVerification,sourceUrl:rule.source?.url,
    plainExplanation:rule.legalVerification==='INTERNAL_POLICY'?finding.plainExplanation:`Cần xử lý phát hiện theo ${rule.clause} và đối chiếu chứng từ. Chưa xác nhận kết luận pháp lý.`};
}
