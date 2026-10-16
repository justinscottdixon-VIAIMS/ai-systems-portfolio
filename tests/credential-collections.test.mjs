import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { archiveHref } from '../src/lib/archive-index.mjs';
import { toCredentialCollections } from '../src/lib/credential-collections.mjs';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';

const image = src => ({ kind: 'image', src, alt: src, caption: src });
const source = (href, supports, label = supports) => ({ href, supports, label });
const child = (id, extra = {}) => ({
  id, title: `Edition ${id}`, artist: 'Edition artist', date: '1999', catalogNumber: 'CAT-1',
  format: 'Vinyl', roles: ['Remix'], summary: 'Edition summary',
  gallery: [image(`/reference/${id}.png`)],
  credits: [{ title: 'Track', scope: 'Track 1', roles: ['Remix'], evidence: 'Public label' }],
  publicSources: [source('https://example.test/edition', 'Edition credit')], relatedRecordIds: [], ...extra,
});
const record = (id, extra = {}) => ({
  id, slug: id, title: `Record ${id}`, displayArtistOrClient: 'Record artist',
  dateDisplay: '2001', sortDate: '2001-01-01', category: 'music', status: 'released',
  format: 'Digital', roles: ['Producer'], summary: 'Record summary',
  catalog: { label: 'Label', catalogNumber: 'DIG-2' }, gallery: [image(`/reference/${id}.png`)],
  publicSources: [source(`https://example.test/${id}`, 'Record evidence')],
  relatedRecordIds: [], sections: [{ title: 'Context', items: [{ title: 'Fact', detail: 'Preserved fact' }] }],
  children: [], ...extra,
});
const member = (kind, childId) => ({ id: 'parent', kind, ...(childId === undefined ? {} : { childId }) });
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

test('groups releases, collection editions and context without losing canonical information', () => {
  const original = child('existing');
  const group = record('group', { children: [child('first'), child('second')], credentialsCollection: member('collection') });
  const chart = record('chart', { category: 'publication', credentialsCollection: member('context') });
  const single = record('single', { catalog: undefined, relatedRecordIds: ['chart'], credentialsCollection: member('release') });
  const merged = record('merged', {
    gallery: [original.gallery[0], image('/reference/new.png'), image('/reference/new.png'), { kind: 'pending', alt: 'Held', caption: 'Held evidence' }],
    publicSources: [
      { ...original.publicSources[0], label: 'Same evidence with another label' },
      source(original.publicSources[0].href, 'Different supported fact'),
      source('https://example.test/new', 'New evidence'),
    ],
    credentialsCollection: member('release', 'existing'),
  });
  const input = freeze([record('before'), record('parent', { children: [original] }), group, chart, single, merged, record('after')]);
  const snapshot = JSON.stringify(input);
  const output = toCredentialCollections(input);
  assert.deepEqual(output.map(item => item.id), ['before', 'parent', 'after']);
  const parent = output[1];
  assert.deepEqual(parent.children.map(item => item.id), ['existing', 'group-first', 'group-second', 'single']);
  assert.deepEqual(parent.contextRecords, [group, chart]);
  assert.equal(parent.contextRecords[0], group);
  assert.equal(parent.contextRecords[1].sections, chart.sections);

  const joined = parent.children[0];
  for (const key of ['title', 'artist', 'date', 'catalogNumber', 'format', 'roles', 'credits', 'summary', 'relatedRecordIds']) {
    assert.equal(joined[key], original[key], `existing edition ${key} must remain unchanged`);
  }
  assert.deepEqual(joined.gallery.map(item => item.src), ['/reference/existing.png', '/reference/new.png']);
  assert.deepEqual(joined.publicSources, [original.publicSources[0], merged.publicSources[1], merged.publicSources[2]]);
  assert.deepEqual(joined.contextRecords, [merged]);
  assert.equal(joined.contextRecords[0], merged);
  assert.equal(joined.sourceArchiveHref, '/archive/parent/#existing');

  for (const [index, edition] of group.children.entries()) {
    const projected = parent.children[index + 1];
    for (const key of Object.keys(edition).filter(key => key !== 'id')) assert.equal(projected[key], edition[key]);
    assert.equal(projected.sourceArchiveHref, archiveHref(group, edition));
    assert.deepEqual(projected.contextRecords, []);
  }
  const projectedSingle = parent.children.at(-1);
  assert.equal(projectedSingle.artist, single.displayArtistOrClient);
  assert.equal(projectedSingle.date, single.dateDisplay);
  assert.equal(projectedSingle.catalogNumber, 'Not specified');
  assert.deepEqual(projectedSingle.credits, []);
  assert.equal(projectedSingle.gallery, single.gallery);
  assert.equal(projectedSingle.publicSources, single.publicSources);
  assert.equal(projectedSingle.relatedRecordIds, single.relatedRecordIds);
  assert.equal(projectedSingle.sections, single.sections);
  assert.deepEqual(projectedSingle.contextRecords, [single]);
  assert.equal(projectedSingle.sourceArchiveHref, '/archive/single/');
  assert.equal(JSON.stringify(input), snapshot);
});

