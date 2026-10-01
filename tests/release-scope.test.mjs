import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { selectReleaseRecords, releaseRecordIds } from '../src/lib/release-scope.mjs';
const records = toPortfolioRecords(JSON.parse(await readFile(new URL('../src/data/portfolio-records.json', import.meta.url))));

test('development retains the complete archive unchanged', () => {
 assert.equal(selectReleaseRecords(records), records);
 assert.equal(selectReleaseRecords(records, 'full'), records);
});
test('candidate contains exactly eight selected dossiers with no pending records or dangling related links', () => {
 const selected = selectReleaseRecords(records, 'selected');
 assert.equal(selected.length, 8);
 assert.deepEqual(new Set(selected.map(r => r.id)), new Set(releaseRecordIds));
 const ids = new Set(selected.map(r => r.id));
 for (const r of selected) {
  assert.notEqual(r.status, 'verification-pending');
  assert.ok(r.relatedRecordIds.every(id => ids.has(id)));
  for (const child of r.children) assert.ok(child.relatedRecordIds.every(id => ids.has(id)));
 }
});
test('release selection does not mutate the development archive', () => {
 const before = structuredClone(records);
 selectReleaseRecords(records, 'selected');
 assert.deepEqual(records, before);
});
test('unknown scope and missing selected dossier fail the build instead of broadening publication', () => {
 assert.throws(() => selectReleaseRecords(records, 'typo'), /Unknown/);
 assert.throws(() => selectReleaseRecords(records.filter(r => r.id !== 'time-travel'), 'selected'), /Missing/);
});
test('a selected dossier regressing to verification-pending blocks the candidate', () => {
 const changed = structuredClone(records);
 changed.find(r => r.id === 'time-travel').status = 'verification-pending';
 assert.throws(() => selectReleaseRecords(changed, 'selected'), /pending/);
});

test('player release excludes all credentials without changing the development records', () => {
 const before = structuredClone(records);
 assert.deepEqual(selectReleaseRecords(records, 'player'), []);
 assert.deepEqual(records, before);
 assert.equal(selectReleaseRecords(records).length, 18);
});
