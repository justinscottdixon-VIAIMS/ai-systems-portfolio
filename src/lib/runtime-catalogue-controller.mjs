import { catalogueRefreshDecision, createCatalogueRefreshState, refreshCatalogue } from './catalogue-refresh.mjs';
import { isRetryableMetadataFailure, probeCatalogueItems } from './media-metadata-probe.mjs';

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
  let playableItems = new Map();
  let metadataIncomplete = false, metadataRetryAt = 0, metadataFailures = 0;
  let running = false, inFlight = false, pending = null, timer = null;
  let lastStartedAt = null, generation = 0, reportedFailure = false;
  let abortController = null;

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
    abortController = new AbortController();
    const { signal } = abortController;
    const current = () => running && requestGeneration === generation;
    pending = (async () => {
      try {
        const response = await fetchCatalogue('/api/media-catalog', {
          headers: { accept: 'application/json' }, cache: 'no-cache', signal,
        });
        if (!response.ok) throw new Error('Catalogue HTTP failure');
        const result = refreshCatalogue(state, await response.json());
        if (!current()) return;
        const unchanged = result.status === 'unchanged';
        if (unchanged && (!metadataIncomplete || now() < metadataRetryAt)) { reportedFailure = false; return; }
        if (!unchanged && result.status !== 'accepted') throw new Error('Invalid catalogue');
        const probed = await probeItems(result.state.items, { cache, signal });
        if (!current()) return;
        const retryable = new Set(probed.rejected.filter(row => isRetryableMetadataFailure(row.reason)).map(row => row.id));
        const accepted = new Map(probed.accepted.map(row => [row.id, row]));
        // Keep the last playable version during transient replacement failures.
        // Only candidates still in the authoritative catalogue can be retained.
        const nextItems = result.state.items.flatMap(candidate => {
          const row = accepted.get(candidate.id);
          const prior = playableItems.get(candidate.id);
          return row ? [row] : retryable.has(candidate.id) && prior
            && prior.kind === candidate.kind && prior.folder === candidate.folder ? [prior] : [];
        });
        await applyCatalogue(nextItems, { isCurrent: current, signal });
        if (!current()) return;
        playableItems = new Map(nextItems.map(row => [row.id, row]));
        metadataIncomplete = retryable.size > 0;
        metadataFailures = metadataIncomplete ? (unchanged ? metadataFailures + 1 : 1) : 0;
        metadataRetryAt = metadataIncomplete ? now() + Math.min(60_000, 15_000 * 2 ** Math.min(metadataFailures - 1, 2)) : 0;
        state = result.state;
        reportedFailure = false;
      } catch {
        if (current() && !reportedFailure) {
          reportedFailure = true;
          onDiagnostic('Media catalogue refresh unavailable; retaining the current library.');
        }
      } finally {
        if (requestGeneration === generation) {
          inFlight = false;
          pending = null;
          abortController = null;
          schedule();
        }
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
    abortController?.abort();
    abortController = null;
    inFlight = false;
    pending = null;
  }
  return { start, focus, visibilityChanged, refresh, stop };
}

export function bindRuntimeCatalogueLifecycle(controller, { windowTarget, documentTarget }) {
  const onPageShow = (event) => { if (event.persisted) controller.start(); };
  const teardown = () => {
    controller.stop();
    windowTarget.removeEventListener('focus', controller.focus);
    documentTarget.removeEventListener('visibilitychange', controller.visibilityChanged);
    windowTarget.removeEventListener('pagehide', onPageHide);
    windowTarget.removeEventListener('pageshow', onPageShow);
  };
  const onPageHide = (event) => {
    if (event.persisted) controller.stop();
    else teardown();
  };
  windowTarget.addEventListener('focus', controller.focus);
  documentTarget.addEventListener('visibilitychange', controller.visibilityChanged);
  windowTarget.addEventListener('pagehide', onPageHide);
  windowTarget.addEventListener('pageshow', onPageShow);
  controller.start();
  return teardown;
}
