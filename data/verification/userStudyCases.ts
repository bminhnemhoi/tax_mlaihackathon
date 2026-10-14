import type { RiskGroup } from '@/lib/schemas';

/**
 * Bộ 5 ca thử với người dùng thực tế (docs/submission/proposal-user-questions.md).
 * Người dùng ghi quyết định của mình TRƯỚC khi xem kết quả hệ thống → nhãn độc lập + độ đồng thuận người–máy.
 * `designedAs` là thiết kế của đội (công bố sau buổi thử), KHÔNG phải nhãn đúng: nhãn đúng lấy từ người dùng.
 * U2 là ca kiểm tra "tin máy quá mức": hệ thống tự duyệt một khoản người làm nghề sẽ nghi ngờ.
 */
export interface UserStudyCase { id: 'U1' | 'U2' | 'U3' | 'U4' | 'U5'; summary: string; designedAs: { status: 'ROUTINE' | 'ESCALATED'; riskGroup?: RiskGroup; trap?: boolean }; invoice: Record<string, unknown> }

export const userStudyCases: UserStudyCase[] = [
  { id: 'U1', summary: 'Văn phòng phẩm 2.200.000₫, chuyển khoản', designedAs: { status: 'ROUTINE' },
    invoice: { invoiceNumber: 'U1-0001', invoiceDate: '2026-10-06', supplierTaxCode: '0312345678', supplierName: 'Công ty TNHH Văn phòng phẩm Hồng Hà', itemName: 'Văn phòng phẩm tháng 10', preTaxAmount: 2000000, taxRate: 10, taxAmount: 200000, totalAmount: 2200000, paymentMethod: 'BANK_TRANSFER' } },
  { id: 'U2', summary: 'Tiệc cưới người thân giám đốc 4.400.000₫, chuyển khoản', designedAs: { status: 'ROUTINE', trap: true },
    invoice: { invoiceNumber: 'U2-0002', invoiceDate: '2026-10-06', supplierTaxCode: '0315678901', supplierName: 'Trung tâm Tiệc cưới Hoa Sen', itemName: 'Chi phí tiệc cưới người thân giám đốc', preTaxAmount: 4000000, taxRate: 10, taxAmount: 400000, totalAmount: 4400000, paymentMethod: 'BANK_TRANSFER' } },
  { id: 'U3', summary: 'Cước Internet cáp quang, thuế suất 8%, 1.080.000₫', designedAs: { status: 'ESCALATED', riskGroup: 'OUT_OF_POLICY' },
    invoice: { invoiceNumber: 'U3-0003', invoiceDate: '2026-10-06', supplierTaxCode: '0100109106', supplierName: 'Tổng Công ty Viễn thông A', itemName: 'Cước Internet cáp quang tháng 9', preTaxAmount: 1000000, taxRate: 8, taxAmount: 80000, totalAmount: 1080000, paymentMethod: 'BANK_TRANSFER' } },
  { id: 'U4', summary: 'Máy chiếu 27.500.000₫, chuyển khoản có UNC, chưa rõ trạng thái MST bên bán', designedAs: { status: 'ESCALATED', riskGroup: 'UNCERTAIN_INFO' },
    invoice: { invoiceNumber: 'U4-0004', invoiceDate: '2026-10-06', supplierTaxCode: '0319876543', supplierName: 'Công ty CP Thiết bị Trình chiếu Sao Mai', itemName: 'Máy chiếu phòng họp', preTaxAmount: 25000000, taxRate: 10, taxAmount: 2500000, totalAmount: 27500000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true } },
  { id: 'U5', summary: 'Hợp đồng bảo trì máy chủ 242.000.000₫, chuyển khoản có UNC', designedAs: { status: 'ESCALATED', riskGroup: 'EXCEED_AUTHORITY' },
    invoice: { invoiceNumber: 'U5-0005', invoiceDate: '2026-10-06', supplierTaxCode: '0314567890', supplierName: 'Công ty TNHH Giải pháp Hệ thống Nam Việt', itemName: 'Hợp đồng bảo trì hệ thống máy chủ năm 2026', preTaxAmount: 220000000, taxRate: 10, taxAmount: 22000000, totalAmount: 242000000, paymentMethod: 'BANK_TRANSFER', hasBankSlip: true, sellerStatus: 'ACTIVE' } }
];
