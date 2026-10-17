'use strict';
const $ = selector => document.querySelector(selector);
let state, section = 'music', selected, busy = false, dragged, replacement, lastRendered, previewKey;
const sectionOf = group => group.provider === 'cinema' ? 'cinema' : group.kind === 'video' ? 'music-videos' : 'music';
const displayTitle = value => value.replace(/^V_/i, '').replace(/_$/, '');
const groupFor = item => item.playlistId || `unassigned-${item.folder}-${item.kind}`;
const node = (tag, text, cls) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (cls) element.className = cls; return element; };
const button = (text, action, label) => { const element = node('button', text); element.type = 'button'; if (label) element.setAttribute('aria-label', label); element.addEventListener('click', action); return element; };
function message(text = '') { $('#message').hidden = !text; $('#message').textContent = text; }
async function request(url, body) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'X-VIAIMS-Request': 'manager' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to connect.'); return data;
}
async function refresh(force = false) {
  if (busy || dragged || $('#text-dialog').open) return;
  try {
    const next = await request('/api/state'); state = next;
    $('#connection').textContent = next.jobs.some(j => ['queued', 'checking', 'publishing'].includes(j.status)) ? 'Connected · checking new media' : 'Connected · live playlist verified';
    const version = JSON.stringify({ ...next, checkedAt: undefined });
    if (force || version !== lastRendered) { lastRendered = version; render(); }
  } catch (error) { $('#connection').textContent = 'Offline · edits paused'; message(error.message); }
}
async function act(work) {
  if (busy) return;
  busy = true; document.body.classList.add('busy'); $('#connection').textContent = 'Saving…'; message();
  try { await work(); } catch (error) { message(error.message); }
  finally { busy = false; document.body.classList.remove('busy'); await refresh(true); }
}
const edit = operation => act(() => request('/api/edit', { operation, fingerprint: state.fingerprint }));
async function ask(title, value, max = 250) {
  const dialog = $('#text-dialog'); $('#dialog-title').textContent = title; $('#title-input').value = value; $('#title-input').maxLength = max;
  dialog.showModal(); $('#title-input').select();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'save' ? $('#title-input').value.trim() : null), { once: true }));
}
function preview(item, local = false) {
  const source = local ? item.preview : item.src, key = `${item.id}:${source}`;
  if (previewKey !== key) {
    $('#preview').replaceChildren(); const media = node(item.kind === 'video' ? 'video' : 'audio'); media.controls = true; media.preload = 'metadata'; media.src = source;
    media.addEventListener('error', () => message('Preview could not play. Check the file and connection.'));
    $('#preview').append(media); previewKey = key;
  }
  $('#preview-label').textContent = `${displayTitle(item.title)}${local ? ' · local inspection copy' : ''}`;
  $('#preview').firstChild.play().catch(() => {});
}
function moveButtons(index, list, save) {
  const arrows = node('div', undefined, 'arrows');
  for (const [symbol, offset, label] of [['↑', -1, 'Move earlier'], ['↓', 1, 'Move later']]) {
    const control = button(symbol, () => { const ids = list.map(x => x.id); [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]]; save(ids); }, label);
    control.disabled = index + offset < 0 || index + offset >= list.length; arrows.append(control);
  }
  return arrows;
}
function draggable(element, type, id, drop) {
  element.draggable = true;
  element.addEventListener('dragstart', event => { if (event.target.closest('button,select,input')) { event.preventDefault(); return; } dragged = { type, id }; event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; });
  element.addEventListener('dragend', () => { dragged = null; document.querySelectorAll('.dragover').forEach(e => e.classList.remove('dragover')); });
  element.addEventListener('dragover', event => { if (dragged?.type === type) { event.preventDefault(); element.classList.add('dragover'); } });
  element.addEventListener('dragleave', () => element.classList.remove('dragover'));
  element.addEventListener('drop', event => { if (dragged?.type !== type) return; event.preventDefault(); event.stopPropagation(); const from = dragged.id; dragged = null; element.classList.remove('dragover'); if (from !== id) drop(from, id); });
}
function reorder(list, from, to) { const ids = list.map(i => i.id).filter(id => id !== from); ids.splice(ids.indexOf(to), 0, from); return ids; }
function render() {
  const groups = state.playlists.filter(g => sectionOf(g) === section).sort((a, b) => a.position - b.position);
  if (!groups.some(g => g.id === selected)) selected = groups[0]?.id;
  const group = groups.find(g => g.id === selected);
  $('#playlists').replaceChildren();
  groups.forEach((g, index) => {
    const row = node('div', undefined, `playlist${g.id === selected ? ' selected' : ''}`);
    const select = button(g.title, () => { selected = g.id; render(); }); select.className = 'name'; select.setAttribute('aria-current', String(g.id === selected)); row.append(select);
    const save = ids => edit({ type: 'order-playlists', section, ids });
    row.append(moveButtons(index, groups, save)); draggable(row, 'playlist', g.id, (from, to) => save(reorder(groups, from, to)));
    $('#playlists').append(row);
  });
  $('#section-name').textContent = section === 'music-videos' ? 'MUSIC VIDEOS' : section.toUpperCase();
  $('#group-heading').textContent = section === 'cinema' ? 'Series' : 'Playlists';
  $('#playlist-title').textContent = group?.title || 'Create your first playlist'; $('#rename-playlist').disabled = !group;
  $('#dropzone').hidden = !group; $('#choose-files').disabled = !group;
  const tracks = state.items.filter(i => groupFor(i) === selected).sort((a, b) => a.playlistOrder - b.playlistOrder);
  $('#playlist-count').textContent = `${tracks.length} ${tracks.length === 1 ? 'recording' : 'recordings'} · website order`;
  $('#tracks').replaceChildren(); $('#empty').hidden = tracks.length > 0;
  tracks.forEach((item, index) => {
    const row = node('li', undefined, 'track'); row.append(node('span', String(index + 1).padStart(2, '0'), 'number'));
    const content = node('div'), info = node('div', undefined, 'track-info');
    const rename = async () => { const title = await ask('Rename recording', displayTitle(item.title)); if (title && title !== displayTitle(item.title)) edit({ type: 'rename-track', itemId: item.id, title: /^V_.*_$/i.test(item.title) ? `V_${title}_` : title }); };
    const name = button(displayTitle(item.title), rename, `Rename ${displayTitle(item.title)}`); name.className = 'track-title'; info.append(name, node('span', 'LIVE', 'badge')); content.append(info);
    const controls = node('div', undefined, 'track-controls'); controls.append(button('▶ Preview', () => preview(item)), button('Rename', rename));
    controls.append(moveButtons(index, tracks, ids => edit({ type: 'order-tracks', playlistId: selected, ids })));
    const destination = node('select'); destination.setAttribute('aria-label', `Playlist for ${item.title}`);
    state.playlists.filter(g => g.provider === item.folder && g.kind === item.kind).sort((a, b) => a.position - b.position).forEach(g => { const option = node('option', g.title); option.value = g.id; option.selected = g.id === groupFor(item); destination.append(option); });
    destination.addEventListener('change', () => edit({ type: 'move-track', itemId: item.id, playlistId: destination.value })); controls.append(destination);
    controls.append(button('Replace file', () => { replacement = item; $('#replace-input').click(); }), button('Remove', () => { if (confirm(`Remove “${item.title}” from the website? The media file is preserved, and you can restore it here.`)) edit({ type: 'remove-track', itemId: item.id }); }));
    content.append(controls); row.append(content);
    draggable(row, 'track', item.id, (from, to) => edit({ type: 'order-tracks', playlistId: selected, ids: reorder(tracks, from, to) })); $('#tracks').append(row);
  });
  $('#imports').replaceChildren();
  if (state.importPending) { const box = node('div', 'Your existing folder changes are ready to bring into this workspace.', 'job'); box.append(button('Use folder changes', () => act(() => request('/api/import', {})))); $('#imports').append(box); }
  state.jobs.filter(j => j.playlistId === selected).slice().reverse().forEach(job => {
    const box = node('div', undefined, `job ${job.status}`), title = node('div', undefined, 'job-title'); title.append(node('strong', displayTitle(job.title)), node('small', job.status.replaceAll('-', ' ').toUpperCase())); box.append(title, node('p', job.message));
    const actions = node('div', undefined, 'actions'); actions.append(button('▶ Preview', () => preview(job, true)));
    const jobAction = action => act(() => request('/api/job', { id: job.id, action }));
    if (job.status === 'needs-review') actions.append(button('Retry inspection', () => jobAction('retry')));
    if (job.status === 'ready-to-replace') actions.append(button('Confirm replacement', () => { if (confirm(`Replace the published recording with this inspected file? The previous file will be retained.`)) jobAction('replace'); }));
    if (['needs-review', 'duplicate', 'published', 'ready-to-replace'].includes(job.status)) actions.append(button('Dismiss', () => jobAction('dismiss')));
    box.append(actions); $('#imports').append(box);
  });
  $('#removed').replaceChildren(); state.removed.forEach(item => { const row = node('div'); row.append(node('span', displayTitle(item.title)), button('Restore', () => edit({ type: 'restore-track', itemId: item.id }))); $('#removed').append(row); });
  if (!state.removed.length) $('#removed').append(node('p', 'No removed recordings.'));
}
async function upload(files, target) {
  if (!selected || !files.length) return;
  const playlist = target ? groupFor(target) : selected;
  await act(async () => {
    for (const file of files) {
      $('#connection').textContent = `Copying ${file.name}…`;
      const params = new URLSearchParams({ filename: file.name, playlist }); if (target) params.set('replace', target.id);
      const response = await fetch(`/api/upload?${params}`, { method: 'POST', headers: { 'X-VIAIMS-Request': 'manager', 'Content-Type': 'application/octet-stream' }, body: file });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
    }
  });
}
$('#sections').addEventListener('click', event => { const target = event.target.closest('[data-section]'); if (!target || !state) return; section = target.dataset.section; selected = null; $('#sections').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === target))); render(); });
$('#add-playlist').addEventListener('click', async () => { const title = await ask(section === 'cinema' ? 'New cinema series' : 'New playlist', '', 100); if (title) await edit({ type: 'create-playlist', section, title }); });
$('#rename-playlist').addEventListener('click', async () => { const group = state.playlists.find(g => g.id === selected); const title = await ask('Rename playlist', group.title, 100); if (title && title !== group.title) edit({ type: 'rename-playlist', playlistId: selected, title }); });
$('#choose-files').addEventListener('click', event => { event.stopPropagation(); $('#file-input').click(); });
$('#dropzone').addEventListener('click', event => { if (event.target.id !== 'choose-files') $('#file-input').click(); });
$('#dropzone').addEventListener('keydown', event => { if (event.target === $('#dropzone') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); $('#file-input').click(); } });
$('#file-input').addEventListener('change', async event => { await upload([...event.target.files]); event.target.value = ''; });
$('#replace-input').addEventListener('change', async event => { const target = replacement; replacement = null; if (event.target.files.length) await upload([event.target.files[0]], target); event.target.value = ''; });
$('#dropzone').addEventListener('dragover', event => { if (!dragged) { event.preventDefault(); $('#dropzone').classList.add('dragover'); } });
$('#dropzone').addEventListener('dragleave', () => $('#dropzone').classList.remove('dragover'));
$('#dropzone').addEventListener('drop', event => { if (dragged) return; event.preventDefault(); $('#dropzone').classList.remove('dragover'); upload([...event.dataTransfer.files]); });
window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
window.addEventListener('drop', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
refresh(); setInterval(() => refresh(), 5000);
