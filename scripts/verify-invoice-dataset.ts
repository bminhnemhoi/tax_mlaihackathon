import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type DatasetItem = {
  id: string;
  file: string;
  kind: string;
  sourceUrl: string;
  licenseStatus: string;
  truthStatus: string;
  truthFile?: string;
  sha256?: string;
};

type DatasetManifest = {
  version: string;
  accuracyContract: string;
  items: DatasetItem[];
};

const root = path.resolve(process.cwd(), 'input-sample');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DatasetManifest;
const errors: string[] = [];
const hashes = new Set<string>();

if (!manifest.items.length) errors.push('manifest không có mẫu');
for (const item of manifest.items) {
  const filePath = path.join(root, item.file);
  if (!fs.existsSync(filePath)) errors.push(`${item.id}: thiếu file ${item.file}`);
  if (!/^https?:\/\//.test(item.sourceUrl)) errors.push(`${item.id}: sourceUrl không hợp lệ`);
  if (!['XML', 'PDF_TEXT_OR_SCAN', 'IMAGE_POS', 'IMAGE_CAMERA'].includes(item.kind)) errors.push(`${item.id}: kind không được hỗ trợ`);
  if (item.truthFile && !fs.existsSync(path.join(root, item.truthFile))) errors.push(`${item.id}: thiếu truthFile ${item.truthFile}`);
  if (fs.existsSync(filePath)) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (item.sha256 && item.sha256 !== hash) errors.push(`${item.id}: SHA-256 không khớp manifest`);
    if (hashes.has(hash)) errors.push(`${item.id}: trùng SHA-256 với mẫu khác`);
    hashes.add(hash);
  }
}

const requireEligible = process.argv.includes('--eligible-only');
if (requireEligible) {
  const ineligible = manifest.items.filter((item) => item.licenseStatus !== 'REDISTRIBUTABLE' || item.truthStatus !== 'LABELED');
  if (ineligible.length) errors.push(`Có ${ineligible.length} mẫu chưa đủ license và nhãn độc lập để công bố accuracy`);
}

if (errors.length) {
  console.error(errors.map((error) => `FAIL ${error}`).join('\n'));
  process.exit(1);
}
console.log(`PASS manifest ${manifest.items.length} mẫu; ${hashes.size} SHA-256 duy nhất`);
if (!requireEligible) console.log('INFO chưa tính accuracy công khai cho mẫu thiếu license hoặc nhãn độc lập');
