// v12 — Projects & Version History.
//
// Turns the editor from a single ephemeral canvas into a project workspace:
//  • Local-first store (localStorage) so "never lose a design" works offline
//    and without a Supabase account; cloud sync layers on when signed in.
//  • Debounced autosave of the active project after every committed edit.
//  • Version snapshots — automatic (time-spaced) + named — with a timeline
//    modal to restore or fork a version into a new project.
//
// v13: a project's `payload` is now a *document* (multiple pages). Serialization
// is delegated to pages.js (serializeDocument / applyDocument); this module owns
// persistence, the dashboard, version history, and cloud sync.

import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';
import { escapeHTML } from '../utils/dom.js';
import { onHistoryChange } from '../state/history.js';
import { makeThumb, uid } from './document.js';
import { serializeDocument, applyDocument, onDocumentChange, pageCount } from './pages.js';
import { getClient, getUser, onAuthChange } from './auth.js';

const STORE_KEY = 'snapshotpro_projects_v12';
const ACTIVE_KEY = 'snapshotpro_active_project';
const AUTOSAVE_DELAY = 1500;            // ms after the last edit before we save
const AUTO_VERSION_INTERVAL = 3 * 60_000; // min spacing between auto-snapshots
const MAX_AUTO_VERSIONS = 15;           // named versions are never pruned

let activeId = null;
let saveTimer = null;
let creating = false;   // guard so the debounce can't double-create "Untitled"

// ── Local store ────────────────────────────────────────────────────────────
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
function writeStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    // Quota exceeded — prune the oldest auto-versions across all projects and retry once.
    pruneAutoVersions(store);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
    catch (e2) { showNotification('Storage full — older versions were trimmed.', 'error'); return false; }
  }
}
function pruneAutoVersions(store) {
  Object.values(store).forEach(p => {
    if (p.versions) p.versions = p.versions.filter(v => !v.auto).slice(0, 5)
      .concat((p.versions.filter(v => v.auto)).slice(0, 3));
  });
}

function getActive() {
  if (!activeId) return null;
  return loadStore()[activeId] || null;
}

// ── Saving ───────────────────────────────────────────────────────────────────
function newProject(name) {
  const store = loadStore();
  const id = uid();
  const now = Date.now();
  store[id] = {
    id,
    name: name || untitledName(store),
    payload: serializeDocument(),
    thumbnail: makeThumb(),
    createdAt: now,
    updatedAt: now,
    versions: []
  };
  activeId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  writeStore(store);
  pushProjectToCloud(store[id]);
  // v30 — Brand Brain enforcement: a new project starts on-brand.
  if (state.brand && state.brand.enforce && state.brand.enabled) {
    import('./brand-brain.js').then(m => m.applyBrand());
  }
  return store[id];
}

function untitledName(store) {
  const n = Object.values(store).filter(p => /^Untitled/.test(p.name)).length;
  return n ? `Untitled ${n + 1}` : 'Untitled';
}

// Persist the current editor state into the active project. Auto-snapshots a
// version if enough time has passed since the last one.
function saveActive({ versionLabel } = {}) {
  const store = loadStore();
  let p = store[activeId];
  if (!p) return null;

  p.payload = serializeDocument();
  p.thumbnail = makeThumb();
  p.updatedAt = Date.now();

  const named = versionLabel != null;
  const last = p.versions[0];
  const due = !last || (Date.now() - last.createdAt) > AUTO_VERSION_INTERVAL;
  if (named || due) {
    p.versions.unshift({
      id: uid(),
      label: named ? versionLabel : null,
      payload: p.payload,
      thumbnail: p.thumbnail,
      createdAt: Date.now(),
      auto: !named
    });
    const justAdded = p.versions[0];
    // Keep all named versions; cap auto versions.
    const namedV = p.versions.filter(v => !v.auto);
    const autoV = p.versions.filter(v => v.auto).slice(0, MAX_AUTO_VERSIONS);
    p.versions = [...namedV, ...autoV].sort((a, b) => b.createdAt - a.createdAt);
    pushVersionToCloud(p.id, justAdded);
  }

  writeStore(store);
  pushProjectToCloud(p);
  setSavedStatus(p.updatedAt);
  return p;
}

