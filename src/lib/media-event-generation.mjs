const TRANSIENT_MEDIA_ATTRIBUTES = ['src', 'data-visual-token', 'data-visual-source', 'data-fade-token'];

export function supersedeMediaElement(element) {
  if (!element || typeof element.cloneNode !== 'function' || typeof element.replaceWith !== 'function') {
    throw new TypeError('a replaceable media element is required');
  }
  const replacement = element.cloneNode(false);
  for (const attribute of TRANSIENT_MEDIA_ATTRIBUTES) replacement.removeAttribute(attribute);
  element.pause?.();
  element.removeAttribute?.('src');
  element.load?.();
  element.replaceWith(replacement);
  return replacement;
}
