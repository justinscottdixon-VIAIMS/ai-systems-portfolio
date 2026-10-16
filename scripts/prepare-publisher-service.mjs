import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const { values } = parseArgs({ options: { root: { type: 'string' }, 'env-file': { type: 'string' }, node: { type: 'string' } } });
if (!values.root || !values['env-file'] || !values.node) throw new Error('Pass --root, --env-file and --node');
const root = path.resolve(values.root);
const state = path.join(root, '.viaims-publisher');
const runtime = path.join(state, 'runtime');
await fs.mkdir(runtime, { recursive: true, mode: 0o700 });
for (const provider of ['Cinema', 'Music', 'Media']) await fs.mkdir(path.join(root, provider), { recursive: true });
await build({ entryPoints: ['scripts/local-media-publisher.mjs'], outfile: path.join(runtime, 'publisher.mjs'), bundle: true, platform: 'node', target: 'node24', format: 'esm',
  banner: { js: 'import { createRequire as createBundledRequire } from "node:module"; const require = createBundledRequire(import.meta.url);' },
});
const label = 'com.viaims.media-publisher';
const args = [values.node, path.join(runtime, 'publisher.mjs'), '--root', root, '--env-file', path.resolve(values['env-file']), '--publish'];
const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join('')}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>WorkingDirectory</key><string>${xml(runtime)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string></dict><key>StandardOutPath</key><string>${xml(path.join(state, 'service.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(state, 'service-error.log'))}</string></dict></plist>\n`;
await fs.writeFile(path.join(state, `${label}.plist`), plist, { mode: 0o600 });
await fs.writeFile(path.join(root, 'READ ME.txt'), `VIAIMS AUTOMATIC PUBLISHING\n\nDrop completed files into Cinema, Music or Media. After copying settles, the publisher checks the actual format and decodes the entire file. Passing files upload and appear on the website without a rebuild. Questionable files stay local and appear in Publishing Status.html.\n\nCinema / Media: H.264 MP4 or MOV, VP8/VP9 WebM.\nMusic: MP3, AAC/M4A, FLAC, 16/24-bit PCM WAV, or compatible video. Mono/stereo; maximum 2 GiB and four hours per file.\n\nOptional title: beside a file named Track.mp3, create Track.mp3.json containing {"title":"Your title"}. Rename or edit a held file to retry. Duplicate content and same-title replacements are held. No automatic re-encoding or deletion is performed.\n\nThe watcher runs while this Mac is awake, logged in, and online. It starts again at login. Status refreshes every 15 seconds when open; publication time includes the full audit and upload, then the player's next refresh. Removing a local file never removes a public release. Stop Publishing.command pauses publication; Start Publishing.command resumes it.\n\nThe existing preparation folder is separate and has not been enrolled for automatic publication. Credentials remain in the existing private environment file; never put passwords or tokens in these folders.\n`);
await fs.appendFile(path.join(root, 'READ ME.txt'), '\nCOMPLETE LIVE PLAYLISTS\nOpen LIVE PLAYLISTS.txt for all published titles in website order. Each player\nfolder contains a Published Playlist folder with numbered online shortcuts\nand PLAYLIST.txt. These references refresh about once a minute while the\nservice runs. Export new files into the parent player folder. Renaming a\nshortcut does not reorder the website. See LIVE PLAYLISTS STATUS.txt for\nrefresh health; an unavailable connection keeps the last verified list.\n');
const uid = process.getuid();
const installed = path.join(process.env.HOME, 'Library', 'LaunchAgents', `${label}.plist`);
for (const [name, command] of [
  ['Start Publishing.command', `launchctl bootstrap gui/${uid} ${quote(installed)} 2>/dev/null || launchctl kickstart gui/${uid}/${label}`],
  ['Stop Publishing.command', `launchctl bootout gui/${uid}/${label}`],
]) {
  const filename = path.join(root, name);
  await fs.writeFile(filename, `#!/bin/zsh\n${command}\n`, { mode: 0o700 }); await fs.chmod(filename, 0o700);
}
console.log(`Prepared portable publisher and login-service definition in ${root}`);
