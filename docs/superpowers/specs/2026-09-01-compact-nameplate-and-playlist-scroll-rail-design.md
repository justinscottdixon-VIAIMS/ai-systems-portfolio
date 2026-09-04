# VIAIMS Compact Nameplate and Playlist Scroll Rail Design

**Date:** 2026-09-01  
**Status:** Approved in conversation; implementation not yet started

## 1. Purpose

Reduce the opening institutional block to no more than one quarter of its current filled desktop area, and prevent playlist rows from capturing ordinary page-wheel scrolling. Preserve the approved identity copy, the adaptive-media implementation already in progress, and the current visual language.

## 2. Compact institutional nameplate

The current tall opening header becomes a compact technical nameplate.

- Preserve the system status, clock status, reference, name, VIAIMS institution name, acronym, and every professional-role phrase.
- Keep `JUSTIN SCOTT DIXON` as the strongest element.
- Present the institution and acronym as a compact secondary identity.
- Condense the professional roles into one wrapping line rather than five vertically separated lines.
- Remove the large inter-group gaps and excess header bottom spacing.
- At the approved 938px-wide reference viewport, keep the complete space from the top of the document to the media-stage border at or below 120px. This is less than one quarter of the approximately 487px currently shown before the media begins.
- Allow natural wrapping on narrow screens; do not clip identity text or force unreadably small type.
- Preserve the order: nameplate, media stage, compact player.

## 3. Dedicated playlist scroll rail

Desktop pointer-wheel behavior is divided into two explicit zones.

### Page-scroll zone

- Playlist rows remain clickable but do not capture wheel input.
- Wheel input over a row, its text, or its action buttons continues scrolling the document.
- Reaching either end of the playlist never traps subsequent page scrolling.

### Playlist-scroll zone

- A narrow rail is placed beside the right edge of every populated provider playlist rather than over its item content.
- Wheel input over that rail scrolls only the active playlist and suppresses document scrolling for that wheel event.
- The rail has a visible but restrained idle treatment and a clearer hover/focus treatment.
- The rail is keyboard-focusable and exposes an accessible label identifying it as the playlist scroll control.
- When focused, Arrow Up/Down scroll by one row and Page Up/Down scroll by the visible tray height. Home and End move to the first and last rows.
- If a playlist does not overflow, the rail is visually inactive and does not capture wheel input.

### Touch behavior

- On fine-pointer desktop devices, the item viewport does not respond to wheel input; its adjacent rail changes the viewport's scroll position.
- Touch users may continue swiping the playlist directly. The dedicated rail is hidden on coarse-pointer devices and does not reduce mobile row width.
- Normal document touch scrolling must remain available when the gesture cannot move the playlist farther in its requested direction.

## 4. Implementation boundary

- Keep provider selection, playback, active-item identity, and queue state unchanged.
- Introduce only the markup, styling, and small interaction seam needed for the explicit rail.
- Do not change media sources, audio behavior, Mirror Wings policy, commerce, ingestion, or production-meter behavior.
- Preserve all existing dirty implementation.

## 5. Testing and approval

Implementation uses strict RED/GREEN order.

1. Add a failing source/structure test for the compact nameplate contract.
2. Add failing interaction tests proving row-wheel events remain available to the page and rail-wheel/keyboard events control only the playlist.
3. Implement the minimum markup, CSS, and interaction behavior to pass.
4. Run focused tests, the full suite, production build, and `git diff --check`.
5. Reopen the fresh build in native Chrome at the supplied desktop viewport and verify the nameplate height and both scroll zones manually.

No commit, push, merge, deployment, media publication, hosting, or DNS change is authorized by this design.
