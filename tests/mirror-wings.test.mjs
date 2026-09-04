import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRROR_WING_EDGE_SAMPLE_FRACTION,
  MIRROR_WING_PROVIDER_POLICY,
  calculateMirrorWingGeometry,
  normalizeStageProvider,
  resolveMirrorWingPresentation,
} from '../src/lib/mirror-wings.mjs';

test('provider policy enables only Cinema and Music Video by default', () => {
  assert.deepEqual(MIRROR_WING_PROVIDER_POLICY, {
    cinema: true,
    'music-video': true,
    media: false,
    welcome: false,
    youtube: false,
  });
  assert.equal(normalizeStageProvider('music', 'video'), 'music-video');
  assert.equal(normalizeStageProvider('music', 'audio'), 'unknown');
  assert.equal(normalizeStageProvider('cinema'), 'cinema');
  assert.equal(normalizeStageProvider('media'), 'media');
  assert.equal(normalizeStageProvider('youtube'), 'youtube');
});

test('presentation requires provider, aspect, viewport, and motion eligibility', () => {
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait' }).enabled, true);
  assert.equal(resolveMirrorWingPresentation({ provider: 'music-video', aspect: 'square' }).enabled, true);
  assert.equal(resolveMirrorWingPresentation({ provider: 'media', aspect: 'portrait' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'welcome', aspect: 'portrait' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'landscape' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'unknown' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait', isMobile: true }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait', prefersReducedMotion: true }).enabled, false);
});

test('edge sampling is symmetric and exposes a stable CSS scale', () => {
  const presentation = resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait' });
  assert.equal(MIRROR_WING_EDGE_SAMPLE_FRACTION, 0.28);
  assert.equal(presentation.edgeSampleFraction, 0.28);
  assert.equal(presentation.edgeScale, 1 / 0.28);
});

test('geometry fills each unused side and hides the seam under the master', () => {
  const geometry = calculateMirrorWingGeometry(1440, 420, 8);
  assert.equal(geometry.wingInlineSize, 518);
  assert.equal(geometry.overlap, 8);
  assert.equal(geometry.masterInlineSize, 420);
  assert.equal(geometry.sampleInlineSize, 420 * 0.28);
  assert.equal(geometry.edgeStretch, 518 / (420 * 0.28));
  assert.deepEqual(calculateMirrorWingGeometry(390, 390, 8), {
    wingInlineSize: 0,
    overlap: 0,
    masterInlineSize: 390,
    sampleInlineSize: 390 * 0.28,
    edgeStretch: 0,
  });
  assert.deepEqual(calculateMirrorWingGeometry(Number.NaN, 420, 8), {
    wingInlineSize: 0,
    overlap: 0,
    masterInlineSize: 0,
    sampleInlineSize: 0,
    edgeStretch: 0,
  });
});
