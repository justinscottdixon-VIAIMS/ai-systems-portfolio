import test from 'node:test';
import assert from 'node:assert/strict';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { toCredentialCollections } from '../src/lib/credential-collections.mjs';
import { archiveEntries, matchesArchiveQuery } from '../src/lib/archive-index.mjs';

const gallery = [{ kind: 'image', src: '/reference/test-cover.png', alt: 'Test cover', caption: 'Test artwork' }];
const history = [{
  title: 'Studio recollections',
  intro: 'Firsthand account from the artist, recorded later.',
  items: [{ title: 'Listening together', date: 'Session date unresolved', detail: 'A quiet room and an imagined dancefloor.' }],
}];
function fixture() {
  return { version: 1, records: [{
    id: 'releases', slug: 'releases', category: 'music', status: 'released',
    evidenceLevel: 'owner-approved-archive', public: true, title: 'Releases',
    format: 'Collection', dateDisplay: '1999', sortDate: '1999-01-01', era: '1990s',
    roles: ['Producer'], summary: 'Collection summary.', gallery,
    publicSources: [{ label: 'Public reference', href: 'https://example.test/release', supports: 'Release identity.' }],
    sections: [{ title: 'Collection history', items: [{ title: 'Collection fact', detail: 'Parent context stays separate.' }] }],
    children: [{
      id: 'edition', title: 'Release', artist: 'Artist', date: '1999', catalogNumber: 'TEST-1',
      format: 'CD', roles: ['Producer'], summary: 'Release summary.', gallery,
    }],
  }] };
}

test('release history defaults to empty without borrowing dossier sections or changing source', () => {
  const source = fixture();
  const before = structuredClone(source);
  const [record] = toPortfolioRecords(source);
  assert.deepEqual(record.children[0].historySections, []);
  assert.equal(record.sections.length, 1);
  assert.deepEqual(source, before);
  source.records[0].children[0].historySections = [];
  assert.deepEqual(toPortfolioRecords(source)[0].children[0].historySections, []);
});

test('release history retains attribution, optional dates and exact wording through normalization', () => {
  const source = fixture();
  const baseline = toPortfolioRecords(source)[0].children[0];
  source.records[0].children[0].historySections = structuredClone(history);
  source.records[0].children[0].historySections[0].items.push({ title: 'Undated recollection', detail: 'No date has been assigned.' });
  const before = structuredClone(source);
  const child = toPortfolioRecords(source)[0].children[0];
  assert.deepEqual(child.historySections, [{ ...history[0], items: [history[0].items[0], { title: 'Undated recollection', date: undefined, detail: 'No date has been assigned.' }] }]);
  const { historySections, ...unchanged } = child;
  const { historySections: unused, ...original } = baseline;
  assert.deepEqual(unchanged, original);
  assert.deepEqual(source, before);
});

test('provided release history rejects non-arrays and incomplete section content', () => {
  for (const value of [null, {}, 'History']) {
    const source = fixture();
    source.records[0].children[0].historySections = value;
    assert.throws(() => toPortfolioRecords(source), /history sections must be an array/);
  }
  for (const section of [null, { title: 'History', items: [] }, { title: 'History', items: [{ title: 'Item', detail: ' ' }] }]) {
    const source = fixture();
    source.records[0].children[0].historySections = [section];
    assert.throws(() => toPortfolioRecords(source), /history section/);
  }
});

test('grouped archive searches every history field inside the existing release entry', () => {
  const source = fixture();
  source.records[0].children[0].historySections = structuredClone(history);
  source.records[0].credentialsCollection = { id: 'parent', kind: 'collection' };
  const parent = structuredClone(source.records[0]);
  Object.assign(parent, { id: 'parent', slug: 'parent', children: [] });
  delete parent.credentialsCollection;
  source.records.push(parent);
  const normalized = toPortfolioRecords(source);
  const grouped = toCredentialCollections(normalized);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].children.length, 1);
  assert.deepEqual(grouped[0].children[0].historySections, history);
  const entries = archiveEntries(grouped);
  assert.equal(entries.length, 3); // Collection, existing child, and existing collection context.
  const entry = entries.find(item => item.catalogNumber === 'TEST-1');
  assert.equal(entry.href, '/archive/parent/#releases-edition');
  for (const query of ['studio recollections', 'firsthand account', 'listening together', 'session date unresolved', 'imagined dancefloor']) {
    assert.equal(matchesArchiveQuery(entry, query), true, query);
  }
  assert.equal(matchesArchiveQuery(entry, 'collection fact'), false);
  assert.equal(archiveEntries(normalized).find(item => item.catalogNumber === 'TEST-1').href, '/archive/releases/#edition');
});
