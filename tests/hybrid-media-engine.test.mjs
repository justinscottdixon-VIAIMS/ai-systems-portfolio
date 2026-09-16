import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../src/components/HybridMediaEngine.astro', import.meta.url);
const stylePath = new URL('../src/styles/hybrid-media-engine.css', import.meta.url);

async function source(url) {
  return readFile(url, 'utf8');
}

test('runtime catalogue owns replaceable rows and one persistent delegated listener per list', async () => {
  const component = await source(componentPath);
  for (const module of ['runtime-catalogue-controller', 'runtime-media-library']) {
    assert.match(component, new RegExp(`from '../lib/${module}\\.mjs'`));
  }
  for (const name of ['cinemaButtons', 'allCinemaItems', 'allMediaItems', 'musicProducts', 'productById', 'entryCueControls']) {
    assert.match(component, new RegExp(`\\blet ${name} =`));
  }
  for (const provider of ['cinema', 'music', 'media']) {
    assert.equal((component.match(new RegExp(`${provider}Playlist\\.addEventListener\\('click'`, 'g')) ?? []).length, 1);
    assert.match(component, new RegExp(`function render${provider[0].toUpperCase() + provider.slice(1)}Rows\\(`));
  }
  assert.match(component, /event\.target\.closest\(/);
  assert.doesNotMatch(component, /cinemaButtons\.forEach\(\(button\) => \{\s*button\.addEventListener\('click'/);
  assert.doesNotMatch(component, /querySelectorAll\('(\.media-cue|\[data-music-mode[^']*)'\)\.forEach\(\(button\) => \{\s*button\.addEventListener\('click'/);
  const mediaPanel = component.slice(component.indexOf('id="panel-media"'), component.indexOf('id="panel-youtube"'));
  assert.match(mediaPanel, /id="playlist-media"/);
  assert.doesNotMatch(mediaPanel, /library\.media\.length === 0\s*\?/);
});

test('runtime catalogue uses safe text rendering and one visible lifecycle', async () => {
  const component = await source(componentPath);
  assert.match(component, /document\.createElement\('button'\)/);
  assert.match(component, /\.textContent = item\.title/);
  assert.match(component, /\.dataset\.musicMode =/);
  assert.doesNotMatch(component, /innerHTML|insertAdjacentHTML|createContextualFragment/);
  const binding = 'bindRuntimeCatalogueLifecycle(runtimeCatalogue, { windowTarget: window, documentTarget: document })';
  assert.equal(component.split(binding).length - 1, 1);
  assert.match(component, /applyRuntimeLibrary\(toRuntimeMediaLibrary\(items\), items, lifecycle\)/);
  assert.match(component, /transitionQueue\.then\(\(\) => lifecycle\.isCurrent\(\) && applyRuntimeLibrary/);
});

test('native video leases suspend tagged overlays and restore the saved visual owner transactionally', async () => {
  const component = await source(componentPath);
  const captureStart = component.indexOf('function captureControllerState(');
  const capture = component.slice(captureStart, component.indexOf('\n\tfunction ', captureStart + 1));
  assert.match(capture, /visualOwner: stage\.dataset\.visualOwner/);
  const leaseStart = component.indexOf('async function activateNativeLease(');
  const lease = component.slice(leaseStart, component.indexOf('\n\tasync function ', leaseStart + 1));
  assert.match(lease, /stage\.dataset\.visualOwner = 'cinema'/);
  const restoreStart = component.indexOf('async function restoreLeasedCinema(');
  const restore = component.slice(restoreStart, component.indexOf('\n\tasync function ', restoreStart + 1));
  assert.match(restore, /restoredSnapshot\?\.visualOwner === 'music-tag'/);
  const rollbackStart = component.indexOf('async function rollbackControllerState(');
  const rollback = component.slice(rollbackStart, component.indexOf('\n\tasync function ', rollbackStart + 1));
  assert.match(rollback, /stage\.dataset\.visualOwner = prior\.stageSnapshot\.visualOwner/);
});

test('both fullscreen modes remove inline stage audio and retry targets from hit testing', async () => {
  const css = await source(stylePath);
  for (const mode of [':fullscreen', '[data-fullscreen-mode="viewport"]']) {
    for (const control of ['.cinema-audio-invitation', '.cinema-retry']) {
      const selector = `.fullscreen-shell${mode} ${control}`;
      const rule = css.slice(css.indexOf(selector)).split('}')[0];
      assert.ok(css.includes(selector), `missing fullscreen rule for ${selector}`);
      assert.match(rule, /display:\s*none\s*;/);
    }
  }
});

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

test('Mirror Wings sample opposite source edges and reflect both outward', async () => {
  const css = await source(stylePath);
  assert.match(css, /\.media-wing-shell\s*\{[\s\S]+width:\s*var\(--mirror-wing-inline-size, 0px\)/s);
  assert.match(css, /\.media-wing\s*\{[\s\S]+position:\s*absolute[\s\S]+width:\s*var\(--mirror-master-inline-size, 0px\)[\s\S]+transform:\s*scaleX\(calc\(-1 \* var\(--mirror-edge-stretch, 1\)\)\)/s);
  assert.match(css, /\.media-wing--left\s*\{[\s\S]+left:\s*100%[\s\S]+transform-origin:\s*left center/s);
  assert.match(css, /\.media-wing--right\s*\{[\s\S]+right:\s*100%[\s\S]+transform-origin:\s*right center/s);
  assert.match(css, /data-mirror-wings="on"/);
  assert.match(css, /media-wing-shell--left[\s\S]+linear-gradient\(to right, rgb\(0 0 0 \/ 0\.18\), #000 42%, #000 100%\)/s);
  assert.match(css, /media-wing-shell--right[\s\S]+linear-gradient\(to left, rgb\(0 0 0 \/ 0\.18\), #000 42%, #000 100%\)/s);
});

test('Mirror Wings reconcile both responsive directions and motion preference changes', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('function reconcileMirrorWings(');
  const end = component.indexOf('\n\tfunction alignMirrorWings', start);
  const reconciliation = component.slice(start, end);
  assert.match(reconciliation, /resolveMirrorWingPresentation\(\{/);
  assert.doesNotMatch(reconciliation, /if \(stage\.dataset\.mirrorWings !== 'on'\) return/);
  assert.match(reconciliation, /stage\.dataset\.mirrorWings = 'off'/);
  assert.match(reconciliation, /pendingMirrorActivationToken/);
  assert.match(component, /mobileMirrorQuery\.addEventListener\('change', reconcileMirrorWings\)/);
  assert.match(component, /reducedMotionQuery\.addEventListener\('change', reconcileMirrorWings\)/);
});

test('Mirror Wing activation consumes coordinated follower readiness failures', async () => {
  const component = await source(componentPath);
  assert.match(component, /prepareMirrorFollowers\(mv, wings, \{ isCurrent \}\)/);
  assert.match(component, /commitMirrorFollowers\(mv, wings, \{/);
  assert.match(component, /pendingMirrorActivationToken/);
  assert.match(component, /if \(!prepared\)[\s\S]+if \(isCurrent\(\)\) handleMirrorWingFailure\(\)/s);
  assert.match(component, /function handleMirrorWingFailure\(\)[\s\S]+stage\.dataset\.mirrorFailure = 'true'[\s\S]+stage\.dataset\.mirrorWings = 'off'[\s\S]+hideMirrorWings\(\)/s);
});

test('Mirror Wings become visible only after current atomic activation commits', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function activateMirrorWings(');
  const end = component.indexOf('\n\tasync function playMirrorWings', start);
  const activation = component.slice(start, end);
  assert.match(activation, /await prepareMirrorFollowers/);
  assert.match(activation, /await commitMirrorFollowers/);
  assert.match(activation, /if \(!committed \|\| !isCurrent\(\)\)[\s\S]+return/s);
  assert.match(activation, /stage\.dataset\.mirrorWings = 'on'/);
  assert.equal(activation.indexOf("stage.dataset.mirrorWings = 'on'") > activation.indexOf('await commitMirrorFollowers'), true);
  assert.match(component, /committedMirrorActivationToken/);
  assert.match(activation, /shouldCleanupStale: \(\) => pendingMirrorActivationToken === null[\s\S]+committedMirrorActivationToken === null/s);
});

test('Mirror Wing runtime errors and alignment exceptions isolate the balanced pair', async () => {
  const component = await source(componentPath);
  assert.match(component, /alignMirrorFollowers\(mv, wings, \{[\s\S]+active: stage\.dataset\.mirrorWings === 'on'[\s\S]+onFailure: handleMirrorWingFailure/s);
  assert.match(component, /function handleMirrorWingRuntimeError\(\)[\s\S]+stage\.dataset\.mirrorWings === 'on'[\s\S]+pendingMirrorActivationToken !== null[\s\S]+handleMirrorWingFailure\(\)/s);
  assert.match(component, /bindMirrorFollowerFailures\(wings, handleMirrorWingRuntimeError\)/);
});

test('hybrid engine imports presentation rules and classifies source metadata', async () => {
  const component = await source(componentPath);
  assert.match(component, /from '\.\.\/lib\/media-presentation\.mjs'/);
  assert.match(component, /classifyMediaAspect\(mv\.videoWidth, mv\.videoHeight\)/);
  assert.match(component, /alignMirrorFollowers\(mv, wings/);
  assert.match(component, /data-cinema-src=/);
  assert.match(component, /data-audio-src=/);
});

test('master playback events propagate to active decorative wings', async () => {
  const component = await source(componentPath);
  assert.match(component, /mv\.addEventListener\('play'/);
  assert.match(component, /mv\.addEventListener\('pause'/);
  assert.match(component, /playMirrorWings\(\)/);
  assert.match(component, /pauseMirrorWings\(\)/);
});

test('shared stage resolves internal Mirror Wings policy for each native provider', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-stage-provider=\{library\.experience\.enabled \? 'welcome' : 'cinema'\}/);
  assert.match(component, /data-mirror-wings="off"/);
  assert.match(component, /from '\.\.\/lib\/mirror-wings\.mjs'/);
  assert.match(component, /normalizeStageProvider\(provider, 'video'\)/);
  assert.match(component, /resolveMirrorWingPresentation\(\{/);
  assert.match(component, /provider: stage\.dataset\.stageProvider/);
  assert.match(component, /stage\.dataset\.mirrorWings = 'off'/);
  assert.match(component, /stage\.dataset\.mirrorWings = 'on'/);
  assert.match(component, /stage\.style\.setProperty\('--mirror-wing-inline-size'/);
  assert.match(component, /stage\.style\.setProperty\('--mirror-edge-scale'/);
});

test('Cinema and Music Video update provider identity before requesting a source', async () => {
  const component = await source(componentPath);
  const switchStart = component.indexOf('async function switchVideo(');
  const switchEnd = component.indexOf('\n\tfunction currentCinema', switchStart);
  assert.match(component.slice(switchStart, switchEnd), /setStageProvider\('cinema'\)[\s\S]+mv\.src = currentCinema\(\)\.src/s);
  const leaseStart = component.indexOf('async function activateNativeLease(');
  const leaseEnd = component.indexOf('\n\tasync function activateCinema', leaseStart);
  assert.match(component.slice(leaseStart, leaseEnd), /setStageProvider\(normalizeStageProvider\(provider, 'video'\)\)[\s\S]+mv\.src = src/s);
});

test('active Mirror Wings follow resolved policy instead of aspect alone', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('function activeMirrorWings()');
  const end = component.indexOf('\n\tasync function playVideoStack', start);
  assert.match(component.slice(start, end), /stage\.dataset\.mirrorWings === 'on'/);
  assert.doesNotMatch(component.slice(start, end), /usesMirrorWings/);
});

test('leased presentation restores the exact mirror state before Music Audio activation', async () => {
  const component = await source(componentPath);
  assert.match(component, /captureCinemaSnapshot\(mv, stage,[^\n]+wings\)/);
  assert.match(component, /restoreCinemaSnapshot\(mv, stage, restoredSnapshot, wings, restoreOptions\)/);
  assert.match(component, /const releasedLease = session\.lease \? await restoreLeasedCinema\(\{ resumeAudible: false \}\) : null;[\s\S]+activateSource\(session, \{ provider: 'music', id: productId, mode: 'audio' \}\)/);
  assert.equal((component.match(/mv\.addEventListener\('ended'/g) ?? []).length, 1);
});

test('stage precedes one integrated player dock containing every command surface', async () => {
  const component = await source(componentPath);
  const stage = component.indexOf('id="master-stage-container"');
  const dock = component.indexOf('data-player-dock');
  const tabs = component.indexOf('data-player-tabs');
  const command = component.indexOf('data-player-command-strip');
  const status = component.indexOf('data-player-status-strip');
  const tray = component.indexOf('data-provider-tray');
  assert.equal(stage > -1 && dock > stage && tabs > dock && command > tabs && status > command && tray > status, true);
  assert.equal((component.match(/data-stage-command-header/g) ?? []).length, 0);
  assert.match(component, /id="now-playing-status"[^>]+aria-live="polite"/s);
});

test('stage owns the Cinema audio invitation and dock owns transport, meters, and cart', async () => {
  const component = await source(componentPath);
  const stageStart = component.indexOf('id="master-stage-container"');
  const stageEnd = component.indexOf('<audio id="music-audio"', stageStart);
  const dockStart = component.indexOf('data-player-dock', stageEnd);
  const dockEnd = component.indexOf('data-operational-deck', dockStart);
  const stage = component.slice(stageStart, stageEnd);
  const dock = component.slice(dockStart, dockEnd);

	assert.match(stage, /id="cinema-audio-invitation"[^>]+data-cinema-audio-invitation/s);
  assert.equal((component.match(/data-cinema-audio-invitation/g) ?? []).length, 1);
  for (const id of ['active-prev', 'active-play', 'active-next', 'music-shuffle', 'music-repeat', 'return-to-cinema', 'meter-l', 'meter-r', 'cart-count']) {
    assert.match(dock, new RegExp(`id="${id}"`));
    assert.doesNotMatch(stage, new RegExp(`id="${id}"`));
  }
});

test('empty Cinema fallback disables native controls and exposes programmatic selection and meter labels', async () => {
  const component = await source(componentPath);
  assert.match(component, /id="cinema-audio-invitation"[^>]+disabled=\{library\.experience\.enabled \|\| !firstCinema\}/s);
  const invitationStart = component.indexOf('function renderCinemaAudioInvitation()');
  const invitationEnd = component.indexOf('\n\tfunction ', invitationStart + 1);
  const invitation = component.slice(invitationStart, invitationEnd);
  assert.match(invitation, /const available = Boolean\(currentCinema\(\)\) && session\.playback\.stageOwner === 'cinema'/);
  for (const id of ['active-prev', 'active-play', 'active-next']) {
    assert.match(component, new RegExp(`id="${id}"[^>]+disabled=\\{library\\.experience\\.enabled \\|\\| !firstCinema\\}`, 's'));
  }
  assert.match(component, /class="cinema-cue"[^>]+aria-current=\{index === 0 \? 'true' : 'false'\}/s);
	assert.match(component, /const selected = playlistIndex >= 0 && playlistIndex === cinema\.cursor/);
	assert.match(component, /button\.setAttribute\('aria-current', String\(selected\)\)/);
  assert.match(component, /id="meter-l"[^>]+aria-label="Left channel level"/s);
  assert.match(component, /id="meter-r"[^>]+aria-label="Right channel level"/s);
});

test('Media Library exposes five accessible tabs and independent panels', async () => {
  const component = await source(componentPath);
  assert.match(component, /role="tablist"[^>]+aria-label="Media Library"/s);
  for (const provider of ['cinema', 'music', 'media', 'youtube', 'credentials']) {
    assert.match(component, new RegExp(`id="tab-${provider}"[^>]+role="tab"`, 's'));
    assert.match(component, new RegExp(`id="panel-${provider}"[^>]+role="tabpanel"`, 's'));
  }
  assert.match(component, /selectBrowseTab\(/);
  assert.match(component, /<PublicationsAndCredits\s*\/>/);
  assert.match(component, /activeSourceKind\.textContent = 'CREDENTIALS'/);
  assert.match(component, /nowPlayingTitle\.textContent = 'Career & Release Index'/);
});

test('YouTube tab leads with the approved channel and keeps curated videos independent', async () => {
  const component = await source(componentPath);
  assert.match(component, /library\.youtubeChannel/);
  assert.match(component, /class="youtube-channel"/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(component, /library\.youtube\.map/);
});

test('Music rows keep one product identity with distinct Audio and optional Video actions', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-product-id=/);
  assert.match(component, /data-music-mode="audio"/);
  assert.match(component, /data-music-mode="video"/);
  assert.match(component, /id="music-shuffle"/);
  assert.match(component, /id="music-repeat"/);
  assert.match(component, /id="buy-license"/);
  assert.match(component, /id="cart-count"/);
  assert.match(component, /data-music-mode="audio"[^>]+aria-label={`Play \$\{item\.title\}`}/s);
  assert.match(component, /data-music-mode="video"[^>]+aria-label={`Play \$\{item\.title\} video`}/s);
});

test('mobile portrait policy and inline transport are exposed through one controller', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /from '\.\.\/lib\/mobile-media\.mjs'/);
  assert.match(component, /eligibleVideoItems\(allCinemaItems, window\.innerWidth\)/);
  assert.match(component, /data-media-aspect=\{item\.aspect/);
  assert.match(component, /id="active-seek"[^>]+aria-label="Seek active item"/s);
  assert.match(component, /id="active-elapsed"/);
  assert.match(component, /id="active-remaining"/);
  assert.match(component, /id="enter-fullscreen"[^>]+disabled/s);
  assert.match(component, /data-music-mode="audio"[^>]+aria-label={`Play \$\{item\.title\}`}/s);
  assert.match(component, /data-music-mode="audio"[^>]*>PLAY<\/button>/s);
  assert.doesNotMatch(component, /data-music-mode="audio"[^>]*>AUDIO<\/button>/s);
  const mobile = css.slice(css.indexOf('@media (max-width:767px)'));
  assert.match(mobile, /\[data-media-aspect\]:not\(\[data-media-aspect="portrait"\]\)[^{]*\{[^}]*display:\s*none/s);
});

test('inline seek control uses the instrument-panel treatment and reports played progress', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /activeSeek\.style\.setProperty\('--seek-progress',\s*`\$\{seekProgress\}%`\)/);
  assert.match(css, /\.player-dock__seek\s*\{[^}]*font:[^}]*ui-monospace/s);
  assert.match(css, /#active-seek\s*\{[^}]*appearance:\s*none[^}]*linear-gradient\([^}]*--seek-progress/s);
  assert.match(css, /#active-seek::-webkit-slider-thumb\s*\{[^}]*appearance:\s*none[^}]*background:\s*rgb\(181 155 102\)/s);
  assert.match(css, /#active-seek::-moz-range-thumb\s*\{[^}]*background:\s*rgb\(181 155 102\)/s);
  assert.match(css, /#active-seek:focus-visible\s*\{[^}]*outline:\s*2px solid rgb\(181 155 102\)/s);
  assert.match(css, /#active-seek:disabled\s*\{[^}]*opacity:/s);
});

test('branded fullscreen shell has a seek-free safe-area transport and viewport fallback', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /data-fullscreen-shell/);
  assert.match(component, /data-fullscreen-overlay/);
  for (const id of ['exit-fullscreen', 'fullscreen-prev', 'fullscreen-play', 'fullscreen-next', 'fullscreen-mute', 'fullscreen-elapsed', 'fullscreen-remaining', 'fullscreen-title']) {
    assert.match(component, new RegExp(`id="${id}"`));
  }
  const overlayStart = component.indexOf('data-fullscreen-overlay');
  const overlayEnd = component.indexOf('</div>', overlayStart);
  assert.doesNotMatch(component.slice(overlayStart, overlayEnd), /type="range"/);
  assert.match(component, /fullscreenShell\.requestFullscreen/);
  assert.match(component, /fullscreenShell\.dataset\.fullscreenMode = 'viewport'/);
  assert.match(component, /fullscreenchange/);
  assert.match(component, /fullscreenerror/);
  assert.match(component, /enterFullscreen\.focus\(\)/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /env\(safe-area-inset-/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /opacity\s+1250ms/);
  assert.match(css, /min-(?:height|width):\s*44px/);
});

test('fullscreen transport uses shared commands and glass capsule icon groups', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);

  assert.match(component, /class="fullscreen-overlay__capsule fullscreen-overlay__capsule--primary"/);
  assert.match(component, /class="fullscreen-overlay__capsule fullscreen-overlay__capsule--utility"/);
  assert.equal((component.match(/class="fullscreen-overlay__icon(?:\s|\")/g) ?? []).length >= 7, true);
  assert.doesNotMatch(component, /fullscreenPrev\.addEventListener\('click', \(\) => activePrev\.click\(\)\)/);
  assert.doesNotMatch(component, /fullscreenPlay\.addEventListener\('click', \(\) => activePlay\.click\(\)\)/);
  assert.doesNotMatch(component, /fullscreenNext\.addEventListener\('click', \(\) => activeNext\.click\(\)\)/);
  assert.match(component, /activePrev\.addEventListener\('click', requestPrevious\)/);
  assert.match(component, /fullscreenPrev\.addEventListener\('click', requestPrevious\)/);
  assert.match(component, /activePlay\.addEventListener\('click', requestPlayPause\)/);
  assert.match(component, /fullscreenPlay\.addEventListener\('click', requestPlayPause\)/);
  assert.match(component, /activeNext\.addEventListener\('click', requestNext\)/);
  assert.match(component, /fullscreenNext\.addEventListener\('click', requestNext\)/);
  assert.match(css, /\.fullscreen-overlay__capsule\s*\{[\s\S]*border-radius:\s*999px[\s\S]*backdrop-filter:\s*blur/s);
  assert.match(css, /\.fullscreen-overlay__button\s*\{[\s\S]*border:\s*0/s);
});

test('fullscreen mute preserves single-source arbitration and controller ownership', async () => {
  const component = await source(componentPath);
  assert.match(component, /setPlaybackMuted/);
  const start = component.indexOf('async function toggleFullscreenMute()');
  const end = component.indexOf('\n\tfunction ', start + 1);
  const toggle = component.slice(start, end);

  assert.match(toggle, /controlledPlayback\.provider === 'cinema'/);
  assert.match(toggle, /audible\.current\?\.provider === 'cinema'\s*\? restoreCinemaAudio\(\)\s*:\s*hearCinema\(\)/s);
  assert.match(toggle, /transportTargetIsLoaded\(controlledPlayback\).*session = setPlaybackMuted\(session, media\.muted\)/s);
  assert.equal(toggle.indexOf('await (audible.current?.provider') < toggle.indexOf('renderFullscreenSession()'), true);
  assert.match(component, /function requestFullscreenMute\(\)[\s\S]+enqueueMediaControlTransition\(\(\) => toggleFullscreenMute\(\)\)/s);
  assert.match(component, /fullscreenMute\.addEventListener\('click', requestFullscreenMute\)/);
});

test('tagged Music visuals are a separate muted layer with stale-safe continuity', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /id="music-visual-video"[^>]+muted[^>]+playsinline[^>]+loop/s);
  assert.match(component, /createMusicVisualSession/);
  assert.match(component, /visualSession\.activate\(product\.visual\)/);
  assert.match(component, /visualActivation\.action === 'keep'/);
  assert.match(component, /visualSession\.releaseToCinema/);
  assert.match(component, /data-visual-owner/);
  assert.match(component, /data-visual-transition/);
  assert.match(css, /music-visual-video/);
  assert.match(css, /data-visual-transition="fade-out"/);
  assert.doesNotMatch(css, /cinema[^}]*fade-in/i);
});

test('reviewed fullscreen and visual races are generation and interaction safe', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /suppressMusicVisualMediaSync/);
  assert.match(component, /visualActivation\.token/);
  assert.match(component, /bindMusicVisualActivationEvents\(visualActivation\.token, product\.visual\.src\)/);
  assert.match(component, /bindMusicVisualFadeCompletion\(transition\.token\)/);
  assert.match(component, /replaceMusicVisualGenerationElement\(\)/);
  assert.match(component, /musicVisualVideo = supersedeMediaElement\(musicVisualVideo\)/);
  assert.match(component, /musicVisualActivationEvents\?\.abort\(\)/);
  assert.match(component, /musicVisualFadeEvents\?\.abort\(\)/);
  const eventBindingStart = component.indexOf('function bindMusicVisualActivationEvents');
  const eventBindingEnd = component.indexOf('\n\tfunction ', eventBindingStart + 1);
  assert.doesNotMatch(component.slice(eventBindingStart, eventBindingEnd), /dataset\.visualToken|dataset\.visualSource/);
  assert.match(component, /recoverMusicVisualFailure/);
  assert.match(component, /fullscreenOverlay\.addEventListener\('pointerdown'/);
  assert.match(component, /fullscreenPlay\.setAttribute\('aria-label'/);
  assert.match(component, /for \(const control of \[fullscreenMute, activeMute\]\)/);
  assert.match(component, /control\.setAttribute\('aria-label', media\.muted \? 'Unmute active item' : 'Mute active item'\)/);
  assert.match(component, /exitFullscreen\.focus\(\)/);
  assert.match(component, /mv\.load\(\)/);
  assert.match(css, /\.fullscreen-overlay\s*\{[\s\S]*transition:\s*opacity 1250ms/s);
  assert.match(css, /\.fullscreen-overlay__header strong\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /-webkit-line-clamp:\s*2/);
});

test('mobile queue rebuild preserves an eligible tagged visual presentation', async () => {
  const component = await source(componentPath);
  const rebuildStart = component.indexOf('function rebuildEligibleVideoQueues(');
  const rebuildEnd = component.indexOf('\n\tfunction ', rebuildStart + 1);
  const rebuild = component.slice(rebuildStart, rebuildEnd);
  assert.match(rebuild, /preserveMusicVisualPresentation/);
  assert.match(rebuild, /stage\.dataset\.visualOwner === 'music-tag'/);
  assert.match(rebuild, /stage\.dataset\.mediaAspect/);
});

test('mobile inline and Music row actions meet 44px touch targets', async () => {
  const css = await source(stylePath);
  const mobile = css.slice(css.indexOf('@media (max-width:767px)'));
  assert.match(mobile, /\.player-dock button,[\s\S]*\.player-dock a[^{]*\{[^}]*min-height:\s*44px[^}]*min-width:\s*44px/s);
});

test('compact trays show six 46px rows and scroll internally', async () => {
  const css = await source(stylePath);
  assert.match(css, /--provider-row-height:\s*46px/);
  assert.match(css, /max-height:\s*calc\(var\(--provider-row-height\)\s*\*\s*6/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /min-height:\s*var\(--provider-row-height\)/);
  assert.match(css, /\n\s*height:\s*var\(--provider-row-height\);/);
});

test('populated playlists expose a dedicated accessible scroll rail', async () => {
  const component = await source(componentPath);
  assert.match(component, /class="media-library__scroll-shell"/);
  assert.match(component, /data-playlist-scroll-rail/);
  assert.match(component, /role="scrollbar"/);
  assert.match(component, /aria-controls=/);
  assert.match(component, /data-playlist-scroll-thumb/);
});

test('playlist wheel and keyboard input are owned only by the dedicated rail', async () => {
  const component = await source(componentPath);
  assert.match(component, /playlistScrollTarget/);
	assert.match(component, /playlistWheelTarget/);
  assert.match(component, /playlistRails\.forEach/);
  assert.match(component, /rail\.addEventListener\('wheel'/);
  assert.match(component, /rail\.addEventListener\('keydown'/);
  assert.doesNotMatch(component, /items\.addEventListener\('wheel'/);
	assert.match(component, /items\.children\[1\]\.offsetTop\s*-\s*items\.children\[0\]\.offsetTop/);
	assert.match(component, /if \(target === null\) return;[\s\S]+event\.preventDefault\(\)/s);
  assert.match(component, /aria-valuemax/);
  assert.match(component, /aria-valuenow/);
});

test('fine pointers reserve playlist scrolling for the rail while touch keeps direct scrolling', async () => {
  const css = await source(stylePath);
  assert.match(css, /overscroll-behavior:\s*auto/);
  assert.match(css, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
  const finePointer = css.slice(css.indexOf('@media (hover: hover) and (pointer: fine)'));
  assert.match(finePointer, /\.media-library__items\s*\{[^}]*overflow-y:\s*hidden/s);
  assert.match(finePointer, /\.playlist-scroll-rail\s*\{[^}]*display:\s*block/s);
});

test('responsive dock keeps accessible scrollable tabs and compact Music rows', async () => {
  const css = await source(stylePath);
  assert.match(css, /\.player-dock/);
  assert.match(css, /\.media-library__tabs/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  const mobile = css.slice(css.indexOf('@media (max-width:767px)'));
  assert.match(mobile, /\.music-product\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.doesNotMatch(mobile, /\.music-product\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/s);
});

test('active transport applies provider policy and guards provider-specific mutations', async () => {
  const component = await source(componentPath);
  assert.match(component, /activePlayButtonState, activeTransportPolicy/);
  assert.match(component, /transportPlaybackForTab/);
  assert.match(component, /const policy = activeTransportPolicy\(controlledPlayback\)/);
  const renderTabStart = component.indexOf('function renderTab(');
  const renderTabEnd = component.indexOf('\n\tfunction ', renderTabStart + 1);
  const renderTab = component.slice(renderTabStart, renderTabEnd);
  assert.match(renderTab, /renderTransportDeckIdentity\(activeTab\)/);
  assert.match(renderTab, /syncTransportTime\(\)/);
  assert.match(component, /control\.disabled = !enabled/);
  assert.match(component, /control\.setAttribute\('aria-disabled', String\(!enabled\)\)/);

  const previousHandler = component.slice(
    component.indexOf('function requestPrevious()'),
    component.indexOf('function requestNext()'),
  );
  assert.match(previousHandler, /if \(!policy\.previous\) return/);
  assert.match(previousHandler, /controlledPlayback\.provider === 'music'/);
  assert.match(previousHandler, /controlledPlayback\.provider === 'cinema'/);
  assert.doesNotMatch(previousHandler, /else .*activateCinema/);

  const nextHandler = component.slice(
    component.indexOf('function requestNext()'),
    component.indexOf("activePlay.addEventListener('click'"),
  );
  assert.match(nextHandler, /if \(!policy\.next\) return/);
  assert.match(nextHandler, /controlledPlayback\.provider === 'music'/);
  assert.match(nextHandler, /controlledPlayback\.provider === 'cinema'/);
  assert.doesNotMatch(nextHandler, /else .*activateCinema/);

  const musicControls = component.slice(
    component.indexOf("shuffleButton.addEventListener('click'"),
	component.indexOf("cinemaAudioInvitation.addEventListener('click'"),
  );
  assert.match(musicControls, /if \(!policy\.shuffle\) return/);
  assert.match(musicControls, /if \(!policy\.repeat\) return/);
});

test('active Play/Pause text and aria-label synchronize from actual media events', async () => {
  const component = await source(componentPath);
  const syncStart = component.indexOf('function syncActivePlayButton()');
  const syncEnd = component.indexOf('\n\tfunction ', syncStart + 1);
  const syncFunction = component.slice(syncStart, syncEnd);
  assert.equal(syncStart > -1, true);
  assert.match(syncFunction, /activePlayButtonState\(transportTargetIsLoaded\(\) \? media\.paused : true\)/);
  assert.match(syncFunction, /activePlay\.textContent = state\.text/);
  assert.match(syncFunction, /activePlay\.setAttribute\('aria-label', state\.ariaLabel\)/);
  assert.equal((component.match(/syncActivePlayButton\(\)/g) ?? []).length >= 5, true);
  assert.doesNotMatch(component, /activePlay\.textContent = '(?:PLAY|PAUSE)'/);
});

test('native ended events capture their scoped source identity before queueing and validate inside the queue', async () => {
  const component = await source(componentPath);

  const musicStart = component.indexOf("musicAudio.addEventListener('ended'");
  const musicEnd = component.indexOf('\n\t});', musicStart) + '\n\t});'.length;
  const music = component.slice(musicStart, musicEnd);
  assert.equal(music.indexOf('createEndedEventToken(session.playback, musicAudio.currentSrc || musicAudio.src)') < music.indexOf('enqueueTransition(async () =>'), true);
  assert.match(music, /if \(!isCurrentEndedEventToken\(endedToken, session\.playback, musicAudio\.currentSrc \|\| musicAudio\.src\)\) return/);

  const videoStart = component.indexOf("mv.addEventListener('ended'");
  const videoEnd = component.indexOf('\n\t});', videoStart) + '\n\t});'.length;
  const video = component.slice(videoStart, videoEnd);
  assert.equal(video.indexOf('createEndedEventToken(session.playback, mv.currentSrc || mv.src)') < video.indexOf('enqueueTransition(async () =>', video.indexOf('if (session.lease)')), true);
  assert.match(video, /if \(!isCurrentEndedEventToken\(leaseToken, session\.playback, mv\.currentSrc \|\| mv\.src\)\) return/);
  assert.match(video, /if \(!isCurrentCinemaEndedToken\(cinemaToken, cinema, mv\.currentSrc \|\| mv\.src\)\) return/);
});

test('Cinema selection commits identity and loading state before playback orchestration', async () => {
  const component = await source(componentPath);
  for (const symbol of ['createEndedEventToken', 'isCurrentEndedEventToken', 'runCommittedPlayback']) {
    assert.match(component, new RegExp(`import \\{[^}]*\\b${symbol}\\b[^}]*\\} from '\\.\\.\\/lib\\/active-transport\\.mjs'`));
  }
  assert.match(component, /async function switchVideo\(index, playImmediate = true\)/);
  assert.doesNotMatch(component, /if \(playImmediate\) void playVideoStack\(\)/);

  const activateStart = component.indexOf('async function activateCinema(index, { preserveAudibleAuthority = false } = {})');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activateCinema = component.slice(activateStart, activateEnd);
  const orchestrate = activateCinema.indexOf('runCommittedPlayback({');
  const commit = activateCinema.indexOf('commitSelection: async () =>');
  const select = activateCinema.indexOf('await switchVideo(index, false)');
  const ownership = activateCinema.indexOf("session = activateSource(session, { provider: 'cinema'", select);
  const loading = activateCinema.indexOf("renderCinemaIdentity('CINEMA LOADING')");
  const start = activateCinema.indexOf('startPlayback: () => playVideoStack()');
  const playing = activateCinema.indexOf('onPlaying: async () =>');
  const rejected = activateCinema.indexOf('CINEMA PLAYBACK ERROR');
  assert.equal(orchestrate > -1 && commit > orchestrate, true);
  assert.equal(select > commit && ownership > select && loading > ownership, true);
  assert.equal(start > loading && playing > start && rejected > start, true);
  assert.match(activateCinema, /preserveMusicTransport\s*\? 'MUSIC AUDIO LIVE · CINEMA MOTION RESTORED'\s*:\s*'CINEMA LIVE'/s);
  assert.match(activateCinema, /const preserveMusicTransport = preserveAudibleAuthority/);
  assert.match(activateCinema, /session\.activeTab === 'cinema'.*renderTransportDeckIdentity\('cinema'\)/s);
  assert.match(component, /function renderCinemaIdentity\(status\)[\s\S]+applyActiveTransportPolicy\(\)/);
  assert.match(activateCinema, /hasReportedTransitionError = true/);
  assert.match(component, /if \(!hasReportedTransitionError\)[^\n]+PLAYBACK ERROR/);

  assert.match(component, /cinemaPlaylist\.addEventListener\('click'[\s\S]+enqueueMediaControlTransition\(\(\) => \{[\s\S]+return activateCinema/);
  assert.match(component, /mv\.addEventListener\('ended'[\s\S]+enqueueTransition\(async \(\) =>/);
});

test('validated experience configuration alone gates the entry overlay and media sources', async () => {
  const component = await source(componentPath);
  const conditionalStart = component.indexOf('{library.experience.enabled && (');
  const gate = component.indexOf('id="experience-entry-gate"');
  const label = 'CLICK TO ENTER THE VIAIMS EXPERIENCE';
  const labelIndex = component.indexOf(label);
  const conditionalEnd = component.indexOf('\n\t\t)}', conditionalStart);
  const masterStart = component.indexOf('<video id="master-video"');

  assert.equal(conditionalStart > -1 && gate > conditionalStart && labelIndex > gate, true);
  assert.equal(conditionalEnd > labelIndex && masterStart > conditionalEnd, true);
  assert.equal((component.match(new RegExp(label, 'g')) ?? []).length, 1);
  assert.match(component, /data-entry-enabled=\{String\(library\.experience\.enabled\)\}/);

  const masterTag = component.slice(masterStart, component.indexOf('></video>', masterStart));
  assert.match(masterTag, /src=\{library\.experience\.enabled \? library\.experience\.welcomeVideoSrc : firstCinema\?\.src \?\? ''\}/);
  assert.match(masterTag, /autoplay=\{!library\.experience\.enabled\}/);
  assert.doesNotMatch(masterTag, /src=["'][^"']+["']/);
  assert.doesNotMatch(masterTag, /\sloop(?:\s|>|=)/);

  const ambientStart = component.indexOf('<audio id="ambient-audio"');
  const ambientTag = component.slice(ambientStart, component.indexOf('></audio>', ambientStart));
  assert.equal(ambientStart > masterStart, true);
  assert.match(ambientTag, /src=\{library\.experience\.ambientAudioSrc \?\? ''\}/);
  assert.match(ambientTag, /\sloop(?:\s|$)/);
  assert.match(ambientTag, /preload="metadata"/);
  assert.doesNotMatch(ambientTag, /src=["'][^"']+["']/);
});

test('intro availability is initialized from validated DOM media sources after element lookup', async () => {
  const component = await source(componentPath);
  const masterLookup = component.indexOf("const mv = root.querySelector('#master-video')");
  const ambientLookup = component.indexOf("const ambientAudio = root.querySelector('#ambient-audio')");
  const initialization = component.indexOf('let introSession = createIntroSession({');

  assert.equal(masterLookup > -1 && ambientLookup > masterLookup && initialization > ambientLookup, true);
  const block = component.slice(initialization, component.indexOf('\n\t});', initialization) + '\n\t});'.length);
  assert.match(block, /enabled: root\.dataset\.entryEnabled === 'true'/);
  assert.match(block, /welcomeVideoSrc: mv\.getAttribute\('src'\) \|\| ''/);
  assert.match(block, /ambientAudioSrc: ambientAudio\.getAttribute\('src'\) \|\| ''/);
  assert.doesNotMatch(block, /JSON\.parse/);
});

test('entry click initiates ambient and welcome playback synchronously before handling either result', async () => {
  const component = await source(componentPath);
  const handlerStart = component.indexOf("entryButton?.addEventListener('click', () => {");
  const handlerEnd = component.indexOf('\n\t});', handlerStart) + '\n\t});'.length;
  const handler = component.slice(handlerStart, handlerEnd);
  const ambientPlay = handler.indexOf('const ambientAttempt = ambientAudio.play()');
  const welcomePlay = handler.indexOf('const welcomeAttempt = playVideoStack()');
  const firstHandledResult = handler.indexOf('void ambientAttempt.catch');

  assert.equal(handlerStart > -1 && handlerEnd > handlerStart, true);
  assert.doesNotMatch(handler.slice(0, ambientPlay), /\bawait\s/);
  assert.equal(ambientPlay > -1 && welcomePlay > ambientPlay && firstHandledResult > welcomePlay, true);
  assert.match(handler, /introSession = beginExperience\(introSession\)/);
  assert.match(handler, /entryGate\.hidden = true/);
  assert.match(handler, /void welcomeAttempt\.catch\(\(\) => enqueueTransition\(\(\) => continueFromWelcomeFailure\(\)\)\)/);
  assert.match(handler, /void ambientAttempt\.catch\(handleAmbientFailure\)/);
});

test('ambient runtime errors revoke ambient authority and preserve visual playback', async () => {
  const component = await source(componentPath);
  assert.match(component, /removeAudibleProvider/);

  const handlerStart = component.indexOf('function handleAmbientFailure()');
  const handlerEnd = component.indexOf('\n\n\tentryButton', handlerStart + 1);
  const handler = component.slice(handlerStart, handlerEnd);
  assert.equal(handlerStart > -1, true);
  assert.match(handler, /const failed = failAmbient\(introSession\)/);
  assert.match(handler, /if \(failed === introSession\) return/);
  assert.match(handler, /introSession = failed/);
  assert.match(handler, /audible = removeAudibleProvider\(audible, 'ambient'\)/);
  assert.match(handler, /suspendedForStageLease = removeAudibleProvider\(suspendedForStageLease, 'ambient'\)/);
  assert.match(handler, /nowPlayingStatus\.textContent = introSession\.status/);
  assert.doesNotMatch(handler, /pauseVideoStack|switchVideo|activateCinema|mv\.src/);

  assert.match(component, /ambientAudio\.addEventListener\('error', handleAmbientFailure\)/);
  const entryStart = component.indexOf("entryButton?.addEventListener('click'");
  const entryEnd = component.indexOf('\n\t});', entryStart) + '\n\t});'.length;
  assert.match(component.slice(entryStart, entryEnd), /void ambientAttempt\.catch\(handleAmbientFailure\)/);
});

test('welcome media events hand the stage to current Cinema once through guarded transitions', async () => {
  const component = await source(componentPath);
  const finishStart = component.indexOf('async function finishWelcome()');
  const failureStart = component.indexOf('async function continueFromWelcomeFailure()');
	const finish = component.slice(finishStart, failureStart);
	const failureEnd = component.indexOf('async function returnMusicQueueToCinema()', failureStart + 1);
  const failure = component.slice(failureStart, failureEnd);

  assert.match(finish, /if \(introSession\.phase !== 'welcome'\) return/);
	assert.equal(finish.indexOf('introSession = completeWelcome(introSession)') < finish.indexOf('await activateCinema(cinema.cursor, { preserveAudibleAuthority: true })'), true);
	assert.equal((finish.match(/activateCinema\(cinema\.cursor, \{ preserveAudibleAuthority: true \}\)/g) ?? []).length, 1);
  assert.doesNotMatch(finish, /setTimeout|setInterval/);

  assert.match(failure, /if \(introSession\.phase !== 'welcome'\) return/);
	assert.equal(failure.indexOf('introSession = failWelcome(introSession)') < failure.indexOf('await activateCinema(cinema.cursor, { preserveAudibleAuthority: true })'), true);
	assert.equal((failure.match(/activateCinema\(cinema\.cursor, \{ preserveAudibleAuthority: true \}\)/g) ?? []).length, 1);

  const endedStart = component.indexOf("mv.addEventListener('ended'");
  const endedEnd = component.indexOf('\n\t});', endedStart) + '\n\t});'.length;
  const ended = component.slice(endedStart, endedEnd);
  assert.match(ended, /if \(introSession\.phase === 'welcome'\) \{/);
  assert.match(ended, /enqueueTransition\(\(\) => finishWelcome\(\)\)/);
  assert.equal(ended.indexOf('finishWelcome()') < ended.indexOf('createEndedEventToken('), true);

  const errorStart = component.indexOf("mv.addEventListener('error'");
  const errorEnd = component.indexOf('\n\t});', errorStart) + '\n\t});'.length;
  const error = component.slice(errorStart, errorEnd);
  assert.match(error, /runtimeVideoErrorAction/);
  assert.match(error, /if \(action === 'welcome-fallback'\)/);
  assert.match(error, /enqueueTransition\(\(\) => continueFromWelcomeFailure\(\)\)/);
});

test('master-video runtime errors restore leases or expose a Cinema retry through guarded transitions', async () => {
  const component = await source(componentPath);
  assert.match(component, /runtimeVideoErrorAction/);

  const recoveryStart = component.indexOf('async function recoverMasterVideoFailure(');
  const recoveryEnd = component.indexOf('\n\tasync function ', recoveryStart + 1);
  const recovery = component.slice(recoveryStart, recoveryEnd);
  assert.equal(recoveryStart > -1, true);
  assert.match(recovery, /if \(action === 'restore-lease'\)/);
  assert.match(recovery, /await restoreLeasedCinema\(\)/);
  assert.match(recovery, /MUSIC VIDEO UNAVAILABLE|MEDIA UNAVAILABLE/);
  assert.match(recovery, /if \(action === 'cinema-retry'\)/);
  assert.match(recovery, /retryCinema\.hidden = false/);
  assert.match(recovery, /retryCinema\.disabled = false/);
  assert.match(recovery, /RETRY AVAILABLE/);
  assert.match(recovery, /MUSIC AUDIO CONTINUING/);

  const errorStart = component.indexOf("mv.addEventListener('error'");
  const errorEnd = component.indexOf('\n\t});', errorStart) + '\n\t});'.length;
  const error = component.slice(errorStart, errorEnd);
  assert.match(error, /const action = runtimeVideoErrorAction\(/);
  assert.match(error, /if \(action === 'restore-lease'\)/);
  assert.match(error, /createEndedEventToken\(session\.playback, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(error, /isCurrentEndedEventToken\(errorToken, session\.playback, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(error, /if \(action === 'cinema-retry'\)/);
  assert.match(error, /createCinemaEndedToken\(cinema, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(error, /isCurrentCinemaEndedToken\(errorToken, cinema, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(error, /recoverMasterVideoFailure\(action, failedPlayback\)/);
});

test('entry lock blocks playback controls until either welcome handoff restores normal policy', async () => {
  const component = await source(componentPath);
  assert.match(component, /let entryControlsLocked = introSession\.phase !== 'cinema'/);
  assert.match(component, /function enqueueMediaControlTransition\(action\) \{\s*if \(entryControlsLocked\) return/s);

  const policyStart = component.indexOf('function applyActiveTransportPolicy()');
  const policyEnd = component.indexOf('\n\tfunction ', policyStart + 1);
  const policy = component.slice(policyStart, policyEnd);
  assert.match(policy, /const enabled = !referenceReturnState && !entryControlsLocked && policy\[action\]/);

  const availabilityStart = component.indexOf('function syncEntryControlAvailability()');
  const availabilityEnd = component.indexOf('\n\tfunction ', availabilityStart + 1);
  const availability = component.slice(availabilityStart, availabilityEnd);
  assert.match(availability, /for \(const control of entryCueControls\)/);
  assert.match(availability, /control\.disabled = entryControlsLocked/);
	assert.match(availability, /renderCinemaAudioInvitation\(\)/);
  assert.match(availability, /applyActiveTransportPolicy\(\)/);

  for (const literal of [
    'cinemaButtons',
    "...root.querySelectorAll('[data-music-mode]')",
    "...root.querySelectorAll('.media-cue')",
    'returnButton',
  ]) {
    assert.equal(component.includes(literal), true, `entry cue controls must include ${literal}`);
  }

  for (const listener of ["cinemaPlaylist.addEventListener('click'", 'cinemaAudioInvitation.addEventListener']) {
    const start = component.indexOf(listener);
    const end = component.indexOf('\n\t});', start) + '\n\t});'.length;
    assert.equal(start > -1, true);
    assert.match(component.slice(start, end), /enqueueMediaControlTransition\(/);
  }

  for (const functionName of ['requestPlayPause', 'requestPrevious', 'requestNext']) {
    const start = component.indexOf(`function ${functionName}()`);
    const end = component.indexOf('\n\tfunction ', start + 1);
    assert.match(component.slice(start, end), /enqueueMediaControlTransition\(/);
  }

  for (const functionName of ['finishWelcome', 'continueFromWelcomeFailure']) {
    const start = component.indexOf(`async function ${functionName}()`);
    const end = component.indexOf('\n\tasync function ', start + 1);
    const handoff = component.slice(start, end);
    assert.match(handoff, /finally \{\s*entryControlsLocked = false;\s*syncEntryControlAvailability\(\);\s*\}/s);
  }

	assert.match(component, /id="cinema-audio-invitation"[^>]+disabled=\{library\.experience\.enabled \|\| !firstCinema\}/s);
  assert.match(component, /class="cinema-cue"[^>]+disabled=\{library\.experience\.enabled\}/s);
});

test('entry gate is a readable, focus-visible overlay above the master video', async () => {
  const css = await source(stylePath);
  const gateStart = css.indexOf('.experience-entry-gate {');
  const gateEnd = css.indexOf('}', gateStart);
  const gate = css.slice(gateStart, gateEnd);
  const masterStart = css.indexOf('.media-master {');
  const masterEnd = css.indexOf('}', masterStart);
  const master = css.slice(masterStart, masterEnd);
  const buttonStart = css.indexOf('#enter-viaims-experience {');
  const buttonEnd = css.indexOf('}', buttonStart);
  const button = css.slice(buttonStart, buttonEnd);
  const focusStart = css.indexOf('#enter-viaims-experience:focus-visible {');
  const focusEnd = css.indexOf('}', focusStart);
  const focus = css.slice(focusStart, focusEnd);

  assert.equal(gateStart > -1 && buttonStart > -1 && focusStart > -1, true);
  assert.match(gate, /position:\s*absolute/);
  assert.match(gate, /inset:\s*0/);
  const gateZ = Number(gate.match(/z-index:\s*(\d+)/)?.[1]);
  const masterZ = Number(master.match(/z-index:\s*(\d+)/)?.[1]);
  assert.equal(gateZ > 10 && gateZ > masterZ, true);
  assert.match(gate, /display:\s*(?:grid|flex)/);
  assert.match(gate, /(?:place-items:\s*center|align-items:\s*center[\s\S]+justify-content:\s*center)/);
  assert.match(gate, /background:\s*rgb\([^;]+\/\s*0\.[5-9][0-9]*\)/);
  assert.match(gate, /backdrop-filter:\s*blur\(/);

  assert.match(button, /min-height:\s*(?:44px|2\.75rem)/);
  assert.match(button, /padding:/);
  assert.match(button, /border:/);
  assert.match(button, /background:/);
  assert.match(button, /color:/);
  assert.match(focus, /outline:\s*[1-9][^;]+/);
  assert.match(focus, /outline-offset:/);
  assert.doesNotMatch(`${gate}\n${button}\n${focus}`, /animation|transition/);
});

test('Cinema continuity is the sole visual selection cursor', async () => {
  const component = await source(componentPath);
  assert.match(component, /advanceCinema, createCinemaContinuity, createCinemaEndedToken, isCurrentCinemaEndedToken, selectCinema/);
  assert.match(component, /let cinema = createCinemaContinuity\(videoPlaylist\)/);
  assert.doesNotMatch(component, /\bcurrentVidIdx\b/);

  const currentStart = component.indexOf('function currentCinema()');
  const currentEnd = component.indexOf('\n\tfunction ', currentStart + 1);
  const current = component.slice(currentStart, currentEnd);
  assert.match(current, /videoPlaylist\[cinema\.cursor\] \?\? null/);

  const switchStart = component.indexOf('async function switchVideo(');
  const switchEnd = component.indexOf('\n\tfunction ', switchStart + 1);
  const switchVideo = component.slice(switchStart, switchEnd);
  assert.match(switchVideo, /cinema = selectCinema\(cinema, index\)/);
  assert.match(switchVideo, /mv\.src = currentCinema\(\)\.src/);
});

test('Music Media and YouTube rows preserve independent accessible selections', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);

  assert.match(component, /class="music-product"[^>]+aria-current="false"/s);
  assert.match(component, /class="media-cue"[^>]+aria-current="false"/s);
  assert.match(component, /class="youtube-cue"[^>]+aria-current="false"/s);

  const stateStart = component.indexOf('function updateProviderCueState(provider, id)');
  const stateEnd = component.indexOf('\n\tfunction ', stateStart + 1);
  const state = component.slice(stateStart, stateEnd);
  assert.equal(stateStart > -1, true);
  assert.match(state, /music:\s*\{ selector: '\.music-product', dataKey: 'productId' \}/);
  assert.match(state, /media:\s*\{ selector: '\.media-cue', dataKey: 'mediaId' \}/);
  assert.match(state, /youtube:\s*\{ selector: '\.youtube-cue', dataKey: 'youtubeId' \}/);
  assert.match(state, /row\.classList\.toggle\('is-active', selected\)/);
  assert.match(state, /row\.setAttribute\('aria-current', String\(selected\)\)/);

  const musicStart = component.indexOf('async function activateMusicAudio(');
  const musicEnd = component.indexOf('\n\tasync function ', musicStart + 1);
  const music = component.slice(musicStart, musicEnd);
  assert.equal(music.indexOf("updateProviderCueState('music', productId)") > music.indexOf('await musicAudio.play()'), true);

  const leaseStart = component.indexOf('async function activateNativeLease(');
  const leaseEnd = component.indexOf('\n\tasync function ', leaseStart + 1);
  const lease = component.slice(leaseStart, leaseEnd);
  assert.equal(lease.indexOf('updateProviderCueState(provider, id)') > lease.indexOf('await playVideoStack()'), true);

  const youtubeStart = component.indexOf("root.querySelectorAll('.youtube-cue')");
  const youtubeEnd = component.indexOf('\n\t});', youtubeStart) + '\n\t});'.length;
  assert.match(component.slice(youtubeStart, youtubeEnd), /updateProviderCueState\('youtube', button\.dataset\.youtubeId\)/);

  assert.match(css, /\.music-product\.is-active,\s*\.media-cue\.is-active,\s*\.youtube-cue\.is-active\s*\{/s);
});

test('master ended keeps welcome first, leases generic, and Cinema independent', async () => {
  const component = await source(componentPath);
  const start = component.indexOf("mv.addEventListener('ended'");
  const end = component.indexOf('\n\t});', start) + '\n\t});'.length;
  const ended = component.slice(start, end);
  const welcome = ended.indexOf("if (introSession.phase === 'welcome')");
  const lease = ended.indexOf('if (session.lease)');
  const leaseToken = ended.indexOf('createEndedEventToken(session.playback, mv.currentSrc || mv.src)');
  const cinemaToken = ended.indexOf('createCinemaEndedToken(cinema, mv.currentSrc || mv.src)');

  assert.equal(welcome > -1 && lease > welcome, true);
  assert.equal(leaseToken > lease && cinemaToken > leaseToken, true);
  assert.match(ended, /isCurrentEndedEventToken\(leaseToken, session\.playback, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(ended, /isCurrentCinemaEndedToken\(cinemaToken, cinema, mv\.currentSrc \|\| mv\.src\)/);
  assert.match(ended, /cinema = advanceCinema\(cinema, 1\)/);
  assert.match(ended, /activateCinema\(cinema\.cursor, \{ preserveAudibleAuthority: true \}\)/);

  const cinemaBranch = ended.slice(cinemaToken);
  assert.doesNotMatch(cinemaBranch, /session\.playback\.provider === 'cinema'/);
  assert.equal(cinemaBranch.indexOf('cinema = advanceCinema(cinema, 1)') < cinemaBranch.indexOf('activateCinema(cinema.cursor'), true);
});

test('Music Audio ended remains scoped to the exact Music activation', async () => {
  const component = await source(componentPath);
  const start = component.indexOf("musicAudio.addEventListener('ended'");
  const end = component.indexOf('\n\t});', start) + '\n\t});'.length;
  const ended = component.slice(start, end);
  const musicGuard = ended.indexOf("if (!(session.playback.provider === 'music' && session.playback.mode === 'audio')) return");
  const tokenCapture = ended.indexOf('const endedToken = createEndedEventToken');
  assert.equal(musicGuard > -1 && musicGuard < tokenCapture, true);
  assert.match(ended, /const endedToken = createEndedEventToken\(session\.playback, musicAudio\.currentSrc \|\| musicAudio\.src\)/);
  assert.match(ended, /isCurrentEndedEventToken\(endedToken, session\.playback, musicAudio\.currentSrc \|\| musicAudio\.src\)/);
  assert.match(ended, /session\.playback\.provider === 'music' && session\.playback\.mode === 'audio'/);
  assert.match(ended, /advanceMusic\(1\)/);
  assert.doesNotMatch(ended, /advanceCinema|activateCinema/);
});

test('stage exposes one accessible reversible Cinema-audio invitation', async () => {
  const component = await source(componentPath);
  const buttonStart = component.indexOf('id="cinema-audio-invitation"');
  const buttonEnd = component.indexOf('</button>', buttonStart);
  const button = component.slice(buttonStart, buttonEnd);
  assert.equal(buttonStart > -1, true);
  assert.match(button, /type="button"/);
  assert.match(button, /class="cinema-audio-invitation"/);
  assert.match(button, /aria-pressed="false"/);
  assert.match(button, /class="cinema-audio-invitation__wave"[^>]+aria-hidden="true"|aria-hidden="true"[^>]+class="cinema-audio-invitation__wave"/);
  assert.match(button, /id="cinema-audio-label">HEAR CINEMA</);
  assert.doesNotMatch(component, /VIDEO AUDIO MUTED|VIDEO AUDIO LIVE|savedCinemaMute|toggleVideoMute/);
});

test('HEAR CINEMA transaction suspends the exact audible element and rolls back rejection', async () => {
  const component = await source(componentPath);
  for (const symbol of ['claimCinemaAudio', 'createAudibleSource', 'restorePriorAudio', 'selectAudibleTrack']) {
    assert.match(component, new RegExp(`import \\{[^}]*\\b${symbol}\\b[^}]*\\} from '\\.\\.\\/lib\\/audible-source\\.mjs'`));
  }
  assert.match(component, /let audible = createAudibleSource\(/);
  const start = component.indexOf('async function hearCinema()');
  const end = component.indexOf('\n\tasync function ', start + 1);
  const hear = component.slice(start, end);

  assert.match(hear, /if \(session\.playback\.stageOwner !== 'cinema'\) return/);
  assert.match(hear, /const priorSession = session/);
  assert.match(hear, /const priorElement = currentAudibleElement\(audible\)/);
  assert.match(hear, /selectAudibleTrack\(audible, \{ \.\.\.audible\.current, currentTime: priorElement\.currentTime \}\)/);
  assert.equal(hear.indexOf('currentTime: priorElement.currentTime') < hear.indexOf('priorElement.pause()'), true);
  assert.match(hear, /audible = claimCinemaAudio\(audible\)/);
  assert.match(hear, /session = activateSource\(session, \{[\s\S]+provider: 'cinema',[\s\S]+muted: false/);
  assert.equal(hear.indexOf('mv.muted = false') < hear.indexOf('await playVideoStack()'), true);
  assert.match(hear, /catch \(error\) \{[\s\S]+mv\.muted = true[\s\S]+audible = prior[\s\S]+session = priorSession/s);
  assert.match(hear, /priorElement\.currentTime = prior\.current\.currentTime[\s\S]+await priorElement\.play\(\)/s);
});

test('CINEMA AUDIO LIVE restores exact ambient or Music identity and rolls back rejection', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function restoreCinemaAudio()');
  const end = component.indexOf('\n\tasync function ', start + 1);
  const restore = component.slice(start, end);

  assert.match(restore, /const priorAudible = audible/);
  assert.match(restore, /audible = restorePriorAudio\(audible\)/);
  assert.match(restore, /mv\.muted = true/);
  assert.match(restore, /const restoredElement = currentAudibleElement\(audible\)/);
  assert.equal(restore.indexOf('restoredElement.currentTime = audible.current.currentTime') < restore.indexOf('await restoredElement.play()'), true);
  assert.match(restore, /audible\.current\?\.provider === 'music'[\s\S]+activateSource\(session, \{ provider: 'music', id: audible\.current\.id, mode: 'audio' \}\)/s);
  assert.match(restore, /catch \(error\) \{[\s\S]+audible = priorAudible[\s\S]+session = priorSession[\s\S]+mv\.muted = false/s);
  assert.match(restore, /await playVideoStack\(\)/);
});

test('Music Audio activation arbitrates audible tracks without pausing Cinema motion', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function activateMusicAudio(');
  const end = component.indexOf('\n\tasync function ', start + 1);
  const activate = component.slice(start, end);

  assert.match(activate, /const priorElement = currentAudibleElement\(audible\)/);
	assert.match(activate, /const priorMusicQueue = musicQueue/);
  assert.match(activate, /currentTime: priorElement\.currentTime/);
  assert.match(activate, /priorElement\.pause\(\)/);
  assert.match(activate, /audible = selectAudibleTrack\(audible, \{ provider: 'music', id: productId, mode: 'audio', currentTime: 0 \}\)/);
  assert.match(activate, /mv\.muted = true/);
  assert.doesNotMatch(activate, /pauseVideoStack\(\)|mv\.pause\(\)/);
	assert.match(activate, /catch \(error\) \{[\s\S]+musicQueue = priorMusicQueue[\s\S]+audible = priorAudible[\s\S]+session = priorSession/s);
});

test('Cinema-audio invitation follows stage ownership and has a reduced-motion cue', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  const start = component.indexOf('function renderCinemaAudioInvitation()');
  const end = component.indexOf('\n\tfunction ', start + 1);
  const render = component.slice(start, end);
  assert.match(render, /const available = Boolean\(currentCinema\(\)\) && session\.playback\.stageOwner === 'cinema'/);
  assert.match(render, /cinemaAudioInvitation\.hidden = !available/);
  assert.match(render, /cinemaAudioInvitation\.disabled = entryControlsLocked \|\| !available/);
  assert.match(render, /cinemaAudioInvitation\.setAttribute\('aria-pressed', String\(cinemaIsAudible\)\)/);
  assert.match(render, /cinemaAudioLabel\.textContent = cinemaIsAudible \? 'CINEMA AUDIO LIVE' : 'HEAR CINEMA'/);
  assert.match(component, /cinemaAudioInvitation\.addEventListener\('animationend'[\s\S]+classList\.remove\('is-inviting'\)/);

  assert.match(css, /\.cinema-audio-invitation\s*\{/);
  assert.match(css, /\.cinema-audio-invitation:focus-visible\s*\{/);
  assert.match(css, /\.cinema-audio-invitation\.is-inviting[\s\S]+animation:/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.cinema-audio-invitation\.is-inviting[\s\S]+animation:\s*none/s);
  assert.match(reduced, /\.cinema-audio-invitation[\s\S]+border[^;]*rgb\(181 155 102/s);
});

test('a rejected Music Video lease rolls back its Music queue mode selection', async () => {
  const component = await source(componentPath);
  const start = component.indexOf("musicPlaylist.addEventListener('click'");
  const end = component.indexOf("mediaPlaylist.addEventListener('click'", start);
  const listener = component.slice(start, end);
  assert.match(listener, /const nextMusicQueue = product\.kind === 'video' \? selectMusicItem\(musicQueue, product\.productId\) : selectMusicMode\(musicQueue, product\.productId, 'video'\)/);
  assert.match(listener, /activateNativeLease\('music', product\.productId, product\.videoSrc, product\.title, \{ nextMusicQueue \}\)/);
  assert.doesNotMatch(listener, /musicQueue = selectMusicMode/);

  const activateStart = component.indexOf('async function activateNativeLease(');
  const activateEnd = component.indexOf('\n\tasync function activateCinema', activateStart);
  const activate = component.slice(activateStart, activateEnd);
  assert.match(activate, /const prior = captureControllerState/);
  assert.match(activate, /musicQueue = nextMusicQueue \?\? prior\.musicQueue/);
  assert.match(activate, /rollbackControllerState\(prior, error/);
});

test('automatic Music advance rolls rejection back to the exact pre-advance queue', async () => {
  const component = await source(componentPath);
  const advanceStart = component.indexOf('async function advanceMusic(direction)');
  const advanceEnd = component.indexOf('\n\tasync function ', advanceStart + 1);
  const advance = component.slice(advanceStart, advanceEnd);
  const activateStart = component.indexOf('async function activateMusicAudio(');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activate = component.slice(activateStart, activateEnd);

  assert.match(advance, /\? advanceMusicQueue\(musicQueue, direction\)/);
  assert.doesNotMatch(advance, /musicQueue = next/);
  assert.match(advance, /await activateMusicAudio\(next\.currentProductId, \{ nextMusicQueue: next \}\)/);
  assert.match(activate, /async function activateMusicAudio\(productId, \{ nextMusicQueue = null \} = \{\}\)/);
  const capture = activate.indexOf('const priorMusicQueue = musicQueue');
  const commit = activate.indexOf('musicQueue = nextMusicQueue ?? selectMusicMode');
  const rollback = activate.indexOf('musicQueue = priorMusicQueue');
  assert.equal(capture > -1 && commit > capture && rollback > commit, true);
});

test('lease release commits logical and UI state only after stage and audible restoration succeed', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function restoreLeasedCinema(');
  const end = component.indexOf('\n\tasync function activateMusicAudio', start);
  const restore = component.slice(start, end);

  assert.match(restore, /const prior = captureControllerState\(\)/);
  assert.match(restore, /let restoredAudible = prior\.suspendedForStageLease \?\? createAudibleSource\(\)/);
  const restoreStage = restore.indexOf('await restoreCinemaSnapshot(mv, stage, restoredSnapshot, wings, restoreOptions)');
  const replayAudible = restore.indexOf('await resumeAudibleState(restoredAudible)');
  const commitSession = restore.indexOf('session = restoredSession');
  const commitAudible = restore.indexOf('audible = restoredAudible');
  const clearSuspended = restore.indexOf('suspendedForStageLease = null');
  const commitUi = restore.indexOf('returnButton.hidden = true');
  assert.equal(restoreStage > -1 && replayAudible > restoreStage, true);
  assert.equal(commitSession > replayAudible && commitAudible > commitSession && clearSuspended > commitAudible && commitUi > clearSuspended, true);
  assert.match(restore, /catch \(error\) \{[\s\S]+throw await rollbackControllerState\(prior, error, \{[\s\S]+attemptedAudibleState: restoredAudible,[\s\S]+statusPrefix: 'PLAYBACK\/RESTORE ERROR'/s);
});

test('direct lease replacement retains Cinema snapshot and restores the immediately prior lease on rejection', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function activateNativeLease(');
  const end = component.indexOf('\n\tasync function activateCinema', start);
  const activate = component.slice(start, end);

  assert.match(activate, /const prior = captureControllerState\(\{ audibleState: priorAudible \}\)/);
  assert.match(activate, /const retainedCinemaSnapshot = prior\.session\.lease\?\.snapshot \?\? prior\.stageSnapshot/);
  assert.match(activate, /activateSource\(prior\.session, \{ provider, id, mode: 'video', snapshot: retainedCinemaSnapshot \}\)/);
  assert.match(activate, /musicQueue = nextMusicQueue \?\? prior\.musicQueue/);
  assert.match(activate, /catch \(error\) \{[\s\S]+throw await rollbackControllerState\(prior, error, \{[\s\S]+attemptedAudibleState: nextAudible,[\s\S]+statusPrefix: 'PLAYBACK\/RESTORE ERROR'/s);
  assert.doesNotMatch(activate, /catch \(error\) \{[\s\S]+restoreLeasedCinema\(\)/s);

  const listenerStart = component.indexOf("musicPlaylist.addEventListener('click'");
  const listenerEnd = component.indexOf("mediaPlaylist.addEventListener('click'", listenerStart);
  const listener = component.slice(listenerStart, listenerEnd);
  assert.match(listener, /const nextMusicQueue = product\.kind === 'video' \? selectMusicItem\(musicQueue, product\.productId\) : selectMusicMode\(musicQueue, product\.productId, 'video'\)/);
  assert.match(listener, /activateNativeLease\('music', product\.productId, product\.videoSrc, product\.title, \{ nextMusicQueue \}\)/);
  assert.doesNotMatch(listener, /musicQueue = selectMusicMode/);
});

test('rollback fallback keeps prior lease identity muted and surfaces a specific restore error', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('async function rollbackControllerState(');
  const end = component.indexOf('\n\tasync function ', start + 1);
  const rollback = component.slice(start, end);

  assert.match(rollback, /session = prior\.session/);
  assert.match(rollback, /audible = prior\.audible/);
  assert.match(rollback, /suspendedForStageLease = prior\.suspendedForStageLease/);
  assert.match(rollback, /musicQueue = prior\.musicQueue/);
  assert.match(rollback, /await restoreCinemaSnapshot\(mv, stage, prior\.stageSnapshot, wings\)/);
  assert.equal(rollback.indexOf('mv.muted = true') < rollback.indexOf('await restoreCinemaSnapshot'), true);
  assert.match(rollback, /catch \(rollbackError\) \{[\s\S]+mv\.muted = true[\s\S]+ROLLBACK FAILED/s);
  assert.match(rollback, /hasReportedTransitionError = true/);
  assert.match(rollback, /nowPlayingStatus\.textContent = status/);
});

test('lease policy lets the selected Cinema deck reclaim transport while direct Cinema cues stay guarded', async () => {
  const component = await source(componentPath);
  const policyStart = component.indexOf('function applyActiveTransportPolicy()');
  const policyEnd = component.indexOf('\n\tfunction ', policyStart + 1);
  const policy = component.slice(policyStart, policyEnd);
  assert.doesNotMatch(policy, /leaseBlocksNavigation/);

  const nextStart = component.indexOf('function requestNext()');
  const nextEnd = component.indexOf('\n\tasync function ', nextStart + 1);
  const next = component.slice(nextStart, nextEnd);
  assert.match(next, /controlledPlayback\.provider === 'cinema'/);
  assert.match(next, /if \(session\.lease\) await restoreLeasedCinema/);

  const availabilityStart = component.indexOf('function syncCinemaCueAvailability()');
  const availabilityEnd = component.indexOf('\n\tfunction ', availabilityStart + 1);
  const availability = component.slice(availabilityStart, availabilityEnd);
  assert.match(availability, /const disabled = Boolean\(referenceReturnState\) \|\| entryControlsLocked \|\| Boolean\(session\.lease\)/);
  assert.match(availability, /button\.disabled = disabled/);
  assert.match(availability, /aria-disabled/);

  const activateStart = component.indexOf('async function activateCinema(');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activateCinema = component.slice(activateStart, activateEnd);
  assert.match(activateCinema, /if \(session\.lease\) return/);
  assert.doesNotMatch(activateCinema, /if \(session\.lease\) await restoreLeasedCinema\(\)/);

  const audioStart = component.indexOf('async function activateMusicAudio(');
  const audioEnd = component.indexOf('\n\tasync function ', audioStart + 1);
  assert.match(component.slice(audioStart, audioEnd), /const releasedLease = session\.lease \? await restoreLeasedCinema\(\{ resumeAudible: false \}\) : null/);
  assert.match(component, /returnButton\.addEventListener\('click'[\s\S]+restoreLeasedCinema\(\)/);
  assert.match(component, /if \(session\.lease\) \{[\s\S]+await restoreLeasedCinema\(\)/);
});

test('Music Video lease rollback restores master audio without starting the separate Music Audio element', async () => {
  const component = await source(componentPath);
  for (const symbol of ['audibleElementKind', 'claimCinemaAudio', 'createAudibleSource', 'restorePriorAudio', 'selectAudibleTrack']) {
    assert.match(component, new RegExp(`import \\{[^}]*\\b${symbol}\\b[^}]*\\} from '\\.\\.\\/lib\\/audible-source\\.mjs'`));
  }
  const mappingStart = component.indexOf('function currentAudibleElement(');
  const mappingEnd = component.indexOf('\n\tfunction ', mappingStart + 1);
  const mapping = component.slice(mappingStart, mappingEnd);
  assert.match(mapping, /switch \(audibleElementKind\(state\)\)/);
  assert.match(mapping, /case 'ambient': return ambientAudio/);
  assert.match(mapping, /case 'music': return musicAudio/);
  assert.match(mapping, /default: return null/);

  const leaseStart = component.indexOf('async function activateNativeLease(');
  const leaseEnd = component.indexOf('\n\tasync function activateCinema', leaseStart);
  const lease = component.slice(leaseStart, leaseEnd);
  assert.match(lease, /selectAudibleTrack\(prior\.audible, \{ provider, id, mode: 'video', currentTime: 0 \}\)/);
  assert.match(lease, /rollbackControllerState\(prior, error, \{[\s\S]+attemptedAudibleState: nextAudible,[\s\S]+statusPrefix: 'PLAYBACK\/RESTORE ERROR'/s);

  const rollbackStart = component.indexOf('async function rollbackControllerState(');
  const rollbackEnd = component.indexOf('\n\tasync function ', rollbackStart + 1);
  const rollback = component.slice(rollbackStart, rollbackEnd);
  assert.match(rollback, /await restoreCinemaSnapshot\(mv, stage, prior\.stageSnapshot, wings\)/);
  assert.match(rollback, /await resumeAudibleState\(prior\.audible\)/);

  const resumeStart = component.indexOf('async function resumeAudibleState(');
  const resumeEnd = component.indexOf('\n\tasync function ', resumeStart + 1);
  const resume = component.slice(resumeStart, resumeEnd);
  assert.match(resume, /const element = currentAudibleElement\(state\)/);
  assert.match(resume, /if \(!element \|\| !state\.current\) return/);
  assert.doesNotMatch(resume, /state\.current\.mode === 'video'[\s\S]+musicAudio\.play/);
});

test('Music Repeat Off restores the Cinema mute and audible state captured before Music Audio', async () => {
  const component = await source(componentPath);
  assert.match(component, /let cinemaMutedBeforeMusicAudio = null/);
  const activateStart = component.indexOf('async function activateMusicAudio(');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activate = component.slice(activateStart, activateEnd);
  assert.match(activate, /const priorCinemaMutedBeforeMusicAudio = cinemaMutedBeforeMusicAudio/);
  assert.match(activate, /if \(cinemaMutedBeforeMusicAudio === null\) cinemaMutedBeforeMusicAudio = cinemaMuteAuthority/);
  assert.match(activate, /catch \(error\) \{[\s\S]+cinemaMutedBeforeMusicAudio = priorCinemaMutedBeforeMusicAudio/s);

  const returnStart = component.indexOf('async function returnMusicQueueToCinema()');
  const returnEnd = component.indexOf('\n\tasync function ', returnStart + 1);
  const queueEnd = component.slice(returnStart, returnEnd);
  assert.match(queueEnd, /const restoreMuted = cinemaMutedBeforeMusicAudio \?\? true/);
  assert.match(queueEnd, /mv\.muted = restoreMuted/);
  assert.match(queueEnd, /provider: 'cinema'/);
  assert.match(queueEnd, /audible = restoreMuted \? createAudibleSource\(\) : createAudibleSource\(/);
  assert.match(queueEnd, /cinemaMutedBeforeMusicAudio = null/);
});

test('Music Audio replaces a stage lease without replaying the superseded audible source', async () => {
  const component = await source(componentPath);
  assert.match(component, /async function restoreLeasedCinema\(\{ resumeAudible = true \} = \{\}\)/);
  const restoreStart = component.indexOf('async function restoreLeasedCinema(');
  const restoreEnd = component.indexOf('\n\tasync function ', restoreStart + 1);
  const restore = component.slice(restoreStart, restoreEnd);
  assert.match(restore, /if \(resumeAudible\) await resumeAudibleState\(restoredAudible\)/);
  assert.match(restore, /const restoreOptions = resumeAudible \? undefined : \{ masterMuted: true \}/);
  assert.match(restore, /restoreCinemaSnapshot\(mv, stage, restoredSnapshot, wings, restoreOptions\)/);

  const activateStart = component.indexOf('async function activateMusicAudio(');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activate = component.slice(activateStart, activateEnd);
  assert.match(activate, /const releasedLease = session\.lease \? await restoreLeasedCinema\(\{ resumeAudible: false \}\) : null/);
  assert.match(restore, /return \{ \.\.\.released, snapshot: restoredSnapshot, session: restoredSession \}/);
  assert.match(activate, /const cinemaMuteAuthority = releasedLease\?\.snapshot\?\.muted \?\? mv\.muted/);
  assert.match(activate, /if \(cinemaMutedBeforeMusicAudio === null\) cinemaMutedBeforeMusicAudio = cinemaMuteAuthority/);
  assert.match(activate, /const priorCinemaMute = cinemaMuteAuthority/);
});

test('Cinema auto-advance failure exposes a dedicated retry without taking Music transport', async () => {
  const component = await source(componentPath);
  assert.match(component, /id="retry-cinema"[^>]+hidden[^>]+disabled/s);
  const activateStart = component.indexOf('async function activateCinema(');
  const activateEnd = component.indexOf('\n\tasync function ', activateStart + 1);
  const activate = component.slice(activateStart, activateEnd);
  assert.match(activate, /retryCinema\.hidden = true/);
  assert.match(activate, /CINEMA AUTO-ADVANCE FAILED/);
  assert.match(activate, /RETRY AVAILABLE/);
  assert.match(activate, /retryCinema\.hidden = false/);
  assert.match(activate, /preserveMusicTransport\s*\? 'MUSIC AUDIO LIVE · CINEMA MOTION RESTORED'\s*:\s*'CINEMA LIVE'/s);
  assert.match(component, /retryCinema\.addEventListener\('click',[\s\S]+preserveAudibleAuthority: session\.playback\.provider === 'music'/s);
});
