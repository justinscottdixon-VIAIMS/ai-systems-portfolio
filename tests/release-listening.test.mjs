import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeListeningLinks, mergeListeningLinks, listeningHref } from '../src/lib/release-listening.mjs';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { toCredentialCollections } from '../src/lib/credential-collections.mjs';
import { consolidateMusicReleases } from '../src/lib/music-release-timeline.mjs';
const source = JSON.parse(await readFile(new URL('../src/data/portfolio-records.json', import.meta.url)));
const records = toPortfolioRecords(source);
const collections = toCredentialCollections(records);
const example = {videoId: 'PGkhm-Fb018', label: 'Future Funk', title: 'DJs Friction & Spice - Future Funk', channel: 'Justin Scott Dixon | VIAIMS', checkedOn: '2026-10-16'};

test('only validated YouTube IDs produce outgoing listening URLs', () => {
  assert.equal(listeningHref(normalizeListeningLinks([example])[0]), 'https://www.youtube.com/watch?v=PGkhm-Fb018');
  for (const videoId of ['https://other.example', 'PGkhm-Fb018&t=0', '../redirect', '']) {
    assert.throws(() => normalizeListeningLinks([{...example, videoId}]), /video ID/);
  }
  assert.throws(() => normalizeListeningLinks([{...example, channel: ''}]), /channel/);
  assert.throws(() => normalizeListeningLinks({}), /array/);
});

test('merged release contexts retain videos once without losing alternate recordings', () => {
  const extra = {...example, videoId: 'XYgdf_W2-Zw', label: 'Time Travel Part 2'};
  assert.deepEqual(mergeListeningLinks([example], [example, extra]).map(v => v.videoId), ['PGkhm-Fb018', 'XYgdf_W2-Zw']);
  const music = collections.find(r => r.id === 'singles-remixes');
  const one = music.children.find(c => c.id === 'nc-13');
  assert.equal(one.listeningLinks.filter(v => v.videoId === 'HgtTaza67I8').length, 1);
  assert.ok(one.listeningLinks.some(v => v.videoId === 'JQ-8bXfl9Jk'));
  const transport = music.children.filter(c => /Tranceport/.test(c.title));
  assert.equal(transport.length, 1);
  assert.ok(transport[0].listeningLinks.some(v => v.videoId === 'BqGV4RpaoMc'));
  const aliasMerge = consolidateMusicReleases([{...transport[0], listeningLinks: []}, {...transport[0], id: 'nc-09', listeningLinks: [example]}]);
  assert.equal(aliasMerge[0].listeningLinks[0].videoId, example.videoId);
});

test('distinct SCI mixes and album discs stay attached to the correct title', () => {
  const music = collections.find(r => r.id === 'singles-remixes');
  const ep = music.children.find(c => c.id === 'the-interactions-ep');
  assert.deepEqual(ep.listeningLinks.map(v => v.videoId), ['mkvNWHINpL0', '3HniKw19NOk', 'YtHIcguZdEE', '3FAUe8Ywomo']);
  assert.match(ep.listeningLinks[1].note, /excerpt/);
  const perfecto = music.children.find(c => c.id === 'compilation-appearances-d016');
  assert.ok(perfecto.listeningLinks.some(v => /CD 1/.test(v.label)));
  assert.ok(perfecto.listeningLinks.some(v => /CD 2/.test(v.label)));
  assert.equal(music.children.filter(c => /Perfecto Presents/.test(c.title)).length, 1);
});

test('all card links have evidence metadata, with unrelated Gemini results excluded', () => {
  const all = records.flatMap(r => [r, ...r.children]).flatMap(r => r.listeningLinks);
  assert.ok(all.length > 100);
  const ids = new Set(all.map(v => v.videoId));
  for (const wrong of ['au2n7VVGv_c', 'ky6vtN0jja0', 'uweD9hxE6gk', 'N-KPYMtyrW0', 'gXQrci3Wff8']) assert.ok(!ids.has(wrong));
  for (const r of records.flatMap(r => [r, ...r.children])) assert.equal(new Set(r.listeningLinks.map(v => v.videoId)).size, r.listeningLinks.length);
});
