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
  });
  const response = createResponse();

  await handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { error: 'Media catalogue unavailable' });
});
