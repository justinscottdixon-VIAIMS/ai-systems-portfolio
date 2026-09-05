import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
const recovery = source.slice(
  source.indexOf('\tasync function recoverMasterVideoFailure('),
  source.indexOf('\tfunction bindMusicVisualActivationEvents('),
);

async function runRecovery({ failedPlayback, restored, audibleProvider, status }) {
  const context = {
    audible: { current: { provider: audibleProvider, id: 'song' } },
    async restoreLeasedCinema() { return restored; },
    renderMusicAudioIdentity(_id, label) { status.textContent = label; },
    renderCinemaIdentity(label) { status.textContent = label; },
    hideMirrorWings() {},
    retryCinema: {},
    session: { playback: {} },
    nowPlayingStatus: status,
    applyActiveTransportPolicy() {},
    renderCinemaAudioInvitation() {},
    currentCinema() { return null; },
  };
  runInNewContext(recovery, context);
  await context.recoverMasterVideoFailure('restore-lease', failedPlayback);
}

test('failed Music video does not claim an unavailable Cinema visual was restored', async () => {
  const status = { textContent: '' };
  await runRecovery({
    failedPlayback: { provider: 'music', id: 'mv', mode: 'video' },
    restored: { snapshot: null },
    audibleProvider: 'music',
    status,
  });
  assert.match(status.textContent, /MUSIC VIDEO UNAVAILABLE/);
  assert.match(status.textContent, /CINEMA UNAVAILABLE/);
  assert.doesNotMatch(status.textContent, /CINEMA VISUAL RESTORED/);
});
