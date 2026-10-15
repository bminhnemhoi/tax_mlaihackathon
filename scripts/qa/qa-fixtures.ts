import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {createInvoiceImageFixture} from './invoice-image-fixture';

/**
 * Sinh bộ fixture tổng hợp, tất định cho các bộ hồi quy cần file mẫu (ảnh rõ/mờ, raw text, XML).
 * Thư mục docs/qa-2026-10-10/fixtures/ bị gitignore, nên clone sạch không có file — runner gọi hàm này
 * trước khi chạy test để `npm test` luôn tái lập được. Toàn bộ là dữ liệu giả lập (MST thử nghiệm).
 */
export const QA_FIXTURE_DIR = path.join('docs', 'qa-2026-10-10', 'fixtures');

const RAW_TEXT = `HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ký hiệu: 1C26TQA
Số: QA-SYN-001
Ngày 10 tháng 10 năm 2026
Đơn vị bán hàng: CÔNG TY GIẢ LẬP QA
Mã số thuế: 0100000001
Địa chỉ: 1 Đường Thử Nghiệm, Hà Nội
Đơn vị mua hàng: CÔNG TY KIỂM THỬ MUA HÀNG
Mã số thuế: 0100109106
Hình thức thanh toán: Chuyển khoản
STT Tên hàng hóa, dịch vụ ĐVT Số lượng Đơn giá Thành tiền
1 Giấy in văn phòng Ram 10 100.000 1.000.000
Cộng tiền hàng: 1.000.000
Thuế suất GTGT: 10%
Tiền thuế GTGT: 100.000
Tổng cộng tiền thanh toán: 1.100.000
`;

const INVOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><PBan>2.0.1</PBan><THDon>Hóa đơn giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon><KHHDon>C26TQA</KHHDon><SHDon>1</SHDon><NLap>2026-10-10</NLap><DVTTe>VND</DVTTe><HTTToan>Chuyển khoản</HTTToan></TTChung>
<NDHDon><NBan><Ten>CÔNG TY GIẢ LẬP QA</Ten><MST>0100000001</MST><DChi>1 Đường Thử Nghiệm, Hà Nội</DChi></NBan><NMua><Ten>CÔNG TY KIỂM THỬ MUA HÀNG</Ten><MST>0100109106</MST></NMua>
<DSHHDVu><HHDVu><TChat>1</TChat><STT>1</STT><THHDVu>Giấy in văn phòng</THHDVu><DVTinh>Ram</DVTinh><SLuong>10</SLuong><DGia>100000</DGia><ThTien>1000000</ThTien><TSuat>10%</TSuat></HHDVu></DSHHDVu>
<TToan><THTTLTSuat><LTSuat><TSuat>10%</TSuat><ThTien>1000000</ThTien><TThue>100000</TThue></LTSuat></THTTLTSuat><TgTCThue>1000000</TgTCThue><TgTThue>100000</TgTThue><TgTTTBSo>1100000</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>
`;

export async function ensureQaFixtures(root = process.cwd()): Promise<string> {
  const dir = path.join(root, QA_FIXTURE_DIR);
  fs.mkdirSync(dir, {recursive: true});
  const write = async (name: string, make: () => Promise<Buffer> | Buffer) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, await make());
  };
  const base = await createInvoiceImageFixture();
  await write('clear.png', () => base);
  await write('clear.jpg', () => sharp(base).jpeg({quality: 90}).toBuffer());
  await write('blurred.jpg', () => sharp(base).blur(1.6).jpeg({quality: 80}).toBuffer());
  await write('raw-text.txt', () => Buffer.from(RAW_TEXT, 'utf8'));
  await write('invoice.xml', () => Buffer.from(INVOICE_XML, 'utf8'));
  return dir;
}

if (require.main === module) {
  ensureQaFixtures().then(dir => console.log(`QA fixtures ready: ${dir}`)).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
