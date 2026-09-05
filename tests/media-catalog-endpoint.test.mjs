import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaCatalogueHandler } from '../api/media-catalog.mjs';

function createResponse() {
  return {
    headers: {},
    statusCode: undefined,
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function captureLogger() {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    logger: { error: (...entry) => errors.push(entry), warn: (...entry) => warnings.push(entry) },
  };
}

function listCinema(blobs) {
  return async ({ prefix }) => ({ blobs: prefix === 'Cinema/' ? blobs : [], hasMore: false });
}

function cinemaBlob(pathname) {
  return { pathname, etag: 'one', url: 'https://store.example/clip.mp4', size: 1, uploadedAt: '2026-09-04T12:00:00.000Z' };
}

test('GET returns the complete catalogue envelope without accepting client list options', async () => {
  const calls = [];
  const listPage = async (options) => {
    calls.push(options);
    return { blobs: [], hasMore: false };
  };
  const handler = createMediaCatalogueHandler({
    listPage,
    readText: async () => {
      throw new Error('empty folders must not read sidecars');
    },
  });
  const response = createResponse();

  await handler({
    method: 'GET',
    query: { prefix: 'private/', cursor: 'client-cursor', token: 'client-token' },
    headers: { authorization: 'Bearer client-token' },
  }, response);

  const envelope = {
    authoritative: true,
    fingerprint: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    items: [],
  };
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'public, s-maxage=15, must-revalidate');
  assert.deepEqual(response.body, envelope);
  assert.deepEqual(calls, [
    { prefix: 'Cinema/', cursor: undefined, limit: 1000 },
    { prefix: 'Music/', cursor: undefined, limit: 1000 },
    { prefix: 'Media/', cursor: undefined, limit: 1000 },
    { prefix: 'Music-Visuals/', cursor: undefined, limit: 1000 },
  ]);
});

test('rejects methods other than GET with Allow: GET', async () => {
  let listed = false;
  const handler = createMediaCatalogueHandler({
    listPage: async () => {
      listed = true;
      return { blobs: [], hasMore: false };
    },
    readText: async () => '[]',
  });
  const response = createResponse();

  await handler({ method: 'POST' }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET');
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(response.body, { error: 'Method not allowed' });
  assert.equal(listed, false);
});

test('returns a generic no-store 503 when Blob listing fails', async () => {
  const handler = createMediaCatalogueHandler({
    listPage: async () => {
      throw new Error('BLOB_READ_WRITE_TOKEN=secret-value');
    },
    readText: async () => '[]',
    logger: captureLogger().logger,
  });
  const response = createResponse();

  await handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { error: 'Media catalogue unavailable' });
  assert.doesNotMatch(JSON.stringify(response.body), /secret-value|BLOB_READ_WRITE_TOKEN/);
});

test('returns the same generic no-store 503 when a sidecar read fails', async () => {
  const handler = createMediaCatalogueHandler({
    listPage: async ({ prefix }) => prefix === 'Cinema/'
      ? {
        blobs: [{
          pathname: 'Cinema/playlist-order.json',
          etag: 'order',
          url: 'https://store.example/Cinema/playlist-order.json',
          size: 1,
          uploadedAt: '2026-09-04T12:00:00.000Z',
        }],
        hasMore: false,
      }
      : { blobs: [], hasMore: false },
    readText: async () => {
      throw new Error('sidecar host is unavailable');
    },
    logger: captureLogger().logger,
  });
  const response = createResponse();

  await handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { error: 'Media catalogue unavailable' });
});

test('logs an actionable safe sidecar diagnostic while keeping the 503 generic', async () => {
  const { logger, errors } = captureLogger();
  const handler = createMediaCatalogueHandler({
    listPage: listCinema([cinemaBlob('Cinema/playlist-order.json')]),
    readText: async () => '["nested/Clip.mp4?token=SIDECAR_SECRET"]',
    logger,
  });
  const response = createResponse();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'Media catalogue unavailable' });
  assert.deepEqual(errors, [['media catalogue unavailable', {
    code: 'PLAYLIST_ORDER_INVALID', provider: 'cinema', prefix: 'Cinema/',
    pathname: 'Cinema/playlist-order.json', reason: 'playlist order contains invalid entries',
  }]]);
  assert.doesNotMatch(JSON.stringify(errors), /SIDECAR_SECRET|\?token/);
});