function scheduleAutosave() {
  if (!state.image) return;        // nothing meaningful to save yet
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!activeId) {
      if (creating) return;
      creating = true;
      newProject();
      creating = false;
    } else {
      saveActive();
    }
    renderPanel();
  }, AUTOSAVE_DELAY);
}

// Immediate save triggered by document-level changes (page add / switch /
// delete / reorder) which don't go through the history stack. Creates a project
// on demand so multi-page work is never lost.
export function saveDocumentNow() {
  if (!state.image && pageCount() <= 1) return;
  if (!activeId) {
    if (creating) return;
    creating = true; newProject(); creating = false;
  } else {
    saveActive();
  }
  renderPanel();
}

// ── Applying a project / version to the editor ───────────────────────────────
function openProject(id) {
  const p = loadStore()[id];
  if (!p) return;
  activeId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  applyDocument(p.payload);
  setSavedStatus(p.updatedAt);
  renderPanel();
  showNotification(`Opened "${p.name}".`, 'success');
}

function restoreVersion(versionId) {
  const store = loadStore();
  const p = store[activeId];
  if (!p) return;
  const v = p.versions.find(x => x.id === versionId);
  if (!v) return;
  // Snapshot the pre-restore state first so the restore itself is recoverable.
  p.versions.unshift({
    id: uid(), label: 'Before restore', payload: serializeDocument(),
    thumbnail: makeThumb(), createdAt: Date.now(), auto: false
  });
  p.payload = v.payload;
  p.updatedAt = Date.now();
  writeStore(store);
  pushProjectToCloud(p);
  applyDocument(v.payload);
  closeVersionsModal();
  renderPanel();
  showNotification('Version restored.', 'success');
}

function forkVersion(versionId) {
  const p = loadStore()[activeId];
  if (!p) return;
  const v = p.versions.find(x => x.id === versionId);
  if (!v) return;
  const store = loadStore();
  const id = uid();
  const now = Date.now();
  store[id] = {
    id, name: `${p.name} (copy)`, payload: v.payload, thumbnail: v.thumbnail,
    createdAt: now, updatedAt: now, versions: []
  };
  activeId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  writeStore(store);
  pushProjectToCloud(store[id]);
  applyDocument(v.payload);
  closeVersionsModal();
  renderPanel();
  showNotification(`Forked into "${store[id].name}".`, 'success');
}

// ── Project actions ──────────────────────────────────────────────────────────
function renameProject(id) {
  const store = loadStore();
  const p = store[id];
  if (!p) return;
  const name = prompt('Rename project:', p.name);
  if (name == null) return;
  p.name = name.trim() || p.name;
  p.updatedAt = Date.now();
  writeStore(store);
  pushProjectToCloud(p);
  renderPanel();
}

function duplicateProject(id) {
  const store = loadStore();
  const p = store[id];
  if (!p) return;
  const nid = uid();
  const now = Date.now();
  store[nid] = {
    id: nid, name: `${p.name} (copy)`, payload: p.payload, thumbnail: p.thumbnail,
    createdAt: now, updatedAt: now, versions: []
  };
  writeStore(store);
  pushProjectToCloud(store[nid]);
  renderPanel();
  showNotification(`Duplicated "${p.name}".`, 'success');
}

function deleteProject(id) {
  const store = loadStore();
  const p = store[id];
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
  delete store[id];
  writeStore(store);
  if (activeId === id) { activeId = null; localStorage.removeItem(ACTIVE_KEY); }
  deleteProjectFromCloud(id);
  renderPanel();
  showNotification('Project deleted.', 'success');
}

