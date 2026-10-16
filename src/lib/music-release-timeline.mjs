import { mergePresentationLinks } from './release-presentations.mjs';
import { mergeListeningLinks } from './release-listening.mjs';

// Deliberate release-family grouping. Similar track names on different compilations
// are not enough to establish that two cards describe the same release.
export const musicReleaseAliases = Object.freeze({
  'nc-09': 'compilation-appearances-d003',
});

const unique = (items, key = item => JSON.stringify(item)) => {
  const seen = new Set();
  return items.filter(item => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export function releaseDateParts(release) {
  const value = release.date ?? '';
  const year = value.match(/\b(19\d{2}|20\d{2})\b/);
  if (!year) return null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const month = months.findIndex(name => value.toLowerCase().includes(name));
  // Unspecified month/day sorts after dated entries, never masquerading as January 1.
  let day = 32;
  if (month !== -1) {
    const name = months[month];
    const match = value.match(new RegExp(`(?:\\b(\\d{1,2}) ${name}\\b|\\b${name} (\\d{1,2})(?:,|\\s))`, 'i'));
    if (match) day = Number(match[1] ?? match[2]);
  }
  return { year: Number(year[1]), month: month === -1 ? 13 : month + 1, day };
}

export function musicReleaseGroups(children) {
  const groups = new Map();
  for (const child of [...children].sort((a, b) => {
    const left = releaseDateParts(a), right = releaseDateParts(b);
    if (!left || !right) return left ? -1 : right ? 1 : 0;
    return left.year - right.year || left.month - right.month || left.day - right.day;
  })) {
    const year = releaseDateParts(child)?.year;
    const title = year ? String(year) : 'Release dates to confirm';
    if (!groups.has(title)) groups.set(title, { title, children: [] });
    groups.get(title).children.push(child);
  }
  return [...groups.values()];
}

export function consolidateMusicReleases(children) {
  const ids = new Set(children.map(child => child.id));
  const result = children.filter(child => !ids.has(musicReleaseAliases[child.id])).map(child => {
    const editions = children.filter(item => musicReleaseAliases[item.id] === child.id);
    if (!editions.length) return child;
    const all = [child, ...editions];
    return {
      ...child,
      title: child.id === 'compilation-appearances-d003' ? 'Tranceport.3' : child.title,
      format: unique(all.map(item => item.format)).join(' · '),
      catalogNumber: unique(all.map(item => item.catalogNumber)).join(' / '),
      roles: unique(all.flatMap(item => item.roles)),
      credits: unique(all.flatMap(item => item.credits)),
      listeningLinks: mergeListeningLinks(...all.map(item => item.listeningLinks)),
      presentationLinks: mergePresentationLinks(...all.map(item => item.presentationLinks)),
      gallery: unique(all.flatMap(item => item.gallery), item => item.src ?? JSON.stringify(item)),
      publicSources: unique(all.flatMap(item => item.publicSources), item => JSON.stringify([item.href, item.supports])),
      relatedRecordIds: unique(all.flatMap(item => item.relatedRecordIds)),
      contextRecords: unique(all.flatMap(item => item.contextRecords ?? []), item => item.id),
      historySections: [
        ...(child.historySections ?? []),
        { title: 'Related editions', items: editions.map(item => ({
          title: item.title,
          date: item.date,
          detail: `${item.catalogNumber} · ${item.format}. ${item.summary}`,
        })) },
        ...editions.flatMap(item => item.historySections ?? []),
      ],
      aliasIds: editions.map(item => item.id),
      sourceArchiveHref: `/archive/singles-remixes/#${child.id}`,
    };
  });
  return musicReleaseGroups(result).flatMap(group => group.children);
}
