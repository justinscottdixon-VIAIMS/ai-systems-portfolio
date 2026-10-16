import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeCatalogueEnabled } from '../src/lib/catalogue-release-policy.mjs';
import mediaCatalogue from '../api/media-catalog.mjs';

test('publishing Credentials preserves bundled playlists until catalogue migration is opted in', () => {
  assert.equal(runtimeCatalogueEnabled(), false);
  assert.equal(runtimeCatalogueEnabled('full'), false);
  assert.equal(runtimeCatalogueEnabled('full', 'enabled'), true);
  assert.equal(runtimeCatalogueEnabled('player', 'enabled'), false);
  assert.equal(runtimeCatalogueEnabled('selected', 'enabled'), false);
});

test('unconfigured production endpoint cannot advertise an authoritative empty catalogue', async () => {
  const previous = process.env.VIAIMS_CATALOGUE_REFRESH;
  delete process.env.VIAIMS_CATALOGUE_REFRESH;
  const response = {
    headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.code = value; return this; },
    json(value) { this.body = value; return this; },
  };
  try {
    await mediaCatalogue({ method: 'GET' }, response);
    assert.equal(response.code, 503);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.authoritative, undefined);
    assert.equal(response.body.items, undefined);
  } finally {
    if (previous === undefined) delete process.env.VIAIMS_CATALOGUE_REFRESH;
    else process.env.VIAIMS_CATALOGUE_REFRESH = previous;
  }
});
