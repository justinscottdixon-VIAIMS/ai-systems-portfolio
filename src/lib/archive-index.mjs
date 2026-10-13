export function archiveHref(record, child) {
  return `/archive/${record.slug}/${child ? `#${encodeURIComponent(child.id)}` : ''}`;
}

const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
const sectionHistory = sections => (sections ?? []).flatMap(section => [section.title, section.intro ?? '', ...section.items.flatMap(item => [item.title, item.date ?? '', item.detail])]).join(' ');
const dossierHistory = record => sectionHistory(record.sections);

export function archiveEntries(records) {
  return records.flatMap(record => {
    const entry = {
      href: archiveHref(record), title: record.title,
      artist: record.displayArtistOrClient ?? '', category: record.category,
      date: record.dateDisplay, format: record.format, roles: record.roles,
      summary: record.summary, label: record.catalog?.label ?? '',
      catalogNumber: record.catalog?.catalogNumber ?? '', parent: '',
      history: dossierHistory(record),
    };
    return [entry, ...record.children.map(child => ({
      href: archiveHref(record, child), title: child.title, artist: child.artist,
      category: 'music', date: child.date, format: child.format, roles: child.roles,
      summary: child.summary, label: entry.label, catalogNumber: child.catalogNumber,
      parent: record.title,
      history: [child.credits.flatMap(credit => [credit.title, credit.scope, ...credit.roles, credit.collaborators ?? '', credit.note ?? '']).join(' '), sectionHistory(child.historySections), ...(child.contextRecords ?? []).map(dossierHistory)].join(' '),
    })), ...(record.contextRecords ?? []).map(context => ({
      href: `${archiveHref(record)}#context-${encodeURIComponent(context.id)}`,
      title: context.title, artist: context.displayArtistOrClient ?? '', category: context.category,
      date: context.dateDisplay, format: context.format, roles: context.roles,
      summary: context.summary, label: context.catalog?.label ?? '',
      catalogNumber: context.catalog?.catalogNumber ?? '', parent: record.title,
      history: dossierHistory(context),
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
