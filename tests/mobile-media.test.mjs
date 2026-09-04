import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleVideoItems, isMobileViewport } from '../src/lib/mobile-media.mjs';

test('mobile exposes only portrait native videos while desktop retains all', () => {
  const items = [
    { id: 'p', aspect: 'portrait' },
    { id: 'l', aspect: 'landscape' },
    { id: 's', aspect: 'square' },
    { id: 'u' },
  ];
  assert.deepEqual(eligibleVideoItems(items, 390).map((item) => item.id), ['p']);
  assert.deepEqual(eligibleVideoItems(items, 768).map((item) => item.id), ['p', 'l', 's', 'u']);
});

test('mobile breakpoint requires a finite width no greater than 767', () => {
  assert.equal(isMobileViewport(767), true);
  assert.equal(isMobileViewport(768), false);
  assert.equal(isMobileViewport(Number.NaN), false);
});
