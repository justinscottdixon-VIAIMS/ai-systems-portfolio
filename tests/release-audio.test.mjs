import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeAudioClips, bindReleaseAudio } from '../src/lib/release-audio.mjs';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';
import { toCredentialCollections } from '../src/lib/credential-collections.mjs';

const clip = { src: '/reference/release-audio/cosmic-duo-sasha-call.m4a', title: 'Sasha call' };

test('release audio accepts only named local recordings and retains each source once', () => {
  assert.deepEqual(normalizeAudioClips([clip, clip]), [clip]);
  assert.deepEqual(normalizeAudioClips(), []);
  for (const src of ['https://dropbox.com/file.m4a', '/reference/release-audio/../secret.m4a', '//other.example/file.m4a', '/reference/release-audio/file.html']) {
    assert.throws(() => normalizeAudioClips([{ ...clip, src }]), /local release-audio/);
  }
  assert.throws(() => normalizeAudioClips([{ ...clip, title: '' }]), /title/);
});

function playbackFixture() {
  const media = hidden => ({ paused: false, hidden, directory: false, pause() { this.paused = true; }, matches: () => true,
    closest(selector) { return (this.hidden && selector.includes('[hidden]')) || (this.directory && selector.includes('[data-view="directory"]')) ? {} : null; },
  });
  const audio = media(false), background = media(false), another = media(false);
  const events = new Map(), messages = [];
  let onMutation;
  const document = {
    body: {},
    querySelectorAll(selector) {
      if (selector === '[data-release-audio]') return [audio, another];
      if (selector === 'audio, video') return [audio, background, another];
      return [{ contentWindow: { postMessage: (...args) => messages.push(args) } }];
    },
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name),
  };
  const Observer = class { constructor(callback) { onMutation = callback; } observe() {} disconnect() {} };
  const dispose = bindReleaseAudio(document, { Observer });
  return { audio, background, another, messages, play: target => events.get('play')({ target }), mutate: () => onMutation(), dispose };
}

test('starting a recording pauses competing media; restarting the main player stops the recording', () => {
  const f = playbackFixture();
  f.play(f.audio);
  assert.equal(f.audio.paused, false);
  assert.equal(f.background.paused, true);
  assert.equal(f.another.paused, true);
  assert.equal(JSON.parse(f.messages[0][0]).func, 'pauseVideo');
  assert.equal(f.messages[0][1], 'https://www.youtube.com');
  f.background.paused = false;
  f.play(f.background);
  assert.equal(f.audio.paused, true);
  assert.equal(f.background.paused, false);
  f.dispose();
});

test('navigating away pauses a hidden card and never resumes a hidden recording', () => {
  const f = playbackFixture();
  f.audio.hidden = true;
  f.mutate();
  assert.equal(f.audio.paused, true);
  f.audio.paused = false;
  f.play(f.audio);
  assert.equal(f.audio.paused, true);
  // Back to Credentials hides the dossier through data-view/CSS, not hidden.
  f.audio.hidden = false;
  f.audio.directory = true;
  f.audio.paused = false;
  f.mutate();
  assert.equal(f.audio.paused, true);
  f.audio.paused = false;
  f.play(f.audio);
  assert.equal(f.audio.paused, true);
  f.dispose();
});

test('Cosmic Duo keeps the supplied recording and the separate compilation credits stay track-specific', async () => {
  const source = JSON.parse(await readFile(new URL('../src/data/portfolio-records.json', import.meta.url)));
  const collections = toCredentialCollections(toPortfolioRecords(source));
  const cosmic = collections.find(r => r.id === 'cosmic-records-history');
  const duo = cosmic.children.find(c => c.id === 'cosmic-duo-nu-energy');
  const compilation = cosmic.children.filter(c => c.id === 'sasha-presents-excession-recordings');
  assert.equal(duo.audioClips[0].src, clip.src);
  assert.equal(compilation.length, 1);
  assert.equal(compilation[0].catalogNumber, 'XSN CD 001');
  assert.match(compilation[0].date, /1998/);
  assert.equal(compilation[0].credits[0].scope, 'Track 5 · Cosmic Duo');
  assert.match(compilation[0].credits[0].evidence, /not production credits for the entire compilation/);
  assert.equal(compilation[0].audioClips.length, 0);
  const music = collections.find(r => r.id === 'singles-remixes');
  for (const release of [duo, compilation[0]]) {
    const linked = music.children.filter(c => c.id === `cosmic-records-history-${release.id}`);
    assert.equal(linked.length, 1);
    assert.equal(linked[0].audioClips, release.audioClips);
    assert.equal(linked[0].gallery, release.gallery);
    assert.equal(linked[0].sourceArchiveHref, `/archive/cosmic-records-history/#${release.id}`);
  }
});
