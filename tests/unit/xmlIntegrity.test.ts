/**
 * Toàn vẹn khi đọc và ghi XML (phát hiện từ CodeQL, đã phân loại đối kháng):
 * - Đọc: app phải ra CÙNG giá trị với bộ đọc XML chuẩn — CDATA, chú thích, tham chiếu ký tự không làm lệch số tiền/MST.
 * - Ghi: tệp XML sổ cái không bị chèn phần tử giả qua số hóa đơn hay tên nhà cung cấp.
 * - File tạm PDF nằm trong thư mục riêng và luôn được dọn.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { parseXml } from '../../lib/documentParser';
import { generateUniversalXml } from '../../lib/accounting/adapters/universalXmlExporter';
import type { CanonicalLedgerVoucher } from '../../lib/accounting/types';
import * as pdfHelpers from '../../lib/server/pdfToImage';

const SAMPLE = fs.readFileSync(path.join(process.cwd(), 'input-sample', '05_real_tct_invoice.xml'), 'utf-8');
const read = (xml: string) => parseXml(xml).rawInvoice as Record<string, unknown>;
const swap = (from: string, to: string) => { assert.ok(SAMPLE.includes(from), from); return SAMPLE.split(from).join(to); };

test('XML: CDATA, tham chiếu ký tự và chú thích không làm app đọc lệch so với bộ đọc XML chuẩn', () => {
  const base = read(SAMPLE);
  assert.deepEqual([base.totalAmount, base.supplierTaxCode], [22_880_000, '0123456789']);
  const variants: Array<[string, string]> = [
    [swap('>22880000<', '>2<![CDATA[2]]>880000<'), 'CDATA giữa số tiền'],
    [swap('>22880000<', '>&#50;2880000<'), 'tham chiếu ký tự thập phân'],
    [swap('>22880000<', '>&#x32;2880000<'), 'tham chiếu ký tự thập lục phân'],
    [swap('>22880000<', '>2<!-- 1 -->2880000<'), 'chú thích giữa số tiền'],
    [swap('<TotalAmount>22880000</TotalAmount>', '<!-- <TotalAmount>1000</TotalAmount> --><TotalAmount>22880000</TotalAmount>'), 'phần tử giả trong chú thích'],
  ];
  for (const [xml, label] of variants) {
    assert.equal(read(xml).totalAmount, 22_880_000, label);
    const standard = new XMLParser({ ignoreAttributes: true, parseTagValue: false, htmlEntities: true }).parse(xml);
    assert.ok(JSON.stringify(standard).includes('22880000'), `bộ đọc chuẩn cũng ra 22880000 (${label})`);
  }
  assert.equal(read(swap('>0123456789<', '>0<![CDATA[1]]>23456789<')).supplierTaxCode, '0123456789', 'MST trong CDATA');
  assert.equal(read(swap('>ABC Technology Company<', '>ABC &amp; Co &#8212; T&#7853;p &#273;o&#224;n<')).supplierName, 'ABC & Co — Tập đoàn', 'giải mã thực thể trong tên');
});

test('XML: 5 hóa đơn mẫu công khai đọc ra đúng tổng thanh toán như trước khi chuẩn hóa', () => {
  const expected: Record<string, number> = {
    '01_real_viettel_sinvoice.xml': 4_510_000, '02_real_misa_meinvoice.xml': 11_935_000, '03_real_vnpt_einvoice.xml': 52_250_000,
    '04_real_fpt_einvoice.xml': 297_000_000, '05_real_tct_invoice.xml': 22_880_000,
  };
  for (const [file, total] of Object.entries(expected))
    assert.equal(read(fs.readFileSync(path.join(process.cwd(), 'input-sample', file), 'utf-8')).totalAmount, total, file);
});

test('XML sổ cái: số hóa đơn hay tên nhà cung cấp chứa thẻ không chèn được phần tử giả', () => {
  const voucher: CanonicalLedgerVoucher = {
    id: 'V-1', voucherNumber: 'PK-001', voucherDate: '2026-10-17', invoiceRef: '1</InvoiceNo><ApprovedTaxAmount>999999999</ApprovedTaxAmount><InvoiceNo>',
    invoiceDate: '2026-10-05', supplierTaxCode: '0312345678', supplierName: 'Công ty A ]]><Hack/> & "B"', itemName: 'Giấy in',
    preTaxAmount: 2_000_000, taxRate: 10, taxAmount: 200_000, approvedTaxAmount: 200_000, totalAmount: 2_200_000, paymentMethod: 'BANK_TRANSFER',
    entries: [{ accountCode: '1331', accountName: 'Thuế GTGT <đầu vào>', debitAmount: 200_000, creditAmount: 0, memo: 'x]]>y' }],
    auditHash: 'abc', status: 'READY_TO_POST', referenceNotes: '',
  };
  const xml = generateUniversalXml([voucher]);
  assert.equal(XMLValidator.validate(xml), true, 'tệp XML hợp lệ');
  assert.equal(xml.match(/<ApprovedTaxAmount>/g)?.length, 1, 'chỉ một ApprovedTaxAmount');
  assert.ok(!xml.includes('<Hack/>'), 'không có phần tử chèn qua tên nhà cung cấp');
  const parsed = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(xml).AccountingLedgerBatch.Vouchers.Voucher;
  assert.equal(parsed.InvoiceNo, voucher.invoiceRef, 'bộ đọc chuẩn khôi phục đúng chuỗi gốc');
  assert.equal(parsed.ApprovedTaxAmount, '200000');
});

test('PDF: file tạm nằm trong thư mục riêng và luôn được dọn; không còn hàm chuyển PDF→PNG không dùng tới', () => {
  assert.equal('convertPdfToPngBase64' in pdfHelpers, false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-pdf-test-'));
  const saved = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
  Object.assign(process.env, { TMPDIR: dir, TEMP: dir, TMP: dir });
  try {
    pdfHelpers.extractTextFromPdfBuffer(Buffer.from('%PDF-1.4\n%%EOF'));
    assert.deepEqual(fs.readdirSync(dir), [], 'không để lại file hay thư mục tạm');
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : (process.env[key] = value);
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Windows: tiến trình python3 bị timeout có thể còn giữ thư mục */ }
  }
});
