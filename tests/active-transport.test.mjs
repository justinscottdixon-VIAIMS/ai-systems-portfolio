import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activePlayButtonState,
  activeStatusAfterSuccessfulPlay,
  activeTransportPolicy,
  createEndedEventToken,
  isCurrentEndedEventToken,
  runtimeVideoErrorAction,
  runActivePlaybackRetry,
  runCommittedPlayback,
  transportPlaybackForTab,
} from '../src/lib/active-transport.mjs';

test('runtime master-video failures route by intro phase, stage lease, and Cinema ownership', () => {
  assert.equal(runtimeVideoErrorAction({ introPhase: 'welcome' }), 'welcome-fallback');
  assert.equal(runtimeVideoErrorAction({
    introPhase: 'cinema',
    playback: { provider: 'music', id: 'music-video', mode: 'video', stageOwner: 'music' },
    hasLease: true,
  }), 'restore-lease');
  assert.equal(runtimeVideoErrorAction({
    introPhase: 'cinema',
    playback: { provider: 'media', id: 'media-video', mode: 'video', stageOwner: 'media' },
    hasLease: true,
  }), 'restore-lease');
  assert.equal(runtimeVideoErrorAction({
    introPhase: 'cinema',
    playback: { provider: 'cinema', id: 'cinema-a', mode: 'video', stageOwner: 'cinema' },
  }), 'cinema-retry');
  assert.equal(runtimeVideoErrorAction({
    introPhase: 'cinema',
    playback: { provider: 'music', id: 'song-a', mode: 'audio', stageOwner: 'cinema' },
  }), 'cinema-retry');
  assert.equal(runtimeVideoErrorAction({
    introPhase: 'cinema',
    playback: { provider: 'youtube', id: 'external', mode: 'external', stageOwner: 'youtube' },
  }), 'ignore');
});

const disabled = {
  playPause: false,
  previous: false,
  next: false,
  shuffle: false,
  repeat: false,
};

test('Cinema enables only its native playback and queue navigation', () => {
  assert.deepEqual(activeTransportPolicy({ provider: 'cinema', id: 'cinema-a', mode: 'video' }), {
    playPause: true,
    previous: true,
    next: true,
    shuffle: false,
    repeat: false,
  });
});

test('Music Audio and Video enable playback, product navigation, and Music queue controls', () => {
  const enabled = {
    playPause: true,
    previous: true,
    next: true,
    shuffle: true,
    repeat: true,
  };
  assert.deepEqual(activeTransportPolicy({ provider: 'music', id: 'music-a', mode: 'audio' }), enabled);
  assert.deepEqual(activeTransportPolicy({ provider: 'music', id: 'music-a', mode: 'video' }), enabled);
});

test('Media cannot route Previous or Next and cannot mutate Music queue controls', () => {
  assert.deepEqual(activeTransportPolicy({ provider: 'media', id: 'media-a', mode: 'video' }), {
    playPause: true,
    previous: false,
    next: false,
    shuffle: false,
    repeat: false,
  });
});

test('missing active identity disables every transport action', () => {
  assert.deepEqual(activeTransportPolicy({ provider: 'cinema', id: null, mode: 'video' }), disabled);
  assert.deepEqual(activeTransportPolicy({ provider: 'music', mode: 'audio' }), disabled);
  assert.deepEqual(activeTransportPolicy({ provider: 'media', id: '', mode: 'video' }), disabled);
});

test('YouTube foundation and unsupported playback disable every active transport action', () => {
  assert.deepEqual(activeTransportPolicy({ provider: 'youtube', mode: 'video' }), disabled);
  assert.deepEqual(activeTransportPolicy({ provider: 'music', mode: 'external' }), disabled);
  assert.deepEqual(activeTransportPolicy({ provider: 'unknown', mode: 'video' }), disabled);
});

test('the selected tab owns transport independently of the audible source', () => {
  const decks = {
    cinema: { provider: 'cinema', id: 'cinema-a', mode: 'video' },
    music: { provider: 'music', id: 'music-a', mode: 'audio' },
    media: { provider: 'media', id: 'media-a', mode: 'video' },
  };

  assert.deepEqual(transportPlaybackForTab('cinema', decks), decks.cinema);
  assert.deepEqual(transportPlaybackForTab('music', decks), decks.music);
  assert.deepEqual(transportPlaybackForTab('media', decks), decks.media);
  assert.deepEqual(transportPlaybackForTab('youtube', decks), {});
  assert.deepEqual(transportPlaybackForTab('credentials', decks), {});
});

test('active Play/Pause presentation derives visible text and accessible action from paused state', () => {
  assert.deepEqual(activePlayButtonState(true), { text: 'PLAY', ariaLabel: 'Play active item' });
  assert.deepEqual(activePlayButtonState(false), { text: 'PAUSE', ariaLabel: 'Pause active item' });
  assert.deepEqual(activePlayButtonState(undefined), { text: 'PLAY', ariaLabel: 'Play active item' });
});

