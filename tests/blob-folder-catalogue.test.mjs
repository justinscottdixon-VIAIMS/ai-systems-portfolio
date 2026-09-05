import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlobFolderCatalogue,
  listCompletePrefix,
} from '../src/lib/blob-folder-catalogue.mjs';
import { createCatalogueRefreshState, refreshCatalogue } from '../src/lib/catalogue-refresh.mjs';

function blob(pathname, etag, overrides = {}) {
  return {
    pathname,
    etag,
    url: `https://store.example/${encodeURIComponent(pathname)}`,
    size: 1,
    uploadedAt: '2026-09-04T12:00:00.000Z',
    ...overrides,
  };
}

function pagesByPrefix(pages) {
  return async ({ prefix, cursor }) => {
    const providerPages = pages[prefix];
    const page = providerPages?.blobs
      ? (cursor === undefined ? providerPages : undefined)
      : providerPages?.[cursor ?? 'first'];
    if (!page) throw new Error(`unexpected page ${prefix} ${cursor ?? 'first'}`);
    return page;
  };
}

function acceptedPages({ cinema = [], music = [], media = [], visuals = [] } = {}) {
  return {
    'Cinema/': { blobs: cinema, hasMore: false },
    'Music/': { blobs: music, hasMore: false },
    'Media/': { blobs: media, hasMore: false },
    'Music-Visuals/': { blobs: visuals, hasMore: false },
  };
}

test('lists every page and keeps only direct children of the requested prefix', async () => {
  const calls = [];
  const listPage = async ({ prefix, cursor }) => {
    calls.push([prefix, cursor ?? null]);
    return cursor
      ? { blobs: [blob(`${prefix}Two.mp4`, 'e2')], hasMore: false }
      : { blobs: [blob(`${prefix}One.mp4`, 'e1'), blob(`${prefix}nested/skip.mp4`, 'e3')], hasMore: true, cursor: 'next' };
  };
  const result = await listCompletePrefix({ prefix: 'Cinema/', listPage });
  assert.deepEqual(result.map(({ pathname }) => pathname), ['Cinema/One.mp4', 'Cinema/Two.mp4']);
  assert.deepEqual(calls, [['Cinema/', null], ['Cinema/', 'next']]);
});

test('rejects incomplete or malformed pagination pages', async () => {
  for (const page of [
    { blobs: [], hasMore: true },
    { blobs: [], hasMore: true, cursor: 'again' },
    { blobs: [], hasMore: true, cursor: 'again' },
    { blobs: {}, hasMore: false },
    null,
  ]) {
    let call = 0;
    await assert.rejects(
      () => listCompletePrefix({
        prefix: 'Cinema/',
        listPage: async () => {
          call += 1;
          return call === 2 && page.cursor === 'again'
            ? { blobs: [], hasMore: true, cursor: 'again' }
            : page;
        },
      }),
      /Cinema\/.*(malformed|invalid pagination cursor)/i,
    );
  }
});

test('rejects objects outside the prefix and duplicate direct pathnames before filtering', async () => {
  await assert.rejects(
    () => listCompletePrefix({
      prefix: 'Cinema/',
      listPage: async () => ({ blobs: [blob('Music/Else.mp4', 'e1')], hasMore: false }),
    }),
    /Cinema\/.*outside/i,
  );
  await assert.rejects(
    () => listCompletePrefix({
      prefix: 'Cinema/',
      listPage: async () => ({ blobs: [blob('Cinema/Clip.txt', 'e1'), blob('Cinema/Clip.txt', 'e2')], hasMore: false }),
    }),
    /Cinema\/.*duplicate.*Clip\.txt/i,
  );
  await assert.rejects(
    () => listCompletePrefix({
      prefix: 'Cinema/',
      listPage: async () => ({ blobs: [{}], hasMore: false }),
    }),
    /Cinema\/.*malformed Blob object/i,
  );
});

