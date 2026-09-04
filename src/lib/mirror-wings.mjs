export const MIRROR_WING_PROVIDER_POLICY = Object.freeze({
  cinema: true,
  'music-video': true,
  media: false,
  welcome: false,
  youtube: false,
});

export const MIRROR_WING_EDGE_SAMPLE_FRACTION = 0.28;

const NATIVE_PROVIDERS = new Set(['cinema', 'media', 'welcome', 'youtube']);

export function normalizeStageProvider(provider, mode = 'video') {
  if (provider === 'music') return mode === 'video' ? 'music-video' : 'unknown';
  return NATIVE_PROVIDERS.has(provider) ? provider : 'unknown';
}

export function resolveMirrorWingPresentation({
  provider = 'unknown',
  aspect = 'unknown',
  isMobile = false,
  prefersReducedMotion = false,
  providerPolicy = MIRROR_WING_PROVIDER_POLICY,
} = {}) {
  const aspectEligible = aspect === 'portrait' || aspect === 'square';
  const enabled = Boolean(providerPolicy[provider])
    && aspectEligible
    && !isMobile
    && !prefersReducedMotion;
  return {
    enabled,
    provider,
    aspect,
    edgeSampleFraction: MIRROR_WING_EDGE_SAMPLE_FRACTION,
    edgeScale: 1 / MIRROR_WING_EDGE_SAMPLE_FRACTION,
  };
}

export function calculateMirrorWingGeometry(stageWidth, masterWidth, requestedOverlap = 8) {
  if (![stageWidth, masterWidth, requestedOverlap].every(Number.isFinite)
    || stageWidth <= 0
    || masterWidth <= 0
    || requestedOverlap < 0) {
    return {
      wingInlineSize: 0,
      overlap: 0,
      masterInlineSize: 0,
      sampleInlineSize: 0,
      edgeStretch: 0,
    };
  }
  const unusedSide = Math.max(0, (stageWidth - masterWidth) / 2);
  const sampleInlineSize = masterWidth * MIRROR_WING_EDGE_SAMPLE_FRACTION;
  if (unusedSide === 0) {
    return {
      wingInlineSize: 0,
      overlap: 0,
      masterInlineSize: masterWidth,
      sampleInlineSize,
      edgeStretch: 0,
    };
  }
  const overlap = Math.min(requestedOverlap, unusedSide);
  const wingInlineSize = unusedSide + overlap;
  return {
    wingInlineSize,
    overlap,
    masterInlineSize: masterWidth,
    sampleInlineSize,
    edgeStretch: wingInlineSize / sampleInlineSize,
  };
}
