import fs from 'node:fs/promises';
import { parseEnv, parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createApprovedCatalogueStore } from '../src/lib/approved-catalogue-store.mjs';
import { acquirePublisherLock, createPublisherWatcher } from './publisher-watcher.mjs';
import { publishAuditedFile } from './publisher-upload.mjs';

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
  let stop = false;
  const halt = () => { stop = true; pause.abort(); };
  process.once('SIGTERM', halt);
  process.once('SIGINT', halt);
  try {
    do {
      await watcher.scan();
      if (values.once || stop) break;
      await delay(5000, undefined, { signal: pause.signal }).catch(error => { if (error.name !== 'AbortError') throw error; });
    } while (!stop);
  } finally { process.removeListener('SIGTERM', halt); process.removeListener('SIGINT', halt); await watcher.report(false); await release(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('VIAIMS publisher could not start. Check its configuration, catalogue and local log.'); process.exitCode = 1; });
}