test('ignores direct dotfiles and unsupported files while rejecting malformed eligible metadata', async () => {
  for (const [media, expectation] of [
    [blob('Cinema/Zero.mp4', 'zero', { size: 0 }), /Cinema\/.*positive.*size/i],
    [blob('Cinema/Fraction.mp4', 'fraction', { size: 1.5 }), /Cinema\/.*positive safe integer/i],
    [blob('Cinema/UnsafeInteger.mp4', 'unsafe-integer', { size: Number.MAX_SAFE_INTEGER + 1 }), /Cinema\/.*positive safe integer/i],
    [blob('Cinema/Unsafe.mp4', 'unsafe', { url: 'http://store.example/unsafe.mp4' }), /Cinema\/.*HTTPS/i],
    [blob('Cinema/Credentials.mp4', 'credentials', { url: 'https://user:password@store.example/credentials.mp4' }), /Cinema\/.*HTTPS/i],
    [blob('Cinema/NoEtag.mp4', undefined), /Cinema\/.*ETag/i],
    [blob('Cinema/NullTime.mp4', 'null-time', { uploadedAt: null }), /Cinema\/.*upload time/i],
    [blob('Cinema/InvalidTime.mp4', 'invalid-time', { uploadedAt: 'not-a-timestamp' }), /Cinema\/.*upload time/i],
    [blob('Cinema/ImpossibleTime.mp4', 'impossible-time', { uploadedAt: '2026-02-30T12:00:00.000Z' }), /Cinema\/.*upload time/i],
  ]) {
    await assert.rejects(
      () => buildBlobFolderCatalogue({
        listPage: pagesByPrefix(acceptedPages({ cinema: [media] })),
        readText: async () => '[]',
      }),
      expectation,
    );
  }

  const safe = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({
      cinema: [blob('Cinema/.hidden.mp4', 'dot'), blob('Cinema/Notes.txt', 'text')],
    })),
    readText: async () => '[]',
  });
  assert.deepEqual(safe.items, []);
});

test('rejects an unsafe playlist-order sidecar URL before reading it', async () => {
  for (const url of ['http://store.example/order.json', 'https://user:password@store.example/order.json']) {
    await assert.rejects(
      () => buildBlobFolderCatalogue({
        listPage: pagesByPrefix(acceptedPages({
          cinema: [blob('Cinema/playlist-order.json', 'order', { url })],
        })),
        readText: async () => {
          throw new Error('must not read an unsafe URL');
        },
      }),
      /Cinema\/.*playlist order.*HTTPS/i,
    );
  }
});

test('projects every supported extension with independent Music audio and video items', async () => {
  const envelope = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({
      cinema: ['mp4', 'mov', 'webm'].map((extension) => blob(`Cinema/File.${extension}`, `c-${extension}`)),
      music: ['wav', 'mp3', 'm4a', 'flac', 'aac'].map((extension) => blob(`Music/File.${extension}`, `a-${extension}`)).concat([
        blob('Music/Song.wav', 'song'),
        blob('Music/Film.mov', 'film-mov'),
        blob('Music/Film.mp4', 'film-mp4'),
      ]),
      media: ['mp4', 'mov', 'webm'].map((extension) => blob(`Media/File.${extension}`, `m-${extension}`)),
      visuals: ['mp4', 'mov', 'webm'].map((extension) => blob(`Music-Visuals/VIZ-VOID.${extension}`, `v-${extension}`)),
    })),
    readText: async () => '[]',
  });

  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'music').map((item) => [item.pathname, item.kind]),
    [
      ['Music/File.aac', 'audio'],
      ['Music/File.flac', 'audio'],
      ['Music/File.m4a', 'audio'],
      ['Music/File.mp3', 'audio'],
      ['Music/File.wav', 'audio'],
      ['Music/Film.mov', 'video'],
      ['Music/Film.mp4', 'video'],
      ['Music/Song.wav', 'audio'],
    ],
  );
  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'cinema').map((item) => [item.pathname, item.kind]),
    [
      ['Cinema/File.mov', 'video'],
      ['Cinema/File.mp4', 'video'],
      ['Cinema/File.webm', 'video'],
    ],
  );
  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'media').map((item) => [item.pathname, item.kind]),
    [
      ['Media/File.mov', 'video'],
      ['Media/File.mp4', 'video'],
      ['Media/File.webm', 'video'],
    ],
  );
  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'music-visuals').map((item) => [item.pathname, item.kind]),
    [
      ['Music-Visuals/VIZ-VOID.mov', 'video'],
      ['Music-Visuals/VIZ-VOID.mp4', 'video'],
      ['Music-Visuals/VIZ-VOID.webm', 'video'],
    ],
  );
  assert.equal(envelope.authoritative, true);
  assert.match(envelope.fingerprint, /^[a-f0-9]{64}$/);
});

