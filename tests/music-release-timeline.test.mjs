import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { musicReleaseGroups, releaseDateParts, consolidateMusicReleases } from '../src/lib/music-release-timeline.mjs';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { toCredentialCollections } from '../src/lib/credential-collections.mjs';

test('timeline compares real calendar dates and does not invent dates for partial or unresolved evidence', () => {
  const releases = [
    {id:'unknown',date:'Release date unresolved'}, {id:'year',date:'2000 — source report'},
    {id:'oct',date:'9 October 2000 — database'}, {id:'apr',date:'7 April 2000 — database'},
    {id:'month',date:'April 2000'}, {id:'prior',date:'July 11, 1999'},
  ];
  const snapshot = JSON.stringify(releases);
  const groups = musicReleaseGroups(releases);
  assert.deepEqual(groups.map(g=>g.title),['1999','2000','Release dates to confirm']);
  assert.deepEqual(groups.flatMap(g=>g.children.map(c=>c.id)),['prior','apr','month','oct','year','unknown']);
  assert.equal(releaseDateParts(releases[0]),null);
  assert.deepEqual(releaseDateParts(releases[1]),{year:2000,month:13,day:32});
  assert.equal(JSON.stringify(releases),snapshot);
});

test('Tranceport combines album and sampler contributions, sources and history in one chronological card', async () => {
  const input = toPortfolioRecords(JSON.parse(await readFile(new URL('../src/data/portfolio-records.json',import.meta.url),'utf8')));
  const snapshot = JSON.stringify(input);
  const dossier = toCredentialCollections(input).find(r=>r.id==='singles-remixes');
  const cards = dossier.children.filter(c=>/tranceport/i.test(c.title));
  assert.equal(cards.length,1);
  const card=cards[0];
  assert.equal(card.title,'Tranceport.3');
  assert.match(card.date,/6 June 2000/);
  assert.ok(card.roles.includes('Engineer'));
  assert.ok(card.credits.some(c=>c.title==='Motion'&&c.scope==='Track 9'));
  assert.ok(card.credits.some(c=>c.title==='Motion (Stereo Edit)'&&c.scope==='A1'));
  assert.ok(card.credits.some(c=>c.scope==='Album-level studio engineering'));
  assert.match(card.catalogNumber,/54648-2/);
  assert.match(card.catalogNumber,/0-54648 P/);
  assert.ok(card.historySections.some(s=>s.title==='The club, remembered in the studio'));
  assert.ok(card.historySections.some(s=>s.title==='Related editions'));
  assert.ok(card.publicSources.some(s=>s.href.includes('femmusic.com')));
  assert.deepEqual(card.aliasIds,['nc-09']);
  // Motion's original single and its appearance on another compilation remain different releases.
  assert.ok(dossier.children.some(c=>c.id==='nc-12'));
  assert.ok(dossier.children.some(c=>c.title==='Renaissance: Awakening'));
  const years=dossier.children.map(c=>releaseDateParts(c)?.year??Infinity);
  assert.deepEqual(years,[...years].sort((a,b)=>a-b));
  assert.equal(JSON.stringify(input),snapshot);
});

test('a partial catalogue retains a sampler when its album is absent', () => {
  const sampler = {id:'nc-09', date:'2000', title:'Music from Tranceport 3'};
  assert.deepEqual(consolidateMusicReleases([sampler]),[sampler]);
});
