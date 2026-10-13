import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { screenInvoiceImage } from '../../services/invoiceImagePreflight';
import { runIsolated, getDatabase } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { POST as parseDocument } from '../../app/api/documents/parse/route';
import { createInvoiceImageFixture } from './invoice-image-fixture';

async function main() {
  let checked = 0;
  const elapsed: number[] = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Image screening must not call a network service'); };
  try {
    const screen = async (buffer: Buffer) => {
      const start = performance.now();
      const result = await screenInvoiceImage(buffer);
      elapsed.push(performance.now() - start); checked++;
      return result;
    };
    for (const color of ['white', 'black', '#888888']) {
      const blank = await sharp({ create: { width: 800, height: 800, channels: 3, background: color } }).png().toBuffer();
      assert.equal((await screen(blank)).reason, 'BLANK_IMAGE');
    }
    assert.equal((await screen(Buffer.from('not an image'))).reason, 'INVALID_IMAGE');
    const tiny = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } }).png().toBuffer();
    assert.equal((await screen(tiny)).reason, 'TOO_SMALL');
    const pattern = Buffer.alloc(512 * 512 * 3);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 3;
      const light = Math.floor(y / 4) % 2 === 0;
      pattern[i] = light ? 250 : 110; pattern[i + 1] = light ? 130 : 5; pattern[i + 2] = light ? 20 : 80;
    }
    const stripes = await sharp(pattern, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
    assert.equal((await screen(stripes)).decision, 'REJECT', 'color scene without document/text structure');
    const realPhotos = (await fs.readdir('input-sample')).filter(file => file.endsWith('.jpg'));
    for (const file of realPhotos) {
      const result = await screen(await fs.readFile(path.join('input-sample', file)));
      assert.notEqual(result.decision, 'REJECT', `${file}: ${JSON.stringify(result)}`);
    }
    const original = await createInvoiceImageFixture();
    for (const buffer of [original,
      await sharp(original).rotate(90).png().toBuffer(),
      await sharp(original).rotate(17, { background: '#54462f' }).png().toBuffer(),
      await sharp(original).blur(1.8).png().toBuffer(),
      await sharp(original).negate({ alpha: false }).png().toBuffer(),
      await sharp(original).modulate({ brightness: .45 }).png().toBuffer()]) {
      assert.notEqual((await screen(buffer)).decision, 'REJECT', 'rotated/blurred/dark invoice must remain eligible');
    }
    await runIsolated(async () => {
      const session = switchRole('ACCOUNTANT')!;
      const blank = await sharp({ create: { width: 500, height: 500, channels: 3, background: 'white' } }).png().toBuffer();
      const form = new FormData(); form.append('file', new File([blank], 'blank.png', { type: 'image/png' }));
      const response = await parseDocument(new NextRequest('http://localhost/api/documents/parse', {
        method: 'POST', headers: { cookie: `tax_referee_session=${session.token}` }, body: form
      }));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, 'IMAGE_PREFLIGHT_REJECTED');
      assert.equal((getDatabase().prepare('SELECT count(*) n FROM document_artifacts').get() as { n: number }).n, 0);
    });
    console.log(`PASS ${checked} image variants + API gate; no network/OCR. Mean local screening ${(elapsed.reduce((a,b)=>a+b,0)/elapsed.length).toFixed(1)} ms. This is a fixture check, not semantic accuracy.`);
  } finally { globalThis.fetch = previousFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
