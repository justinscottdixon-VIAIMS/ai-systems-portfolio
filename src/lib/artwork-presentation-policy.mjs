import policy from '../data/artwork-presentation-policy.json' with { type: 'json' };

// These exact release captures remain in the source archive for provenance.
// An enhanced or replacement artwork uses its own reviewed presentation path.
export const excludedArtworkPaths = Object.freeze([...policy.excludedSources]);
const excludedSources = new Set(excludedArtworkPaths);

export function isExcludedArtwork(src) {
  return excludedSources.has(src);
}

export function presentationArtwork(gallery) {
  const visible = gallery.filter(item => item.kind !== 'image' || !isExcludedArtwork(item.src));
  if (visible.length > 0) return visible;
  return [{
    kind: 'pending',
    alt: 'Release artwork awaiting preparation',
    caption: 'Presentation artwork forthcoming.',
  }];
}
