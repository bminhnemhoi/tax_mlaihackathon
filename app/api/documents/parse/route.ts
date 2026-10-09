import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { extractInvoiceWithUnifiedAI, extractInvoiceWithHybridPipeline } from '@/services/aiCoordinator';
import { DocumentExtractionSchema } from '@/lib/schemas';
import { getDatabase, jsonNow } from '@/lib/server/db';

import { parseNumberValue as numberValue, parseTaxRateString } from '@/lib/utils';
import { parseInvoiceFromRawText } from '@/lib/rawTextParser';
import { autoEnrichSupplierData } from '@/services/taxLookupService';
import { extractTextFromPdfBuffer, optimizeImageBuffer } from '@/lib/server/pdfToImage';
import { validateInvoiceMathematics } from '@/lib/invoiceMathValidator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function tag(xml: string, name: string): string | undefined {
  const pattern = `<(?:[a-zA-Z0-9_]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${name}>`;
  const match = xml.match(new RegExp(pattern, 'i'));
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || undefined;
}

function parseXml(xml: string) {
  // 1. Trích xuất khối Người bán <NBan> hoặc <SellerInfo> hoặc <Seller>
  const nbanMatch =
    xml.match(/<NBan[\s\S]*?<\/NBan>/i)?.[0] ||
    xml.match(/<SellerInfo[\s\S]*?<\/SellerInfo>/i)?.[0] ||
    xml.match(/<Seller[\s\S]*?<\/Seller>/i)?.[0] ||
    '';
  const supplierTaxCode =
    tag(nbanMatch, 'MST') ||
    tag(nbanMatch, 'TaxID') ||
    tag(xml, 'SellerTaxCode') ||
    tag(xml, 'TaxCode') ||
    tag(xml, 'MST');

  const supplierName =
    tag(nbanMatch, 'Ten') ||
    tag(nbanMatch, 'TenNBan') ||
    tag(nbanMatch, 'CompanyName') ||
    tag(nbanMatch, 'Name') ||
    tag(xml, 'SellerLegalName') ||
    tag(xml, 'SellerName') ||
    tag(xml, 'CompanyName') ||
    tag(xml, 'Ten');

  // 1b. Trích xuất khối Người mua <NMua> hoặc <BuyerInfo> hoặc <Buyer>
  const nmuaMatch =
    xml.match(/<NMua[\s\S]*?<\/NMua>/i)?.[0] ||
    xml.match(/<BuyerInfo[\s\S]*?<\/BuyerInfo>/i)?.[0] ||
    xml.match(/<Buyer[\s\S]*?<\/Buyer>/i)?.[0] ||
    '';
  const buyerTaxCode =
    tag(nmuaMatch, 'MST') ||
    tag(nmuaMatch, 'TaxID') ||
    tag(xml, 'BuyerTaxCode') ||
    tag(xml, 'NMuaMST');

  const buyerName =
    tag(nmuaMatch, 'Ten') ||
    tag(nmuaMatch, 'TenNMua') ||
    tag(nmuaMatch, 'CompanyName') ||
    tag(nmuaMatch, 'Name') ||
    tag(xml, 'BuyerLegalName') ||
    tag(xml, 'BuyerName');

  // Ký hiệu & Mẫu số hóa đơn
  const invoiceSeries =
    tag(xml, 'KHHDon') ||
    tag(xml, 'InvoiceSeries') ||
    tag(xml, 'Series') ||
    tag(xml, 'KyHieu');

  const invoiceTemplate =
    tag(xml, 'KHMSHDon') ||
    tag(xml, 'InvoiceTemplate') ||
    tag(xml, 'Template') ||
    tag(xml, 'MauSo');

  // Mã Cơ quan thuế (MCCQT 34 ký tự)
  const taxAuthorityCode =
    tag(xml, 'MCCQT') ||
    tag(xml, 'TaxAuthorityCode') ||
    tag(xml, 'MaCQT');

  // Ngày ký số
  const rawSigningDate =
    tag(xml, 'SigningDate') ||
    tag(xml, 'SignatureDate') ||
    tag(xml, 'NgayKy') ||
    tag(xml, 'SigningTime');

  // 2. Trích xuất số hóa đơn
  const invoiceNumber =
    tag(xml, 'SHDon') ||
    tag(xml, 'SHD') ||
    tag(xml, 'InvNum') ||
    tag(xml, 'InvoiceNumber') ||
    tag(xml, 'InvoiceNo') ||
    tag(xml, 'SoHoaDon');

  // 3. Trích xuất ngày lập hóa đơn
  const rawDate =
    tag(xml, 'NLap') ||
    tag(xml, 'NgayLap') ||
    tag(xml, 'InvDate') ||
    tag(xml, 'InvoiceDate') ||
    tag(xml, 'IssueDate');

  // 4. Trích xuất tên hàng hóa dịch vụ
  const itemName =
    tag(xml, 'THHDVu') ||
    tag(xml, 'TenHH') ||
    tag(xml, 'TenHang') ||
    tag(xml, 'TenHHDVu') ||
    tag(xml, 'ProductName') ||
    tag(xml, 'ProdName') ||
    tag(xml, 'ItemName') ||
    'Hàng hóa / Dịch vụ';

  const xmlHeader = xml.replace(/<(?:Items|InvoiceDetail|Details|HHDVu)[\s\S]*?<\/(?:Items|InvoiceDetail|Details|HHDVu)>/gi, '');

  // 5. Trích xuất tiền và thuế
  const preTaxAmount = numberValue(
    tag(xmlHeader, 'TgTCThue') ||
    tag(xmlHeader, 'TongTienHang') ||
    tag(xmlHeader, 'SubTotal') ||
    tag(xmlHeader, 'SubtotalAmount') ||
    tag(xmlHeader, 'ThTien') ||
    tag(xmlHeader, 'TotalSaleAmount') ||
    tag(xmlHeader, 'TotalAmountWithoutVAT') ||
    (tag(xmlHeader, 'GrandTotal') ? tag(xmlHeader, 'TotalAmount') : undefined) ||
    (tag(xmlHeader, 'TotalPayment') ? tag(xmlHeader, 'TotalAmount') : undefined) ||
    tag(xml, 'TgTCThue') ||
    tag(xml, 'TongTienHang')
  );

  const taxAmount = numberValue(
    tag(xmlHeader, 'TgTTThue') ||
    tag(xmlHeader, 'TgTThue') ||
    tag(xmlHeader, 'TongTienThue') ||
    tag(xmlHeader, 'TotalVAT') ||
    tag(xmlHeader, 'TotalVATAmount') ||
    tag(xmlHeader, 'VATAmount') ||
    tag(xmlHeader, 'TThue') ||
    tag(xmlHeader, 'TaxAmount') ||
    tag(xml, 'TgTTThue') ||
    tag(xml, 'TgTThue') ||
    tag(xml, 'TongTienThue')
  );

  const totalAmount = numberValue(
    tag(xmlHeader, 'TgTTTBSo') ||
    tag(xmlHeader, 'GrandTotal') ||
    tag(xmlHeader, 'TotalPayment') ||
    tag(xmlHeader, 'TongThanhToan') ||
    tag(xmlHeader, 'TongTien') ||
    tag(xmlHeader, 'TotalAmountWithVAT') ||
    tag(xmlHeader, 'InvoiceTotal') ||
    tag(xmlHeader, 'TotalAmount') ||
    tag(xml, 'TgTTTBSo') ||
    tag(xml, 'GrandTotal') ||
    tag(xml, 'TotalPayment') ||
    tag(xml, 'TongThanhToan')
  );

  const taxRateRaw =
    tag(xmlHeader, 'TSuat') ||
    tag(xmlHeader, 'ThueSuat') ||
    tag(xmlHeader, 'VATRatePercent') ||
    tag(xmlHeader, 'TaxRatePercent') ||
    tag(xmlHeader, 'VATRate') ||
    tag(xmlHeader, 'VATPercentage') ||
    tag(xml, 'TSuat') ||
    tag(xml, 'ThueSuat');
  const taxRate = parseTaxRateString(taxRateRaw);

  const paymentMethodRaw = (tag(xml, 'HTTT') || tag(xml, 'PaymentMethod') || '').toUpperCase();
  const paymentMethod = paymentMethodRaw.includes('TM') && !paymentMethodRaw.includes('CK') ? 'CASH' : 'BANK_TRANSFER';

  // 6. Trích xuất chi tiết dòng hàng <Item> hoặc <HHDVu> (IMP-08)
  const items: Array<{
    lineNumber: number;
    itemName: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    discountAmount?: number;
  }> = [];

  const xmlWarnings: string[] = [];

  const itemMatches = Array.from(xml.matchAll(/<(?:Item|HHDVu|Detail|Product)[\s\S]*?<\/(?:Item|HHDVu|Detail|Product)>/gi));
  let lineIdx = 1;
  for (const match of itemMatches) {
    const itemXml = match[0];
    const name = tag(itemXml, 'TenHang') || tag(itemXml, 'THHDVu') || tag(itemXml, 'ItemName') || tag(itemXml, 'ProductName') || tag(itemXml, 'ProdName');
    if (!name) continue;

    const unit = tag(itemXml, 'DVT') || tag(itemXml, 'DVTinh') || tag(itemXml, 'Unit') || tag(itemXml, 'UnitOfMeasure');
    const quantity = numberValue(tag(itemXml, 'SoLuong') || tag(itemXml, 'SLuong') || tag(itemXml, 'Quantity') || tag(itemXml, 'ProdQuantity')) || 1;
    const unitPrice = numberValue(tag(itemXml, 'DonGia') || tag(itemXml, 'DGia') || tag(itemXml, 'Price') || tag(itemXml, 'ProdPrice')) || 0;
    const amount = numberValue(tag(itemXml, 'ThanhTien') || tag(itemXml, 'ThTien') || tag(itemXml, 'Amount') || tag(itemXml, 'TotalAmount')) || (quantity * unitPrice);

    const itemTaxRateRaw = tag(itemXml, 'ThueSuat') || tag(itemXml, 'TSuat') || tag(itemXml, 'VATRate') || tag(itemXml, 'TaxRate') || tag(itemXml, 'TaxRatePercent');
    const parsedItemTaxRate = parseTaxRateString(itemTaxRateRaw);
    let itemTaxRate: 0 | 5 | 8 | 10;
    if (parsedItemTaxRate !== undefined) {
      itemTaxRate = parsedItemTaxRate;
    } else if (taxRate !== undefined) {
      itemTaxRate = taxRate;
    } else {
      itemTaxRate = 0;
      xmlWarnings.push(`Dòng ${lineIdx} [${name}]: Không tìm thấy thuế suất, không áp đặt mặc định 10%.`);
    }
    const itemTaxAmount = numberValue(tag(itemXml, 'TienThue') || tag(itemXml, 'TThue') || tag(itemXml, 'VATAmount') || tag(itemXml, 'TaxAmount')) ?? (itemTaxRate === 0 ? 0 : Math.round((amount * itemTaxRate) / 100));
    let discount = numberValue(tag(itemXml, 'TienCK') || tag(itemXml, 'DiscountAmount'));
    const discountRate = numberValue(tag(itemXml, 'Discount') || tag(itemXml, 'ChietKhau') || tag(itemXml, 'DiscountRate'));
    let netItemAmount = amount;
    if (itemTaxRate > 0 && itemTaxAmount > 0 && Math.abs((amount * itemTaxRate) / 100 - itemTaxAmount) > 10) {
      const netTaxable = Math.round((itemTaxAmount * 100) / itemTaxRate);
      discount = amount - netTaxable;
      netItemAmount = netTaxable;
    } else if (discount === undefined && discountRate && discountRate > 0 && discountRate <= 100) {
      discount = Math.round((quantity * unitPrice) - amount);
    }

    items.push({
      lineNumber: numberValue(tag(itemXml, 'STT') || tag(itemXml, 'ItemNo')) || lineIdx++,
      itemName: name,
      unit: unit || 'Cái',
      quantity,
      unitPrice,
      amount: netItemAmount,
      taxRate: itemTaxRate,
      taxAmount: itemTaxAmount,
      discountAmount: discount
    });
  }

  return {
    rawInvoice: {
      invoiceNumber,
      invoiceDate: rawDate,
      supplierTaxCode,
      supplierName,
      buyerTaxCode,
      buyerName,
      invoiceSeries,
      invoiceTemplate,
      taxAuthorityCode,
      signingDate: rawSigningDate,
      itemName,
      preTaxAmount,
      taxRate,
      taxAmount,
      totalAmount,
      paymentMethod,
      items: items.length > 0 ? items : undefined
    },
    warnings: xmlWarnings
  };
}

