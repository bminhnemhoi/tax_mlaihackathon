/**
 * Fast, conservative screening for OCR text that clearly does not look like an
 * invoice. This is intentionally provider-independent so the capture route can
 * reject obvious non-documents before any paid Vision request is made.
 */
export function getNonInvoiceReason(fullText: string, totalLines: number): string | null {
  const normalized = fullText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = normalized.match(/[a-z0-9]{2,}/g) || [];

  if (totalLines < 1 || words.length < 6) return 'NO_READABLE_TEXT';
  if (totalLines < 3) return null;

  const invoiceClues = [
    /hoa don|invoice|receipt|e invoice/,
    /mst|ma so thue|tax code|vat|thue/,
    /tong|total|amount|thanh toan|tien hang|tien thue/,
    /don gia|thanh tien|quantity|qty|unit price/
  ];
  const hasInvoiceClue = invoiceClues.some((pattern) => pattern.test(normalized));

  // Long, readable prose without any invoice-specific anchors is very likely
  // a page/document unrelated to an invoice. Ambiguous or short OCR stays
  // fail-open so low-quality real receipts are not discarded.
  if (!hasInvoiceClue && totalLines >= 6 && words.length >= 18) return 'NO_INVOICE_CLUES';
  return null;
}
