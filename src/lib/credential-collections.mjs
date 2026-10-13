import { archiveHref } from './archive-index.mjs';

const memberKinds = new Set(['release', 'context', 'collection']);

function assertUniqueChildren(record) {
  const ids = new Set();
  for (const child of record.children) {
    if (ids.has(child.id)) throw new TypeError(`duplicate credential collection child id: ${record.id}/${child.id}`);
    ids.add(child.id);
  }
}

function mergeRelease(child, record) {
  const gallery = [...child.gallery];
  const imageSources = new Set(gallery.filter(item => item.kind === 'image').map(item => item.src));
  for (const item of record.gallery) {
    // Pending evidence remains on the canonical record; only eligible images join the release gallery.
    if (item.kind === 'image' && !imageSources.has(item.src)) {
      gallery.push(item);
      imageSources.add(item.src);
    }
  }
  const publicSources = [];
  const sourceKeys = new Set();
  for (const source of [...child.publicSources, ...record.publicSources]) {
    const key = JSON.stringify([source.href, source.supports]);
    if (!sourceKeys.has(key)) {
      publicSources.push(source);
      sourceKeys.add(key);
    }
  }
  return { ...child, gallery, publicSources, contextRecords: [...child.contextRecords, record] };
}

function releaseChild(record) {
  return {
    ...record,
    artist: record.displayArtistOrClient,
    date: record.dateDisplay,
    catalogNumber: record.catalog?.catalogNumber || 'Not specified',
    credits: [],
    sourceArchiveHref: archiveHref(record),
    contextRecords: [record],
  };
}

/** Project normalized canonical records into Credentials collections without changing archive records. */
export function toCredentialCollections(normalizedRecords) {
  if (!Array.isArray(normalizedRecords)) throw new TypeError('credential collection records must be an array');
  const recordsById = new Map();
  for (const record of normalizedRecords) {
    if (recordsById.has(record.id)) throw new TypeError(`duplicate credential record id: ${record.id}`);
    recordsById.set(record.id, record);
  }

  const membersByParent = new Map();
  for (const record of normalizedRecords) {
    const membership = record.credentialsCollection;
    if (membership === undefined) continue;
    if (!membership || typeof membership !== 'object' || Array.isArray(membership)
      || typeof membership.id !== 'string' || !membership.id || !memberKinds.has(membership.kind)) {
      throw new TypeError(`invalid credential collection membership: ${record.id}`);
    }
    const parent = recordsById.get(membership.id);
    if (!parent) throw new TypeError(`unknown credential collection: ${membership.id}`);
    if (parent === record) throw new TypeError(`self credential collection membership: ${record.id}`);
    if (parent.credentialsCollection !== undefined) throw new TypeError(`nested credential collection membership: ${record.id}`);
    if (membership.childId !== undefined) {
      if (membership.kind !== 'release' || typeof membership.childId !== 'string' || !membership.childId) {
        throw new TypeError(`invalid credential collection child target: ${record.id}`);
      }
      if (!parent.children.some(child => child.id === membership.childId)) {
        throw new TypeError(`missing credential collection child target: ${parent.id}/${membership.childId}`);
      }
    }
    if (!membersByParent.has(parent.id)) membersByParent.set(parent.id, []);
    membersByParent.get(parent.id).push(record);
  }

  return normalizedRecords.filter(record => record.credentialsCollection === undefined).map(record => {
    const members = membersByParent.get(record.id);
    if (!members) return record;
    const collection = {
      ...record,
      children: record.children.map(child => ({
        ...child, sourceArchiveHref: archiveHref(record, child), contextRecords: [],
      })),
      contextRecords: [],
    };
    assertUniqueChildren(collection);
    for (const member of members) {
      const { kind, childId } = member.credentialsCollection;
      if (kind === 'context' || kind === 'collection') collection.contextRecords.push(member);
      if (kind === 'collection') {
        collection.children.push(...member.children.map(child => ({
          ...child,
          id: `${member.id}-${child.id}`,
          sourceArchiveHref: archiveHref(member, child),
          contextRecords: [],
        })));
      } else if (kind === 'release') {
        if (childId !== undefined) {
          const index = collection.children.findIndex(child => child.id === childId);
          collection.children[index] = mergeRelease(collection.children[index], member);
        } else {
          collection.children.push(releaseChild(member));
        }
      }
    }
    assertUniqueChildren(collection);
    return collection;
  });
}
