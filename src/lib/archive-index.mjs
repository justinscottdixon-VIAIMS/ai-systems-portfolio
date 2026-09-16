export function archiveHref(record, child) {
  return `/archive/${record.slug}/${child ? `#${encodeURIComponent(child.id)}` : ''}`;
}

const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');

export function archiveEntries(records) {
  return records.flatMap(record => {
    const entry = {
      href: archiveHref(record), title: record.title,
      artist: record.displayArtistOrClient ?? '', category: record.category,
      date: record.dateDisplay, format: record.format, roles: record.roles,
      summary: record.summary, label: record.catalog?.label ?? '',
      catalogNumber: record.catalog?.catalogNumber ?? '', parent: '',
      history: record.sections.flatMap(section => [section.title, section.intro ?? '', ...section.items.flatMap(item => [item.title, item.date ?? '', item.detail])]).join(' '),
    };
    return [entry, ...record.children.map(child => ({
      href: archiveHref(record, child), title: child.title, artist: child.artist,
      category: 'music', date: child.date, format: child.format, roles: child.roles,
      summary: child.summary, label: entry.label, catalogNumber: child.catalogNumber,
      parent: record.title,
      history: child.credits.flatMap(credit => [credit.title, credit.scope, ...credit.roles, credit.collaborators ?? '', credit.note ?? '']).join(' '),
    }))].map(item => ({ ...item, searchText: normalize([
      item.title, item.artist, item.date, item.format, ...item.roles,
      item.summary, item.label, item.catalogNumber, item.parent, item.history ?? '',
    ].join(' ')) }));
  });
}

export function matchesArchiveQuery(entry, query = '', category = '') {
  return (!category || entry.category === category)
    && normalize(query).trim().split(/\s+/).every(term => entry.searchText.includes(term));
}
