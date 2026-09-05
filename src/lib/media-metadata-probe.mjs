const aspectFor = (width, height) => height > width
  ? 'portrait'
  : height < width ? 'landscape' : 'square';

function probeItem(item, { createMediaElement, timeoutMs }) {
  return new Promise((resolve) => {
    const element = createMediaElement(item.kind);
    let settled = false;
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      element.removeEventListener('loadedmetadata', onMetadata);
      element.removeEventListener('error', onError);
      element.removeAttribute('src');
      element.load();
    };
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };
    const reject = (reason) => finish({ accepted: false, reason });
    const onMetadata = () => {
      if (item.kind === 'video') {
        const { videoWidth: width, videoHeight: height } = element;
        if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
          reject('unknown-dimensions');
          return;
        }
        finish({
          accepted: true,
          metadata: { width, height, aspect: aspectFor(width, height) },
        });
        return;
      }
      if (!Number.isFinite(element.duration) || element.duration <= 0) {
        reject('invalid-duration');
        return;
      }
      finish({ accepted: true, metadata: null });
    };
    const onError = () => reject('metadata-error');

    element.preload = 'metadata';
    element.addEventListener('loadedmetadata', onMetadata, { once: true });
    element.addEventListener('error', onError, { once: true });
    timer = setTimeout(() => reject('metadata-timeout'), timeoutMs);
    element.src = item.src;
    element.load();
  });
}

export async function probeCatalogueItems(items, {
  createMediaElement,
  cache = new Map(),
  timeoutMs = 10_000,
} = {}) {
  const outcomes = await Promise.all(items.map(async (item) => {
    const cacheKey = `${item.id}\u0000${item.versionId}`;
    let outcome = cache.get(cacheKey);
    if (!cache.has(cacheKey)) {
      outcome = await probeItem(item, { createMediaElement, timeoutMs });
      cache.set(cacheKey, outcome);
    }
    return { item, outcome };
  }));
  return {
    accepted: outcomes
      .filter(({ outcome }) => outcome.accepted)
      .map(({ item, outcome }) => outcome.metadata ? { ...item, ...outcome.metadata } : { ...item }),
    rejected: outcomes
      .filter(({ outcome }) => !outcome.accepted)
      .map(({ item, outcome }) => ({ id: item.id, reason: outcome.reason })),
  };
}
