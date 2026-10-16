import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPublisherWatcher, acquirePublisherLock, renderPublisherReport } from '../scripts/publisher-watcher.mjs';
import { AuditHold } from '../scripts/publisher-audit.mjs';

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'viaims-publisher-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let clock = Date.now();
  const calls = [];
  const auditor = async (_, args) => ({ kind: 'video', title: args.title ?? 'Finished', duration: 3, codec: 'h264', contentHash: 'a'.repeat(64) });
  const publisher = async input => { calls.push(input); return { status: 'published', item: { title: input.audit.title, src: 'https://example.test/finished.mp4' } }; };
  const watcher = await createPublisherWatcher({ root, publish: true, now: () => clock, auditor, publisher, ...options });
  const source = path.join(root, 'Cinema', 'Finished.mp4'); await fs.writeFile(source, 'media bytes');
  return { root, source, watcher, calls, advance: n => { clock += n; } };
}
test('stable file publishes once and restart does not publish it again', async t => {
  const f = await fixture(t); await f.watcher.scan(); assert.equal(f.calls.length, 0);
  f.advance(20_000); await f.watcher.scan(); assert.equal(f.calls.length, 1);
  await f.watcher.scan(); assert.equal(f.calls.length, 1);
  const restarted = await createPublisherWatcher({ root: f.root, publish: true, publisher: () => { throw new Error('must not republish'); } });
  const result = await restarted.scan(); assert.equal(result.files['Cinema/Finished.mp4'].status, 'published');
  assert.equal(await fs.readFile(f.source, 'utf8'), 'media bytes');
});
test('changing source during audit is not uploaded', async t => {
  let source;
  const f = await fixture(t, { auditor: async () => { await fs.appendFile(source, 'changed'); return { title: 'Finished' }; } }); source = f.source;
  await f.watcher.scan(); f.advance(20_000); const state = await f.watcher.scan();
  assert.equal(f.calls.length, 0); assert.equal(state.files['Cinema/Finished.mp4'].status, 'waiting');
});
test('unsupported or corrupt media is held with original intact', async t => {
  const f = await fixture(t, { auditor: async () => { throw new AuditHold('DECODE_FAILED', 'File needs review.'); } });
  await f.watcher.scan(); f.advance(20_000); const state = await f.watcher.scan();
  assert.equal(state.files['Cinema/Finished.mp4'].status, 'needs-attention'); assert.equal(f.calls.length, 0); assert.ok(await fs.stat(f.source));
});
test('transient upload failures back off and do not expose service secrets', async t => {
  let attempts = 0;
  const f = await fixture(t, { publisher: async () => { attempts++; throw new Error('TOKEN=secret'); } });
  await f.watcher.scan(); f.advance(20_000); await f.watcher.scan(); await f.watcher.scan(); assert.equal(attempts, 1);
  assert.equal(JSON.stringify(f.watcher.snapshot()).includes('secret'), false);
  f.advance(16_000); await f.watcher.scan(); assert.equal(attempts, 2);
});
test('editing title sidecar re-audits a held file', async t => {
  const f = await fixture(t, { auditor: async (_, args) => { if (!args.title) throw new AuditHold('TITLE_CONFLICT', 'Choose a title.'); return { kind: 'video', title: args.title, duration: 3 }; } });
  await f.watcher.scan(); f.advance(20_000); await f.watcher.scan();
  await fs.writeFile(`${f.source}.json`, JSON.stringify({ title: 'New title' })); await f.watcher.scan(); f.advance(20_000); await f.watcher.scan();
  assert.equal(f.calls[0].audit.title, 'New title');
});
test('audit-only mode never uploads and symlinks are held', async t => {
  const f = await fixture(t, { publish: false });
  await fs.symlink(f.source, path.join(f.root, 'Media', 'Linked.mp4'));
  await f.watcher.scan(); f.advance(20_000); const state = await f.watcher.scan();
  assert.equal(f.calls.length, 0); assert.equal(state.files['Cinema/Finished.mp4'].status, 'ready');
  assert.equal(state.files['Media/Linked.mp4'].status, 'needs-attention');
});
test('local deletion preserves published status and never requests remote deletion', async t => {
  const f = await fixture(t); await f.watcher.scan(); f.advance(20_000); await f.watcher.scan();
  await fs.unlink(f.source); const state = await f.watcher.scan(); assert.equal(state.files['Cinema/Finished.mp4'].status, 'published'); assert.equal(f.calls.length, 1);
});
test('exclusive process lock prevents concurrent publishers', async t => {
  const f = await fixture(t); const release = await acquirePublisherLock(f.watcher.stateDirectory);
  await assert.rejects(acquirePublisherLock(f.watcher.stateDirectory)); await release();
  const next = await acquirePublisherLock(f.watcher.stateDirectory); await next();
});
test('owner report renders filenames and audit messages as text', () => {
  const html = renderPublisherReport({ scannedAt: 'now', files: { '<script>': { status: 'needs-attention', message: '<img onerror=bad>' } } }, { root: '/local', publish: true });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror')); assert.ok(html.includes('&lt;script&gt;'));
});
test('title sidecar changes during audit wait instead of publishing old metadata', async t => {
  let source;
  const f = await fixture(t, { auditor: async () => { await fs.writeFile(`${source}.json`, JSON.stringify({title:'Corrected'})); return {title:'Old'}; } }); source=f.source;
  await f.watcher.scan(); f.advance(20_000); const state=await f.watcher.scan();
  assert.equal(f.calls.length,0); assert.equal(state.files['Cinema/Finished.mp4'].status,'waiting');
});
test('stop during audit prevents publication and processing later files', async t => {
  const controller=new AbortController(); let audits=0;
  const f=await fixture(t,{signal:controller.signal,auditor:async(_,options)=>{assert.equal(options.signal,controller.signal);audits++;controller.abort();return {title:'Finished'};}});
  await fs.writeFile(path.join(f.root,'Cinema','Second.mp4'),'other');
  await f.watcher.scan();f.advance(20_000);await f.watcher.scan();
  assert.equal(f.calls.length,0);assert.equal(audits,1);assert.equal(f.watcher.snapshot().files['Cinema/Finished.mp4'].status,'waiting');
});
test('future dated exports settle by observed stability', async t=>{
  const f=await fixture(t);const future=new Date(Date.now()+86400000);await fs.utimes(f.source,future,future);
  await f.watcher.scan();f.advance(20_000);await f.watcher.scan();assert.equal(f.calls.length,1);
});
