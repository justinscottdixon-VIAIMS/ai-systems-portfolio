/** Suppress only facts already printed on the surrounding release card. */
export function contextDisplay(record, { release, showSummary, sourcesAlreadyShown = false } = {}) {
  const existingSources = new Set((release?.publicSources ?? []).map(source => JSON.stringify([source.href, source.supports])));
  return {
    showSummary: showSummary ?? record.summary !== release?.summary,
    showDate: record.dateDisplay !== release?.date,
    showFormat: record.format !== release?.format,
    showRoles: JSON.stringify(record.roles) !== JSON.stringify(release?.roles),
    sources: record.publicSources.filter(source => !sourcesAlreadyShown || !existingSources.has(JSON.stringify([source.href, source.supports]))),
  };
}
