import type { InvoiceInput, RiskGroup, SystemPolicyConfig } from '@/lib/schemas';

export type RefereeCase = {
  id: string; name: string; invoice: Partial<InvoiceInput> & { sourceUncertainFields?: string[] };
  expectedStatus: 'ROUTINE' | 'ESCALATED'; expectedRiskGroup?: RiskGroup;
  expectedRequiresCFO: boolean; rationale: string; provenance: string; expectedRuleIds?: string[];
  context?: { history?: InvoiceInput[]; macroBaseline?: { totalSales: number; openingInventory: number; totalPurchases: number }; config?: Partial<SystemPolicyConfig> };
};
export const developmentCompanyTaxCode = '0102030405';
const base: InvoiceInput = { id:'', invoiceNumber:'', invoiceDate:'2026-08-15', supplierTaxCode:'0312345678', supplierName:'Nhà cung cấp tổng hợp mới', buyerTaxCode:developmentCompanyTaxCode,
  itemName:'Giấy in A4', preTaxAmount:2_000_000, taxRate:10, taxAmount:200_000, totalAmount:2_200_000,
  paymentMethod:'BANK_TRANSFER', hasBankSlip:true, hasItemManifest:true, sellerStatus:'ACTIVE', isImageBlurry:false, isAdjustment:false };
const money = (total: number, rate: 0|5|8|10 = 10):Pick<InvoiceInput,'totalAmount'|'preTaxAmount'|'taxRate'|'taxAmount'> => { const preTaxAmount = total / (1 + rate / 100); return { totalAmount:total, preTaxAmount, taxRate:rate, taxAmount:total-preTaxAmount }; };
function scenario(id:string,name:string,changes:RefereeCase['invoice'],expectedStatus:RefereeCase['expectedStatus'],rationale:string,expectedRiskGroup?:RiskGroup,expectedRequiresCFO=false,context?:RefereeCase['context'],expectedRuleIds?:string[]):RefereeCase {
  return {id,name,invoice:{...base,id,invoiceNumber:id,...changes},expectedStatus,expectedRiskGroup,expectedRequiresCFO,rationale,context,expectedRuleIds,provenance:'SYNTHETIC_DEVELOPMENT: nhãn viết theo hợp đồng SOP trước khi chạy engine; không phải holdout hoặc hóa đơn thật.'};
}
const r=(n:number,name:string,changes:RefereeCase['invoice'],rationale='Đủ dữ kiện cần thiết, không có ngoại lệ theo SOP.'):RefereeCase=>scenario(`DEV-R-${String(n).padStart(2,'0')}`,name,changes,'ROUTINE',rationale);
const u=(n:number,name:string,changes:RefereeCase['invoice'],rationale:string,requiresCFO=false):RefereeCase=>scenario(`DEV-U-${String(n).padStart(2,'0')}`,name,changes,'ESCALATED',rationale,'UNCERTAIN_INFO',requiresCFO);
const o=(n:number,name:string,changes:RefereeCase['invoice'],rationale:string,context?:RefereeCase['context'],requiresCFO=false):RefereeCase=>scenario(`DEV-O-${String(n).padStart(2,'0')}`,name,changes,'ESCALATED',rationale,'OUT_OF_POLICY',requiresCFO,context);
const a=(n:number,name:string,changes:RefereeCase['invoice'],context?:RefereeCase['context']):RefereeCase=>scenario(`DEV-A-${String(n).padStart(2,'0')}`,name,changes,'ESCALATED','Trị tuyệt đối tổng tiền đạt trần cấu hình hoặc lô hàng lớn chạm cảnh báo K: cần CFO.','EXCEED_AUTHORITY',true,context);

