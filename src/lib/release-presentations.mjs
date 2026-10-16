/** Public studio stories/charts stay separate from printed credit evidence. */
export function normalizePresentationLinks(value = []) {
  if (!Array.isArray(value)) throw new TypeError('presentationLinks must be an array');
  const seen = new Set();
  return value.map(link => {
    if (!link || !/^\/(?:reference\/production-workflows\/|production-notes\/)[a-z0-9/.-]+$/.test(link.href ?? '') || link.href.includes('..')) throw new TypeError('Presentation links require a local public presentation path');
    for (const field of ['label', 'description']) if (typeof link[field] !== 'string' || !link[field].trim()) throw new TypeError(`Presentation link requires ${field}`);
    return { href: link.href, label: link.label.trim(), description: link.description.trim() };
  }).filter(link => { if (seen.has(link.href)) return false; seen.add(link.href); return true; });
}
export const mergePresentationLinks = (...groups) => normalizePresentationLinks(groups.flatMap(group => group ?? []));
