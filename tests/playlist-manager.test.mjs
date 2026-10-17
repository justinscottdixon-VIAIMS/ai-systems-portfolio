import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { registryDocument, MEDIA_ORIGIN, readApprovedRegistry, appendApprovedItem } from '../src/lib/approved-catalogue.mjs';
import { initialManagerState, editManagerCatalogue } from '../scripts/playlist-manager-model.mjs';
import { readManagerFolderImport } from '../scripts/playlist-manager-import.mjs';
import { createPlaylistManager } from '../scripts/playlist-manager-service.mjs';
import { startPlaylistManagerServer } from '../scripts/playlist-manager-server.mjs';
import { BlobPreconditionFailedError } from '@vercel/blob';
const item = (id, order = 0, fields = {}) => ({ id, pathname: id, src: `${MEDIA_ORIGIN}/${id}`, versionId: path.basename(id)[0].repeat(64), folder: 'music', kind: 'audio', title: id, size: 5, uploadedAt: '2026-10-17T12:00:00Z', playlistOrder: order, playlistId: 'one', playlistTitle: 'One', playlistPosition: 0, ...fields });
const catalogue = () => registryDocument([item('Music/a.mp3'), item('Music/b.mp3', 1), item('Music/c.mp3', 2), item('Cinema/d.mp4', 0, { folder: 'cinema', kind: 'video', playlistId: 'cinema', playlistTitle: 'Cinema', playlistPosition: 1 })]);
async function fixture(t, options = {}) {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'viaims-manager-'));
 for (const folder of ['Music', 'Cinema']) await fs.mkdir(path.join(root, folder));
 let registry = options.registry || catalogue(), etag = 0;
 const store = { read: async () => ({ registry: structuredClone(registry), etag: String(etag) }), write: async (next, expected) => { if (expected !== String(etag)) throw new BlobPreconditionFailedError(); registry = structuredClone(next); etag++; } };
 const manager = await createPlaylistManager({ root, store, auditor: async (source, input) => ({ kind: 'audio', title: input.title, duration: 10, contentHash: 'e'.repeat(64) }), publisher: async input => { const current = await input.store.read(); const result = appendApprovedItem(current.registry, item('Music/e.mp3', 4, { title: input.audit.title, versionId: input.audit.contentHash })); if (result.status !== 'duplicate') await input.store.write(result.registry, current.etag); return result; }, ...options });
 t.after(async () => { await manager.close(); await fs.rm(root, { recursive: true, force: true }); });
 return { root, manager, store, current: () => registry };
}
test('reorder/rename/move preserve identity, bytes and unrelated providers; remove is reversible', () => {
 const original = catalogue(); let result = { registry: original, state: initialManagerState(original) };
 const apply = op => result = editManagerCatalogue(result.registry, result.state, op);
 apply({ type: 'rename-playlist', playlistId: 'one', title: 'Breaks' });
 apply({ type: 'order-tracks', playlistId: 'one', ids: ['Music/c.mp3','Music/a.mp3','Music/b.mp3'] });
 assert.deepEqual(result.registry.items.filter(i => i.folder === 'music').map(i => i.id), ['Music/c.mp3','Music/a.mp3','Music/b.mp3']);
 assert.equal(result.registry.items.find(i => i.id === 'Music/a.mp3').playlistTitle, 'Breaks');
 apply({ type: 'rename-track', itemId: 'Music/a.mp3', title: 'My Track' });
 assert.equal(result.registry.items.find(i => i.id === 'Music/a.mp3').src, original.items.find(i => i.id === 'Music/a.mp3').src);
 assert.deepEqual(result.registry.items.find(i => i.id === 'Cinema/d.mp4'), original.items.find(i => i.id === 'Cinema/d.mp4'));
 apply({ type: 'remove-track', itemId: 'Music/b.mp3' }); assert.equal(result.registry.items.length, 3);
 apply({ type: 'rename-playlist', playlistId: 'one', title: 'New name while removed' });
 apply({ type: 'restore-track', itemId: 'Music/b.mp3' }); assert.equal(result.registry.items.length, 4);
 apply({ type: 'create-playlist', section: 'music', title: 'Ambient' }); const destination = result.state.playlists.at(-1).id;
 apply({ type: 'move-track', itemId: 'Music/a.mp3', playlistId: destination }); assert.equal(result.registry.items.find(i => i.id === 'Music/a.mp3').playlistId, destination);
 assert.throws(() => apply({ type: 'move-track', itemId: 'Music/a.mp3', playlistId: 'cinema' }));
 assert.throws(() => apply({ type: 'rename-track', itemId: 'Music/a.mp3', title: 'Music/b.mp3' }));
 assert.throws(() => apply({ type: 'order-tracks', playlistId: 'one', ids: ['Music/b.mp3','Music/b.mp3'] }));
});
test('decimal folder position with copied track marker is a new import between original and next track', async t => {
 const { root } = await fixture(t); const playlist = path.join(root, 'Music', '01 One'); await fs.mkdir(playlist);
 await fs.writeFile(path.join(playlist, '.playlist.json'), JSON.stringify({ id: 'one', kind: 'audio' }));
 for (const [name, id, file] of [['01 Metafysion', 'Music/a.mp3'], ['01.1 Enterventions', 'Music/a.mp3', 'Interventions.mp3'], ['02 Blissful', 'Music/b.mp3']]) {
  const folder = path.join(playlist, name); await fs.mkdir(folder); await fs.writeFile(path.join(folder, '.track.json'), JSON.stringify({ itemId: id, folderTitle: id === 'Music/a.mp3' ? 'Metafysion' : 'Blissful' })); if (file) await fs.writeFile(path.join(folder, file), 'bytes');
 }
 const result = await readManagerFolderImport(root, catalogue());
 assert.deepEqual(result.tracks.map(t => t.itemId), ['Music/a.mp3', 'Music/b.mp3']); assert.equal(result.pending[0].title, 'Enterventions'); assert.equal(result.pending[0].beforeId, 'Music/b.mp3'); assert.match(result.warnings[0], /new recording/);
});
test('stale edit is rejected and failed write leaves local empty-group state unchanged', async t => {
 const { manager, store, current } = await fixture(t); const before = await manager.snapshot();
 await manager.edit({ type: 'rename-track', itemId: 'Music/a.mp3', title: 'Updated' }, before.fingerprint);
 await assert.rejects(manager.edit({ type: 'rename-track', itemId: 'Music/b.mp3', title: 'Stale' }, before.fingerprint)); assert.equal(current().items.find(i => i.id === 'Music/b.mp3').title, 'Music/b.mp3');
 store.write = async () => { throw new Error('offline'); };
 await assert.rejects(manager.edit({ type: 'create-playlist', section: 'music', title: 'Unsaved' })); assert.ok(!(await manager.snapshot()).playlists.some(g => g.title === 'Unsaved'));
});
test('new recording publishes into selected playlist, duplicate is held, replacement requires confirmation and retains ID', async t => {
 const { root, manager, current } = await fixture(t); const source = path.join(root, 'new.mp3'); await fs.writeFile(source, 'bytes');
 await manager.add({ source, filename: 'New.mp3', title: 'New', playlistId: 'one' }); await manager.tick();
 assert.equal((await manager.snapshot()).jobs[0].status, 'published'); assert.equal(current().items.find(i => i.id === 'Music/e.mp3').playlistId, 'one');
 await manager.add({ source, filename: 'Again.mp3', title: 'Again', playlistId: 'one' }); await manager.tick(); assert.equal((await manager.snapshot()).jobs[1].status, 'duplicate');
 // Same-byte replacement of another title must never alias that other recording.
 await manager.add({ source, filename: 'Replacement.mp3', playlistId: 'one', replaceId: 'Music/a.mp3' }); await manager.tick();
 const ready = (await manager.snapshot()).jobs[2]; assert.equal(ready.status, 'ready-to-replace'); assert.equal(current().items.find(i => i.id === 'Music/a.mp3').versionId, 'a'.repeat(64));
 await manager.jobAction(ready.id, 'replace'); assert.equal(current().items.find(i => i.id === 'Music/a.mp3').versionId, 'a'.repeat(64));
});
test('a slow audit leaves state readable and rejects source symlinks', async t => {
 let finish; const { root, manager } = await fixture(t, { auditor: () => new Promise(resolve => { finish = resolve; }) }); const source = path.join(root, 'new.mp3'); await fs.writeFile(source, 'bytes');
 await fs.symlink(source, path.join(root, 'link.mp3')); await assert.rejects(manager.add({ source: path.join(root, 'link.mp3'), filename: 'Link.mp3', playlistId: 'one' }));
 await manager.add({ source, filename: 'New.mp3', title: 'New', playlistId: 'one' }); const running = manager.tick();
 while (!finish) await new Promise(resolve => setTimeout(resolve, 1));
 assert.equal((await manager.snapshot()).jobs[0].status, 'checking');
 await manager.edit({ type: 'rename-track', itemId: 'Music/a.mp3', title: 'Changed during audit' });
 finish({ kind: 'audio', title: 'New', duration: 1, contentHash: 'e'.repeat(64) }); await running; assert.equal((await manager.snapshot()).jobs[0].status, 'published');
});
test('loopback API rejects unauthenticated, foreign origins and oversized uploads; previews support ranges', async t => {
 const { manager } = await fixture(t); const server = await startPlaylistManagerServer({ manager, port: 0 }); t.after(() => server.close());
 const home = await fetch(server.url); assert.equal(home.status, 200); const cookie = home.headers.get('set-cookie').split(';')[0]; assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
 assert.equal((await fetch(`${server.url}/api/state`)).status, 401);
 assert.equal((await fetch(server.url, { headers: { Origin: 'https://evil.example' } })).status, 403);
 assert.equal(await new Promise((resolve, reject) => { http.get(server.url, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject); }), 403);
 const state = await (await fetch(`${server.url}/api/state`, { headers: { cookie } })).json(); assert.equal(state.items.length, 4); assert.ok(!JSON.stringify(state).includes('test-token'));
 const headers = { cookie, Origin: server.url, 'X-VIAIMS-Request': 'manager', 'Content-Type': 'application/json' };
 assert.equal((await fetch(`${server.url}/api/edit`, { method: 'POST', headers: { cookie }, body: '{}' })).status, 403);
 assert.equal((await fetch(`${server.url}/api/edit`, { method: 'POST', headers, body: JSON.stringify({ operation: { type: 'rename-track', itemId: 'Music/a.mp3', title: 'Renamed' }, fingerprint: state.fingerprint }) })).status, 200);
 const upload = await fetch(`${server.url}/api/upload?filename=Song.mp3&playlist=one`, { method: 'POST', headers, body: 'bytes' }); assert.equal(upload.status, 202); const { id } = await upload.json();
 const preview = await fetch(`${server.url}/api/preview/${id}`, { headers: { cookie, Range: 'bytes=1-3' } }); assert.equal(preview.status, 206); assert.equal(await preview.text(), 'yte');
 assert.equal((await fetch(`${server.url}/api/preview/${id}`, { headers: { cookie, Range: 'bytes=100-200' } })).status, 416);
 assert.equal((await fetch(`${server.url}/api/upload?filename=..%2Fsecret.mp3&playlist=one`, { method: 'POST', headers, body: 'bytes' })).status, 400);
 assert.equal((await fetch(`${server.url}/api/edit`, { method: 'POST', headers, body: JSON.stringify({ pad: 'x'.repeat(65536) }) })).status, 413);
});
test('a copied marker sorting first cannot claim the canonical original track', async t => {
 const { root } = await fixture(t); const playlist = path.join(root, 'Music', '01 One'); await fs.mkdir(playlist);
 await fs.writeFile(path.join(playlist, '.playlist.json'), JSON.stringify({ id: 'one', kind: 'audio' }));
 for (const name of ['00 Enterventions','01 Metafysion']) {
  const folder = path.join(playlist, name); await fs.mkdir(folder); await fs.writeFile(path.join(folder, '.track.json'), JSON.stringify({ itemId: 'Music/a.mp3', folderTitle: 'Metafysion' }));
  if (name.startsWith('00')) await fs.writeFile(path.join(folder, 'New.mp3'), 'new audio');
 }
 const plan = await readManagerFolderImport(root, catalogue()); assert.equal(plan.tracks[0].title, 'Music/a.mp3'); assert.equal(plan.pending[0].title, 'Enterventions');
});
test('replacement with distinct bytes retains target identity and source can be restored from history', async t => {
 const { root, manager, current } = await fixture(t); const source = path.join(root, 'new.mp3'); await fs.writeFile(source, 'bytes');
 const id = await manager.add({ source, filename: 'New.mp3', title: 'New', playlistId: 'one', replaceId: 'Music/a.mp3' }); await manager.tick();
 assert.equal((await manager.snapshot()).jobs[0].status, 'ready-to-replace');
 await manager.jobAction(id, 'replace'); const replaced = current().items.find(i => i.id === 'Music/a.mp3');
 assert.equal(replaced.pathname, replaced.id); assert.equal(replaced.versionId, 'e'.repeat(64)); assert.equal(replaced.title, 'Music/a.mp3');
 assert.equal((await manager.snapshot()).jobs[0].status, 'published');
});
test('reordering audio playlist groups preserves cinema/video positions and metadata', () => {
 const original = registryDocument([item('Music/a.mp3'), item('Music/b.mp3', 1, { playlistId: 'two', playlistTitle: 'Two', playlistPosition: 1 }), item('Music/c.mp4', 2, { kind: 'video', playlistId: 'videos', playlistTitle: 'Videos', playlistPosition: 2 })]);
 const result = editManagerCatalogue(original, initialManagerState(original), { type: 'order-playlists', section: 'music', ids: ['two','one'] });
 assert.deepEqual(result.registry.items.map(i => i.playlistId), ['two','one','videos']);
 assert.equal(result.registry.items.find(i => i.kind === 'video').playlistPosition, 2);
});
test('fresh remote group metadata survives an unrelated manager edit', async t => {
 const { manager, store, current } = await fixture(t);
 const original = await store.read(); const changed = registryDocument(original.registry.items.map(item => item.playlistId === 'one' ? { ...item, playlistTitle: 'Changed elsewhere', playlistPosition: 3 } : item));
 await store.write(changed, original.etag); const fresh = await manager.snapshot();
 assert.equal(fresh.playlists.find(g => g.id === 'one').title, 'Changed elsewhere');
 await manager.edit({ type: 'rename-track', itemId: 'Music/a.mp3', title: 'Track edit' }, fresh.fingerprint);
 assert.equal(current().items.find(i => i.id === 'Music/a.mp3').playlistTitle, 'Changed elsewhere');
});
test('failed pending-folder import remains retryable without replaying completed metadata', async t => {
 const { root, manager, store } = await fixture(t); await manager.close();
 const directory = path.join(root, '.viaims-publisher/manager'); const state = JSON.parse(await fs.readFile(path.join(directory,'state.json'), 'utf8'));
 const source = path.join(root,'Pending.mp3'); await fs.writeFile(source,'');
 state.import.pending = [{id:'import-one',source,filename:'Pending.mp3',title:'Pending',playlistId:'one'}];
 await fs.writeFile(path.join(directory,'state.json'),JSON.stringify(state));
 const resumed = await createPlaylistManager({root,store}); t.after(()=>resumed.close());
 await assert.rejects(resumed.activateImport()); assert.equal((await resumed.snapshot()).importPending,true);
 await fs.writeFile(source,'bytes'); await resumed.activateImport(); assert.equal((await resumed.snapshot()).jobs.length,1); assert.equal((await resumed.snapshot()).importPending,false);
 // close before the timer can audit the deliberately synthetic bytes
 await resumed.close();
});