test('logs an approved provider and safe pathname for duplicate path failures', async () => {
  const { logger, errors } = captureLogger();
  const handler = createMediaCatalogueHandler({
    listPage: listCinema([cinemaBlob('Cinema/Clip.mp4'), cinemaBlob('Cinema/Clip.mp4')]),
    readText: async () => '[]',
    logger,
  });
  const response = createResponse();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(errors, [['media catalogue unavailable', {
    code: 'BLOB_PATH_DUPLICATE', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/Clip.mp4',
    reason: 'returned a duplicate pathname',
  }]]);
});

test('secret-bearing upstream failures and request data never enter diagnostics', async () => {
  const { logger, errors } = captureLogger();
  const upstream = Object.assign(new Error('BLOB_READ_WRITE_TOKEN=UPSTREAM_SECRET https://user:URL_SECRET@store.example/?token=QUERY_SECRET'), {
    code: 'FORGED_SECRET', prefix: 'private/SECRET_PREFIX', pathname: 'https://store.example/?token=FORGED_SECRET',
  });
  const handler = createMediaCatalogueHandler({
    listPage: async () => { throw upstream; },
    readText: async () => '[]',
    logger,
  });
  const response = createResponse();
  await handler({ method: 'GET', query: { token: 'REQUEST_SECRET' }, headers: { authorization: 'Bearer HEADER_SECRET' } }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'Media catalogue unavailable' });
  assert.deepEqual(errors, [['media catalogue unavailable', {
    code: 'BLOB_LIST_FAILED', provider: 'cinema', prefix: 'Cinema/', reason: 'Blob listing failed',
  }]]);
  assert.doesNotMatch(JSON.stringify({ errors, body: response.body }), /SECRET|https?:|BLOB_READ_WRITE_TOKEN|authorization|Bearer/);
});

test('sidecar read errors retain safe context without upstream text or URLs', async () => {
  const { logger, errors } = captureLogger();
  const handler = createMediaCatalogueHandler({
    listPage: listCinema([cinemaBlob('Cinema/playlist-order.json')]),
    readText: async () => { throw new Error('https://store.example/order?token=SIDECAR_SECRET'); },
    logger,
  });
  const response = createResponse();
  await handler({ method: 'GET' }, response);
  assert.deepEqual(errors, [['media catalogue unavailable', {
    code: 'PLAYLIST_ORDER_READ_FAILED', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/playlist-order.json',
    reason: 'playlist order could not be read',
  }]]);
  assert.doesNotMatch(JSON.stringify({ errors, body: response.body }), /SECRET|https?:|\?token/);
});

test('eligibility omissions log safe reasons without entering the public envelope', async () => {
  const { logger, warnings } = captureLogger();
  const handler = createMediaCatalogueHandler({
    listPage: listCinema([
      cinemaBlob('Cinema/nested/Clip.mp4'), cinemaBlob('Cinema/.hidden.mp4'), cinemaBlob('Cinema/Notes.txt'),
      cinemaBlob('Cinema/private?token=PATH_SECRET.txt'), cinemaBlob('Cinema/Clip.mp4'),
    ]),
    readText: async () => '[]',
    logger,
  });
  const response = createResponse();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.items.map(({ pathname }) => pathname), ['Cinema/Clip.mp4']);
  assert.deepEqual(warnings, [
    ['media catalogue omission', { code: 'BLOB_NESTED_OMITTED', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/nested/Clip.mp4', reason: 'nested files are not eligible' }],
    ['media catalogue omission', { code: 'BLOB_HIDDEN_OMITTED', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/.hidden.mp4', reason: 'hidden files are not eligible' }],
    ['media catalogue omission', { code: 'BLOB_EXTENSION_OMITTED', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/Notes.txt', reason: 'file extension is not supported' }],
    ['media catalogue omission', { code: 'BLOB_EXTENSION_OMITTED', provider: 'cinema', prefix: 'Cinema/', reason: 'file extension is not supported' }],
  ]);
  assert.doesNotMatch(JSON.stringify(response.body), /diagnostic|reason|OMITTED|Notes|hidden|nested/);
  assert.doesNotMatch(JSON.stringify(warnings), /SECRET|\?token/);
});
