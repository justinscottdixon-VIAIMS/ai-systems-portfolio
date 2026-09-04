import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toMediaLibrary } from '../src/lib/media-library.mjs';

const productionCurated = JSON.parse(readFileSync(new URL('../src/data/curated-media.json', import.meta.url), 'utf8'));

const manifest = {
  version: 1,
  generatedAt: '2026-08-30T00:00:00.000Z',
  items: [
    { id: 'video-atlas', kind: 'video', title: 'Atlas', src: 'https://cdn.example/atlas.mp4', specs: 'MP4', engine: 'Sora', width: 720, height: 1280, aspect: 'portrait' },
    { id: 'audio-north', kind: 'audio', title: 'V_Magnetic North_', src: 'https://cdn.example/north.wav', specs: '24-bit WAV', visual: { tag: 'VIZ-VOID', src: 'https://cdn.example/void.mp4', width: 1080, height: 1920, aspect: 'portrait' } },
  ],
};

const curated = {
  version: 1,
  experience: {
    welcomeVideoSrc: 'https://cdn.example/viaims-welcome.mp4',
    ambientAudioSrc: 'https://cdn.example/viaims-ambient.wav',
  },
  music: [{
    productId: 'audio-north',
    musicVideoSrc: 'https://cdn.example/north-video.mp4',
    musicVideoWidth: 720,
    musicVideoHeight: 1280,
    musicVideoAspect: 'portrait',
  }],
  media: [{ id: 'media-reel', title: 'Systems Reel', src: 'https://cdn.example/reel.mp4', specs: 'MP4', width: 1920, height: 1080, aspect: 'landscape' }],
  youtubeChannel: {
    title: 'Justin Scott Dixon / Voyager',
    handle: '@justinscottdixon_voyager',
    href: 'https://www.youtube.com/@justinscottdixon_voyager',
  },
  youtube: [{ id: 'youtube-mix', title: 'Mix Walkthrough', videoId: 'M7lc1UVf-VE' }],
};

test('toMediaLibrary keeps four independent providers', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.deepEqual(library.cinema.map((item) => item.id), ['video-atlas']);
  assert.deepEqual(library.music.map((item) => item.productId), ['audio-north']);
  assert.deepEqual(library.media.map((item) => item.id), ['media-reel']);
  assert.deepEqual(library.youtubeChannel, {
    title: 'Justin Scott Dixon / Voyager',
    handle: '@justinscottdixon_voyager',
    href: 'https://www.youtube.com/@justinscottdixon_voyager',
  });
  assert.deepEqual(library.youtube.map((item) => item.id), ['youtube-mix']);
});

test('YouTube channel identity requires an HTTPS destination', () => {
  assert.throws(
    () => toMediaLibrary(manifest, {
      version: 1,
      music: [],
      media: [],
      youtube: [],
      youtubeChannel: {
        title: 'Justin Scott Dixon / Voyager',
        handle: '@justinscottdixon_voyager',
        href: 'http://www.youtube.com/@justinscottdixon_voyager',
      },
    }),
    /youtube channel href must be an HTTPS URL/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, {
      version: 1,
      music: [],
      media: [],
      youtube: [],
      youtubeChannel: {
        title: 'Justin Scott Dixon / Voyager',
        handle: '@justinscottdixon_voyager',
        href: 'https://youtube.example/@justinscottdixon_voyager',
      },
    }),
    /youtube channel must use the approved canonical destination/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, {
      version: 1,
      music: [],
      media: [],
      youtube: [],
      youtubeChannel: {
        title: 'Justin Scott Dixon / Voyager',
        handle: '@another_handle',
        href: 'https://www.youtube.com/@justinscottdixon_voyager',
      },
    }),
    /youtube channel must use the approved canonical destination/,
  );
});

test('production YouTube destination is exact and keeps individual videos empty', () => {
  const library = toMediaLibrary(manifest, productionCurated);
  assert.deepEqual(library.youtubeChannel, {
    title: 'Justin Scott Dixon / Voyager',
    handle: '@justinscottdixon_voyager',
    href: 'https://www.youtube.com/@justinscottdixon_voyager',
  });
  assert.deepEqual(library.youtube, []);
});

test('one Music product contains audio and optional video modes without entering Cinema', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.equal(library.music[0].audioSrc, 'https://cdn.example/north.wav');
  assert.equal(library.music[0].videoSrc, 'https://cdn.example/north-video.mp4');
  assert.equal(library.music[0].videoAspect, 'portrait');
  assert.equal(library.music[0].visual.tag, 'VIZ-VOID');
  assert.equal(library.music[0].title, 'V_Magnetic North_');
  assert.equal(library.music[0].storeHref, '/store?product=audio-north');
  assert.equal(library.cinema.some((item) => item.src === library.music[0].videoSrc), false);
});

test('curated native video modes require complete and consistent aspect metadata', () => {
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, music: [{ productId: 'audio-north', musicVideoSrc: 'https://cdn.example/video.mp4' }] }),
    /Music Video.*dimensions/i,
  );
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, media: [{ ...curated.media[0], aspect: 'portrait' }] }),
    /Media.*aspect.*dimensions/i,
  );
});

test('empty curated providers produce explicit empty arrays without fabricated items', () => {
  const library = toMediaLibrary(manifest, { version: 1, music: [], media: [], youtube: [] });
  assert.deepEqual(library.media, []);
  assert.deepEqual(library.youtube, []);
  assert.equal(library.music[0].videoSrc, null);
});

test('curated entries must reference real Music products and HTTPS media', () => {
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, music: [{ productId: 'missing' }] }),
    /unknown Music product: missing/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, media: [{ id: 'bad', title: 'Bad', src: '/local.mp4', specs: 'MP4' }] }),
    /must be an HTTPS URL/,
  );
});

test('experience is enabled only when both real HTTPS entry assets exist', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.deepEqual(library.experience, {
    enabled: true,
    welcomeVideoSrc: 'https://cdn.example/viaims-welcome.mp4',
    ambientAudioSrc: 'https://cdn.example/viaims-ambient.wav',
  });
});

test('missing entry assets retain truthful Cinema fallback', () => {
  const library = toMediaLibrary(manifest, { version: 1, music: [], media: [], youtube: [] });
  assert.deepEqual(library.experience, {
    enabled: false,
    welcomeVideoSrc: null,
    ambientAudioSrc: null,
  });
});

test('partial or non-HTTPS entry configuration is rejected', () => {
  assert.throws(
    () => toMediaLibrary(manifest, {
      ...curated,
      experience: { welcomeVideoSrc: 'https://cdn.example/welcome.mp4' },
    }),
    /experience requires both welcomeVideoSrc and ambientAudioSrc/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, {
      ...curated,
      experience: {
        welcomeVideoSrc: '/welcome.mp4',
        ambientAudioSrc: 'https://cdn.example/ambient.wav',
      },
    }),
    /must be an HTTPS URL/,
  );
});
