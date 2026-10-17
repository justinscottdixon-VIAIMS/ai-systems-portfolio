import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { registryDocument, readApprovedRegistry } from '../src/lib/approved-catalogue.mjs';
import { auditSnapshot, MEDIA_EXTENSIONS, AuditHold } from './publisher-audit.mjs';
import { publishAuditedFile } from './publisher-upload.mjs';
import { initialManagerState, editManagerCatalogue, placeManagerItem, managerTitle } from './playlist-manager-model.mjs';
import { readManagerFolderImport } from './playlist-manager-import.mjs';
const inputError = message => Object.assign(new Error(message), { code: 'MANAGER_INPUT' });

async function atomicJson(filename, value) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temp, filename);
}
export async function createPlaylistManager({ root, store, token, signal, auditor = auditSnapshot, publisher = publishAuditedFile }) {
  root = await fs.realpath(root);
  const directory = path.join(root, '.viaims-publisher', 'manager');
  await fs.mkdir(path.join(directory, 'files'), { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(directory, 'history'), { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'state.json');
  let state, tail = Promise.resolve(), closed = false, working;
  const serial = work => { const result = tail.then(work); tail = result.catch(() => {}); return result; };
  const save = () => atomicJson(filename, state);
  function syncGroups(registry, current) {
    for (const group of initialManagerState(registry).playlists) {
      const index = current.playlists.findIndex(g => g.id === group.id);
      if (index < 0) current.playlists.push(group);
      else current.playlists[index] = group;
    }
    return current;
  }
  async function read() { const value = await store.read({ signal }); if (!value) throw inputError('The live playlist is temporarily unavailable. Your saved media is safe.'); return value; }
  const first = await read();
  try { state = JSON.parse(await fs.readFile(filename, 'utf8')); if (state.version !== 1 || !Array.isArray(state.playlists) || !Array.isArray(state.jobs) || !Array.isArray(state.removed)) throw inputError('Manager state needs recovery.'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const imported = await readManagerFolderImport(root, first.registry);
    state = initialManagerState(first.registry, imported.groups);
    state.import = imported;
    await save();
  }
  for (const job of state.jobs) if (['checking', 'publishing'].includes(job.status)) { job.status = 'queued'; job.message = 'Resuming interrupted inspection.'; }
  async function commit(transform, fingerprint) {
    for (let attempt = 0; attempt < 4; attempt++) {
      signal?.throwIfAborted();
      const snapshot = await read();
      if (fingerprint && fingerprint !== readApprovedRegistry(snapshot.registry).fingerprint) throw inputError('The live playlist changed. Refresh and try that edit again.');
      const next = transform(snapshot.registry, syncGroups(snapshot.registry, structuredClone(state)));
      await atomicJson(path.join(directory, 'history', `${Date.now()}-${randomUUID()}.json`), { registry: snapshot.registry, state });
      try {
        await store.write(next.registry, snapshot.etag, { signal });
        state = next.state; await save(); return;
      } catch (error) { if (!(error instanceof BlobPreconditionFailedError) || attempt === 3 || fingerprint) throw error; }
    }
  }
  async function activateImport() {
    return serial(async () => {
      if (!state.import) return;
      const plan = state.import;
      if (!plan.applied) await commit((registry, current) => {
        for (const group of plan.groups) {
          const index = current.playlists.findIndex(g => g.id === group.id);
          if (index < 0) current.playlists.push(group); else current.playlists[index] = group;
        }
        let result = { registry, state: current };
        for (const track of plan.tracks) {
          if (!registry.items.some(i => i.id === track.itemId)) continue;
          result = editManagerCatalogue(result.registry, result.state, { type: 'rename-track', itemId: track.itemId, title: track.title });
          result = editManagerCatalogue(result.registry, result.state, { type: 'move-track', itemId: track.itemId, playlistId: track.playlistId });
        }
        for (const group of current.playlists) {
          const ids = plan.tracks.filter(t => t.playlistId === group.id && result.registry.items.some(i => i.id === t.itemId)).map(t => t.itemId);
          const remaining = result.registry.items.filter(i => i.playlistId === group.id && !ids.includes(i.id)).map(i => i.id);
          result = editManagerCatalogue(result.registry, result.state, { type: 'order-tracks', playlistId: group.id, ids: [...ids, ...remaining] });
        }
        result.state.import.applied = true;
        result.state.importWarnings = plan.warnings;
        return result;
      });
      for (const pending of plan.pending) if (!state.jobs.some(j => j.importKey === pending.id)) await enqueue({ ...pending, imported: true });
      delete state.import; await save();
    });
  }
  async function enqueue(input) {
    const group = state.playlists.find(g => g.id === input.playlistId);
    if (!group) throw inputError('Choose a playlist first.');
    const name = input.filename;
    if (typeof name !== 'string' || path.basename(name) !== name || /[\\\x00-\x1f]/.test(name) || !MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase())) throw inputError('Choose a supported audio or video file.');
    if (state.jobs.filter(j => !['published', 'duplicate', 'dismissed'].includes(j.status)).length >= 100) throw inputError('Finish the pending imports before adding more files.');
    const source = await fs.realpath(input.source), stat = await fs.lstat(input.source);
    if (stat.isSymbolicLink() || !stat.isFile() || !source.startsWith(root + path.sep) || stat.size <= 0 || stat.size > 2 * 1024 ** 3) throw inputError('Choose a completed media file inside the publishing storage.');
    const id = randomUUID(), snapshot = path.join(directory, 'files', `${id}${path.extname(name).toLowerCase()}`);
    await fs.copyFile(source, snapshot, fs.constants.COPYFILE_EXCL);
    const after = await fs.stat(source);
    if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) { await fs.rm(snapshot, { force: true }); throw inputError('The file is still changing. Wait for the export to finish.'); }
    const job = { id, ...(input.imported ? { importKey: input.id } : {}), playlistId: group.id, title: managerTitle(input.title || path.basename(name, path.extname(name)).replaceAll('_', ' '), 250), filename: name, source: snapshot, size: stat.size, provider: group.provider === 'cinema' ? 'Cinema' : 'Music', kind: group.kind, status: 'queued', message: 'Waiting for inspection.', createdAt: new Date().toISOString(), ...(input.beforeId ? { beforeId: input.beforeId } : {}), ...(input.replaceId ? { replaceId: input.replaceId } : {}) };
    if (job.replaceId) {
      const existing = (await read()).registry.items.find(i => i.id === job.replaceId && i.folder === group.provider && i.kind === group.kind);
      if (!existing) throw inputError('The recording to replace is no longer available.');
      job.expectedVersion = existing.versionId;
    }
    state.jobs.push(job); await save(); return job.id;
  }
  async function publishJob(job) {
    job.status = 'publishing'; job.message = 'Uploading and verifying the live playlist.'; await save();
    let last;
    const wrapped = {
      async read() {
        last = await read();
        if (!job.replaceId) return last;
        const target = last.registry.items.find(i => i.id === job.replaceId);
        if (!target || target.versionId !== job.expectedVersion) throw inputError('The recording changed since inspection. Review a fresh replacement.');
        return { ...last, registry: registryDocument(last.registry.items.filter(i => i.id !== job.replaceId)) };
      },
      async write(next, etag) {
        let item = next.items.find(i => i.folder === job.provider.toLowerCase() && i.versionId === job.audit.contentHash);
        if (!item) throw inputError('The upload did not produce a complete recording.');
        let registry = next;
        syncGroups(last.registry, state);
        if (job.replaceId) {
          const prior = last.registry.items.find(i => i.id === job.replaceId);
          item = { ...item, id: prior.id, pathname: prior.pathname, title: prior.title, playlistId: prior.playlistId, playlistTitle: prior.playlistTitle, playlistPosition: prior.playlistPosition, playlistOrder: prior.playlistOrder };
          registry = registryDocument(last.registry.items.map(i => i.id === prior.id ? item : i));
        } else registry = placeManagerItem(next, state, item.id, job.playlistId, job.beforeId).registry;
        await atomicJson(path.join(directory, 'history', `${Date.now()}-${randomUUID()}.json`), { registry: last.registry, state });
        return store.write(registry, etag, { signal });
      },
    };
    const result = await publisher({ file: { snapshot: job.source, filename: job.filename, extension: path.extname(job.filename).toLowerCase() }, audit: job.audit, provider: job.provider, size: job.size, store: wrapped, token, signal });
    job.status = result.status; job.itemId = job.replaceId || result.item.id;
    job.message = result.status === 'duplicate' ? `Already published as ${result.item.title}. No duplicate was added.` : job.replaceId ? 'Replacement is live. The previous file is preserved.' : 'Published and verified. The website will refresh automatically.';
    await save();
  }
  const failureMessage = error => error.code === 'AUDIT_UNAVAILABLE' ? 'Inspection tools are unavailable. Retry after they are restored.' : error instanceof AuditHold || ['MANAGER_INPUT', 'PLAYLIST_KIND'].includes(error.code) ? error.message : 'Import needs review. Check connectivity and retry; existing recordings are safe.';
  async function runJob() {
    let job = await serial(async () => {
      if (closed || signal?.aborted) return;
      const next = state.jobs.find(j => j.status === 'queued');
      if (next) { next.status = 'checking'; next.message = 'Checking format and decoding the entire recording.'; await save(); }
      return next;
    });
    if (!job) return;
    try {
      // Full decoding must not lock the interface while a long video is inspected.
      const audit = await auditor(job.source, { filename: job.filename, provider: job.provider, title: job.title, signal });
      await serial(async () => {
        job = state.jobs.find(row => row.id === job.id);
        if (!job) return;
        if (audit.kind !== job.kind) { const error = new Error(`This playlist accepts ${job.kind === 'audio' ? 'audio' : 'video'} files.`); error.code = 'PLAYLIST_KIND'; throw error; }
        job.audit = audit;
        if (job.replaceId) { job.status = 'ready-to-replace'; job.message = 'Inspection passed. Preview this version, then confirm replacement.'; await save(); }
        else await publishJob(job);
      });
    } catch (error) {
      await serial(async () => {
        job = state.jobs.find(row => row.id === job.id);
        if (!job) return;
        job.status = signal?.aborted ? 'queued' : 'needs-review';
        job.message = signal?.aborted ? 'Paused. Will resume when the manager restarts.' : failureMessage(error);
        await save();
      });
    }
  }
  function tick() {
    if (working) return working;
    working = runJob().finally(() => { working = undefined; });
    return working;
  }
  const timer = setInterval(() => { void tick().catch(() => {}); }, 1500);
  timer.unref?.();
  return {
    directory, root, activateImport,
    snapshot: () => serial(async () => {
      const snapshot = await read();
      const envelope = readApprovedRegistry(snapshot.registry);
      // Include releases added independently by the legacy flat-file watcher.
      syncGroups(snapshot.registry, state);
      await save();
      return { fingerprint: envelope.fingerprint, playlists: state.playlists, items: envelope.items, jobs: state.jobs.filter(j => j.status !== 'dismissed').map(({ source, expectedVersion, audit, ...job }) => ({ ...job, duration: audit?.duration, preview: `/api/preview/${job.id}` })), removed: state.removed.map(r => ({ id: r.item.id, title: r.item.title })), importPending: Boolean(state.import), warnings: state.importWarnings ?? state.import?.warnings ?? [], checkedAt: new Date().toISOString() };
    }),
    edit: (operation, fingerprint) => serial(() => commit((registry, current) => editManagerCatalogue(registry, current, operation), fingerprint)),
    add: input => serial(() => enqueue(input)),
    jobAction: (id, action) => serial(async () => {
      const job = state.jobs.find(j => j.id === id); if (!job) throw inputError('Import no longer exists.');
      if (action === 'replace' && job.status === 'ready-to-replace') { try { await publishJob(job); } catch (error) { job.status = 'needs-review'; job.message = failureMessage(error); await save(); throw error; } }
      else if (action === 'retry' && job.status === 'needs-review') { job.status = 'queued'; job.message = 'Waiting for another inspection.'; await save(); }
      else if (action === 'dismiss' && ['needs-review', 'duplicate', 'published', 'ready-to-replace'].includes(job.status)) { job.status = 'dismissed'; await save(); }
      else throw inputError('This import is not ready for that action.');
    }),
    preview: id => { const job = state.jobs.find(j => j.id === id); if (!job) throw inputError('Recording not found.'); return { filename: job.source, kind: job.kind }; },
    close: async () => { if (closed) return; closed = true; clearInterval(timer); await working; await tail; await save(); },
    tick,
  };
}
