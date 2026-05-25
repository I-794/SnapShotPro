import { showNotification } from '../ui/notification.js';
import { getClient, getUser, onAuthChange } from './auth.js';
import { state } from '../state/state.js';
import { render } from '../render/render.js';

const TEMPLATES_KEY = 'snapshotpro_templates';

function loadLocalTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveLocalTemplates(obj) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(obj)); }
  catch (e) {}
}

function snapshotProject() {
  return JSON.parse(JSON.stringify({
    imageTransform: state.imageTransform,
    imageFilters: state.imageFilters,
    textOverlay: state.textOverlay,
    watermark: state.watermark,
    gradient: state.gradient,
    padding: state.padding,
    scale: state.scale,
    borderRadius: state.borderRadius,
    showBorder: state.showBorder,
    borderWidth: state.borderWidth,
    borderColor: state.borderColor,
    shadow: state.shadow,
    canvas: state.canvas,
    bgMode: state.bgMode,
    bgColor: state.bgColor,
    deviceFrame: state.deviceFrame,
    annotations: state.annotations,
    redactions: state.redactions,
    spotlight: state.spotlight,
    meshGradient: state.meshGradient,
    tilt3d: state.tilt3d,
    scene: state.scene,
    autoLayout: state.autoLayout
  }));
}

export async function pushTemplates() {
  const user = getUser();
  const c = await getClient();
  if (!user || !c) return;
  const all = loadLocalTemplates();
  const names = Object.keys(all);
  if (names.length === 0) return;
  const rows = names.map(name => ({
    user_id: user.id,
    name,
    payload: all[name],
    updated_at: new Date().toISOString()
  }));
  const { error } = await c.from('templates').upsert(rows, { onConflict: 'user_id,name' });
  if (error) console.warn('template sync push failed', error);
}

export async function pullTemplates() {
  const user = getUser();
  const c = await getClient();
  if (!user || !c) return;
  const { data, error } = await c.from('templates').select('name, payload').eq('user_id', user.id);
  if (error) { console.warn('template sync pull failed', error); return; }
  const local = loadLocalTemplates();
  let added = 0;
  data.forEach(row => {
    if (!local[row.name]) { local[row.name] = row.payload; added++; }
  });
  if (added > 0) {
    saveLocalTemplates(local);
    showNotification(`Synced ${added} template${added === 1 ? '' : 's'} from cloud.`, 'success');
    if (typeof window.__refreshTemplateList === 'function') window.__refreshTemplateList();
  }
}

export async function saveProject(name) {
  const user = getUser();
  const c = await getClient();
  if (!user || !c) { showNotification('Sign in to save projects to the cloud.', 'error'); return; }
  const { error } = await c.from('projects').upsert({
    user_id: user.id,
    name,
    payload: snapshotProject(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,name' });
  if (error) showNotification('Project save failed: ' + error.message, 'error');
  else showNotification(`Project "${name}" saved to cloud.`, 'success');
}

export async function listProjects() {
  const user = getUser();
  const c = await getClient();
  if (!user || !c) return [];
  const { data, error } = await c.from('projects').select('name, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
  if (error) { console.warn(error); return []; }
  return data || [];
}

export async function loadProject(name) {
  const user = getUser();
  const c = await getClient();
  if (!user || !c) return;
  const { data, error } = await c.from('projects').select('payload').eq('user_id', user.id).eq('name', name).single();
  if (error) { showNotification('Load failed: ' + error.message, 'error'); return; }
  Object.assign(state, data.payload);
  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  showNotification(`Loaded "${name}".`, 'success');
}

async function syncOnSignIn(user) {
  if (!user) return;
  await pullTemplates();
  await pushTemplates();
}

export function bindCloudSync() {
  onAuthChange(syncOnSignIn);
  // Cloud projects panel buttons
  const saveBtn = document.getElementById('cloud-save-btn');
  const refreshBtn = document.getElementById('cloud-refresh-btn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const name = prompt('Name this project:');
    if (name) await saveProject(name.trim());
    refreshProjectList();
  });
  if (refreshBtn) refreshBtn.addEventListener('click', refreshProjectList);
}

async function refreshProjectList() {
  const list = document.getElementById('cloud-project-list');
  if (!list) return;
  const user = getUser();
  if (!user) { list.innerHTML = '<p class="info-text">Sign in to see cloud projects.</p>'; return; }
  const items = await listProjects();
  if (items.length === 0) { list.innerHTML = '<p class="info-text">No saved projects yet.</p>'; return; }
  list.innerHTML = items.map(p =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">
      <span>${p.name}</span>
      <button class="btn btn-secondary" data-load="${encodeURIComponent(p.name)}" style="padding:2px 8px;font-size:11px;">Load</button>
    </div>`
  ).join('');
  list.querySelectorAll('button[data-load]').forEach(btn =>
    btn.addEventListener('click', () => loadProject(decodeURIComponent(btn.dataset.load)))
  );
}