/** Labels are specified from SOP, never computed by the policy engine. */
export const developmentCases:RefereeCase[] = [
  r(1,'Chuyển khoản thông thường',{}),
  r(2,'Tiền mặt nhỏ',{paymentMethod:'CASH',hasBankSlip:false}),
  r(3,'Chứng từ ngân hàng không cần ở khoản nhỏ',{hasBankSlip:undefined}),
  r(4,'Không yêu cầu bảng kê riêng',{hasItemManifest:undefined}),
  r(5,'Bảng kê không có nhưng tên hàng rõ',{hasItemManifest:false}),
  r(6,'Tiền mặt nhỏ thiếu các tệp không áp dụng',{paymentMethod:'CASH',hasBankSlip:undefined,hasItemManifest:undefined}),
  r(7,'Tiền mặt trước mốc tháng 7/2025',{...money(15_000_000),invoiceDate:'2025-06-20',paymentMethod:'CASH',hasBankSlip:false}),
  r(8,'Một đồng dưới ngưỡng cũ',{...money(19_999_999),invoiceDate:'2025-06-30',paymentMethod:'CASH',hasBankSlip:false}),
  r(9,'Một đồng dưới ngưỡng mới',{...money(4_999_999),invoiceDate:'2025-07-01',paymentMethod:'CASH',hasBankSlip:false}),
  r(10,'Chuyển khoản đúng tại ngưỡng',{...money(5_000_000)}),
  r(11,'Chuyển khoản trên ngưỡng',{...money(5_000_001)}),
  r(12,'Một đồng dưới trần KTT',{...money(199_999_999)}),
  r(13,'Điều chỉnh âm nhỏ có tham chiếu',{...money(-11_000),isAdjustment:true,originalInvoiceRef:'ORIGINAL-13'}),
  r(14,'Điều chỉnh âm dưới trần',{...money(-199_999_999),isAdjustment:true,originalInvoiceRef:'ORIGINAL-14'}),
  r(15,'Ngày ký cùng ngày lập',{signingDate:base.invoiceDate}),
  r(16,'Ký hiệu năm khớp',{invoiceSeries:'1K26TBB'}),
  r(17,'Điều chỉnh tăng có tham chiếu',{isAdjustment:true,originalInvoiceRef:'ORIGINAL-17'}),
  r(18,'Dòng hàng khớp tổng',{items:[{lineNumber:1,itemName:'Giấy in A4',quantity:2,unitPrice:1_000_000,amount:2_000_000,taxRate:10,taxAmount:200_000}]}),
  r(19,'Thuế suất 0',{...money(2_000_000,0)}),
  r(20,'Thuế suất 5',{...money(2_100_000,5)}),
  r(21,'Hàng thông thường 8',{...money(2_160_000,8)}),
  r(22,'Viễn thông đúng 10',{itemName:'Cước viễn thông'}),
  r(23,'Năm 2027 mức 10',{invoiceDate:'2027-01-03'}),
  r(24,'Cảnh báo tệp không liên quan',{hasItemManifest:undefined,sourceUncertainFields:['hasItemManifest','hasBankSlip']}),
  u(1,'Không biết phương thức thanh toán từ ngưỡng 5 triệu',{...money(11_000_000),paymentMethod:undefined,hasBankSlip:undefined},'Từ ngưỡng không dùng tiền mặt, chưa biết phương thức; không gán thành tiền mặt.'),
  u(2,'Không biết trạng thái bên bán từ ngưỡng trọng yếu',{...money(22_000_000),sellerStatus:'UNKNOWN'},'Từ 20 triệu phải biết trạng thái MST bên bán; tên/MST không chứng minh trạng thái hoạt động.'),
  u(3,'Thiếu MST bên bán',{supplierTaxCode:undefined},'MST là dữ kiện bắt buộc.'),
  u(4,'Số tiền mâu thuẫn',{totalAmount:2_201_000},'Tổng tiền lệch tiền trước thuế và thuế.'),
  u(5,'Ảnh mờ',{isImageBlurry:true},'Không tự bịa hai số tiền ứng viên.'),
  u(6,'Chuyển khoản lớn chưa có bằng chứng',{...money(11_000_000),hasBankSlip:undefined},'Chưa có chứng từ không chứng minh đã trả tiền mặt.'),
  u(7,'Chuyển khoản lớn báo chưa nộp chứng từ',{...money(11_000_000),hasBankSlip:false},'Cần bổ sung chứng từ thanh toán.'),
  u(8,'Dịch vụ tổng hợp thiếu bảng kê',{itemName:'Dịch vụ tư vấn tổng hợp',hasItemManifest:false},'SOP yêu cầu làm rõ các hạng mục dịch vụ.'),
  u(9,'Đóng MST chưa biết ngày',{sellerStatus:'CLOSED'},'Không biết ngày đóng không được kết luận hóa đơn sai.'),
  u(10,'Hóa đơn trước ngày đóng',{sellerStatus:'CLOSED',sellerSuspensionDate:'2026-09-01'},'Xác minh hồ sơ giao dịch trước thời điểm đóng.'),
  u(11,'Đúng ngày đóng',{sellerStatus:'CLOSED',sellerSuspensionDate:base.invoiceDate},'Chưa có thời điểm trong ngày, cần xác minh.'),
  u(12,'Điều chỉnh thiếu tham chiếu',{isAdjustment:true},'Cần tham chiếu hóa đơn gốc trước khi xử lý.'),
  o(1,'Tiền mặt đúng ngưỡng',{...money(5_000_000),paymentMethod:'CASH',hasBankSlip:false},'Tiền mặt tại ngưỡng cấu hình.'),
  o(2,'Tiền mặt trên ngưỡng',{...money(5_000_001),paymentMethod:'CASH',hasBankSlip:false},'Tiền mặt trên ngưỡng cấu hình.'),
  o(3,'Tiền mặt tại ngưỡng cũ',{...money(20_000_000),invoiceDate:'2025-06-30',paymentMethod:'CASH',hasBankSlip:false},'Mốc lịch sử dùng ngưỡng 20 triệu.'),
  o(4,'Cụm tiền mặt cùng ngày',{...money(3_300_000),paymentMethod:'CASH',hasBankSlip:false},'Gộp đúng NCC/ngày vượt ngưỡng.',{history:[{...base,...money(2_200_000),id:'HISTORY-O4',invoiceNumber:'HISTORY-O4',paymentMethod:'CASH',hasBankSlip:false}]}),
  o(5,'Trùng số hóa đơn',{invoiceNumber:'DUPLICATE-O5'},'Không tạo chứng từ ghi nhận lần hai.',{history:[{...base,id:'HISTORY-O5',invoiceNumber:'DUPLICATE-O5'}]}),
  o(6,'MST người mua khác',{buyerTaxCode:'0203456789'},'Không khớp doanh nghiệp đang cấu hình.'),
  o(7,'Viễn thông mức 8',{itemName:'Cước viễn thông',...money(2_160_000,8)},'Danh mục loại trừ đang cấu hình.'),
  o(8,'Bảo hiểm mức 8',{itemName:'Bảo hiểm tài sản',...money(2_160_000,8)},'Danh mục loại trừ đang cấu hình.'),
  o(9,'Bất động sản mức 8',{itemName:'Kinh doanh bất động sản',...money(2_160_000,8)},'Danh mục loại trừ đang cấu hình.'),
  o(10,'Ngày hóa đơn sau ngày đóng',{sellerStatus:'CLOSED',sellerSuspensionDate:'2026-08-14'},'Dừng theo SOP, cần đối chiếu nguồn.'),
  o(11,'Hai rủi ro tiền mặt và thuế suất',{...money(10_800_000,8),itemName:'Cước viễn thông',paymentMethod:'CASH',hasBankSlip:false},'Giữ cả hai phát hiện.'),
  o(12,'Tiền mặt và vượt quyền',{...money(220_000_000),paymentMethod:'CASH',hasBankSlip:false},'Ngoài quy định đồng thời cần CFO.',undefined,true),
  a(1,'Đúng trần 200 triệu',{...money(200_000_000)}),
  a(2,'Một đồng trên trần',{...money(200_000_001)}),
  a(3,'Âm đúng trần',{...money(-200_000_000),isAdjustment:true,originalInvoiceRef:'ORIGINAL-A3'}),
  a(4,'Âm trên trần',{...money(-200_000_001),isAdjustment:true,originalInvoiceRef:'ORIGINAL-A4'}),
  a(5,'Điều chỉnh tăng lớn',{...money(230_000_000),isAdjustment:true,originalInvoiceRef:'ORIGINAL-A5'}),
  a(6,'Vật tư 300 triệu',{...money(300_000_000),itemName:'Vật tư dự án'}),
  a(7,'Lô hàng làm K đỏ',{...money(1_100_000_000)},{macroBaseline:{totalSales:200_000_000,openingInventory:100_000_000,totalPurchases:100_000_000}}),
  a(8,'Trần đề xuất 100 triệu',{...money(100_000_000)},{config:{kttApprovalLimit:100_000_000}}),
  a(9,'Trần đề xuất 500 triệu',{...money(500_000_000)},{config:{kttApprovalLimit:500_000_000}}),
  a(10,'Khoản 275 triệu',{...money(275_000_000)}),
  a(11,'Dịch vụ đúng thuế nhưng vượt quyền',{...money(250_000_000),itemName:'Cước viễn thông'}),
  a(12,'Điều chỉnh giảm 275 triệu',{...money(-275_000_000),isAdjustment:true,originalInvoiceRef:'ORIGINAL-A12'}),
];
