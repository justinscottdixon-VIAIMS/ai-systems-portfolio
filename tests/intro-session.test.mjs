import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginExperience,
  completeWelcome,
  createIntroSession,
  failAmbient,
  failWelcome,
} from '../src/lib/intro-session.mjs';

const configured = {
  enabled: true,
  welcomeVideoSrc: 'https://cdn.example/welcome.mp4',
  ambientAudioSrc: 'https://cdn.example/ambient.wav',
};

test('missing entry assets start directly in truthful Cinema fallback', () => {
  assert.deepEqual(createIntroSession({ enabled: false }), {
    available: false,
    phase: 'cinema',
    ambientStatus: 'unavailable',
    status: 'CINEMA READY',
  });
});

test('enabled experience without a welcome video stays in truthful Cinema fallback', () => {
  assert.deepEqual(createIntroSession({ enabled: true, ambientAudioSrc: configured.ambientAudioSrc }), {
    available: false,
    phase: 'cinema',
    ambientStatus: 'unavailable',
    status: 'CINEMA READY',
  });
});

test('enabled experience without ambient audio stays in truthful Cinema fallback', () => {
  assert.deepEqual(createIntroSession({ enabled: true, welcomeVideoSrc: configured.welcomeVideoSrc }), {
    available: false,
    phase: 'cinema',
    ambientStatus: 'unavailable',
    status: 'CINEMA READY',
  });
});

test('configured assets wait for the explicit visitor gesture', () => {
  const session = createIntroSession(configured);
  assert.equal(session.available, true);
  assert.equal(session.phase, 'awaiting-entry');
  assert.equal(session.ambientStatus, 'ready');
  assert.equal(beginExperience(session).phase, 'welcome');
});

test('the welcome ended event hands the stage to Cinema while ambient continues', () => {
  const entered = beginExperience(createIntroSession(configured));
  assert.deepEqual(completeWelcome(entered), {
    ...entered,
    phase: 'cinema',
    ambientStatus: 'playing',
    status: 'CINEMA LIVE · AMBIENT AUDIO LIVE',
  });
});

test('welcome failure continues to Cinema and ambient failure preserves visuals', () => {
  const entered = beginExperience(createIntroSession(configured));
  assert.equal(failWelcome(entered).phase, 'cinema');
  assert.equal(failWelcome(entered).status, 'WELCOME VIDEO UNAVAILABLE · CINEMA CONTINUING');
  const withoutAmbient = failAmbient(entered);
  assert.equal(withoutAmbient.phase, 'welcome');
  assert.equal(withoutAmbient.ambientStatus, 'failed');
  assert.equal(withoutAmbient.status, 'AMBIENT AUDIO UNAVAILABLE · VISUAL EXPERIENCE CONTINUING');
});

test('ambient failure after Cinema preserves the visual Cinema phase', () => {
  const cinema = completeWelcome(beginExperience(createIntroSession(configured)));
  const withoutAmbient = failAmbient(cinema);
  assert.equal(withoutAmbient.phase, 'cinema');
  assert.equal(withoutAmbient.ambientStatus, 'failed');
  assert.equal(withoutAmbient.status, 'AMBIENT AUDIO UNAVAILABLE · VISUAL EXPERIENCE CONTINUING');
});

test('repeated ambient runtime errors are idempotent', () => {
  const failed = failAmbient(beginExperience(createIntroSession(configured)));
  assert.equal(failAmbient(failed), failed);
});

test('invalid repeated transitions are idempotent', () => {
  const fallback = createIntroSession({ enabled: false });
  assert.deepEqual(beginExperience(fallback), fallback);
  assert.deepEqual(completeWelcome(fallback), fallback);
});
