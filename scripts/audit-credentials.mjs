// Read-only inventory. Content flags are review items, not automatically defects.
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const records = toPortfolioRecords(JSON.parse(await readFile(resolve(root, 'src/data/portfolio-records.json'), 'utf8')));
const derivatives = JSON.parse(await readFile(resolve(root, 'src/data/directory-image-review.json'), 'utf8'));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const rows = [];
const failures = [];
const assets = new Set();
for (const record of records) {
  const flags = [];
  const visit = (value, path = '') => {
    if (typeof value === 'string' && /pending|unresolved|clearance|placeholder/i.test(value)) flags.push({path, text:value});
    else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key,item]) => visit(item, path ? `${path}.${key}` : key));
  };
  visit(record);
  for (const item of [record,...record.children]) for (const image of item.gallery) if (image.kind === 'image') assets.add(image.src);
  rows.push({id:record.id,title:record.title,children:record.children.length,flags});
}
for (const [id, images] of Object.entries(derivatives)) {
  if (!records.some(record => record.id === id)) failures.push(`Unknown derivative record: ${id}`);
  assets.add(images.desktop); assets.add(images.mobile);
  if (!await exists(resolve(root,images.source))) failures.push(`Missing original: ${images.source}`);
}
for (const asset of assets) for (const folder of ['public','public-deploy']) {
  if (!await exists(resolve(root, folder, asset.slice(1)))) failures.push(`Missing ${folder}${asset}`);
}
const report = {dossiers:rows.length, childEditions:rows.reduce((sum,row)=>sum+row.children,0), localImages:assets.size, failures, records:rows};
console.log(JSON.stringify(report,null,2));
if (failures.length) process.exitCode = 1;
