import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../src/components/HybridMediaEngine.astro', import.meta.url);
const stylePath = new URL('../src/styles/hybrid-media-engine.css', import.meta.url);

async function source(url) {
  return readFile(url, 'utf8');
}

test('hybrid engine exposes an adaptive stage with two decorative wings', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-hybrid-media-engine/);
  assert.match(component, /id="master-stage-container"[^>]+data-media-aspect="unknown"/s);
  assert.match(component, /id="mirror-wing-left"/);
  assert.match(component, /id="mirror-wing-right"/);
  assert.equal((component.match(/aria-hidden="true"/g) ?? []).length >= 2, true);
  assert.equal((component.match(/tabindex="-1"/g) ?? []).length >= 2, true);
  assert.doesNotMatch(component, /id="bg-video-blur"/);
});

test('adaptive stage CSS contains portrait, landscape, mobile, and reduced-motion rules', async () => {
  const css = await source(stylePath);
  assert.match(css, /data-media-aspect="portrait"/);
  assert.match(css, /data-media-aspect="square"/);
  assert.match(css, /data-media-aspect="landscape"/);
  assert.match(css, /max-width:\s*767px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('hybrid engine imports presentation rules and classifies source metadata', async () => {
  const component = await source(componentPath);
  assert.match(component, /from '\.\.\/lib\/media-presentation\.mjs'/);
  assert.match(component, /classifyMediaAspect\(mv\.videoWidth, mv\.videoHeight\)/);
  assert.match(component, /alignFollower\(mv, wing, 0\.3\)/);
  assert.match(component, /data-v-src=/);
  assert.match(component, /data-a-src=/);
});

test('master playback events propagate to active decorative wings', async () => {
  const component = await source(componentPath);
  assert.match(component, /mv\.addEventListener\('play'/);
  assert.match(component, /mv\.addEventListener\('pause'/);
  assert.match(component, /playMirrorWings\(\)/);
  assert.match(component, /pauseMirrorWings\(\)/);
});

test('hybrid engine renders a full mastering console before the operational deck', async () => {
  const component = await source(componentPath);
  const consoleIndex = component.indexOf('data-mastering-console');
  const deckIndex = component.indexOf('data-operational-deck');
  assert.equal(consoleIndex > -1, true);
  assert.equal(deckIndex > consoleIndex, true);
  assert.match(component, /id="audio-bus-status"[^>]+aria-live="polite"/s);
  assert.match(component, /id="audio-queue-preview"/);
  assert.match(component, /id="dsp-seek"/);
  assert.match(component, /id="dsp-rewind-10"/);
  assert.match(component, /id="dsp-forward-10"/);
  assert.match(component, /id="dsp-audio"/);
});