test('successful active play recovers only a current Cinema playback error status', () => {
  const cinema = { provider: 'cinema', id: 'cinema-a', mode: 'video' };
  const playbackError = 'CINEMA PLAYBACK ERROR · autoplay rejected';

  assert.equal(activeStatusAfterSuccessfulPlay(cinema, playbackError), 'CINEMA LIVE');
  assert.equal(activeStatusAfterSuccessfulPlay(cinema, 'CINEMA LOADING'), 'CINEMA LOADING');
  assert.equal(
    activeStatusAfterSuccessfulPlay({ provider: 'music', id: 'music-a', mode: 'audio' }, playbackError),
    playbackError,
  );
  assert.equal(
    activeStatusAfterSuccessfulPlay({ provider: 'music', id: 'music-a', mode: 'video' }, 'MUSIC VIDEO LIVE'),
    'MUSIC VIDEO LIVE',
  );
  assert.equal(
    activeStatusAfterSuccessfulPlay({ provider: 'media', id: 'media-a', mode: 'video' }, 'MEDIA LIVE'),
    'MEDIA LIVE',
  );
});

test('queued manual Cinema retry handles rejection without generic status overwrite', async () => {
  const playback = { provider: 'cinema', id: 'cinema-a', mode: 'video' };
  const failure = new Error('user activation denied');
  let status = 'CINEMA PLAYBACK ERROR · autoplay rejected';
  let genericErrorCount = 0;
  let queue = Promise.resolve();
  const enqueue = (action) => {
    queue = queue.then(action).catch((error) => {
      genericErrorCount += 1;
      status = `PLAYBACK ERROR · ${error.message}`;
    });
    return queue;
  };

  const outcome = await enqueue(() => runActivePlaybackRetry({
    playback,
    currentStatus: status,
    startPlayback: async () => { throw failure; },
    onStatus: (nextStatus) => { status = nextStatus; },
  }));

  assert.equal(genericErrorCount, 0);
  assert.equal(status, 'CINEMA PLAYBACK ERROR · user activation denied');
  assert.deepEqual(outcome, {
    outcome: 'handled-error',
    status: 'CINEMA PLAYBACK ERROR · user activation denied',
    error: failure,
  });
});

test('ended-event token is valid only for the exact activation and effective source', () => {
  const playback = { provider: 'music', id: 'product-a', mode: 'audio' };
  const source = 'https://media.example/product-a.wav';
  const token = createEndedEventToken(playback, source);

  assert.deepEqual(token, { provider: 'music', id: 'product-a', mode: 'audio', source });
  assert.equal(isCurrentEndedEventToken(token, playback, source), true);
  assert.equal(isCurrentEndedEventToken(token, { ...playback, id: 'product-b' }, source), false);
  assert.equal(isCurrentEndedEventToken(token, { ...playback, provider: 'cinema', mode: 'video' }, source), false);
  assert.equal(isCurrentEndedEventToken(token, { ...playback, mode: 'video' }, source), false);
  assert.equal(isCurrentEndedEventToken(token, playback, 'https://media.example/replaced.wav'), false);
});

test('committed playback preserves a new selection and reports rejection after start fails', async () => {
  const order = [];
  const failure = new Error('autoplay rejected');
  let selected = 'old-cinema';

  await assert.rejects(
    runCommittedPlayback({
      commitSelection: async () => {
        order.push('commit');
        selected = 'new-cinema';
        return selected;
      },
      startPlayback: async (committed) => {
        order.push(`start:${committed}:${selected}`);
        throw failure;
      },
      onPlaying: async () => { order.push('playing'); },
      onRejected: async (error, committed) => {
        order.push(`rejected:${error.message}:${committed}:${selected}`);
      },
    }),
    failure,
  );

  assert.equal(selected, 'new-cinema');
  assert.deepEqual(order, [
    'commit',
    'start:new-cinema:new-cinema',
    'rejected:autoplay rejected:new-cinema:new-cinema',
  ]);
});

test('committed playback announces playing only after start resolves', async () => {
  const order = [];

  const result = await runCommittedPlayback({
    commitSelection: async () => {
      order.push('commit');
      return 'cinema-b';
    },
    startPlayback: async (committed) => {
      order.push(`start:${committed}`);
      await Promise.resolve();
      order.push('started');
      return 'playing-result';
    },
    onPlaying: async (committed, playbackResult) => {
      order.push(`playing:${committed}:${playbackResult}`);
    },
    onRejected: async () => { order.push('rejected'); },
  });

  assert.equal(result, 'playing-result');
  assert.deepEqual(order, ['commit', 'start:cinema-b', 'started', 'playing:cinema-b:playing-result']);
});
