import assert from 'node:assert/strict';
import test from 'node:test';

import { supersedeMediaElement } from '../src/lib/media-event-generation.mjs';

class FakeMediaElement extends EventTarget {
  constructor(attributes = {}) {
    super();
    this.attributes = new Map(Object.entries(attributes));
    this.replacement = null;
  }

  cloneNode() { return new FakeMediaElement(Object.fromEntries(this.attributes)); }
  removeAttribute(name) { this.attributes.delete(name); }
  pause() {}
  load() {}
  replaceWith(next) { this.replacement = next; }
}

test('a queued event from a superseded media generation cannot reach the replacement', async () => {
  const oldGeneration = new FakeMediaElement({ src: '/old.mp4', 'data-visual-token': '1' });
  const newGeneration = supersedeMediaElement(oldGeneration);
  let currentFailures = 0;
  newGeneration.addEventListener('error', () => { currentFailures += 1; });

  await Promise.resolve();
  oldGeneration.dispatchEvent(new Event('error'));

  assert.equal(currentFailures, 0);
  assert.equal(oldGeneration.replacement, newGeneration);
  assert.equal(newGeneration.attributes.has('src'), false);
  assert.equal(newGeneration.attributes.has('data-visual-token'), false);
});

test('a transition event from a detached fade generation cannot finish the replacement fade', () => {
  const oldGeneration = new FakeMediaElement({ 'data-fade-token': '4' });
  const newGeneration = supersedeMediaElement(oldGeneration);
  let completedToken = null;
  newGeneration.addEventListener('transitionend', () => { completedToken = 5; });

  oldGeneration.dispatchEvent(new Event('transitionend'));

  assert.equal(completedToken, null);
  assert.equal(newGeneration.attributes.has('data-fade-token'), false);
});