// ── Cloud sync (best-effort; local stays the source of truth) ────────────────
async function pushProjectToCloud(p) {
  try {
    const user = getUser(); const c = await getClient();
    if (!user || !c || !p) return;
    await c.from('projects').upsert({
      id: p.id, user_id: user.id, name: p.name,
      payload: p.payload, thumbnail: p.thumbnail,
      updated_at: new Date(p.updatedAt).toISOString()
    }, { onConflict: 'id' });
  } catch (e) { /* offline / not configured — local copy is safe */ }
}
async function pushVersionToCloud(projectId, v) {
  try {
    const user = getUser(); const c = await getClient();
    if (!user || !c || !v) return;
    await c.from('project_versions').upsert({
      id: v.id, project_id: projectId, user_id: user.id,
      label: v.label, payload: v.payload, thumbnail: v.thumbnail,
      created_at: new Date(v.createdAt).toISOString()
    }, { onConflict: 'id' });
  } catch (e) { /* best-effort */ }
}
async function deleteProjectFromCloud(id) {
  try {
    const user = getUser(); const c = await getClient();
    if (!user || !c) return;
    await c.from('projects').delete().eq('id', id).eq('user_id', user.id);
  } catch (e) { /* best-effort */ }
}
async function pullCloud() {
  try {
    const user = getUser(); const c = await getClient();
    if (!user || !c) return;
    const { data: projs } = await c.from('projects')
      .select('id, name, payload, thumbnail, updated_at').eq('user_id', user.id);
    if (!projs) return;
    const { data: vers } = await c.from('project_versions')
      .select('id, project_id, label, payload, thumbnail, created_at').eq('user_id', user.id);
    const store = loadStore();
    let added = 0;
    projs.forEach(row => {
      const cloudUpdated = new Date(row.updated_at).getTime();
      const local = store[row.id];
      if (!local || cloudUpdated > local.updatedAt) {
        store[row.id] = {
          id: row.id, name: row.name, payload: row.payload, thumbnail: row.thumbnail,
          createdAt: local ? local.createdAt : cloudUpdated, updatedAt: cloudUpdated,
          versions: (vers || []).filter(v => v.project_id === row.id).map(v => ({
            id: v.id, label: v.label, payload: v.payload, thumbnail: v.thumbnail,
            createdAt: new Date(v.created_at).getTime(), auto: !v.label
          })).sort((a, b) => b.createdAt - a.createdAt)
        };
        if (!local) added++;
      }
    });
    writeStore(store);
    if (added > 0) showNotification(`Synced ${added} project${added === 1 ? '' : 's'} from cloud.`, 'success');
    renderPanel();
  } catch (e) { /* best-effort */ }
}

