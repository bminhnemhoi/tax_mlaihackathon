import type { InvoiceInput, SystemPolicyConfig } from './schemas';
import { getApplicableRegulations } from '@/data/regulatoryRegistry';

export const coreDecisionFields=['invoiceNumber','invoiceDate','supplierTaxCode','supplierName','itemName','preTaxAmount','taxRate','taxAmount','totalAmount'] as const;
export function paymentThreshold(invoice:Partial<InvoiceInput>,config?:Partial<SystemPolicyConfig>):number {
  const date=invoice.invoiceDate || '2026-01-01';
  return date < (config?.nonCashThresholdEffectiveFrom || '2025-07-01')
    ? getApplicableRegulations(date).nonCashThreshold : config?.nonCashThreshold ?? getApplicableRegulations(date).nonCashThreshold;
}
export function needsItemManifest(invoice:Partial<InvoiceInput>):boolean {
  return /TƯ VẤN|TIẾP KHÁCH|ĂN UỐNG|HỘI NGHỊ|TỔNG HỢP|DỊCH VỤ KHÁC|HÀNG HÓA KHÁC/i.test(invoice.itemName || '')
    && !(invoice.items?.length && invoice.items.every(i=>i.itemName.trim().length>2));
}
export function requiredDecisionFields(invoice:Partial<InvoiceInput>,config?:Partial<SystemPolicyConfig>,sameDayTotal=0):Set<string> {
  const required=new Set<string>([...coreDecisionFields,'isImageBlurry']);
  const needsPaymentEvidence=Math.max(Math.abs(invoice.totalAmount || 0),sameDayTotal)>=paymentThreshold(invoice,config);
  // Hình thức thanh toán chỉ quyết định kết quả khi tổng (gộp cùng NCC trong ngày) đạt ngưỡng không dùng tiền mặt;
  // dưới ngưỡng, hỏi thêm chỉ tạo chuyển tiếp thừa.
  if(needsPaymentEvidence)required.add('paymentMethod');
  if(needsPaymentEvidence && (invoice.paymentMethod==='BANK_TRANSFER' || invoice.isStaffReimbursed===true))required.add('hasBankSlip');
  // Trạng thái MST bên bán bắt buộc từ ngưỡng trọng yếu (mặc định 20 triệu); dưới ngưỡng, trạng thái đóng/tạm ngừng
  // đã biết (nhập tay hoặc danh bạ NCC) vẫn luôn được kiểm tra.
  if(Math.abs(invoice.totalAmount || 0)>=(config?.sellerStatusMaterialityVnd ?? 20_000_000))required.add('sellerStatus');
  if(needsItemManifest(invoice))required.add('hasItemManifest');
  if(invoice.isAdjustment || (invoice.totalAmount || 0)<0)required.add('originalInvoiceRef');
  if(invoice.sellerStatus==='CLOSED')required.add('sellerSuspensionDate');
  if(config?.strictBuyerTaxCodeCheck)required.add('buyerTaxCode');
  // An explicitly present/flagged identifier must not bypass invoice checks.
  if(invoice.invoiceSeries)required.add('invoiceSeries');
  if(invoice.signingDate)required.add('signingDate');
  if(invoice.taxAuthorityCode)required.add('taxAuthorityCode');
  if(invoice.items?.length)required.add('items');
  return required;
}
export function missingBusinessFacts(invoice:Partial<InvoiceInput>,config?:Partial<SystemPolicyConfig>,sameDayTotal=0):string[] {
  const required=requiredDecisionFields(invoice,config,sameDayTotal);
  return [...required].filter(field=> !coreDecisionFields.includes(field as typeof coreDecisionFields[number]) && field!=='isImageBlurry'
    && ((invoice as Record<string,unknown>)[field]===undefined || (invoice as Record<string,unknown>)[field]==='UNKNOWN'
      || (['hasBankSlip','hasItemManifest'].includes(field) && (invoice as Record<string,unknown>)[field]===false)));
}
