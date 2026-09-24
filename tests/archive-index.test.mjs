import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { archiveEntries, matchesArchiveQuery, archiveHref } from '../src/lib/archive-index.mjs';
const records = toPortfolioRecords(JSON.parse(await readFile(new URL('../src/data/portfolio-records.json', import.meta.url))));

test('archive gives each child a stable URL within its dossier', () => {
  const entries = archiveEntries(records);
  assert.equal(entries.length, records.length + records.reduce((n, r) => n + r.children.length, 0));
  assert.equal(new Set(entries.map(e => e.href)).size, entries.length);
  assert.equal(entries.find(e => e.catalogNumber === 'COSMIC 001').href, '/archive/cosmic-records-history/#groove-me');
  assert.equal(archiveHref(records[0]), `/archive/${records[0].slug}/`);
});

test('search reaches nested releases, titles, artists and roles while preserving date uncertainty', () => {
  const entries = archiveEntries(records);
  const groove = entries.find(e => e.catalogNumber === 'COSMIC 001');
  assert.equal(groove.date, 'January 1996');
  assert.equal(entries.find(e => e.catalogNumber === 'COSMIC 002').date, 'Exact date unresolved');
  assert.equal(matchesArchiveQuery(groove, '  COSMIC 001 ', 'music'), true);
  assert.equal(matchesArchiveQuery(groove, 'friction co-producer'), true);
  assert.equal(matchesArchiveQuery(groove, '1996-01-01'), false);
  assert.equal(matchesArchiveQuery(groove, '', 'film'), false);
  assert.equal(matchesArchiveQuery(groove, 'nonexistent'), false);
  assert.equal(entries.some(e => matchesArchiveQuery(e, 'funkee ass')), true);
});

test('career search includes attributed history inside a dossier', () => {
  const entries = archiveEntries(records);
  assert.equal(entries.some(e => e.title === 'Studio evolution' && matchesArchiveQuery(e, 'AK1200 recording')), true);
});
