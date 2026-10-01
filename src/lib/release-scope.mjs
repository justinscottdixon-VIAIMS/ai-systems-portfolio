// Publication selection is explicit; record status alone is not editorial approval.
export const releaseRecordIds = Object.freeze([
 'time-travel', 'one-voyager-remix', 'two-worlds', 'someone-else-bloom',
 'audio-shock', 'unexpected', 'navigator', 'groove-me-anniversary',
]);

export function selectReleaseRecords(records, scope = 'full') {
 if (scope === 'full') return records;
 if (scope !== 'selected') throw new Error(`Unknown VIAIMS_RELEASE_SCOPE: ${scope}`);
 const ids = new Set(releaseRecordIds);
 for (const id of ids) {
  const record = records.find(record => record.id === id);
  if (!record) throw new Error(`Missing release dossier: ${id}`);
  if (record.status === 'verification-pending') throw new Error(`Release dossier is verification-pending: ${id}`);
 }
 return records.filter(record => ids.has(record.id)).map(record => ({
  ...record,
  relatedRecordIds: record.relatedRecordIds.filter(id => ids.has(id)),
  children: record.children.map(child => ({
   ...child, relatedRecordIds: child.relatedRecordIds.filter(id => ids.has(id)),
  })),
 }));
}
