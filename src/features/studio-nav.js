// v13.5 — Studio workspace navigation.
//
// The studio's left sidebar used to be one long scroll of ~25 panels. This turns
// it into an icon rail + a single contextual panel: each rail tab reveals only
// its group of panels. Grouping is derived from each panel's existing title, so
// no panel markup or control wiring changes — every element ID stays put.
//
// On narrow screens grouping is disabled (all panels show in one scroll) so the
// existing mobile sidebar-toggle behavior is preserved.

const NARROW = 860;
const ACTIVE_KEY = 'snapshotpro_studio_group';

// Ordered tabs (must match the rail buttons in editor/index.html).
const TABS = [
  { id: 'import', label: 'Import' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'background', label: 'Background' },
  { id: 'frame', label: 'Frame' },
  { id: 'markup', label: 'Markup' },
  { id: 'ai', label: 'AI' },
  { id: 'export', label: 'Export' },
  { id: 'project', label: 'Project' }
];

// Map a panel to a group by a distinctive substring of its title.
const TITLE_GROUPS = [
  ['Image Upload', 'import'], ['Auto Layout', 'import'],
  ['Image Editing', 'adjust'], ['Image Settings', 'adjust'], ['3D Tilt', 'adjust'], ['Smart Palette', 'adjust'],
  ['Background', 'background'], ['Mockup Scenes', 'background'],
  ['Device', 'frame'], ['Mockup Presets', 'frame'], ['Shadow', 'frame'], ['Canvas', 'frame'],
  ['Annotations', 'markup'], ['Privacy', 'markup'], ['Spotlight', 'markup'], ['Watermark', 'markup'], ['Animation', 'markup'],
  ['AI Tools', 'ai'], ['Brand Kit', 'ai'],
  ['Video', 'export'], ['App Store', 'export'], ['Export Settings', 'export'], ['Share', 'export'],
  ['Projects', 'project'], ['Pages', 'project'], ['Gallery', 'project'], ['Templates', 'project']
];

function groupForTitle(title) {
  for (const [needle, group] of TITLE_GROUPS) {
    if (title.includes(needle)) return group;
  }
  return 'import'; // fallback so nothing is ever orphaned
}

let active = 'import';
let sections = [];

function isNarrow() { return window.innerWidth <= NARROW; }

function apply() {
  const narrow = isNarrow();
  const rail = document.getElementById('tool-rail');
  const header = document.getElementById('panel-header');
  if (rail) rail.style.display = narrow ? 'none' : '';
  if (header) header.style.display = narrow ? 'none' : '';

  sections.forEach(({ el, group, titleEl, redundant }) => {
    el.style.display = (narrow || group === active) ? '' : 'none';
    // The panel header already names the group, so hide a panel's own title when
    // it just repeats it (e.g. "Background"). On mobile the header is hidden, so
    // the title comes back.
    if (redundant && titleEl) titleEl.style.display = narrow ? '' : 'none';
  });

  document.querySelectorAll('.rail-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.group === active));
  const titleEl = document.getElementById('panel-title');
  if (titleEl) titleEl.textContent = (TABS.find(t => t.id === active) || {}).label || '';
}

export function setGroup(id) {
  if (!TABS.some(t => t.id === id)) return;
  active = id;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.scrollTop = 0;
  apply();
}

export function bindStudioNav() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // Tag every panel with its group from the title.
  const labelByGroup = Object.fromEntries(TABS.map(t => [t.id, t.label]));
  const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  sections = Array.from(sidebar.querySelectorAll('.sidebar-section')).map(el => {
    const titleEl = el.querySelector('.section-title');
    const title = titleEl ? titleEl.textContent : '';
    const group = groupForTitle(title);
    el.dataset.group = group;
    const redundant = !!titleEl && norm(title) === norm(labelByGroup[group]);
    return { el, group, titleEl, redundant };
  });

  // Sticky contextual-panel header showing the active group.
  const header = document.createElement('div');
  header.className = 'panel-header';
  header.id = 'panel-header';
  header.innerHTML = '<h2 id="panel-title">Import</h2>';
  sidebar.prepend(header);

  // Rail buttons.
  document.querySelectorAll('.rail-btn').forEach(b =>
    b.addEventListener('click', () => setGroup(b.dataset.group)));

  active = (() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'import'; } catch (e) { return 'import'; }
  })();

  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(apply, 150); });

  apply();
}
