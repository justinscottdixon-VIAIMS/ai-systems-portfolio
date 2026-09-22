const categories = new Set(['music', 'film', 'publication', 'product', 'podcast-audiobook', 'career']);
const statuses = new Set(['released', 'published', 'archived', 'in-development', 'verification-pending']);
const evidenceLevels = new Set(['primary-public', 'corroborated-public', 'attributed-public', 'owner-approved-archive']);

function text(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function httpsUrl(value, label) {
  const url = new URL(text(value, label));
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError(`${label} must be a credential-free HTTPS URL`);
  return url.href;
}

function presentationItem(item, label) {
  if (!item || !['image', 'pending'].includes(item.kind)) throw new TypeError(`${label} kind is invalid`);
  const result = {
    kind: item.kind,
    alt: text(item.alt, `${label} alt`),
    caption: text(item.caption, `${label} caption`),
  };
  if (item.kind === 'image') {
    const src = text(item.src, `${label} src`);
    if (!src.startsWith('/reference/')) throw new TypeError(`${label} src must use the local reference asset path`);
    result.src = src;
  }
  return result;
}

function dossierSection(section, label) {
  if (!section || !Array.isArray(section.items) || section.items.length === 0) throw new TypeError(`${label} requires items`);
  return {
    title: text(section.title, `${label} title`),
    intro: section.intro ? text(section.intro, `${label} intro`) : undefined,
    items: section.items.map((item, itemIndex) => ({
      title: text(item.title, `${label} item ${itemIndex} title`),
      date: item.date ? text(item.date, `${label} item ${itemIndex} date`) : undefined,
      detail: text(item.detail, `${label} item ${itemIndex} detail`),
    })),
  };
}

function sourceReference(source, label) {
  return {label: text(source.label, `${label} label`), href: httpsUrl(source.href, `${label} href`), supports: text(source.supports, `${label} support`)};
}

function trackCredit(credit, label) {
  if (!credit || !Array.isArray(credit.roles) || credit.roles.length === 0) throw new TypeError(`${label} requires roles`);
  return {
    title: text(credit.title, `${label} title`), scope: text(credit.scope, `${label} scope`),
    roles: credit.roles.map(role => text(role, `${label} role`)),
    collaborators: credit.collaborators ? text(credit.collaborators, `${label} collaborators`) : undefined,
    note: credit.note ? text(credit.note, `${label} note`) : undefined,
    evidence: text(credit.evidence, `${label} evidence`),
  };
}

function childRecords(children, label) {
  if (children === undefined) return [];
  if (!Array.isArray(children)) throw new TypeError(`${label} children must be an array`);
  const ids = new Set(['sources']);
  return children.map((child, index) => {
    const result = childRecord(child, `${label} child ${index}`);
    if (ids.has(result.id)) throw new TypeError(`${label} duplicate child id: ${result.id}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.id) || /^history-/.test(result.id)) throw new TypeError(`${label} invalid child id`);
    ids.add(result.id);
    return result;
  });
}

function relatedIds(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} related records must be an array`);
  return [...new Set(value.map(id => text(id, `${label} related record`)))];
}

function childRecord(child, label) {
  if (!child || !Array.isArray(child.roles)) throw new TypeError(`${label} requires roles`);
  if (!Array.isArray(child.gallery) || child.gallery.length === 0) throw new TypeError(`${label} requires a gallery plan`);
  if (child.credits !== undefined && !Array.isArray(child.credits)) throw new TypeError(`${label} credits must be an array`);
  if (child.publicSources !== undefined && !Array.isArray(child.publicSources)) throw new TypeError(`${label} sources must be an array`);
  return {
    relatedRecordIds: relatedIds(child.relatedRecordIds, label),
    credits: (child.credits ?? []).map((credit, index) => trackCredit(credit, `${label} credit ${index}`)),
    publicSources: (child.publicSources ?? []).map((source, index) => sourceReference(source, `${label} source ${index}`)),
    id: text(child.id, `${label} id`),
    title: text(child.title, `${label} title`),
    artist: text(child.artist, `${label} artist`),
    date: text(child.date, `${label} date`),
    catalogNumber: text(child.catalogNumber, `${label} catalog number`),
    format: text(child.format, `${label} format`),
    roles: child.roles.map((role, roleIndex) => text(role, `${label} role ${roleIndex}`)),
    summary: text(child.summary, `${label} summary`),
    gallery: child.gallery.map((item, itemIndex) => presentationItem(item, `${label} gallery item ${itemIndex}`)),
  };
}

export function toPortfolioRecords(source) {
  if (source?.version !== 1 || !Array.isArray(source.records)) throw new TypeError('portfolio records must use version 1');
  const ids = new Set();
  const slugs = new Set();
  const records = source.records.map((record, index) => {
    const label = `portfolio record ${index}`;
    const id = text(record.id, `${label} id`);
    const slug = text(record.slug, `${label} slug`);
    if (ids.has(id)) throw new TypeError(`duplicate portfolio record id: ${id}`);
    if (slugs.has(slug)) throw new TypeError(`duplicate portfolio record slug: ${slug}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new TypeError(`${label} slug is invalid`);
    if (!categories.has(record.category)) throw new TypeError(`${label} category is invalid`);
    if (!statuses.has(record.status)) throw new TypeError(`${label} status is invalid`);
    if (!evidenceLevels.has(record.evidenceLevel)) throw new TypeError(`${label} evidence level is invalid`);
    if (record.public !== true) throw new TypeError(`${label} is not approved for the public dataset`);
    if (!Array.isArray(record.roles) || record.roles.length === 0) throw new TypeError(`${label} requires at least one role`);
    if (!Array.isArray(record.publicSources) || record.publicSources.length === 0) throw new TypeError(`${label} requires a public source`);
    if (!Array.isArray(record.gallery) || record.gallery.length === 0) throw new TypeError(`${label} requires a gallery plan`);
    ids.add(id);
    slugs.add(slug);
    return {
      ...record,
      relatedRecordIds: relatedIds(record.relatedRecordIds, label),
      id,
      slug,
      title: text(record.title, `${label} title`),
      format: text(record.format, `${label} format`),
      dateDisplay: text(record.dateDisplay, `${label} date`),
      sortDate: text(record.sortDate, `${label} sort date`),
      era: text(record.era, `${label} era`),
      roles: record.roles.map((role, roleIndex) => text(role, `${label} role ${roleIndex}`)),
      summary: text(record.summary, `${label} summary`),
      gallery: record.gallery.map((item, itemIndex) => presentationItem(item, `${label} gallery item ${itemIndex}`)),
      sections: Array.isArray(record.sections)
        ? record.sections.map((section, sectionIndex) => dossierSection(section, `${label} section ${sectionIndex}`))
        : [],
      children: childRecords(record.children, label),
      publicSources: record.publicSources.map((sourceItem, sourceIndex) => ({
        label: text(sourceItem.label, `${label} source ${sourceIndex} label`),
        href: httpsUrl(sourceItem.href, `${label} source ${sourceIndex} href`),
        supports: text(sourceItem.supports, `${label} source ${sourceIndex} support`),
      })),
    };
  });
  for (const record of records) {
    for (const item of [record, ...record.children]) {
      for (const id of item.relatedRecordIds) {
        if (!ids.has(id)) throw new TypeError(`unknown related record: ${id}`);
      }
    }
  }
  return records.sort((left, right) => left.sortDate.localeCompare(right.sortDate));
}
