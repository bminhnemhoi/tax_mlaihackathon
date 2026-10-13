import assert from 'node:assert/strict';
import {parseReceiptEntities,ReceiptOcrLine} from '../../lib/receiptEntityParser';
const row=(text:string,x:number,y:number):ReceiptOcrLine=>({text,confidence:0.95,bbox:{x,y,w:150,h:20}});
const parsed=parseReceiptEntities([row('Số hóa đơn: HD0000123',10,0),row('Ngày bán: 10/10/2026',10,30),row('Mã số thuế: 0100000001',10,60),row('Tổng cộng:',10,90),row('1,380,000',300,90),row('Tiền mặt 2,000,000',10,120),row('Tiền trả lại: 620,000',10,150)]);
assert.equal(parsed.invoice.invoiceNumber,'HD0000123');assert.equal(parsed.invoice.invoiceDate,'2026-10-10');assert.equal(parsed.invoice.supplierTaxCode,'0100000001');assert.equal(parsed.invoice.totalAmount,1380000);assert.equal(parsed.invoice.paymentMethod,'CASH');assert.ok(parsed.evidence.totalAmount.length===2);
for(const field of ['taxRate','taxAmount','preTaxAmount','buyerTaxCode'])assert.ok(!(field in parsed.invoice));
const roleAwareTaxCodes=parseReceiptEntities([
 row('Thông tin bên bán',10,0),
 row('Mã số thuế: 0100109106001',10,24),
 row('Thông tin bên mua',10,48),
 row('Mã số thuế: 0100109106',10,72)
]);
assert.equal(roleAwareTaxCodes.invoice.supplierTaxCode,'0100109106001','Nhận MST chi nhánh 13 số khi OCR làm mất dấu gạch nối');
assert.equal(roleAwareTaxCodes.invoice.buyerTaxCode,'0100109106','Không gán MST bên mua thành MST nhà cung cấp sau tiêu đề bên mua');
const ambiguous=parseReceiptEntities([row('Tổng cộng: 100,000',10,0),row('Tổng cộng: 110,000',10,30)]);assert.ok(!('totalAmount' in ambiguous.invoice));
assert.ok(!('taxAmount' in parseReceiptEntities([row('Bao gồm thuế GTGT 5%: THÔNG TIN KHÁCH HÀNG',10,0)]).invoice));
const weak=parseReceiptEntities([{...row('Tổng cộng: 100,000',10,0),confidence:0.6}]);assert.ok(weak.uncertainFields.includes('totalAmount'));
const branchReceipt=parseReceiptEntities([
 row('VM+ QNH 112 Thanh Niên',10,0),
 row('Số 112 Thanh Niên, P. Cẩm Thanh',10,24),
 row('VinCommerce TP. Cẩm Phả, Quảng Ninh',10,48),
 row('HÓA ĐƠN BÁN HÀNG',10,72),
 row('Ngày bán: 09/08/2020',10,96)
]);
assert.equal(branchReceipt.invoice.supplierName,'VinCommerce','Ưu tiên tên thương hiệu trong đầu hóa đơn và bỏ phần địa danh chi nhánh');
assert.match(String(branchReceipt.invoice.supplierAddress||''),/Số 112 Thanh Niên/i,'Giữ địa chỉ chi nhánh không có nhãn để tra cứu có đối chiếu');
const storeReceipt=parseReceiptEntities([
 row('VI+ HCM 793 Nguyễn Kiệm',10,0),
 row('R',10,20),
 row('VinCommerce',10,40),
 row('793 Nguyễn Kiệm, Phường 3',10,60),
 row('Quận Gò Vấp, TP.HCM',10,80),
 row('HÓA ĐƠN BÁN HÀNG',10,100),
 row('Ngày bán: 24/03/2019',10,120)
]);
assert.equal(storeReceipt.invoice.supplierName,'VinCommerce','Không chọn mảnh địa chỉ Quận/TP làm tên nhà cung cấp');
assert.match(String(storeReceipt.invoice.supplierAddress||''),/793 Nguyễn Kiệm/i,'Gộp địa chỉ chi nhánh in cùng dòng với thương hiệu');
const multiBranchReceipt=parseReceiptEntities([
 row('OGAME-HOBBY',10,0),
 row('CN1: 12 Nguyễn Huệ, Quận 1, TP.HCM',10,24),
 row('CN2: 45 Lê Lợi, Quận 3, TP.HCM',10,48),
 row('HÓA ĐƠN BÁN HÀNG',10,72),
 row('Tổng cộng: 100.000',10,96)
]);
assert.equal(multiBranchReceipt.invoice.supplierName,'OGAME-HOBBY');
assert.ok(!('supplierAddress' in multiBranchReceipt.invoice), 'Không chọn ngẫu nhiên một địa chỉ khi hóa đơn liệt kê nhiều chi nhánh');
const words=parseReceiptEntities([row('Số tiền: 666\'6L9; Sáu trm bảy muoi chin nghin chin trm chin muoi chin dong',10,0)]);
assert.equal(words.invoice.totalAmount,679999);
assert.ok(!String(words.invoice.supplierName || '').toLowerCase().includes('số tiền'));
console.log('PASS receipt entities: identifier, labelled MST, date, spatial total, no inferred tax, conflicting totals, weak evidence.');
