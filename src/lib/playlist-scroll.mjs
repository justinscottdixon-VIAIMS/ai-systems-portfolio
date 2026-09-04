function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function playlistScrollTarget({ key, scrollTop, rowStep, viewportHeight, scrollHeight }) {
  const maximum = Math.max(0, scrollHeight - viewportHeight);
  const targets = {
    ArrowDown: scrollTop + rowStep,
    ArrowUp: scrollTop - rowStep,
    PageDown: scrollTop + viewportHeight,
    PageUp: scrollTop - viewportHeight,
    Home: 0,
    End: maximum,
  };
  if (!Object.hasOwn(targets, key)) return null;
  return clamp(targets[key], 0, maximum);
}

export function playlistWheelTarget({ deltaY, deltaMode, scrollTop, rowStep, viewportHeight, scrollHeight }) {
  const maximum = Math.max(0, scrollHeight - viewportHeight);
  const unit = deltaMode === 1 ? rowStep : deltaMode === 2 ? viewportHeight : 1;
  const target = clamp(scrollTop + deltaY * unit, 0, maximum);
  return target === scrollTop ? null : target;
}