test('uses listed-first provider order followed by deterministic natural filename order', async () => {
  const envelope = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({
      cinema: [
        blob('Cinema/Clip 10.mp4', 'ten'),
        blob('Cinema/Clip 2.mp4', 'two'),
        blob('Cinema/Finale.mp4', 'finale'),
        blob('Cinema/Opening.mp4', 'opening'),
        blob('Cinema/playlist-order.json', 'order'),
      ],
    })),
    readText: async (url) => {
      assert.match(url, /playlist-order\.json/);
      return '["Opening.mp4", "Finale.mp4"]';
    },
  });
  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'cinema').map((item) => item.pathname),
    ['Cinema/Opening.mp4', 'Cinema/Finale.mp4', 'Cinema/Clip 2.mp4', 'Cinema/Clip 10.mp4'],
  );
  assert.deepEqual(
    envelope.items.filter((item) => item.folder === 'cinema').map((item) => item.playlistOrder),
    [0, 1, 2, 3],
  );
});

test('rejects invalid optional sidecars and preserves independent provider orders', async () => {
  for (const sidecar of ['{', '["One.mp4", "One.mp4"]', '["Missing.mp4"]', '["nested/One.mp4"]']) {
    await assert.rejects(
      () => buildBlobFolderCatalogue({
        listPage: pagesByPrefix(acceptedPages({ cinema: [blob('Cinema/One.mp4', 'one'), blob('Cinema/playlist-order.json', 'order')] })),
        readText: async () => sidecar,
      }),
      /Cinema/i,
    );
  }

  const envelope = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({
      cinema: [blob('Cinema/Second.mp4', 'c2'), blob('Cinema/First.mp4', 'c1'), blob('Cinema/playlist-order.json', 'co')],
      music: [blob('Music/Second.mp3', 'm2'), blob('Music/First.mp3', 'm1'), blob('Music/playlist-order.json', 'mo')],
    })),
    readText: async (url) => url.includes('Cinema') ? '["Second.mp4"]' : '["First.mp3"]',
  });
  assert.deepEqual(envelope.items.map((item) => [item.folder, item.pathname, item.playlistOrder]), [
    ['cinema', 'Cinema/Second.mp4', 0],
    ['cinema', 'Cinema/First.mp4', 1],
    ['music', 'Music/First.mp3', 0],
    ['music', 'Music/Second.mp3', 1],
  ]);
});

test('an existing playlist sidecar must decode to an array', async (t) => {
  for (const source of ['null', '{}', '"One.mp4"', '42', 'true', 'false']) {
    await t.test(source, async () => {
      await assert.rejects(
        () => buildBlobFolderCatalogue({
          listPage: pagesByPrefix(acceptedPages({ cinema: [blob('Cinema/One.mp4', 'one'), blob('Cinema/playlist-order.json', 'order')] })),
          readText: async () => source,
        }),
        /Cinema\/? .*playlist order must be an array/i,
      );
    });
  }
});