test('leaves records with no memberships unchanged and uses specified release catalogue numbers', () => {
  const plain = freeze([record('plain')]);
  assert.deepEqual(toCredentialCollections([]), []);
  assert.equal(toCredentialCollections(plain)[0], plain[0]);
  const single = record('single', { credentialsCollection: member('release') });
  assert.equal(toCredentialCollections([record('parent'), single])[0].children[0].catalogNumber, 'DIG-2');
});

test('rejects invalid, unknown, self, nested and missing-child membership', () => {
  assert.throws(() => toCredentialCollections({}), /must be an array/);
  assert.throws(() => toCredentialCollections([record('a'), record('a')]), /duplicate credential record/);
  for (const credentialsCollection of [null, [], { id: 'parent', kind: 'unknown' }, { id: '', kind: 'release' }]) {
    assert.throws(() => toCredentialCollections([record('parent'), record('a', { credentialsCollection })]), /invalid credential collection membership/);
  }
  assert.throws(() => toCredentialCollections([record('a', { credentialsCollection: member('release') })]), /unknown credential collection/);
  assert.throws(() => toCredentialCollections([record('parent', { credentialsCollection: member('release') })]), /self credential collection/);
  assert.throws(() => toCredentialCollections([
    record('parent'), record('nested', { credentialsCollection: member('collection') }),
    record('a', { credentialsCollection: { id: 'nested', kind: 'release' } }),
  ]), /nested credential collection/);
  assert.throws(() => toCredentialCollections([
    record('parent'), record('a', { credentialsCollection: member('release', 'missing') }),
  ]), /missing credential collection child target/);
  for (const credentialsCollection of [member('context', 'existing'), member('collection', 'existing'), member('release', '')]) {
    assert.throws(() => toCredentialCollections([
      record('parent', { children: [child('existing')] }), record('a', { credentialsCollection }),
    ]), /invalid credential collection child target/);
  }
});

test('rejects collisions with existing or flattened child IDs', () => {
  assert.throws(() => toCredentialCollections([
    record('parent', { children: [child('single')] }), record('single', { credentialsCollection: member('release') }),
  ]), /duplicate credential collection child id: parent\/single/);
  assert.throws(() => toCredentialCollections([
    record('parent', { children: [child('group-edition')] }),
    record('group', { children: [child('edition')], credentialsCollection: member('collection') }),
  ]), /duplicate credential collection child id: parent\/group-edition/);
  assert.throws(() => toCredentialCollections([
    record('parent', { children: [child('same'), child('same')] }), record('chart', { credentialsCollection: member('context') }),
  ]), /duplicate credential collection child id/);
});

