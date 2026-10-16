import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedCatalogue, registryDocument, readApprovedRegistry, appendApprovedItem, MEDIA_ORIGIN } from '../src/lib/approved-catalogue.mjs';
import { createApprovedCatalogueStore } from '../src/lib/approved-catalogue-store.mjs';
import { createApprovedMediaCatalogueHandler } from '../src/lib/approved-catalogue-handler.mjs';

export const row = (extra = {}) => ({ id: 'Cinema/one.mp4', pathname: 'Cinema/one.mp4', versionId: 'a'.repeat(64), folder: 'cinema', kind: 'video', title: 'One', src: `${MEDIA_ORIGIN}/portfolio-preview/one.mp4`, size: 123, uploadedAt: '2026-10-16T12:00:00.000Z', playlistOrder: 0, ...extra });

test('initialized catalogue preserves existing released URLs and titles even with no new drops', () => {
  const registry = registryDocument([row()]);
  assert.deepEqual(readApprovedRegistry(registry).items, [row()]);
  assert.throws(() => readApprovedRegistry({ version: 1, items: [] }));
  assert.equal(readApprovedRegistry(registryDocument([])).items.length, 0);
});
test('catalogue rejects secrets, other stores, malformed identities and invalid hashes', () => {
  for (const bad of [{ token: 'secret' }, { src: 'https://elsewhere.example/file.mp4' }, { id: 'elsewhere' }, { pathname: 'Music/one.mp4' }, { versionId: 'bad' }, { size: 0 }, { title: 'line\nbreak' }, { playlistOrder: -1 }]) assert.throws(() => approvedCatalogue([row(bad)]));
});
test('fingerprints are deterministic and change when approved metadata changes', () => {
  const a = row(), b = row({ id: 'Cinema/two.mp4', pathname: 'Cinema/two.mp4', versionId: 'b'.repeat(64), title: 'Two', playlistOrder: 1 });
  assert.equal(approvedCatalogue([a, b]).fingerprint, approvedCatalogue([b, a]).fingerprint);
  assert.notEqual(approvedCatalogue([a]).fingerprint, approvedCatalogue([row({ title: 'Corrected' })]).fingerprint);
});
test('append deduplicates content within a player, holds title collisions and preserves ordering', () => {
  const base = registryDocument([row({ playlistOrder: 8 })]);
  assert.equal(appendApprovedItem(base, row({ title: 'Renamed copy' })).status, 'duplicate');
  assert.throws(() => appendApprovedItem(base, row({ versionId: 'b'.repeat(64), id: 'Cinema/new.mp4', pathname: 'Cinema/new.mp4' })), { code: 'TITLE_CONFLICT' });
  const result = appendApprovedItem(base, row({ versionId: 'b'.repeat(64), id: 'Cinema/new.mp4', pathname: 'Cinema/new.mp4', title: 'New' }));
  assert.equal(result.item.playlistOrder, 9); assert.equal(result.registry.items[0].title, 'One');
});
test('registry store verifies current metadata and passes the prior ETag on updates', async () => {
  let readOptions, readUrl, writeOptions;
  const registry = registryDocument([row()]);
  const store = createApprovedCatalogueStore({ metadata: async () => ({ url: `${MEDIA_ORIGIN}/VIAIMS/approved-catalogue.json`, etag: 'v1', size: 1000 }), reader: async (url, options) => {
    readUrl = url; readOptions = options;
    return { statusCode: 200, blob: { size: 1000, etag: 'v1' }, stream: new Response(JSON.stringify(registry)).body };
  }, writer: async (_, body, options) => { writeOptions = options; assert.deepEqual(JSON.parse(body), registry); } });
  const result = await store.read(); await store.write(result.registry, result.etag);
  assert.equal(new URL(readUrl).searchParams.get('viaimsVersion'), 'v1'); assert.equal(readOptions.headers['Cache-Control'], 'no-cache'); assert.equal(writeOptions.ifMatch, 'v1'); assert.equal(writeOptions.allowOverwrite, true);
});
test('registry store refuses oversized and uninitialized responses', async () => {
  const store = createApprovedCatalogueStore({ metadata: async () => ({ url: `${MEDIA_ORIGIN}/VIAIMS/approved-catalogue.json`, etag: 'v1', size: 2_000_001 }), reader: async () => { throw new Error('Must not read oversized content'); } });
  await assert.rejects(store.read());
});
test('endpoint fails closed on missing registry and never logs upstream secrets', async () => {
  const messages = [], response = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n;return this; }, json(body) { this.body=body; } };
  const handler = createApprovedMediaCatalogueHandler({ store: { read: async () => { throw new Error('TOKEN=private'); } }, logger: { error: text => messages.push(text) } });
  await handler({ method: 'GET' }, response);
  assert.equal(response.code, 503); assert.equal(response.headers['Cache-Control'], 'no-store'); assert.equal(JSON.stringify(messages).includes('private'), false);
});
test('endpoint returns a complete validated snapshot and rejects writes', async () => {
  const response = { setHeader() {}, status(n) { this.code=n;return this; }, json(body) { this.body=body; } };
  const handler = createApprovedMediaCatalogueHandler({ store: { read: async () => ({ registry: registryDocument([row()]) }) } });
  await handler({ method: 'GET' }, response); assert.equal(response.code, 200); assert.equal(response.body.items.length, 1);
  await handler({ method: 'POST' }, response); assert.equal(response.code, 405);
});
test('stale public CDN content is rejected against authoritative metadata',async()=>{
 let cancelled=false;
 const store=createApprovedCatalogueStore({metadata:async()=>({url:`${MEDIA_ORIGIN}/VIAIMS/approved-catalogue.json`,etag:'latest',size:123}),reader:async()=>({statusCode:200,blob:{size:123,etag:'old'},stream:new ReadableStream({cancel(){cancelled=true;}})})});
 await assert.rejects(store.read(),/version changed/); assert.equal(cancelled,true);
});
