import fs from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AuditHold, auditSnapshot } from './publisher-audit.mjs';

const PROVIDERS = ['Cinema', 'Music', 'Media'];
const signature = s => `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function atomicJson(filename, value) {
  const temporary = `${filename}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temporary, filename);
}

export async function acquirePublisherLock(stateDirectory) {
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const filename = path.join(stateDirectory, 'publisher.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(filename, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close();
      return async () => { await fs.unlink(filename).catch(() => {}); };
    } catch (error) {
      if (error.code !== 'EEXIST' || attempt) throw new Error('Publisher is already running, or its lock needs review');
      const owner = JSON.parse(await fs.readFile(filename, 'utf8'));
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('Invalid publisher lock');
      try { process.kill(owner.pid, 0); } catch (error) {
        if (error.code !== 'ESRCH') throw new Error('Publisher is already running');
        await fs.unlink(filename); continue;
      }
      throw new Error('Publisher is already running');
    }
  }
}

export function renderPublisherReport(state, { root, publish, running = true }) {
  const rows = Object.entries(state.files).map(([key, row]) => `<tr><td>${escape(key)}</td><td class="${escape(row.status)}">${escape(row.status)}</td><td>${escape(row.message)}${row.audit ? `<br><small>${escape(row.audit.codec)} · ${Math.round(row.audit.duration)} seconds${row.audit.width ? ` · ${row.audit.width}×${row.audit.height}` : ` · ${row.audit.sampleRate} Hz · ${row.audit.channels} channels`}</small>` : ''}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="15"><title>VIAIMS Publishing</title><style>body{background:#15120f;color:#eee4d2;font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 20px}h1{color:#dfbb82}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #655237;overflow-wrap:anywhere}.published{color:#9ce0a6}.needs-attention,.retrying{color:#f0c779}small{color:#c4b79d}code{overflow-wrap:anywhere}</style><h1>VIAIMS Publishing</h1><p>${publish ? 'Automatic publication enabled' : 'Audit only — no uploads'} · ${running ? 'Last scan' : 'Stopped after scan'}: ${escape(state.scannedAt)}</p><p>Drop finished files into <b>Cinema</b>, <b>Music</b>, or <b>Media</b> inside <code>${escape(root)}</code>. Files publish after they finish copying and pass the technical audit. Originals stay in place. Removing a local file does not remove a published release.</p><p>Questions about a title or an unsupported format appear below. Rename or replace a held file to re-audit it. A same-title replacement needs review.</p>${state.error ? `<p role="alert">${escape(state.error)}</p>` : ''}<table><thead><tr><th>File</th><th>Status</th><th>Details</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Ready for your first drop.</td></tr>'}</tbody></table></html>`;
}

export async function createPublisherWatcher({ root, publish = false, publisher, auditor = auditSnapshot, settleMs = 15_000, now = Date.now }) {
  root = path.resolve(root);
  await fs.mkdir(root, { recursive: true });
  if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Drop folder must be a real directory');
  root = await fs.realpath(root);
  const stateDirectory = path.join(root, '.viaims-publisher');
  await fs.mkdir(path.join(stateDirectory, 'staging'), { recursive: true, mode: 0o700 });
  for (const provider of PROVIDERS) {
    await fs.mkdir(path.join(root, provider), { recursive: true });
    if ((await fs.lstat(path.join(root, provider))).isSymbolicLink()) throw new Error('Provider folders must not be symlinks');
  }
  let state = { version: 1, files: {} };
  try { state = JSON.parse(await fs.readFile(path.join(stateDirectory, 'state.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (state.version !== 1 || !state.files || typeof state.files !== 'object' || Array.isArray(state.files)) throw new Error('Publisher state needs review');
  let scanning = false;
  async function report(running = true) {
    state.scannedAt = new Date(now()).toISOString();
    await atomicJson(path.join(stateDirectory, 'state.json'), state);
    const temporary = path.join(root, 'Publishing Status.html.tmp');
    await fs.writeFile(temporary, renderPublisherReport(state, { root, publish, running }));
    await fs.rename(temporary, path.join(root, 'Publishing Status.html'));
  }
  async function scan() {
    if (scanning) return;
    scanning = true;
    delete state.error;
    const seen = new Set();
    try {
      for (const provider of PROVIDERS) {
        if ((await fs.lstat(path.join(root, provider))).isSymbolicLink()) throw new Error('Provider folder changed');
        const entries = await fs.readdir(path.join(root, provider), { withFileTypes: true });
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
          if (entry.name.startsWith('.') || entry.name.endsWith('.json')) continue;
          const key = `${provider}/${entry.name}`; seen.add(key);
          const source = path.join(root, provider, entry.name);
          const stat = await fs.lstat(source);
          const sourceSignature = signature(stat);
          let sidecarSignature = '';
          try { sidecarSignature = signature(await fs.lstat(`${source}.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          const sig = `${sourceSignature}:${sidecarSignature}`;
          let row = Object.hasOwn(state.files, key) ? state.files[key] : null;
          if (!row || row.signature !== sig) row = state.files[key] = { signature: sig, observedAt: now(), status: 'waiting', message: 'Waiting for copying to finish.' };
          if (!stat.isFile() || stat.isSymbolicLink()) { row.status = 'needs-attention'; row.message = 'Only regular files directly inside a player folder are supported.'; continue; }
          if (['published', 'duplicate', 'needs-attention'].includes(row.status) || (!publish && row.status === 'ready')) continue;
          if (now() - row.observedAt < settleMs || now() - stat.mtimeMs < settleMs || row.retryAt > now()) continue;
          const snapshot = path.join(stateDirectory, 'staging', createHash('sha256').update(key).digest('hex'));
          try {
            if (stat.size <= 0 || stat.size > 2 * 1024 ** 3) throw new AuditHold('FILE_SIZE', 'Files must be nonempty and no larger than 2 GiB.');
            const space = await fs.statfs(stateDirectory);
            if (Number(space.bavail) * Number(space.bsize) < stat.size + 200 * 1024 ** 2) throw new Error('Insufficient staging space');
            let title;
            try {
              const sidecar = `${source}.json`, sideStat = await fs.lstat(sidecar);
              if (!sideStat.isFile() || sideStat.isSymbolicLink() || sideStat.size > 4096) throw new AuditHold('INVALID_METADATA', 'The optional title sidecar must be a small regular JSON file.');
              const metadata = JSON.parse(await fs.readFile(sidecar, 'utf8'));
              if (!metadata || Object.keys(metadata).some(key => key !== 'title') || typeof metadata.title !== 'string') throw new Error('Invalid title');
              title = metadata.title;
            } catch (error) { if (error.code !== 'ENOENT') throw new AuditHold('INVALID_METADATA', 'Review the optional filename.ext.json title sidecar.'); }
            row.status = 'auditing'; row.message = 'Inspecting and decoding the complete file.'; await report();
            const handle = await fs.open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
            try { await pipeline(handle.createReadStream(), createWriteStream(`${snapshot}.tmp`, { mode: 0o600 })); } finally { await handle.close(); }
            if (signature(await fs.lstat(source)) !== sourceSignature) { row.observedAt = now(); row.status = 'waiting'; row.message = 'File changed while copying; waiting again.'; continue; }
            await fs.rename(`${snapshot}.tmp`, snapshot);
            const audit = await auditor(snapshot, { filename: entry.name, provider, title });
            if (signature(await fs.lstat(source)) !== sourceSignature) { row.status = 'waiting'; row.observedAt = now(); row.message = 'File changed during audit; waiting again.'; continue; }
            row.audit = audit;
            if (!publish) { row.status = 'ready'; row.message = 'Audit passed. Audit-only mode has not uploaded this file.'; continue; }
            if (typeof publisher !== 'function') throw new Error('Publisher is not configured');
            row.status = 'publishing'; row.message = 'Audit passed. Uploading and registering the release.'; await report();
            const result = await publisher({ file: { filename: entry.name, extension: path.extname(entry.name).toLowerCase(), snapshot }, audit, provider, size: stat.size });
            row.status = result.status; row.message = result.status === 'duplicate' ? 'This content is already published in this player.' : `Published as ${result.item.title}.`; row.url = result.item.src;
            delete row.retryAt; delete row.failures;
          } catch (error) {
            row.status = error instanceof AuditHold ? 'needs-attention' : 'retrying';
            row.message = error instanceof AuditHold ? error.message : 'A local or upload service is unavailable. Retrying automatically.';
            if (!(error instanceof AuditHold)) { row.failures = (row.failures ?? 0) + 1; row.retryAt = now() + Math.min(15 * 60_000, 15_000 * 2 ** Math.min(row.failures - 1, 6)); }
          } finally { await fs.unlink(snapshot).catch(() => {}); await fs.unlink(`${snapshot}.tmp`).catch(() => {}); await report(); }
        }
      }
      for (const [key, row] of Object.entries(state.files)) if (!seen.has(key) && !['published', 'duplicate'].includes(row.status)) { row.status = 'removed'; row.message = 'Removed locally; public releases are not deleted.'; }
    } catch { state.error = 'The drop folder is unavailable or changed. Check its location and folder permissions.'; }
    finally { scanning = false; await report(); }
    return structuredClone(state);
  }
  return { scan, report, stateDirectory, snapshot: () => structuredClone(state) };
}
