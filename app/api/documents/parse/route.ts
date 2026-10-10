import { assertValidXml, parseXml, sanitizeInvoice } from '@/lib/documentParser';
import { requireRequestUser } from '@/lib/server/auth';
import { artifactRoot } from '@/lib/server/db';
import { withRequestDatabase } from '@/lib/server/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { extractInvoiceWithUnifiedAI, extractInvoiceWithHybridPipeline } from '@/services/aiCoordinator';
import { DocumentExtractionSchema } from '@/lib/schemas';
import { getDatabase, jsonNow } from '@/lib/server/db';

import { parseNumberValue as numberValue, parseTaxRateString } from '@/lib/utils';
import { parseInvoiceFromRawText } from '@/lib/rawTextParser';
import { autoEnrichSupplierData, validateTaxCode } from '@/services/taxLookupService';
import { extractTextFromPdfBuffer, optimizeImageBuffer } from '@/lib/server/pdfToImage';
import { GEMINI_API_CONFIG } from '@/lib/constants';
import { validateInvoiceMathematics } from '@/lib/invoiceMathValidator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Stored in the current request database: never reuse another session's artifact/review.
const extractionVersion = `vision-compact-v3:${GEMINI_API_CONFIG.BASE_URL}:${GEMINI_API_CONFIG.MODEL}:${process.env.DOCUMENT_IMAGE_MAX_DIM || "1000"}-q${process.env.DOCUMENT_IMAGE_JPEG_QUALITY || "80"}:provenance-v1:${process.env.DOCUMENT_IMAGE_ENGINE || "gemini"}:receipt-v2:${process.env.LOCAL_OCR_PROFILE || "min960"}`;
function getCachedDocumentResult(hash: string) {
  const row = getDatabase().prepare(`SELECT r.payload_json FROM document_artifacts a
    JOIN extraction_reviews r ON r.artifact_id=a.id WHERE a.content_hash=?`).get(hash) as {payload_json:string}|undefined;
  if (!row) return null;
  try {
    const stored = JSON.parse(row.payload_json);
    if (stored.extractionVersion !== extractionVersion) return null;
    const result = DocumentExtractionSchema.safeParse(stored.cachedResult);
    return result.success ? result.data : null;
  } catch { return null; }
}
function extractionResponse(result: unknown, started: number, cacheHit=false) {
  const totalMs = Math.round(performance.now()-started);
  return NextResponse.json({ ...(result as object), performance:{totalMs,cacheHit} },
    { headers:{'Server-Timing':`extraction;dur=${totalMs}`, 'Cache-Control':'no-store'} });
}


function persistTextExtraction(rawText:string, rawInvoice:Record<string,unknown>, result:any, extractedFields:string[]) {
 const db=getDatabase();const hash=result.sourceHash;
 const prior=db.prepare('SELECT id FROM document_artifacts WHERE content_hash=?').get(hash) as {id:string}|undefined;
 const id=prior?.id || crypto.randomUUID();const directory=artifactRoot();const storage=path.join(directory,`${id}.txt`);
 if(!prior){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(storage,rawText,{flag:'wx'});db.prepare('INSERT INTO document_artifacts (id,invoice_id,revision,original_file_name,source_type,mime_type,storage_path,content_hash,byte_size,signature_status,created_at) VALUES (?,?,1,?,?,?,?,?,?,?,?)').run(id,`pending:${id}`,'van-ban.txt','FORM','text/plain',storage,hash,Buffer.byteLength(rawText),'NOT_APPLICABLE',jsonNow());}
 const inferredFields=Object.keys(result.invoice).filter(k=>!extractedFields.includes(k) && !['isImageBlurry','isAdjustment'].includes(k));
 const uncertainFields=[...new Set([...(result.uncertainFields || []),...inferredFields])];
 const output={...result,artifactId:id,uncertainFields,needsReview:true};
 db.prepare('INSERT OR REPLACE INTO extraction_reviews VALUES (?,?)').run(id,JSON.stringify({...output,invoice:rawInvoice,inferredFields}));return output;
}

