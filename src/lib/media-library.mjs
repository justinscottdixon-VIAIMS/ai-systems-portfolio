function httpsUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${label} must be an HTTPS URL`); }
  if (url.protocol !== 'https:') throw new TypeError(`${label} must be an HTTPS URL`);
  return value;
}

function required(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

export function toMediaLibrary(manifest, curated = { version: 1, music: [], media: [], youtube: [] }) {
  if (curated?.version !== 1) throw new TypeError('curated media version must be 1');
  const cinema = manifest.items
    .filter((item) => item.kind === 'video')
    .map((item) => ({ ...item, provider: 'cinema', engine: item.engine ?? 'AI Render' }));
  const audioById = new Map(manifest.items.filter((item) => item.kind === 'audio').map((item) => [item.id, item]));
  const overrides = new Map((curated.music ?? []).map((item) => [item.productId, item]));
  for (const productId of overrides.keys()) {
    if (!audioById.has(productId)) throw new TypeError(`unknown Music product: ${productId}`);
  }
  const music = [...audioById.values()].map((item) => {
    const extra = overrides.get(item.id) ?? {};
    return {
      provider: 'music',
      productId: item.id,
      title: item.title,
      specs: item.specs,
      audioSrc: item.src,
      videoSrc: extra.musicVideoSrc ? httpsUrl(extra.musicVideoSrc, `music ${item.id} video`) : null,
      storeHref: `/store?product=${encodeURIComponent(item.id)}`,
    };
  });
  const media = (curated.media ?? []).map((item, index) => ({
    provider: 'media',
    id: required(item.id, `media[${index}].id`),
    title: required(item.title, `media[${index}].title`),
    src: httpsUrl(item.src, `media[${index}].src`),
    specs: required(item.specs, `media[${index}].specs`),
  }));
  const youtube = (curated.youtube ?? []).map((item, index) => ({
    provider: 'youtube',
    id: required(item.id, `youtube[${index}].id`),
    title: required(item.title, `youtube[${index}].title`),
    videoId: required(item.videoId, `youtube[${index}].videoId`),
  }));
  return { cinema, music, media, youtube };
}
