function formatSeconds(value) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatTransportTime({ currentTime, duration }) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration < 0) {
    return { elapsed: '--:--', remaining: '--:--' };
  }
  const elapsed = Math.min(Math.max(0, currentTime), duration);
  return {
    elapsed: formatSeconds(elapsed),
    remaining: `-${formatSeconds(duration - elapsed)}`,
  };
}
