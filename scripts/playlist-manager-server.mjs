import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { MEDIA_ORIGIN } from '../src/lib/approved-catalogue.mjs';

const MAX_UPLOAD = 2 * 1024 ** 3;
const assets = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
const mime = name => ({ '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.flac': 'audio/flac', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }[path.extname(name)] || 'application/octet-stream');
class RequestError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
async function jsonBody(request) {
  let size = 0; const chunks = [];
  await new Promise((resolve, reject) => {
    request.on('data', chunk => { size += chunk.length; if (size > 65536) { reject(new RequestError('This edit is too large.', 413)); return; } chunks.push(chunk); });
    request.once('end', resolve); request.once('error', reject);
  });
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new RequestError('Invalid edit.'); }
}
export async function startPlaylistManagerServer({ manager, port = 4350, assetDirectory = new URL('../tools/playlist-manager/', import.meta.url) }) {
  const session = randomBytes(32).toString('hex');
  let origin;
  const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob: ${MEDIA_ORIGIN}; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    let upload;
    try {
      if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') throw new RequestError('Open the manager directly on this Mac.', 403);
      const url = new URL(request.url, origin);
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [filename, contentType] = assets.get(url.pathname);
        if (url.pathname === '/') response.setHeader('Set-Cookie', `viaims_manager=${session}; HttpOnly; SameSite=Strict; Path=/`);
        response.writeHead(200, { 'Content-Type': contentType }); response.end(await fs.readFile(new URL(filename, assetDirectory))); return;
      }
      const cookie = request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('viaims_manager='))?.slice(15);
      if (!cookie || cookie.length !== session.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))) throw new RequestError('Reload the manager to reconnect.', 401);
      if (request.method !== 'GET' && (request.headers.origin !== origin || request.headers['x-viaims-request'] !== 'manager')) throw new RequestError('Edits must come from the local manager.', 403);
      if (request.method === 'GET' && url.pathname === '/api/state') { json(response, 200, await manager.snapshot()); return; }
      if (request.method === 'GET' && /^\/api\/preview\/[a-f0-9-]+$/.test(url.pathname)) {
        const { filename } = manager.preview(url.pathname.split('/').at(-1)), stat = await fs.stat(filename);
        let start = 0, end = stat.size - 1;
        if (request.headers.range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
          if (!match) throw new RequestError('Unsupported range.', 416);
          start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
          if (!Number.isSafeInteger(start) || start > end || start < 0) { response.setHeader('Content-Range', `bytes */${stat.size}`); throw new RequestError('Unsupported range.', 416); }
        }
        response.writeHead(request.headers.range ? 206 : 200, { 'Content-Type': mime(filename), 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(request.headers.range ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}) });
        await pipeline(createReadStream(filename, { start, end }), response); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/edit') { const body = await jsonBody(request); if (!body.fingerprint) throw new RequestError('Refresh before editing.'); await manager.edit(body.operation, body.fingerprint); json(response, 200, { saved: true }); return; }
      if (request.method === 'POST' && url.pathname === '/api/import') { await jsonBody(request); await manager.activateImport(); json(response, 200, { saved: true }); return; }
      if (request.method === 'POST' && url.pathname === '/api/job') { const body = await jsonBody(request); await manager.jobAction(body.id, body.action); json(response, 200, { saved: true }); return; }
      if (request.method === 'POST' && url.pathname === '/api/upload') {
        const name = url.searchParams.get('filename');
        if (!name || name.length > 240 || /[\/\\\x00-\x1f\x7f]/.test(name)) throw new RequestError('Choose a readable media filename.');
        const length = Number(request.headers['content-length']);
        if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_UPLOAD) throw new RequestError('Choose a completed file under 2 GiB.', 413);
        upload = path.join(manager.directory, 'files', `${randomUUID()}.incoming`);
        let size = 0;
        await pipeline(request, new Transform({ transform(chunk, encoding, callback) { size += chunk.length; callback(size > length || size > MAX_UPLOAD ? new RequestError('File exceeds the upload limit.', 413) : null, chunk); } }), createWriteStream(upload, { flags: 'wx', mode: 0o600 }));
        if (size !== length) throw new RequestError('Upload interrupted. Please try again.');
        const id = await manager.add({ source: upload, filename: name, title: url.searchParams.get('title') || undefined, playlistId: url.searchParams.get('playlist'), replaceId: url.searchParams.get('replace') || undefined });
        json(response, 202, { id }); return;
      }
      throw new RequestError('Not found.', 404);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) json(response, error.status || (error.name === 'TypeError' ? 400 : 409), { error: error.status || error.code === 'MANAGER_INPUT' ? error.message : 'The change could not be saved. Refresh the manager and check connectivity; your existing media is safe.' });
      else if (!response.destroyed) response.destroy();
    } finally { if (upload) await fs.rm(upload, { force: true }).catch(() => {}); }
  });
  server.requestTimeout = 30 * 60_000; server.headersTimeout = 15000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { origin = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
  return { url: origin, close: async () => { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); } };
}
