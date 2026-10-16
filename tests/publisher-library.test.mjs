import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeLocalPlaylistLibrary, refreshLocalPlaylistLibrary, LIBRARY_DIRECTORY } from '../scripts/publisher-library.mjs';
import { registryDocument, MEDIA_ORIGIN } from '../src/lib/approved-catalogue.mjs';
import { createPublisherWatcher } from '../scripts/publisher-watcher.mjs';
const item = (extra={}) => ({id:'Music/first.mp3',pathname:'Music/first.mp3',folder:'music',kind:'audio',versionId:'a'.repeat(64),title:'First Song',src:`${MEDIA_ORIGIN}/Music/first.mp3`,size:123,uploadedAt:'2026-10-16T12:00:00.000Z',playlistOrder:0,...extra});
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'viaims-library-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
test('complete registry appears in Finder order without requiring local media copies',async t=>{
 const root=await fixture(t);const items=[item({id:'Music/last.mp3',pathname:'Music/last.mp3',title:'Last Song',versionId:'b'.repeat(64),playlistOrder:9}),item()];
 await writeLocalPlaylistLibrary({root,catalogue:{items},checkedAt:'2026-10-16T12:00:00Z'});
 const music=path.join(root,'Music',LIBRARY_DIRECTORY);const names=(await fs.readdir(music)).filter(n=>n.endsWith('.webloc')).sort();assert.match(names[0],/^01 — First Song/);assert.match(names[1],/^02 — Last Song/);
 assert.match(await fs.readFile(path.join(music,names[0]),'utf8'),new RegExp(`${MEDIA_ORIGIN}/Music/first.mp3`));assert.match(await fs.readFile(path.join(root,'Media',LIBRARY_DIRECTORY,'PLAYLIST.txt'),'utf8'),/No published items yet/);
 assert.equal(JSON.parse(await fs.readFile(path.join(root,'LIVE REGISTRY.json'))).items.length,2);
 const watcher=await createPublisherWatcher({root,settleMs:0,auditor:()=>{throw new Error('Reference folder must not be audited');}});assert.deepEqual((await watcher.scan()).files,{});
});
test('reference links escape XML and title paths cannot escape the generated folder',async t=>{
 const root=await fixture(t);await writeLocalPlaylistLibrary({root,catalogue:{items:[item({title:'../A / B & C <one>'})]}});const dir=path.join(root,'Music',LIBRARY_DIRECTORY);const name=(await fs.readdir(dir)).find(n=>n.endsWith('.webloc'));assert.equal(path.basename(name),name);assert.ok(!name.includes('/'));assert.match(await fs.readFile(path.join(dir,'PLAYLIST.txt'),'utf8'),/A \/ B & C <one>/);
});
test('reordering removes only unchanged owned links and preserves extra or edited files',async t=>{
 const root=await fixture(t);await writeLocalPlaylistLibrary({root,catalogue:{items:[item()]}});const dir=path.join(root,'Music',LIBRARY_DIRECTORY);const old=(await fs.readdir(dir)).find(n=>n.endsWith('.webloc'));await fs.writeFile(path.join(dir,'my notes.txt'),'keep');
 await writeLocalPlaylistLibrary({root,catalogue:{items:[item({title:'Corrected'})]}});await assert.rejects(fs.stat(path.join(dir,old)),{code:'ENOENT'});assert.equal(await fs.readFile(path.join(dir,'my notes.txt'),'utf8'),'keep');const edited=(await fs.readdir(dir)).find(n=>n.endsWith('.webloc'));await fs.writeFile(path.join(dir,edited),'owner edit');await writeLocalPlaylistLibrary({root,catalogue:{items:[]}});assert.equal(await fs.readFile(path.join(dir,edited),'utf8'),'owner edit');
});
test('unavailable remote registry retains last accepted local playlist with stale status',async t=>{
 const root=await fixture(t);await writeLocalPlaylistLibrary({root,catalogue:{items:[item()]},checkedAt:'2026-10-16T12:00:00Z'});const prior=await fs.readFile(path.join(root,'LIVE PLAYLISTS.txt'),'utf8');
 const result=await refreshLocalPlaylistLibrary({root,store:{read:async()=>{throw new Error('SECRET=private');}},checkedAt:'2026-10-16T12:01:00Z'});assert.equal(result,null);assert.equal(await fs.readFile(path.join(root,'LIVE PLAYLISTS.txt'),'utf8'),prior);const status=await fs.readFile(path.join(root,'LIVE PLAYLISTS STATUS.txt'),'utf8');assert.match(status,/REFRESH UNAVAILABLE/);assert.ok(!status.includes('SECRET'));
});
test('invalid registry is rejected before writing local playlist files',async t=>{
 const root=await fixture(t);await assert.rejects(writeLocalPlaylistLibrary({root,catalogue:{items:[item({src:'https://elsewhere.example/file.mp3'})]}}));await assert.rejects(fs.stat(path.join(root,'LIVE REGISTRY.json')),{code:'ENOENT'});
});
test('existing unowned reference directory is preserved',async t=>{
 const root=await fixture(t);const dir=path.join(root,'Music',LIBRARY_DIRECTORY);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'notes.txt'),'keep');await assert.rejects(writeLocalPlaylistLibrary({root,catalogue:{items:[item()]}}),/needs review/);assert.equal(await fs.readFile(path.join(dir,'notes.txt'),'utf8'),'keep');
});
test('sync obtains only an initialized approved registry',async t=>{
 const root=await fixture(t);await fs.mkdir(path.join(root,'.viaims-publisher'),{recursive:true});const result=await refreshLocalPlaylistLibrary({root,store:{read:async()=>({registry:registryDocument([item()])})}});assert.equal(result.count,1);
});
test('an active edited shortcut survives refresh and is flagged instead of overwritten',async t=>{
 const root=await fixture(t);const catalogue={items:[item()]};await writeLocalPlaylistLibrary({root,catalogue});const dir=path.join(root,'Music',LIBRARY_DIRECTORY);const name=(await fs.readdir(dir)).find(n=>n.endsWith('.webloc'));await fs.writeFile(path.join(dir,name),'owner edit');
 const result=await writeLocalPlaylistLibrary({root,catalogue});assert.equal(await fs.readFile(path.join(dir,name),'utf8'),'owner edit');assert.equal(result.conflicts.length,1);assert.match(await fs.readFile(path.join(root,'LIVE PLAYLISTS STATUS.txt'),'utf8'),/NEED REVIEW/);
});
test('unrelated file colliding with a future reference is preserved',async t=>{
 const root=await fixture(t);await writeLocalPlaylistLibrary({root,catalogue:{items:[item()]}});const dir=path.join(root,'Music',LIBRARY_DIRECTORY);const names=(await fs.readdir(dir)).filter(n=>n.endsWith('.webloc'));const future=names[0].replace('First Song','Another Song');await fs.writeFile(path.join(dir,future),'unrelated content');
 const result=await writeLocalPlaylistLibrary({root,catalogue:{items:[item({title:'Another Song'})]}});assert.equal(await fs.readFile(path.join(dir,future),'utf8'),'unrelated content');assert.equal(result.conflicts.length,1);
});
