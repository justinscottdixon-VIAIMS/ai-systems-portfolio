// Run outside the playback queue so Music and mute controls remain responsive.
export function createCinemaBrandCard(element, { schedule = setTimeout, unschedule = clearTimeout } = {}) {
  let timer = null;
  let generation = 0;
  function cancel() {
    generation += 1;
    if (timer !== null) unschedule(timer);
    timer = null;
    element.hidden = true;
  }
  function show(onComplete) {
    cancel();
    const current = generation;
    // Commit the hidden state so rapid selections restart the CSS fade.
    void element.offsetWidth;
    element.hidden = false;
    timer = schedule(() => {
      if (current !== generation) return;
      timer = null;
      element.hidden = true;
      onComplete();
    }, 2000);
  }
  return { show, cancel };
}