function sanitizeInvoice(raw: Record<string, unknown>): { invoice: Record<string, unknown>; warnings: string[] } {
  const invoice: Record<string, unknown> = {};
  const warnings: string[] = [];

  // invoiceNumber
  if (raw.invoiceNumber && typeof raw.invoiceNumber === 'string') {
    const invNum = raw.invoiceNumber.trim();
    if (invNum) invoice.invoiceNumber = invNum;
  }

  // invoiceDate -> chuẩn hóa YYYY-MM-DD
  if (raw.invoiceDate && typeof raw.invoiceDate === 'string') {
    const trimmed = raw.invoiceDate.trim().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      invoice.invoiceDate = trimmed;
    } else {
      const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (dmy) {
        const [, d, m, y] = dmy;
        invoice.invoiceDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (ymd) {
          const [, y, m, d] = ymd;
          invoice.invoiceDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
    }
  }

  // buyerTaxCode -> chuẩn hóa MST người mua 10 hoặc 13 số
  if (raw.buyerTaxCode) {
    const cleanedBuyerMst = String(raw.buyerTaxCode).replace(/[^0-9-]/g, '').trim();
    if (/^\d{10}(?:-\d{3})?$/.test(cleanedBuyerMst)) {
      invoice.buyerTaxCode = cleanedBuyerMst;
    } else {
      const digitsOnly = cleanedBuyerMst.replace(/-/g, '');
      if (digitsOnly.length === 10) {
        invoice.buyerTaxCode = digitsOnly;
      } else if (digitsOnly.length === 13) {
        invoice.buyerTaxCode = `${digitsOnly.slice(0, 10)}-${digitsOnly.slice(10)}`;
      }
    }
  }

  // buyerName
  if (raw.buyerName && typeof raw.buyerName === 'string') {
    const bName = raw.buyerName.trim();
    if (bName) invoice.buyerName = bName;
  }

  // invoiceSeries & invoiceTemplate
  if (raw.invoiceSeries && typeof raw.invoiceSeries === 'string') {
    const s = raw.invoiceSeries.trim().toUpperCase();
    if (s) invoice.invoiceSeries = s;
  }
  if (raw.invoiceTemplate && typeof raw.invoiceTemplate === 'string') {
    const t = raw.invoiceTemplate.trim();
    if (t) invoice.invoiceTemplate = t;
  }

  // taxAuthorityCode (MCCQT 34 ký tự)
  if (raw.taxAuthorityCode && typeof raw.taxAuthorityCode === 'string') {
    const c = raw.taxAuthorityCode.trim();
    if (c) invoice.taxAuthorityCode = c;
  }

  // signingDate -> chuẩn hóa YYYY-MM-DD
  if (raw.signingDate && typeof raw.signingDate === 'string') {
    const sTrimmed = raw.signingDate.trim().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(sTrimmed)) {
      invoice.signingDate = sTrimmed;
    } else {
      const dmy = sTrimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (dmy) {
        const [, d, m, y] = dmy;
        invoice.signingDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  // supplierTaxCode -> 10 hoặc 13 ký tự số
  if (raw.supplierTaxCode) {
    const cleanedMst = String(raw.supplierTaxCode).replace(/[^0-9-]/g, '').trim();
    if (/^\d{10}(?:-\d{3})?$/.test(cleanedMst)) {
      invoice.supplierTaxCode = cleanedMst;
    } else {
      const digitsOnly = cleanedMst.replace(/-/g, '');
      if (digitsOnly.length === 10) {
        invoice.supplierTaxCode = digitsOnly;
      } else if (digitsOnly.length === 13) {
        invoice.supplierTaxCode = `${digitsOnly.slice(0, 10)}-${digitsOnly.slice(10)}`;
      } else if (digitsOnly.length > 0) {
        warnings.push(`Mã số thuế bên bán [${cleanedMst}] chưa chuẩn 10 hoặc 13 số.`);
      }
    }
  }

  // supplierName
  if (raw.supplierName && typeof raw.supplierName === 'string') {
    const name = raw.supplierName.trim();
    if (name.length >= 2) invoice.supplierName = name;
  }

  // itemName
  if (raw.itemName && typeof raw.itemName === 'string') {
    const item = raw.itemName.trim();
    if (item.length >= 1) invoice.itemName = item;
  }

  // Tiền & thuế
  const preTax = typeof raw.preTaxAmount === 'number' && Number.isFinite(raw.preTaxAmount) ? raw.preTaxAmount : numberValue(raw.preTaxAmount);
  const tax = typeof raw.taxAmount === 'number' && Number.isFinite(raw.taxAmount) ? raw.taxAmount : numberValue(raw.taxAmount);
  const total = typeof raw.totalAmount === 'number' && Number.isFinite(raw.totalAmount) ? raw.totalAmount : numberValue(raw.totalAmount);

  let rate: number | undefined;
  if (raw.taxRate !== undefined && raw.taxRate !== null) {
    rate = parseTaxRateString(raw.taxRate);
  }

  if (preTax !== undefined) invoice.preTaxAmount = Math.round(preTax);
  if (rate !== undefined) invoice.taxRate = rate;
  if (tax !== undefined) invoice.taxAmount = Math.round(tax);
  if (total !== undefined) invoice.totalAmount = Math.round(total);

  // Tự động suy luận số tiền còn thiếu nếu có 2 trong 3 trường
  if (invoice.preTaxAmount !== undefined && invoice.taxRate !== undefined && invoice.taxAmount === undefined) {
    invoice.taxAmount = invoice.taxRate === 0 ? 0 : Math.round((Number(invoice.preTaxAmount) * Number(invoice.taxRate)) / 100);
  }
  if (invoice.preTaxAmount !== undefined && invoice.taxAmount !== undefined && invoice.totalAmount === undefined) {
    invoice.totalAmount = Number(invoice.preTaxAmount) + Number(invoice.taxAmount);
  } else if (invoice.totalAmount !== undefined && invoice.preTaxAmount !== undefined && invoice.taxAmount === undefined) {
    invoice.taxAmount = Number(invoice.totalAmount) - Number(invoice.preTaxAmount);
  } else if (invoice.totalAmount !== undefined && invoice.taxAmount !== undefined && invoice.preTaxAmount === undefined) {
    invoice.preTaxAmount = Number(invoice.totalAmount) - Number(invoice.taxAmount);
  } else if (invoice.totalAmount !== undefined && invoice.taxAmount !== undefined && invoice.preTaxAmount !== undefined) {
    // Nếu tổng thành tiền trước thuế gộp trừ chiết khấu dẫn đến lệch tổng thanh toán:
    if (Math.abs((Number(invoice.preTaxAmount) + Number(invoice.taxAmount)) - Number(invoice.totalAmount)) > 100) {
      invoice.preTaxAmount = Number(invoice.totalAmount) - Number(invoice.taxAmount);
    }
  }

  // paymentMethod
  if (raw.paymentMethod === 'CASH' || raw.paymentMethod === 'BANK_TRANSFER') {
    invoice.paymentMethod = raw.paymentMethod;
  } else {
    invoice.paymentMethod = 'CASH';
  }

  if (typeof raw.hasBankSlip === 'boolean') invoice.hasBankSlip = raw.hasBankSlip;
  if (typeof raw.hasItemManifest === 'boolean') invoice.hasItemManifest = raw.hasItemManifest;
  invoice.isImageBlurry = Boolean(raw.isImageBlurry);
  invoice.sellerStatus = raw.sellerStatus === 'ACTIVE' || raw.sellerStatus === 'SUSPENDED' || raw.sellerStatus === 'CLOSED'
    ? raw.sellerStatus
    : 'UNKNOWN';
  invoice.isAdjustment = Boolean(raw.isAdjustment);

  // Chuẩn hóa danh sách dòng hàng (IMP-08)
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    invoice.items = raw.items.map((it: any, index: number) => ({
      lineNumber: typeof it.lineNumber === 'number' ? it.lineNumber : index + 1,
      itemName: String(it.itemName || `Mặt hàng ${index + 1}`),
      unit: it.unit ? String(it.unit) : undefined,
      quantity: typeof it.quantity === 'number' ? it.quantity : 1,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : 0,
      amount: typeof it.amount === 'number' ? it.amount : 0,
      taxRate: typeof it.taxRate === 'number' && [0, 5, 8, 10].includes(it.taxRate)
        ? it.taxRate
        : (parseTaxRateString(it.taxRate) ?? (invoice.taxRate !== undefined ? (invoice.taxRate as 0 | 5 | 8 | 10) : 0)),
      taxAmount: typeof it.taxAmount === 'number' ? it.taxAmount : 0,
      discountAmount: typeof it.discountAmount === 'number' ? it.discountAmount : undefined
    }));
  }

  if (invoice.totalAmount === undefined) {
    warnings.push('Chưa nhận diện được Tổng tiền thanh toán. Vui lòng kiểm tra lại.');
  }

  return { invoice, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rawText = String(body.rawText || '').trim();
      if (!rawText) return NextResponse.json({ error: 'Nội dung văn bản trống' }, { status: 400 });

      const parsedText = parseInvoiceFromRawText(rawText);
      const { invoice, warnings } = sanitizeInvoice(parsedText.invoice);

      // Tự động suy luận và điền trường MST hoặc Tên bên bán còn thiếu
      const enriched = await autoEnrichSupplierData({
        supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
        supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined,
        rawText
      });
      if (enriched.enrichedField) {
        invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
        invoice.supplierName = enriched.supplierName || invoice.supplierName;
      }

      const textHash = crypto.createHash('sha256').update(rawText).digest('hex');
      const artifactId = `RAW-${Date.now().toString(36).toUpperCase()}`;

      const combinedWarnings = [
        `Đã bóc tách tự động từ văn bản thô (${parsedText.extractedFields.length} trường nhận diện).`,
        ...warnings
      ];
      if (enriched.notes) combinedWarnings.unshift(enriched.notes);

      const result = DocumentExtractionSchema.parse({
        invoice,
        confidence: Object.fromEntries(Object.keys(invoice).map((key) => [key, parsedText.extractedFields.includes(key) ? 0.95 : 0.7])),
        needsReview: true,
        sourceType: 'FORM',
        artifactId,
        sourceHash: textHash,
        warnings: combinedWarnings
      });
      return NextResponse.json(result);
    }

    const form = await req.formData();
    const rawText = form.get('rawText');
    if (typeof rawText === 'string' && rawText.trim()) {
      const parsedText = parseInvoiceFromRawText(rawText.trim());
      const { invoice, warnings } = sanitizeInvoice(parsedText.invoice);

      // Tự động suy luận và điền trường MST hoặc Tên bên bán còn thiếu
      const enriched = await autoEnrichSupplierData({
        supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
        supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined,
        rawText: rawText.trim()
      });
      if (enriched.enrichedField) {
        invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
        invoice.supplierName = enriched.supplierName || invoice.supplierName;
      }

      const textHash = crypto.createHash('sha256').update(rawText).digest('hex');
      const artifactId = `RAW-${Date.now().toString(36).toUpperCase()}`;

      const combinedWarnings = [
        `Đã bóc tách tự động từ văn bản thô (${parsedText.extractedFields.length} trường nhận diện).`,
        ...warnings
      ];
      if (enriched.notes) combinedWarnings.unshift(enriched.notes);

      const result = DocumentExtractionSchema.parse({
        invoice,
        confidence: Object.fromEntries(Object.keys(invoice).map((key) => [key, parsedText.extractedFields.includes(key) ? 0.95 : 0.7])),
        needsReview: true,
        sourceType: 'FORM',
        artifactId,
        sourceHash: textHash,
        warnings: combinedWarnings
      });
      return NextResponse.json(result);
    }

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Thiếu file chứng từ hoặc văn bản thô' }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'File vượt quá 15MB' }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const sourceHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const fileNameLower = file.name.toLowerCase();
    const sourceType = file.type.includes('xml') || fileNameLower.endsWith('.xml')
      ? 'XML'
      : file.type === 'application/pdf' || fileNameLower.endsWith('.pdf')
      ? 'PDF'
      : file.type.startsWith('image/') || fileNameLower.endsWith('.png') || fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') || fileNameLower.endsWith('.webp')
      ? 'IMAGE'
      : null;

    if (!sourceType) return NextResponse.json({ error: 'Chỉ hỗ trợ file XML, PDF và ảnh hóa đơn (PNG, JPG)' }, { status: 415 });

    const existingArtifact = getDatabase().prepare('SELECT id FROM document_artifacts WHERE content_hash = ?').get(sourceHash) as { id: string } | undefined;
    const artifactId = existingArtifact?.id || crypto.randomUUID();
    const extension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    const artifactDirectory = path.join(process.cwd(), 'data', 'runtime', 'artifacts');
    const storagePath = path.join(artifactDirectory, `${artifactId}${extension}`);

    if (!existingArtifact) {
      fs.mkdirSync(artifactDirectory, { recursive: true });
      fs.writeFileSync(storagePath, buffer, { flag: 'wx' });
      getDatabase().prepare(`
        INSERT INTO document_artifacts
          (id, invoice_id, revision, original_file_name, source_type, mime_type, storage_path, content_hash, byte_size, signature_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifactId,
        `pending:${artifactId}`,
        1,
        file.name,
        sourceType,
        file.type || 'application/octet-stream',
        storagePath,
        sourceHash,
        buffer.byteLength,
        sourceType === 'XML' ? 'UNVERIFIED' : 'NOT_APPLICABLE',
        jsonNow()
      );
    }

    let rawData: Record<string, unknown> = {};
    let initialWarnings: string[] = [];
    let extractedOcrDetails: any = null;

    if (sourceType === 'XML') {
      const parsed = parseXml(buffer.toString('utf8'));
      rawData = parsed.rawInvoice;
      if (parsed.warnings && parsed.warnings.length > 0) {
        initialWarnings.push(...parsed.warnings);
      }
    } else if (sourceType === 'PDF') {
      // HƯỚNG TĂNG TỐC ĐỘT PHÁ: Đọc trực tiếp Text Stream từ Digital PDF (< 50ms)
      const pdfText = extractTextFromPdfBuffer(buffer);
      if (pdfText && pdfText.length >= 50) {
        const parsedPdf = parseInvoiceFromRawText(pdfText);
        if (
          parsedPdf.extractedFields.includes('supplierTaxCode') ||
          parsedPdf.extractedFields.includes('totalAmount') ||
          parsedPdf.extractedFields.includes('invoiceNumber')
        ) {
          rawData = parsedPdf.invoice as Record<string, unknown>;
          initialWarnings.push(
            `Đã trích xuất siêu tốc (<0.05s) trực tiếp từ Digital PDF (${parsedPdf.extractedFields.length} trường).`
          );
        }
      }

      // Nếu không có text stream (PDF scan dạng ảnh), fallback sang AI Vision
      if (Object.keys(rawData).length === 0) {
        try {
          const { data: extracted, engineUsed } = await extractInvoiceWithUnifiedAI(
            buffer.toString('base64'),
            'application/pdf',
            file.name
          );
          rawData = (extracted || {}) as Record<string, unknown>;
          const engineLabel =
            engineUsed === 'GEMINI_AI'
              ? 'Google Gemini Vision'
              : engineUsed === 'HYBRID_NEURAL_OCR'
              ? 'Hybrid Neural OCR'
              : 'AI OCR Engine';
          initialWarnings.push(`Dữ liệu OCR được đọc bởi ${engineLabel}; kế toán vui lòng kiểm tra lại trước khi thẩm định.`);
        } catch (aiError) {
          console.warn('Unified AI extraction fallback:', aiError);
          initialWarnings.push('Không thể nhận diện tự động qua AI. Vui lòng nhập thông tin chứng từ trên Form.');
        }
      }
    } else {
      // IMAGE: Ưu tiên Hybrid Pipeline (Apple Vision NPU + DeepSeek Text Parser)
      let mimeType = file.type || 'image/jpeg';
      if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';

      const optimized = optimizeImageBuffer(buffer, mimeType);

      try {
        const { data: extracted, ocrDetails } = await extractInvoiceWithHybridPipeline({
          imagePath: storagePath,
          fileBase64: optimized.buffer.toString('base64'),
          mimeType: optimized.mimeType,
          fileName: file.name
        });
        rawData = (extracted || {}) as Record<string, unknown>;
        extractedOcrDetails = ocrDetails;

        // Cảnh báo chất lượng quang học chỉ khi có nhiều dòng mờ nét (>= 3 dòng)
        if (ocrDetails?.lowConfidenceLines && ocrDetails.lowConfidenceLines.length >= 3) {
          initialWarnings.push(
            `⚠️ Phát hiện ${ocrDetails.lowConfidenceLines.length} dòng chữ in bị mờ nét hoặc phai mực trên chứng từ.`
          );
        }
      } catch (aiError) {
        console.warn('Hybrid AI extraction fallback:', aiError);
        initialWarnings.push('Không thể nhận diện tự động qua AI. Vui lòng nhập thông tin chứng từ trên Form.');
      }
    }

    const { invoice, warnings } = sanitizeInvoice(rawData);

    // Tự động suy luận và điền trường MST hoặc Tên bên bán còn thiếu
    const enriched = await autoEnrichSupplierData({
      supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
      supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined
    });
    if (enriched.enrichedField) {
      invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
      invoice.supplierName = enriched.supplierName || invoice.supplierName;
    }

    // Xác định các trường bóc tách bị mờ / không chắc chắn và Bounding Boxes để highlight trực tiếp trên hóa đơn
    const uncertainFields: string[] = [];
    const fieldWarnings: Record<string, string> = {};
    const ocrHighlights: Array<{
      text: string;
      confidence: number;
      bbox?: { x: number; y: number; w: number; h: number };
      field?: string;
      reason?: string;
    }> = [];

    if (extractedOcrDetails?.lowConfidenceLines && extractedOcrDetails.lowConfidenceLines.length > 0) {
      for (const line of extractedOcrDetails.lowConfidenceLines) {
        let matchedField: string | undefined = undefined;
        let matchedReason = line.reason || 'Chữ in bị mờ nét hoặc đứt đoạn quang học';
        const lineTextClean = line.text.toLowerCase().trim();
        const lineDigits = line.text.replace(/[^0-9]/g, '');

        // 1. Khớp Số Hóa Đơn (invoiceNumber)
        if (typeof invoice.invoiceNumber === 'string' && invoice.invoiceNumber.trim()) {
          const invNum = invoice.invoiceNumber.toLowerCase().trim();
          const invDigits = invNum.replace(/[^0-9]/g, '');
          if (
            (invNum.length >= 3 && lineTextClean.includes(invNum)) ||
            (invDigits.length >= 4 && lineDigits.includes(invDigits))
          ) {
            matchedField = 'invoiceNumber';
            matchedReason = 'Số hóa đơn nằm trong vùng chữ bị mờ nét';
          }
        }

        // 2. Khớp Mã Số Thuế Bên Bán (supplierTaxCode)
        if (!matchedField && typeof invoice.supplierTaxCode === 'string' && invoice.supplierTaxCode.trim()) {
          const mstClean = invoice.supplierTaxCode.replace(/[^0-9]/g, '');
          if (mstClean.length >= 6 && lineDigits.includes(mstClean.slice(0, 6))) {
            matchedField = 'supplierTaxCode';
            matchedReason = 'Mã số thuế bên bán nằm trong vùng chữ bị mờ/phai nét';
          }
        }

        // 3. Khớp Tên Bên Bán (supplierName)
        if (!matchedField && typeof invoice.supplierName === 'string' && invoice.supplierName.trim().length >= 4) {
          const sName = invoice.supplierName.toLowerCase().trim();
          const sKeywords = sName
            .replace(/^(công ty|cty|tnhh|cổ phần|cp|doanh nghiệp|dn tư nhân|tập đoàn)\s+/i, '')
            .split(/\s+/)
            .filter((w) => w.length >= 3);

          if (
            lineTextClean.includes(sName.slice(0, 8)) ||
            (sKeywords.length > 0 && sKeywords.some((kw) => lineTextClean.includes(kw)))
          ) {
            matchedField = 'supplierName';
            matchedReason = 'Tên nhà cung cấp nằm trong vùng chữ bị nhòe nét';
          }
        }

        // 4. Khớp Ngày Lập Hóa Đơn (invoiceDate)
        if (!matchedField && typeof invoice.invoiceDate === 'string' && invoice.invoiceDate.trim()) {
          const dateParts = invoice.invoiceDate.split('-');
          const dmy = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : '';
          const shortDmy = dateParts.length === 3 ? `${Number(dateParts[2])}/${Number(dateParts[1])}/${dateParts[0]}` : '';
          if (
            lineTextClean.includes(invoice.invoiceDate) ||
            (dmy && lineTextClean.includes(dmy)) ||
            (shortDmy && lineTextClean.includes(shortDmy))
          ) {
            matchedField = 'invoiceDate';
            matchedReason = 'Ngày lập hóa đơn nằm trong vùng chữ bị mờ nét';
          }
        }

        // 5. Khớp Số Tiền (totalAmount, preTaxAmount, taxAmount)
        if (!matchedField) {
          const amountsToCheck = [
            { field: 'totalAmount', val: invoice.totalAmount, label: 'Tổng thanh toán' },
            { field: 'preTaxAmount', val: invoice.preTaxAmount, label: 'Tiền trước thuế' },
            { field: 'taxAmount', val: invoice.taxAmount, label: 'Tiền thuế GTGT' }
          ];

          for (const item of amountsToCheck) {
            if (item.val !== undefined && item.val !== null && typeof item.val === 'number' && item.val > 0) {
              const amtDigits = String(Math.round(item.val)).replace(/[^0-9]/g, '');
              if (amtDigits.length >= 4 && lineDigits.includes(amtDigits)) {
                matchedField = item.field;
                matchedReason = `${item.label} nằm trong vùng chữ bị mờ nét`;
                break;
              }
            }
          }
        }

        // 6. Khớp Nội Dung Mặt Hàng (itemName hoặc mảng items)
        if (!matchedField) {
          if (typeof invoice.itemName === 'string' && invoice.itemName.trim().length >= 4) {
            const itemClean = invoice.itemName.toLowerCase().trim();
            const itemWords = itemClean.split(/\s+/).filter((w) => w.length >= 4);
            if (lineTextClean.includes(itemClean.slice(0, 10)) || (itemWords.length > 0 && itemWords.some((w) => lineTextClean.includes(w)))) {
              matchedField = 'itemName';
              matchedReason = 'Tên hàng hóa dịch vụ nằm trong vùng chữ bị mờ nét';
            }
          }

          if (!matchedField && Array.isArray(invoice.items)) {
            for (const it of invoice.items) {
              if (it && typeof it.itemName === 'string' && it.itemName.trim().length >= 4) {
                const subName = it.itemName.toLowerCase().trim();
                if (lineTextClean.includes(subName.slice(0, 8))) {
                  matchedField = 'itemName';
                  matchedReason = `Tên hàng hóa [${it.itemName}] nằm trong vùng chữ bị mờ nét`;
                  break;
                }
              }
            }
          }
        }

        // 7. Khớp Bên Mua (buyerTaxCode, buyerName)
        if (!matchedField && typeof invoice.buyerTaxCode === 'string' && invoice.buyerTaxCode.trim()) {
          const bMstClean = invoice.buyerTaxCode.replace(/[^0-9]/g, '');
          if (bMstClean.length >= 6 && lineDigits.includes(bMstClean.slice(0, 6))) {
            matchedField = 'buyerTaxCode';
            matchedReason = 'Mã số thuế bên mua nằm trong vùng chữ bị mờ/phai nét';
          }
        }
        if (!matchedField && typeof invoice.buyerName === 'string' && invoice.buyerName.trim().length >= 5) {
          const bName = invoice.buyerName.toLowerCase().trim();
          if (lineTextClean.includes(bName.slice(0, 8))) {
            matchedField = 'buyerName';
            matchedReason = 'Tên bên mua nằm trong vùng chữ bị nhòe nét';
          }
        }

        // ĐIỀU KIỆN QUAN TRỌNG: CHỈ HIGHLIGHT KHI VỪA CÓ ĐỘ CHẮC CHẮN THẤP, VỪA LÀ THỰC THỂ ĐƯỢC LLM TRÍCH XUẤT!
        if (matchedField) {
          ocrHighlights.push({
            text: line.text,
            confidence: line.confidence,
            bbox: line.bbox,
            field: matchedField,
            reason: matchedReason
          });

          if (!uncertainFields.includes(matchedField)) {
            uncertainFields.push(matchedField);
            fieldWarnings[matchedField] = matchedReason;
          }
        }
      }
    }

    if (Boolean(invoice.isImageBlurry) || (extractedOcrDetails?.lowConfidenceLines && extractedOcrDetails.lowConfidenceLines.length >= 10)) {
      if (!uncertainFields.includes('totalAmount') && invoice.totalAmount) {
        uncertainFields.push('totalAmount');
        fieldWarnings['totalAmount'] = 'Ảnh bị nhòe nét: Kế toán vui lòng kiểm tra lại số tiền';
      }
    }

    if (uncertainFields.length > 0) {
      const fieldNamesMap: Record<string, string> = {
        invoiceNumber: 'Số Hóa Đơn',
        invoiceDate: 'Ngày Lập HĐ',
        supplierTaxCode: 'Mã Số Thuế',
        supplierName: 'Tên Bên Bán',
        totalAmount: 'Tổng Thanh Toán',
        itemName: 'Nội Dung Hàng Hóa'
      };
      const highlightedNames = uncertainFields.map(f => fieldNamesMap[f] || f).join(', ');
      initialWarnings.unshift(
        `⚠️ Đã khoanh vùng highlight trực tiếp trên hóa đơn và các trường (${highlightedNames}) để kế toán dễ dàng đối chiếu.`
      );
    }

    // Kiểm định Đẳng thức Toán học Bất biến & Checksum MST (Kiểm định 100% chính xác)
    const mathCheck = validateInvoiceMathematics(invoice);

    const combinedWarnings = [...initialWarnings, ...warnings, ...mathCheck.notes];
    if (enriched.notes) combinedWarnings.unshift(enriched.notes);

    const result = DocumentExtractionSchema.parse({
      invoice,
      confidence: Object.fromEntries(
        Object.keys(invoice).map((key) => [
          key,
          uncertainFields.includes(key)
            ? 0.6
            : sourceType === 'XML'
            ? 1
            : mathCheck.isBalanced && ['totalAmount', 'preTaxAmount', 'taxAmount'].includes(key)
            ? 0.98
            : 0.85
        ])
      ),
      needsReview: !mathCheck.isBalanced || Boolean(invoice.isImageBlurry) || uncertainFields.length > 0,
      sourceType,
      artifactId,
      sourceHash,
      warnings: combinedWarnings,
      uncertainFields,
      fieldWarnings,
      ocrHighlights
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đọc chứng từ' }, { status: 400 });
  }
}
