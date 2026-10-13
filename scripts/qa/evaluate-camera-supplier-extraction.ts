import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseReceiptEntities } from '../../lib/receiptEntityParser';

type CameraTruthCase = {
  file: string;
  supplierNameContains: string;
  supplierTaxCode?: string;
  absent?: string[];
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
}

function run(): void {
  const truthPath = path.join(process.cwd(), 'input-sample/ground-truth/camera-truth.json');
  const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8')) as { cases: CameraTruthCase[] };
  const results: Array<{
    file: string;
    supplierName: string | null;
    supplierNameMatches: boolean;
    supplierTaxCode: string | null;
    supplierTaxCodeMatches: boolean | null;
    supplierAddress: string | null;
    supplierAddressFound: boolean;
    supplierSearchContext: string | null;
    supplierSearchContextFound: boolean;
  }> = [];

  for (const expected of truth.cases) {
    const imagePath = path.join(process.cwd(), 'input-sample', expected.file);
    const ocr = JSON.parse(execFileSync('python3', [
      path.join(process.cwd(), 'scripts/ocr/apple_vision_ocr.py'), imagePath, 'accurate'
    ], { encoding: 'utf8', timeout: 20_000 })) as {
      error?: string; lines?: Array<{ text: string; confidence: number; bbox: { x: number; y: number; w: number; h: number } }>;
    };
    if (ocr.error || !ocr.lines?.length) throw new Error(`${expected.file}: ${ocr.error || 'OCR returned no lines'}`);

    const parsed = parseReceiptEntities(ocr.lines);
    const supplierName = typeof parsed.invoice.supplierName === 'string' ? parsed.invoice.supplierName : '';
    const supplierTaxCode = typeof parsed.invoice.supplierTaxCode === 'string' ? parsed.invoice.supplierTaxCode : '';
    const supplierAddress = typeof parsed.invoice.supplierAddress === 'string' ? parsed.invoice.supplierAddress : '';
    const supplierSearchContext = typeof parsed.supplierSearchContext === 'string' ? parsed.supplierSearchContext : '';
    const nameMatches = Boolean(supplierName && normalize(supplierName).includes(normalize(expected.supplierNameContains)));
    const absentTaxCode = expected.absent?.includes('supplierTaxCode') || false;
    const taxCodeMatches = expected.supplierTaxCode
      ? supplierTaxCode.replace(/\D/g, '') === expected.supplierTaxCode.replace(/\D/g, '')
      : absentTaxCode ? !supplierTaxCode : null;

    assert.ok(nameMatches, `${expected.file}: OCR supplier name ${JSON.stringify(supplierName)} did not contain expected text ${JSON.stringify(expected.supplierNameContains)}`);
    assert.notEqual(taxCodeMatches, false, `${expected.file}: MST was wrong or missing (expected ${expected.supplierTaxCode || 'no printed MST'}, got ${supplierTaxCode || 'blank'})`);
    results.push({
      file: expected.file,
      supplierName: supplierName || null,
      supplierNameMatches: nameMatches,
      supplierTaxCode: supplierTaxCode || null,
      supplierTaxCodeMatches: taxCodeMatches,
      supplierAddress: supplierAddress || null,
      supplierAddressFound: Boolean(supplierAddress),
      supplierSearchContext: supplierSearchContext || null,
      supplierSearchContextFound: Boolean(supplierSearchContext)
    });
  }

  const namesRead = results.filter((result) => result.supplierNameMatches).length;
  const expectedTaxCodes = results.filter((result) => result.supplierTaxCodeMatches !== null).length;
  const taxCodesCorrect = results.filter((result) => result.supplierTaxCodeMatches === true).length;
  const addressesRead = results.filter((result) => result.supplierAddressFound).length;
  const searchContextsRead = results.filter((result) => result.supplierSearchContextFound).length;
  console.log(JSON.stringify({
    scope: 'Local OCR/parser source extraction and seller-address coverage only; does not call online identity lookup or measure name-to-MST inference.',
    manualCameraCases: results.length,
    supplierNamesRead: `${namesRead}/${results.length}`,
    printedSupplierTaxCodeCasesCorrect: `${taxCodesCorrect}/${expectedTaxCodes}`,
    sellerAddressesRead: `${addressesRead}/${results.length}`,
    sellerSearchContextsRead: `${searchContextsRead}/${results.length}`,
    results
  }, null, 2));
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
