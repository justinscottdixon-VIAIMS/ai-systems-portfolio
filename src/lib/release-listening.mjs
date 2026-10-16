/** YouTube listening references are separate from release dates and credit evidence. */
export function normalizeListeningLinks(value = []) {
  if (!Array.isArray(value)) throw new TypeError('listeningLinks must be an array');
  const seen = new Set();
  return value.map(link => {
    if (!link || !/^[A-Za-z0-9_-]{11}$/.test(link.videoId)) throw new TypeError('Invalid YouTube video ID');
    for (const key of ['label', 'title', 'channel', 'checkedOn']) {
      if (typeof link[key] !== 'string' || !link[key].trim()) throw new TypeError(`Listening link requires ${key}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(link.checkedOn)) throw new TypeError('Invalid listening link check date');
    if (link.note !== undefined && (typeof link.note !== 'string' || !link.note.trim())) throw new TypeError('Invalid listening link note');
    return {
      videoId: link.videoId, label: link.label.trim(), title: link.title.trim(),
      channel: link.channel.trim(), checkedOn: link.checkedOn,
      ...(link.alternate === true ? { alternate: true } : {}),
      ...(link.note ? { note: link.note.trim() } : {}),
    };
  }).filter(link => {
    if (seen.has(link.videoId)) return false;
    seen.add(link.videoId);
    return true;
  });
}

export function mergeListeningLinks(...groups) {
  return normalizeListeningLinks(groups.flatMap(group => group ?? []));
}

export const listeningHref = link => `https://www.youtube.com/watch?v=${link.videoId}`;