// ── UI: sidebar panel ────────────────────────────────────────────────────────
function setSavedStatus(ts) {
  const s = document.getElementById('projects-status');
  if (s) s.textContent = ts ? `Saved · ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
}

function renderPanel() {
  const nameEl = document.getElementById('projects-current-name');
  const active = getActive();
  if (nameEl) nameEl.textContent = active ? active.name : 'No project — edits autosave to a new one';

  const list = document.getElementById('projects-list');
  if (list) {
    const store = loadStore();
    const items = Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt);
    if (items.length === 0) {
      list.innerHTML = '<p class="info-text">No projects yet. Your edits autosave here.</p>';
    } else {
      list.innerHTML = items.map(p => `
        <div class="project-card${p.id === activeId ? ' active' : ''}">
          <div class="project-thumb">${p.thumbnail ? `<img src="${p.thumbnail}" alt="">` : '🖼'}</div>
          <div class="project-meta">
            <div class="project-name" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div>
            <div class="project-sub">${p.versions ? p.versions.length : 0} version${(p.versions && p.versions.length === 1) ? '' : 's'} · ${new Date(p.updatedAt).toLocaleDateString()}</div>
          </div>
          <div class="project-actions">
            <button class="btn btn-secondary" data-open="${p.id}" title="Open" style="padding:2px 7px;font-size:11px;">Open</button>
            <button class="btn btn-secondary" data-rename="${p.id}" title="Rename" style="padding:2px 6px;font-size:11px;">✎</button>
            <button class="btn btn-secondary" data-dup="${p.id}" title="Duplicate" style="padding:2px 6px;font-size:11px;">⧉</button>
            <button class="btn btn-secondary" data-del="${p.id}" title="Delete" style="padding:2px 6px;font-size:11px;">🗑</button>
          </div>
        </div>`).join('');
      list.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open)));
      list.querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', () => renameProject(b.dataset.rename)));
      list.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', () => duplicateProject(b.dataset.dup)));
      list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteProject(b.dataset.del)));
    }
  }
}

// ── UI: versions modal ───────────────────────────────────────────────────────
function openVersionsModal() {
  const p = getActive();
  if (!p) { showNotification('No active project yet — make an edit first.', 'error'); return; }
  const body = document.getElementById('versions-modal-body');
  if (body) {
    if (!p.versions || p.versions.length === 0) {
      body.innerHTML = '<p class="info-text">No versions yet. Versions are captured automatically as you work, and whenever you click "Save version".</p>';
    } else {
      body.innerHTML = p.versions.map(v => `
        <div class="version-row">
          <div class="version-thumb">${v.thumbnail ? `<img src="${v.thumbnail}" alt="">` : ''}</div>
          <div class="version-meta">
            <div class="version-label">${v.label ? escapeHTML(v.label) : 'Autosave'}</div>
            <div class="version-time">${new Date(v.createdAt).toLocaleString()}</div>
          </div>
          <div class="version-actions">
            <button class="btn btn-primary" data-restore="${v.id}" style="padding:3px 10px;font-size:12px;">Restore</button>
            <button class="btn btn-secondary" data-fork="${v.id}" style="padding:3px 10px;font-size:12px;">Fork</button>
          </div>
        </div>`).join('');
      body.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => restoreVersion(b.dataset.restore)));
      body.querySelectorAll('[data-fork]').forEach(b => b.addEventListener('click', () => forkVersion(b.dataset.fork)));
    }
  }
  const title = document.getElementById('versions-modal-title');
  if (title) title.textContent = `Version history — ${p.name}`;
  const m = document.getElementById('versions-modal');
  if (m) m.classList.add('visible');
}
function closeVersionsModal() {
  const m = document.getElementById('versions-modal');
  if (m) m.classList.remove('visible');
}

// ── Bind ─────────────────────────────────────────────────────────────────────
export function bindProjects() {
  activeId = localStorage.getItem(ACTIVE_KEY) || null;

  // Autosave after every committed edit, and after page-level document changes.
  onHistoryChange(scheduleAutosave);
  onDocumentChange(saveDocumentNow);

  const newBtn = document.getElementById('projects-new-btn');
  const saveVerBtn = document.getElementById('projects-save-version-btn');
  const historyBtn = document.getElementById('projects-history-btn');
  if (newBtn) newBtn.addEventListener('click', () => {
    const name = prompt('New project name:', 'Untitled');
    if (name == null) return;
    newProject(name.trim() || undefined);
    renderPanel();
    showNotification('New project created.', 'success');
  });
  if (saveVerBtn) saveVerBtn.addEventListener('click', () => {
    if (!state.image) { showNotification('Load an image first.', 'error'); return; }
    if (!activeId) newProject();
    const label = prompt('Name this version (optional):', '');
    if (label == null) return;
    saveActive({ versionLabel: label.trim() || 'Manual save' });
    renderPanel();
    showNotification('Version saved.', 'success');
  });
  if (historyBtn) historyBtn.addEventListener('click', openVersionsModal);

  const closeBtn = document.getElementById('versions-modal-close');
  const overlay = document.getElementById('versions-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeVersionsModal);
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVersionsModal(); });

  // Pull cloud projects whenever a user signs in.
  onAuthChange(u => { if (u) pullCloud(); });

  const active = getActive();
  if (active) setSavedStatus(active.updatedAt);
  renderPanel();
}
