// Credentials publication and live Blob-catalogue migration are separate releases.
// Keep the reviewed, bundled playlists until the live catalogue is explicitly enabled.
export function runtimeCatalogueEnabled(scope = 'full', setting) {
  return scope === 'full' && setting === 'enabled';
}
