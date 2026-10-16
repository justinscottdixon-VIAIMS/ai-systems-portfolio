/** Keep the label sequence intact; date related editions only from recorded release metadata. */
export function releaseYear(release) {
  const match = release.date?.match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

export function cosmicReleaseGroups(children) {
  const label = children.filter(child => /^COSMIC \d{3}\b/.test(child.catalogNumber));
  label.sort((a, b) => Number(a.catalogNumber.match(/\d{3}/)[0]) - Number(b.catalogNumber.match(/\d{3}/)[0]));
  const labelIds = new Set(label.map(child => child.id));
  const related = children.filter(child => !labelIds.has(child.id) && child.id !== 'transformed');
  const dated = related.filter(child => releaseYear(child) !== null);
  // Preserve source order within a year: the catalogue does not establish exact dates.
  dated.sort((a, b) => releaseYear(a) - releaseYear(b));
  return [
    { title: 'Cosmic Records · 001–018', children: label },
    { title: 'Transformed · four-turntable mix', children: children.filter(child => child.id === 'transformed') },
    { title: 'Third-party releases & remixes · by year', children: dated },
    { title: 'Release dates to confirm', children: related.filter(child => releaseYear(child) === null) },
  ].filter(group => group.children.length);
}
