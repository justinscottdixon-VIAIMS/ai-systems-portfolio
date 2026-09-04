import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMusicVisualTag,
  formatMusicDisplayTitle,
  parseMusicIdentity,
} from '../src/lib/music-title.mjs';

test('Music titles remove delivery metadata and receive one global frame', () => {
  assert.equal(formatMusicDisplayTitle('1._metafysion one.mp3'), 'V_Metafysion One_');
  assert.equal(formatMusicDisplayTitle('V_edges fade_voo1.1.2_48k24b_mstr.mp3'), 'V_Edges Fade_');
  assert.equal(formatMusicDisplayTitle('V_manic_manIA__mstr.mp3'), 'V_Manic manIA_');
});

test('mixed creative capitals survive while ordinary lowercase words capitalize', () => {
  assert.equal(formatMusicDisplayTitle('V_aLiEn signal.mp3'), 'V_aLiEn Signal_');
});

test('one reserved visual token is canonical and absent from the display title', () => {
  assert.equal(extractMusicVisualTag('V_manic manIA__viz-void.mp3'), 'VIZ-VOID');
  assert.deepEqual(parseMusicIdentity('V_manic manIA__VIZ-VOID_mstr.mp3'), {
    title: 'V_Manic manIA_',
    visualTag: 'VIZ-VOID',
  });
});

test('exact overrides retain creative case and receive one frame', () => {
  assert.equal(formatMusicDisplayTitle('source.mp3', { overrideTitle: 'V_eXAct intent_' }), 'V_eXAct intent_');
});

test('multiple visual tokens are rejected', () => {
  assert.throws(
    () => extractMusicVisualTag('song__VIZ-VOID__VIZ-NEON.mp3'),
    /one visual tag/i,
  );
});
