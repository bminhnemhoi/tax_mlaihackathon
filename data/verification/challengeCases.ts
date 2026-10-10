import {InvoiceInput, RiskGroup} from '@/lib/schemas';
import {diverseInvoiceFixtures} from './diverseInvoiceFixtures';
export interface VerificationCase {id:string;name:string;invoice:InvoiceInput;expectedStatus:'ROUTINE'|'ESCALATED';expectedRiskGroup?:RiskGroup;expectedRequiresCFO:boolean;provenance:string}
export const demoCompanyTaxCode='0102030405';
const base:InvoiceInput={id:'',invoiceNumber:'',invoiceDate:'2026-03-10',supplierTaxCode:'0100100100',supplierName:'Nhà cung cấp thử nghiệm',buyerTaxCode:demoCompanyTaxCode,itemName:'Giấy in văn phòng',preTaxAmount:1_000_000,taxRate:10,taxAmount:100_000,totalAmount:1_100_000,paymentMethod:'BANK_TRANSFER',hasBankSlip:true,hasItemManifest:true,sellerStatus:'ACTIVE',isImageBlurry:false,isAdjustment:false};
function fixture(id:string,name:string,changes:Partial<InvoiceInput>,expectedStatus:VerificationCase['expectedStatus'],expectedRiskGroup?:RiskGroup,expectedRequiresCFO=false):VerificationCase {return {id,name,invoice:{...base,...changes,id,invoiceNumber:id},expectedStatus,expectedRiskGroup,expectedRequiresCFO,provenance:'SYNTHETIC: dữ liệu và bằng chứng thanh toán/trạng thái nhà cung cấp do đội tạo cho doanh nghiệp thử nghiệm 0102030405; không phải hóa đơn thực tế.'};}
export const challengeCases:VerificationCase[]=[
 fixture('A-01','Văn phòng phẩm chuyển khoản',{},'ROUTINE'),
 fixture('A-02','Văn phòng phẩm tiền mặt dưới hạn mức',{paymentMethod:'CASH',hasBankSlip:false},'ROUTINE'),
 fixture('A-03','Dịch vụ viễn thông đúng thuế suất',{itemName:'Cước viễn thông',preTaxAmount:4_000_000,taxAmount:400_000,totalAmount:4_400_000},'ROUTINE'),
 fixture('A-04','Thanh toán tiền mặt vượt hạn mức',{paymentMethod:'CASH',hasBankSlip:false,preTaxAmount:10_000_000,taxAmount:1_000_000,totalAmount:11_000_000},'ESCALATED','OUT_OF_POLICY'),
 fixture('A-05','Khoản mua vượt thẩm quyền',{preTaxAmount:250_000_000,taxAmount:25_000_000,totalAmount:275_000_000},'ESCALATED','EXCEED_AUTHORITY',true),
];
export const commonCases:VerificationCase[]=[challengeCases[0],challengeCases[3],fixture('C-03','Dữ liệu nguồn mờ',{isImageBlurry:true},'ESCALATED','UNCERTAIN_INFO'),fixture('C-04','MST người mua khác doanh nghiệp',{buyerTaxCode:'0200200200'},'ESCALATED','OUT_OF_POLICY')];
export const regressionCases:VerificationCase[]=[...challengeCases,...diverseInvoiceFixtures.map((f,i)=>({id:`R-${i+1}`,name:f.name,invoice:{...f.invoice,buyerTaxCode:demoCompanyTaxCode},expectedStatus:f.expected==='ROUTINE'?'ROUTINE' as const:'ESCALATED' as const,expectedRiskGroup:f.expected==='ROUTINE'?undefined:f.expected.split(' - ')[1] as RiskGroup,expectedRequiresCFO:f.expected.includes('EXCEED_AUTHORITY'),provenance:'SYNTHETIC: fixture hồi quy nội bộ; MST người mua chuẩn hóa cho doanh nghiệp thử nghiệm.'}))];
