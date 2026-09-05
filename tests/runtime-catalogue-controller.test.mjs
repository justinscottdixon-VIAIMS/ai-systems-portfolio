import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeCatalogueController } from '../src/lib/runtime-catalogue-controller.mjs';

const item = (id = 'Cinema/film.mp4', patch = {}) => ({
  id, pathname: id, versionId: 'etag-1', folder: 'cinema', kind: 'video', title: 'Film',
  src: `https://media.example.test/${id}`, size: 1024,
  uploadedAt: '2026-09-04T12:00:00.000Z', playlistOrder: 0, ...patch,
});
const envelope = (items = [item()], fingerprint = 'a') => ({ authoritative: true, fingerprint: fingerprint.repeat(64), items });
const response = (body = envelope()) => ({ ok: true, json: async () => body });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness(options = {}) {
  let clock = 0, visible = options.visible ?? true, timerId = 0;
  const timers = new Map(), requests = [], applied = [], diagnostics = [], caches = [];
  const controller = createRuntimeCatalogueController({
    fetchCatalogue: (...args) => { requests.push(args); return options.fetch?.(...args) ?? Promise.resolve(response()); },
    probeItems: async (items, { cache }) => {
      caches.push(cache);
      return options.probe ? options.probe(items, { cache }) : { accepted: items, rejected: [] };
    },
    applyCatalogue: async (items, lifecycle) => { applied.push(items); await options.apply?.(items, lifecycle); },
    now: () => clock, visible: () => visible,
    setTimer: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: clock + delay }); return id; },
    clearTimer: (id) => timers.delete(id),
    onDiagnostic: (message) => diagnostics.push(message),
  });
  return {
    controller, requests, applied, diagnostics, timers, caches,
    setVisible(value) { visible = value; },
    async tick(ms) {
      clock += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.due <= clock) { timers.delete(id); timer.fn(); }
      }
      await settle();
    },
  };
}

test('starts once with an immediate visible JSON request and checks every 15 seconds', async () => {
  const h = harness();
  h.controller.start(); h.controller.start();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.requests[0], ['/api/media-catalog', { headers: { accept: 'application/json' }, cache: 'no-cache' }]);
  await settle();
  assert.equal(h.applied.length, 1);
  await h.tick(14_999); assert.equal(h.requests.length, 1);
  await h.tick(1); assert.equal(h.requests.length, 2);
  assert.equal(h.applied.length, 1, 'same fingerprint does not render twice');
  assert.equal(h.caches.length, 1, 'unchanged candidates are not probed again');
  h.controller.stop();
});

test('does no work while hidden and refreshes immediately on visible focus', async () => {
  const h = harness({ visible: false });
  h.controller.start(); h.controller.focus(); await h.controller.refresh();
  assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
  h.setVisible(true); h.controller.visibilityChanged(); await settle();
  assert.equal(h.requests.length, 1);
  await h.tick(100); h.controller.focus(); await settle();
  assert.equal(h.requests.length, 2);
  h.setVisible(false); h.controller.visibilityChanged();
  assert.equal(h.timers.size, 0);
  await h.tick(30_000); assert.equal(h.requests.length, 2);
  h.controller.stop();
});

test('serializes fetch, full probing and application and schedules from request start', async () => {
  const fetch = deferred(), probe = deferred(), apply = deferred();
  const h = harness({ fetch: () => fetch.promise, probe: () => probe.promise, apply: () => apply.promise });
  h.controller.start(); h.controller.focus(); void h.controller.refresh();
  assert.equal(h.requests.length, 1);
  await h.tick(2_000); fetch.resolve(response()); await settle();
  assert.equal(h.applied.length, 0);
  h.controller.focus(); await h.tick(3_000); assert.equal(h.requests.length, 1);
  probe.resolve({ accepted: [item()], rejected: [] }); await settle();
  h.controller.focus(); assert.equal(h.requests.length, 1);
  apply.resolve(); await settle();
  assert.equal([...h.timers.values()][0].due, 15_000);
  h.controller.stop();
});

for (const failure of ['fetch', 'http', 'json', 'invalid', 'probe']) {
  test(`${failure} failure retains the accepted rows, releases in-flight and logs no raw error`, async () => {
    let failing = false;
    const h = harness({
      fetch: async () => {
        if (!failing) return response();
        if (failure === 'fetch') throw new Error('secret connection details');
        if (failure === 'http') return { ok: false, json() { throw new Error('must not decode'); } };
        if (failure === 'json') return { ok: true, json() { throw new Error('secret invalid JSON'); } };
        return response(failure === 'invalid' ? {} : envelope([item()], 'b'));
      },
      probe: async (items) => {
        if (failing && failure === 'probe') throw new Error('secret probe details');
        return { accepted: items, rejected: [] };
      },
    });
    h.controller.start(); await settle(); failing = true;
    await h.controller.refresh(); await h.controller.refresh();
    assert.equal(h.applied.length, 1);
    assert.equal(h.requests.length, 3);
    assert.equal(h.diagnostics.length, 1);
    assert.doesNotMatch(h.diagnostics[0], /secret/);
    assert.equal(h.timers.size, 1);
    failing = false; await h.controller.refresh();
    assert.equal(h.applied.length, 1);
    h.controller.stop();
  });
}

test('accepted empty catalogue never resurrects bootstrap rows after failures', async () => {
  let next = response(envelope([]));
  const h = harness({ fetch: async () => next });
  h.controller.start(); await settle();
  next = { ok: false }; await h.controller.refresh();
  assert.deepEqual(h.applied, [[]]);
  next = response(envelope([item()])); await h.controller.refresh();
  assert.deepEqual(h.applied, [[]], 'fingerprint conflict cannot resurrect removed rows');
  h.controller.stop();
});

test('uses one metadata cache across fingerprints and applies only completed accepted candidates', async () => {
  let next = envelope();
  const h = harness({ fetch: async () => response(next), probe: async (items) => ({ accepted: items.slice(0, 1), rejected: [] }) });
  h.controller.start(); await settle();
  next = envelope([item(), item('Cinema/second.mp4')], 'b');
  await h.controller.refresh();
  assert.equal(h.caches[0], h.caches[1]);
  assert.equal(h.applied.length, 2); assert.equal(h.applied[1].length, 1);
  h.controller.stop();
});

for (const phase of ['fetch', 'probe']) {
  test(`stop discards a pending ${phase} result and removes timers`, async () => {
    const pending = deferred();
    const h = harness(phase === 'fetch' ? { fetch: () => pending.promise } : { probe: () => pending.promise });
    h.controller.start(); await settle(); h.controller.stop(); h.controller.stop();
    pending.resolve(phase === 'fetch' ? response() : { accepted: [item()], rejected: [] });
    await settle(); h.controller.focus(); await h.controller.refresh(); await h.tick(30_000);
    assert.equal(h.applied.length, 0); assert.equal(h.requests.length, 1); assert.equal(h.timers.size, 0);
  });
}

test('a catalogue application queued behind playback can check teardown before mutating rows', async () => {
  const gate = deferred();
  let current;
  const h = harness({ apply: async (items, lifecycle) => { current = lifecycle?.isCurrent; await gate.promise; } });
  h.controller.start(); await settle();
  assert.equal(typeof current, 'function');
  assert.equal(current(), true);
  h.controller.stop();
  assert.equal(current(), false);
  gate.resolve(); await settle();
  assert.equal(h.timers.size, 0);
});
