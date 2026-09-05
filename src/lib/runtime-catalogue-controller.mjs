import { catalogueRefreshDecision, createCatalogueRefreshState, refreshCatalogue } from './catalogue-refresh.mjs';
import { probeCatalogueItems } from './media-metadata-probe.mjs';

export function createRuntimeCatalogueController({
  fetchCatalogue = (...args) => fetch(...args),
  probeItems = (items, options) => probeCatalogueItems(items, {
    ...options, createMediaElement: (kind) => document.createElement(kind === 'audio' ? 'audio' : 'video'),
  }),
  applyCatalogue,
  now = () => performance.now(),
  visible = () => document.visibilityState !== 'hidden',
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer),
  onDiagnostic = (message) => console.warn(message),
} = {}) {
  let state = createCatalogueRefreshState();
  const cache = new Map();
  let running = false, inFlight = false, pending = null, timer = null;
  let lastStartedAt = null, generation = 0, reportedFailure = false;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function schedule() {
    cancelTimer();
    if (!running) return;
    const decision = catalogueRefreshDecision({ now: now(), lastStartedAt, visible: visible(), inFlight });
    if (decision.delayMs === null) return;
    timer = setTimer(() => { timer = null; void refresh(); }, decision.delayMs);
  }

  function refresh() {
    if (!running || !visible()) return Promise.resolve();
    if (inFlight) return pending;
    cancelTimer();
    inFlight = true;
    lastStartedAt = now();
    const requestGeneration = generation;
    const current = () => running && requestGeneration === generation;
    pending = (async () => {
      try {
        const response = await fetchCatalogue('/api/media-catalog', {
          headers: { accept: 'application/json' }, cache: 'no-cache',
        });
        if (!response.ok) throw new Error('Catalogue HTTP failure');
        const result = refreshCatalogue(state, await response.json());
        if (!current()) return;
        if (result.status === 'unchanged') { reportedFailure = false; return; }
        if (result.status !== 'accepted') throw new Error('Invalid catalogue');
        const probed = await probeItems(result.state.items, { cache });
        if (!current()) return;
        await applyCatalogue(probed.accepted, { isCurrent: current });
        if (!current()) return;
        state = result.state;
        reportedFailure = false;
      } catch {
        if (current() && !reportedFailure) {
          reportedFailure = true;
          onDiagnostic('Media catalogue refresh unavailable; retaining the current library.');
        }
      } finally {
        inFlight = false;
        pending = null;
        schedule();
      }
    })();
    return pending;
  }

  function start() {
    if (running) return;
    running = true;
    generation += 1;
    return refresh();
  }

  function focus() { return refresh(); }
  function visibilityChanged() {
    if (visible()) return refresh();
    cancelTimer();
  }
  function stop() {
    running = false;
    generation += 1;
    cancelTimer();
  }
  return { start, focus, visibilityChanged, refresh, stop };
}