test('actual catalogue groups into 9 roots and 97 release views while preserving canonical archives', async () => {
  const data = JSON.parse(await readFile(new URL('../src/data/portfolio-records.json', import.meta.url), 'utf8'));
  const canonical = toPortfolioRecords(data);
  const membershipKinds = new Map([
    ['production-engineering-credits', 'collection'], ['compilation-appearances', 'collection'],
    ['chart-history', 'context'], ['time-travel', 'release'], ['one-voyager-remix', 'release'],
    ['two-worlds', 'release'], ['someone-else-bloom', 'release'], ['navigator', 'release'], ['groove-me-anniversary', 'release'],
  ]);
  const input = freeze(canonical.map(item => membershipKinds.has(item.id) ? {
    ...item, credentialsCollection: {
      id: 'singles-remixes', kind: membershipKinds.get(item.id),
      ...(item.id === 'one-voyager-remix' ? { childId: 'nc-13' } : {}),
    },
  } : item));
  const snapshot = JSON.stringify(input);
  const output = toCredentialCollections(input);
  assert.equal(input.length, 18);
  assert.equal(output.length, 9);
  assert.deepEqual(output.map(item => item.id), input.filter(item => !membershipKinds.has(item.id)).map(item => item.id));
  const parent = output.find(item => item.id === 'singles-remixes');
  const originalParent = input.find(item => item.id === parent.id);
  assert.equal(originalParent.children.length, 17);
  assert.equal(parent.children.length, 49);
  assert.equal(new Set(parent.children.map(item => item.id)).size, 49);
  assert.equal(input.reduce((total, item) => total + item.children.length, 0), 91);
  assert.equal(output.reduce((total, item) => total + item.children.length, 0), 97);
  assert.equal(parent.children.some(item => item.id === 'nc-09'), false);
  assert.deepEqual(parent.contextRecords.map(item => item.id), ['production-engineering-credits', 'compilation-appearances', 'chart-history']);

  for (const originalRecord of input) {
    for (const originalChild of originalRecord.children) {
      const grouped = originalRecord.credentialsCollection?.kind === 'collection';
      const projectedParent = grouped ? parent : output.find(item => item.id === originalRecord.id);
      const projected = projectedParent.children.find(item => item.id === (grouped ? `${originalRecord.id}-${originalChild.id}` : originalChild.id) || item.aliasIds?.includes(originalChild.id));
      assert.ok(projected, `${originalRecord.id}/${originalChild.id} survives`);
      if (projected.aliasIds?.length) {
        for (const credit of originalChild.credits) assert.ok(projected.credits.includes(credit));
        for (const image of originalChild.gallery) assert.ok(projected.gallery.some(item => item.src === image.src));
        for (const section of originalChild.historySections) assert.ok(projected.historySections.includes(section));
        continue;
      }
      for (const key of Object.keys(originalChild).filter(key => key !== 'id')) {
        if (originalRecord.id === 'singles-remixes' && originalChild.id === 'nc-13' && ['gallery', 'publicSources', 'listeningLinks'].includes(key)) continue;
        assert.equal(projected[key], originalChild[key], `${originalRecord.id}/${originalChild.id} retains ${key}`);
      }
      if (projectedParent === parent) assert.equal(projected.sourceArchiveHref, archiveHref(originalRecord, originalChild));
    }
  }
  for (const context of parent.contextRecords) {
    assert.equal(context, input.find(item => item.id === context.id));
  }
  const one = input.find(item => item.id === 'one-voyager-remix');
  const existingOne = originalParent.children.find(item => item.id === 'nc-13');
  const projectedOne = parent.children.find(item => item.id === 'nc-13');
  assert.equal(projectedOne.contextRecords[0], one);
  assert.equal(parent.children.some(item => item.id === one.id), false);
  assert.deepEqual(projectedOne.gallery.map(item => item.src), [...new Set([...existingOne.gallery, ...one.gallery].filter(item => item.kind === 'image').map(item => item.src))]);
  const sourceKeys = sources => sources.map(item => JSON.stringify([item.href, item.supports]));
  assert.deepEqual(sourceKeys(projectedOne.publicSources), [...new Set(sourceKeys([...existingOne.publicSources, ...one.publicSources]))]);
  assert.deepEqual(projectedOne.listeningLinks.map(item => item.videoId), [...new Set([...existingOne.listeningLinks, ...one.listeningLinks].map(item => item.videoId))]);
  const creditsCount = records => records.reduce((total, item) => total + item.children.reduce((sum, edition) => sum + edition.credits.length, 0), 0);
  const cosmic = output.find(item => item.id === 'cosmic-records-history');
  const includedCredits = cosmic.children.filter(item => item.id.startsWith('singles-remixes-')).reduce((sum, child) => sum + child.credits.length, 0);
  assert.equal(creditsCount(output), creditsCount(input) + includedCredits);
  assert.equal(cosmic.children.length, 48);
  assert.equal(cosmic.children[18].id, 'transformed');
  assert.equal(cosmic.children.at(-5).id, 'groove-me-anniversary');
  assert.equal(cosmic.children.slice(-4).every(child => child.date === 'Edition date under review'), true);

  // Archive callers retain all canonical routes, replacing only roots that received enrichment.
  const enrichedById = new Map(output.map(item => [item.id, item]));
  const archiveRecords = input.map(item => enrichedById.get(item.id) ?? item);
  assert.equal(archiveRecords.length, 18);
  assert.deepEqual(archiveRecords.map(item => archiveHref(item)), input.map(item => archiveHref(item)));
  for (const item of input.filter(item => membershipKinds.has(item.id))) assert.equal(archiveRecords.find(entry => entry.id === item.id), item);
  assert.equal(JSON.stringify(input), snapshot);
});


test('ordered cross-references reuse editions and their canonical links without moving or mutating them', () => {
  const editions = record('editions', { children: [child('first'), child('second')] });
  const anniversary = record('anniversary');
  const parent = record('parent', { children: [child('label-last'), child('transformed')], credentialsIncludes: [
    { recordId: 'editions', childId: 'second' }, { recordId: 'anniversary' },
  ] });
  const input = freeze([parent, editions, anniversary]);
  const snapshot = JSON.stringify(input);
  const output = toCredentialCollections(input);
  assert.deepEqual(output[0].children.map(item => item.id), ['label-last', 'transformed', 'editions-second', 'anniversary']);
  assert.equal(output[0].children[2].gallery, editions.children[1].gallery);
  assert.equal(output[0].children[2].sourceArchiveHref, '/archive/editions/#second');
  assert.equal(output[0].children[3].sourceArchiveHref, '/archive/anniversary/');
  assert.equal(output[1], editions);
  assert.equal(JSON.stringify(input), snapshot);
});

test('cross-references reject missing releases, missing editions, self references and duplicates', () => {
  const editions = record('editions', { children: [child('first')] });
  for (const reference of [{ recordId: 'unknown' }, { recordId: 'parent' }, { recordId: 'editions' }, { recordId: 'editions', childId: 'missing' }]) {
    assert.throws(() => toCredentialCollections([record('parent', { credentialsIncludes: [reference] }), editions]), /credential include/);
  }
  assert.throws(() => toCredentialCollections([record('parent', { credentialsIncludes: [{ recordId: 'editions', childId: 'first' }, { recordId: 'editions', childId: 'first' }] }), editions]), /duplicate credential collection child/);
});