test('only an absent sidecar or an empty array uses natural fallback order', async () => {
  const cinema = [blob('Cinema/Clip 10.mp4', 'ten'), blob('Cinema/Clip 2.mp4', 'two')];
  const absent = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({ cinema })),
    readText: async () => { throw new Error('absent sidecars must not be read'); },
  });
  const empty = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({ cinema: [...cinema, blob('Cinema/playlist-order.json', 'order')] })),
    readText: async () => '[]',
  });
  assert.deepEqual(absent.items.map(({ pathname }) => pathname), ['Cinema/Clip 2.mp4', 'Cinema/Clip 10.mp4']);
  assert.deepEqual(empty, absent);
});

test('filename title fallbacks keep every supported file browser-valid', async (t) => {
  for (const [provider, pathname, title] of [
    ['music', 'Music/master.wav', 'V_master.wav_'],
    ['music', 'Music/_.mp4', 'V__.mp4_'],
    ['music', 'Music/48k24b.wav', 'V_48k24b.wav_'],
    ['cinema', 'Cinema/_.mp4', '_.mp4'],
    ['media', 'Media/   .mov', '.mov'],
    ['visuals', 'Music-Visuals/_.webm', '_.webm'],
  ]) {
    await t.test(pathname, async () => {
      const envelope = await buildBlobFolderCatalogue({
        listPage: pagesByPrefix(acceptedPages({
          [provider]: [blob(pathname, 'fallback'), blob(`${pathname.slice(0, pathname.indexOf('/') + 1)}Normal.mp4`, 'normal')],
        })),
        readText: async () => '[]',
      });
      assert.equal(envelope.items.length, 2);
      assert.equal(envelope.items.find((item) => item.pathname === pathname).title, title);
      const refreshed = refreshCatalogue(createCatalogueRefreshState(), envelope);
      assert.equal(refreshed.status, 'accepted');
      assert.deepEqual(refreshed.state.items, envelope.items);
    });
  }
});

test('eligibility diagnostics use an injected callback outside the catalogue envelope', async () => {
  const diagnostics = [];
  const envelope = await buildBlobFolderCatalogue({
    listPage: pagesByPrefix(acceptedPages({ cinema: [blob('Cinema/Notes.txt', 'notes'), blob('Cinema/playlist-order.json', 'order')] })),
    readText: async () => '[]',
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  assert.deepEqual(diagnostics, [{
    code: 'BLOB_EXTENSION_OMITTED', provider: 'cinema', prefix: 'Cinema/', pathname: 'Cinema/Notes.txt',
    reason: 'file extension is not supported',
  }]);
  assert.deepEqual(Object.keys(envelope), ['authoritative', 'fingerprint', 'items']);
  assert.deepEqual(envelope.items, []);
});

test('uses canonical visual tags and hashes identical normalized inputs identically across page boundaries', async () => {
  const contents = [
    blob('Music/1._manic__viz-void.mp3', 'music'),
    blob('Music-Visuals/loop__viz-void.mp4', 'visual'),
  ];
  const onePage = pagesByPrefix(acceptedPages({ music: [contents[0]], visuals: [contents[1]] }));
  const twoPages = async ({ prefix, cursor }) => {
    if (prefix === 'Music/') return cursor
      ? { blobs: [], hasMore: false }
      : { blobs: [contents[0]], hasMore: true, cursor: 'music-next' };
    if (prefix === 'Music-Visuals/') return cursor
      ? { blobs: [], hasMore: false }
      : { blobs: [contents[1]], hasMore: true, cursor: 'visual-next' };
    return { blobs: [], hasMore: false };
  };
  const [first, second] = await Promise.all([
    buildBlobFolderCatalogue({ listPage: onePage, readText: async () => '[]' }),
    buildBlobFolderCatalogue({ listPage: twoPages, readText: async () => '[]' }),
  ]);
  assert.deepEqual(first.items.map(({ pathname, visualTag }) => [pathname, visualTag]), [
    ['Music/1._manic__viz-void.mp3', 'VIZ-VOID'],
    ['Music-Visuals/loop__viz-void.mp4', 'VIZ-VOID'],
  ]);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.items, second.items);
});
