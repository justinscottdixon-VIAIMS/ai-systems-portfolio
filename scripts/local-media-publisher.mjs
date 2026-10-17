import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv, parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createApprovedCatalogueStore } from '../src/lib/approved-catalogue-store.mjs';
import { acquirePublisherLock, createPublisherWatcher } from './publisher-watcher.mjs';
import { publishAuditedFile } from './publisher-upload.mjs';
import { refreshLocalPlaylistLibrary } from './publisher-library.mjs';
import { createMusicFolderController, discoverMusicFolderLayout } from './music-folder-layout.mjs';
import { createPlaylistManager } from './playlist-manager-service.mjs';
import { startPlaylistManagerServer } from './playlist-manager-server.mjs';

export async function loadPublisherToken(filename) {
  if (filename) {
    const env = parseEnv(await fs.readFile(filename, 'utf8'));
    if (!env.BLOB_READ_WRITE_TOKEN) throw new Error('Existing environment file lacks the Blob token');
    // The saved OIDC session may be expired. This owner process uses only the
    // existing Blob token, never propagates other credentials to its children.
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    return env.BLOB_READ_WRITE_TOKEN;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Blob token is required for publication');
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    root: { type: 'string' }, 'env-file': { type: 'string' }, publish: { type: 'boolean', default: false }, once: { type: 'boolean', default: false },
  } });
  if (!values.root) throw new Error('Pass --root with the dedicated VIAIMS Publishing folder');
  const token = values.publish ? await loadPublisherToken(values['env-file']) : undefined;
  const store = values.publish ? createApprovedCatalogueStore({ token }) : null;
  if (store && !(await store.read())) throw new Error('Seed and verify the approved catalogue before starting automatic publication');
  const pause = new AbortController();
  const watcher = await createPublisherWatcher({ root: values.root, publish: values.publish, signal: pause.signal,
    publisher: values.publish ? input => publishAuditedFile({ ...input, store, token }) : undefined,
  });
  const release = await acquirePublisherLock(watcher.stateDirectory);
  let manager, managerServer;
  const folderControllers = store ? await Promise.all(['Music','Cinema'].map(provider => createMusicFolderController({ root: values.root, store, signal: pause.signal, provider }))) : [];
  let stop = false;
  let nextLibraryRefresh = 0;
  const halt = () => { stop = true; pause.abort(); };
  process.once('SIGTERM', halt);
  process.once('SIGINT', halt);
  try {
    let config;
    try { config = JSON.parse(await fs.readFile(path.join(watcher.stateDirectory, 'playlist-manager.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (store && config?.enabled) {
      manager = await createPlaylistManager({ root: values.root, store, token, signal: pause.signal });
      // A bundled runtime carries its static interface beside publisher.mjs.
      const bundled = new URL('./playlist-manager/', import.meta.url);
      const assets = await fs.stat(bundled).then(() => bundled).catch(() => new URL('../tools/playlist-manager/', import.meta.url));
      managerServer = await startPlaylistManagerServer({ manager, port: config.port ?? 4350, assetDirectory: assets });
      for (const provider of ['Music', 'Cinema']) await fs.writeFile(path.join(values.root, `${provider} Playlist Status.txt`), `Managed in Playlist Studio at ${managerServer.url}/\nFolder numbering is retained as a reference and no longer controls the website.\n`);
      console.log(`VIAIMS Playlist Studio available at ${managerServer.url}`);
    }
    do {
      await watcher.scan();
      for (const [index, controller] of folderControllers.entries()) {
        if (stop || manager) break;
        const provider = ['Music','Cinema'][index];
        try { await controller.reconcile(await discoverMusicFolderLayout(values.root, provider));
          await fs.writeFile(path.join(values.root, `${provider} Playlist Status.txt`), `${provider} folders checked. Stable folder order is synchronized automatically.\n`);
        } catch { console.error(`${provider} folder order could not synchronize; public releases are retained.`);
          await fs.writeFile(path.join(values.root, `${provider} Playlist Status.txt`), 'Folder order needs attention or a service is unavailable. Public releases remain available. Check duplicate folder numbers, identities, and connectivity. Retrying automatically.\n');
        }
      }
      if (store && !stop && Date.now() >= nextLibraryRefresh) {
        nextLibraryRefresh = Date.now() + 60_000;
        try { await refreshLocalPlaylistLibrary({ root: values.root, store, signal: pause.signal }); }
        catch { console.error('Local playlist reference could not refresh. Publication continues; check folder permissions.'); }
      }
      if (values.once || stop) break;
      await delay(5000, undefined, { signal: pause.signal }).catch(error => { if (error.name !== 'AbortError') throw error; });
    } while (!stop);
  } finally { process.removeListener('SIGTERM', halt); process.removeListener('SIGINT', halt); await managerServer?.close(); await manager?.close(); await watcher.report(false); await release(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('VIAIMS publisher could not start. Check its configuration, catalogue and local log.'); process.exitCode = 1; });
}
