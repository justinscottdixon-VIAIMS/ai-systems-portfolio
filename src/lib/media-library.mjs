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

function toExperience(value) {
  if (value == null) {
    return { enabled: false, welcomeVideoSrc: null, ambientAudioSrc: null };
  }
  const hasWelcome = typeof value.welcomeVideoSrc === 'string' && value.welcomeVideoSrc.trim() !== '';
  const hasAmbient = typeof value.ambientAudioSrc === 'string' && value.ambientAudioSrc.trim() !== '';
  if (hasWelcome !== hasAmbient || !hasWelcome) {
    throw new TypeError('experience requires both welcomeVideoSrc and ambientAudioSrc');
  }
  return {
    enabled: true,
    welcomeVideoSrc: httpsUrl(value.welcomeVideoSrc, 'experience welcomeVideoSrc'),
    ambientAudioSrc: httpsUrl(value.ambientAudioSrc, 'experience ambientAudioSrc'),
  };
}

function toYoutubeChannel(value) {
  if (value == null) return null;
  const title = required(value.title, 'youtube channel title');
  const handle = required(value.handle, 'youtube channel handle');
  const href = httpsUrl(value.href, 'youtube channel href');
  const canonical = {
    title: 'Justin Scott Dixon / Voyager',
    handle: '@justinscottdixon_voyager',
    href: 'https://www.youtube.com/@justinscottdixon_voyager',
  };
  const url = new URL(href);
  if (title !== canonical.title
    || handle !== canonical.handle
    || url.href !== canonical.href
    || url.username
    || url.password) {
    throw new TypeError('youtube channel must use the approved canonical destination');
  }
  return canonical;
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
    const videoSrc = extra.musicVideoSrc ? httpsUrl(extra.musicVideoSrc, `music ${item.id} video`) : null;
    const videoDimensions = videoSrc ? parseVideoDimensions({
      width: extra.musicVideoWidth,
      height: extra.musicVideoHeight,
      aspect: extra.musicVideoAspect,
    }, `Music Video ${item.id}`) : null;
    return {
      provider: 'music',
      productId: item.id,
      title: item.title,
      specs: item.specs,
      audioSrc: item.src,
      videoSrc,
      videoWidth: videoDimensions?.width ?? null,
      videoHeight: videoDimensions?.height ?? null,
      videoAspect: videoDimensions?.aspect ?? null,
      visual: item.visual ?? null,
      storeHref: `/store?product=${encodeURIComponent(item.id)}`,
    };
  });
  const media = (curated.media ?? []).map((item, index) => {
    const src = httpsUrl(item.src, `media[${index}].src`);
    const dimensions = parseVideoDimensions(item, `Media media[${index}]`);
    return {
      provider: 'media',
      id: required(item.id, `media[${index}].id`),
      title: required(item.title, `media[${index}].title`),
      src,
      specs: required(item.specs, `media[${index}].specs`),
      ...dimensions,
    };
  });
  const youtube = (curated.youtube ?? []).map((item, index) => ({
    provider: 'youtube',
    id: required(item.id, `youtube[${index}].id`),
    title: required(item.title, `youtube[${index}].title`),
    videoId: required(item.videoId, `youtube[${index}].videoId`),
  }));
  return {
    experience: toExperience(curated.experience),
    cinema,
    music,
    media,
    youtubeChannel: toYoutubeChannel(curated.youtubeChannel),
    youtube,
  };
}
import { parseVideoDimensions } from './media-manifest.mjs';