async function handlePOST(req: NextRequest) {
  const started = performance.now();
  try {
    requireRequestUser(req);
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rawText = String(body.rawText || '').trim();
      if (!rawText) return NextResponse.json({ error: 'Nội dung văn bản trống' }, { status: 400 });

      const textHash = crypto.createHash('sha256').update(rawText).digest('hex');
      const cached = getCachedDocumentResult(textHash);
      if (cached) return NextResponse.json(cached);

      const parsedText = parseInvoiceFromRawText(rawText);
      const { invoice, warnings } = sanitizeInvoice(parsedText.invoice);

      // Tự động suy luận và điền trường MST hoặc Tên bên bán còn thiếu
      const enriched = await autoEnrichSupplierData({
        supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
        supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined,
        rawText,
        skipAi: true
      });
      if (enriched.enrichedField) {
        invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
        invoice.supplierName = enriched.supplierName || invoice.supplierName;
      }

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
        sourceHash: textHash,
        warnings: combinedWarnings
      });
      return NextResponse.json(persistTextExtraction(rawText,parsedText.invoice as Record<string,unknown>,result,parsedText.extractedFields));
    }

    const form = await req.formData();
    const rawText = form.get('rawText');
    if (typeof rawText === 'string' && rawText.trim()) {
      const textHash = crypto.createHash('sha256').update(rawText.trim()).digest('hex');
      const cached = getCachedDocumentResult(textHash);
      if (cached) return NextResponse.json(cached);

      const parsedText = parseInvoiceFromRawText(rawText.trim());
      const { invoice, warnings } = sanitizeInvoice(parsedText.invoice);

      // Tự động suy luận và điền trường MST hoặc Tên bên bán còn thiếu
      const enriched = await autoEnrichSupplierData({
        supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
        supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined,
        rawText: rawText.trim(),
        skipAi: true
      });
      if (enriched.enrichedField) {
        invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
        invoice.supplierName = enriched.supplierName || invoice.supplierName;
      }

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
        sourceHash: textHash,
        warnings: combinedWarnings
      });
      return NextResponse.json(persistTextExtraction(rawText,parsedText.invoice as Record<string,unknown>,result,parsedText.extractedFields));
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

    if (sourceType === 'XML') assertValidXml(buffer.toString('utf8'));
    const cachedFile = form.get('forceRefresh') === 'true' ? null : getCachedDocumentResult(sourceHash);
    if (cachedFile && cachedFile.sourceType === sourceType) return extractionResponse(cachedFile,started,true);

    const existingArtifact = getDatabase().prepare('SELECT id FROM document_artifacts WHERE content_hash = ?').get(sourceHash) as { id: string } | undefined;
    const artifactId = existingArtifact?.id || crypto.randomUUID();
    const extension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    const artifactDirectory = artifactRoot();
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
    let sourceReadFields: string[] | undefined;
    let extractedOcrDetails: any = null;
    let extractedFieldConfidences: Record<string, number> = {};
    let localUncertainFields: string[] = [];

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
          sourceReadFields = parsedPdf.extractedFields;
          initialWarnings.push(
            `Đã đọc lớp chữ trực tiếp từ PDF (${parsedPdf.extractedFields.length} trường).`
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
              ? 'Gemini 2.5 Flash'
              : engineUsed === 'QWEN_AI'
              ? GEMINI_API_CONFIG.MODEL
              : engineUsed === 'HYBRID_NEURAL_OCR'
              ? 'Hybrid Neural OCR'
              : 'Gemini 2.5 Flash';
          initialWarnings.push(`Dữ liệu được trích xuất trực tiếp bởi ${engineLabel}; kế toán vui lòng kiểm tra lại trước khi thẩm định.`);
        } catch (aiError: any) {
          console.error('[Document Parse] Lỗi bóc tách PDF scan qua Gemini Vision:', aiError);
          return NextResponse.json({
            error: `Lỗi đọc tài liệu PDF từ Gemini Vision: ${aiError?.message || 'Không thể trích xuất dữ liệu từ API'}`
          }, { status: 502 });
        }
      }
    } else {
      // IMAGE: Sử dụng model Gemini 2.5 Flash Vision
      let mimeType = file.type || 'image/jpeg';
      if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';

      const t_opt0 = Date.now();
      const optimized = await optimizeImageBuffer(buffer, mimeType);
      console.log(`[Parse Perf] Optimize Image: ${Date.now() - t_opt0}ms`);

      try {
        const t_ai0 = Date.now();
        const { data: extracted, ocrDetails, uncertainFields: localFields, fieldConfidences, fallbackReason } = await extractInvoiceWithHybridPipeline({
          imagePath: storagePath,
          fileBase64: optimized.buffer.toString('base64'),
          mimeType: optimized.mimeType,
          fileName: file.name
        });
        console.log(`[Parse Perf] Vision AI Call: ${Date.now() - t_ai0}ms`);
        rawData = (extracted || {}) as Record<string, unknown>;
        extractedOcrDetails = ocrDetails;
        extractedFieldConfidences = fieldConfidences || {};
        localUncertainFields = localFields || [];
        if (fallbackReason) initialWarnings.push(`Luồng trích xuất: ${fallbackReason}.`);
        if (process.env.DOCUMENT_IMAGE_ENGINE === 'local-ocr') sourceReadFields = Object.keys(rawData);

        if (ocrDetails?.lowConfidenceLines && ocrDetails.lowConfidenceLines.length >= 3) {
          initialWarnings.push(
            `⚠️ Phát hiện ${ocrDetails.lowConfidenceLines.length} dòng chữ in bị mờ nét hoặc phai mực trên chứng từ.`
          );
        }
      } catch (aiError: any) {
        console.error('[Document Parse] Lỗi bóc tách ảnh hóa đơn qua Gemini Vision:', aiError);
        return NextResponse.json({
          error: `Lỗi đọc ảnh hóa đơn từ Gemini 2.5 Flash: ${aiError?.message || 'Không thể trích xuất dữ liệu từ API'}`
        }, { status: 502 });
      }
    }

    const t_san0 = Date.now();
    const { invoice, warnings } = sanitizeInvoice(rawData);
    console.log(`[Parse Perf] Sanitize Invoice: ${Date.now() - t_san0}ms`);

    // Local OCR is deliberately source-preserving: the shared sanitizer can
    // derive a missing amount from total + VAT rate for legacy XML/VLM flows,
    // but an image must never gain a tax value that was not printed. Keep only
    // numeric fields actually returned by the OCR entity parser.
    if (process.env.DOCUMENT_IMAGE_ENGINE === 'local-ocr') {
      for (const field of ['preTaxAmount', 'taxAmount', 'totalAmount'] as const) {
        if (!(field in rawData)) delete invoice[field];
      }
    }

    // Tự động đối chiếu CSDL & Danh bạ chuỗi bán lẻ để điền MST hoặc Tên bên bán (bỏ qua LLM để đạt tốc độ < 1s)
    const t_enr0 = Date.now();
    const enriched = process.env.DOCUMENT_IMAGE_ENGINE === 'local-ocr'
      ? { enrichedField: undefined, supplierTaxCode: undefined, supplierName: undefined }
      : await autoEnrichSupplierData({
          supplierTaxCode: typeof invoice.supplierTaxCode === 'string' ? invoice.supplierTaxCode : undefined,
          supplierName: typeof invoice.supplierName === 'string' ? invoice.supplierName : undefined,
          skipAi: true
        });
    console.log(`[Parse Perf] Auto Enrich Supplier: ${Date.now() - t_enr0}ms`);
    if (enriched.enrichedField) {
      invoice.supplierTaxCode = enriched.supplierTaxCode || invoice.supplierTaxCode;
      invoice.supplierName = enriched.supplierName || invoice.supplierName;
    }

    // Xác định các trường bóc tách bị mờ / không chắc chắn và Bounding Boxes để highlight trực tiếp trên hóa đơn
    const uncertainFields: string[] = [...localUncertainFields];
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

    const inferredFields = Object.keys(invoice).filter(key => !['isImageBlurry','isAdjustment','sellerStatus'].includes(key) && (rawData[key] === undefined || rawData[key] === null || (sourceReadFields !== undefined && !sourceReadFields.includes(key))));
    for (const key of inferredFields) if (!uncertainFields.includes(key)) uncertainFields.push(key);
    // Balanced zeros and absent identities are not evidence of successful OCR.
    const requiredSourceFields = ['invoiceNumber','invoiceDate','supplierTaxCode','supplierName','itemName','preTaxAmount','taxRate','taxAmount','totalAmount'];
    if (sourceType !== 'XML') requiredSourceFields.push('buyerTaxCode');
    for (const key of requiredSourceFields) {
      if (invoice[key] === undefined || invoice[key] === null || invoice[key] === '') {
        if (!uncertainFields.includes(key)) uncertainFields.push(key);
        fieldWarnings[key] = 'Chưa đọc được từ chứng từ gốc; cần bổ sung và xác minh.';
      }
    }
    const absentFields = requiredSourceFields.filter((key) => invoice[key] === undefined || invoice[key] === null || invoice[key] === '');
    // A ten/13-digit shape alone is not enough evidence for an MST. Reject
    // OCR strings that fail the public checksum and keep them editable; a
    // directory lookup or supplier name must never silently repair a printed
    // tax code.
    for (const key of ['supplierTaxCode', 'buyerTaxCode'] as const) {
      const value = invoice[key];
      if (typeof value === 'string' && value && !validateTaxCode(value).isValid) {
        if (!uncertainFields.includes(key)) uncertainFields.push(key);
        fieldWarnings[key] = 'Mã số thuế đọc được không vượt qua kiểm tra chữ số; cần đối chiếu bản gốc.';
      }
    }
    if (sourceType !== 'XML' && Number(invoice.preTaxAmount || 0) === 0 && Number(invoice.totalAmount || 0) === 0) {
      for (const key of ['preTaxAmount','taxAmount','totalAmount']) {
        if (!uncertainFields.includes(key)) uncertainFields.push(key);
        fieldWarnings[key] = 'Không có số tiền đáng tin cậy từ OCR; số 0 cần xác minh.';
      }
    }
    // Run the arithmetic check only after source/uncertainty guards have been
    // assembled. A mathematically balanced value from a weak OCR token is not
    // evidence that the printed invoice is correct.
    const mathCheck = validateInvoiceMathematics(invoice, {
      untrustedFields: uncertainFields,
      sourceType
    });
    const combinedWarnings = [...initialWarnings, ...warnings, ...mathCheck.notes];
    if (enriched.notes) combinedWarnings.unshift(enriched.notes);

    const confidence = Object.fromEntries(
      Object.keys(invoice).map((key) => [
        key,
        uncertainFields.includes(key)
          ? 0.6
          : sourceType === 'XML'
          ? 1
          : Math.min(0.95, Math.max(0.05, extractedFieldConfidences[key] ?? 0.85))
      ])
    );
    const evidenceSource = sourceType === 'XML'
      ? 'XML'
      : sourceType === 'PDF' && sourceReadFields
      ? 'PDF_TEXT'
      : sourceType === 'IMAGE' && extractedOcrDetails
      ? 'OCR'
      : sourceType === 'IMAGE'
      ? 'VLM'
      : 'USER';
    const fieldEvidence = Object.fromEntries(
      Object.keys(invoice).map((key) => [key, {
        source: inferredFields.includes(key) ? 'INFERRED' : evidenceSource,
        status: !mathCheck.isBalanced && ['preTaxAmount', 'taxAmount', 'totalAmount'].includes(key)
          ? 'CONFLICT'
          : uncertainFields.includes(key)
          ? 'UNCERTAIN'
          : 'VERIFIED',
        confidence: confidence[key] ?? 0,
        text: typeof rawData[key] === 'string' ? rawData[key] as string : undefined
      }])
    );
    for (const key of absentFields) {
      fieldEvidence[key] = {
        source: evidenceSource,
        status: 'ABSENT',
        confidence: 0,
        text: undefined
      };
    }
    const conflicts = mathCheck.isBalanced ? [] : combinedWarnings.filter((warning) => /không khớp|không xác nhận|mâu thuẫn/i.test(warning));

    const result = DocumentExtractionSchema.parse({
      invoice,
      confidence,
      needsReview: !mathCheck.isBalanced || Boolean(invoice.isImageBlurry) || uncertainFields.length > 0,
      sourceType,
      artifactId,
      sourceHash,
      warnings: combinedWarnings,
      uncertainFields,
      absentFields,
      conflicts,
      fieldWarnings,
      fieldEvidence,
      ocrHighlights
    });

    getDatabase().prepare('INSERT OR REPLACE INTO extraction_reviews (artifact_id,payload_json) VALUES (?,?)').run(artifactId,JSON.stringify({...result, invoice:rawData, inferredFields, extractionVersion, cachedResult:result}));
    return extractionResponse(result,started);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đọc chứng từ' }, { status: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 400 });
  }
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestDatabase(args[0], () => handlePOST(...args)); }
