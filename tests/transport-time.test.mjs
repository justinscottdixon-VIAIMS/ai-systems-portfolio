import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTransportTime } from '../src/lib/transport-time.mjs';

test('transport time reports elapsed and negative remaining', () => {
  assert.deepEqual(formatTransportTime({ currentTime: 65, duration: 185 }), {
    elapsed: '1:05', remaining: '-2:00',
  });
  assert.deepEqual(formatTransportTime({ currentTime: 0, duration: Number.NaN }), {
    elapsed: '--:--', remaining: '--:--',
  });
});

test('transport time floors seconds, clamps elapsed, and supports hours', () => {
  assert.deepEqual(formatTransportTime({ currentTime: 3661.9, duration: 7200.2 }), {
    elapsed: '1:01:01', remaining: '-58:58',
  });
  assert.deepEqual(formatTransportTime({ currentTime: 20, duration: 10 }), {
    elapsed: '0:10', remaining: '-0:00',
  });
});
