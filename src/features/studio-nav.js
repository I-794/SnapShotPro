// v13.5 — Studio workspace navigation.  (v20.1 — explicit grouping + collapsible)
//
// The left sidebar is an icon rail + a single contextual panel: each rail tab
// reveals only its group of panels. Grouping now comes from each section's
// explicit data-group attribute (set in editor/index.html); a title-substring
// fallback remains so a section is never orphaned. Sections are collapsible: the
// title row toggles its body, and the open/closed state persists per section.
// Every element ID stays put, so feature wiring is unaffected.
//
// On narrow screens grouping is disabled (all panels show in one scroll).

const NARROW = 860;
const ACTIVE_KEY = 'snapshotpro_studio_group';
const COLLAPSE_KEY = 'snapshotpro_section_collapsed';

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

// Fallback only: used when a section has no data-group. Mirrors the v20.1 map.
const TITLE_GROUPS = [
  ['Image Upload', 'import'], ['Auto Layout', 'import'],
  ['Image Editing', 'adjust'], ['Color', 'adjust'], ['Smart Palette', 'adjust'], ['Design Variations', 'adjust'], ['Image Settings', 'adjust'],
  ['Background', 'background'], ['Mockup Scenes', 'background'],
  ['Device', 'frame'], ['3D Mockup', 'frame'], ['Mockup Presets', 'frame'], ['Shadow', 'frame'], ['Reflection', 'frame'], ['3D Tilt', 'frame'], ['Canvas', 'frame'],
  ['Annotations', 'markup'], ['Animation', 'markup'], ['Spotlight', 'markup'], ['Privacy', 'markup'], ['Watermark', 'markup'], ['Liquid Glass', 'markup'], ['Film Grain', 'markup'],
  ['Design Agent', 'ai'], ['AI Tools', 'ai'],
  ['Video', 'export'], ['App Store', 'export'], ['Export Settings', 'export'], ['Share', 'export'],
  ['Projects', 'project'], ['Pages', 'project'], ['Templates', 'project'], ['Brand Kit', 'project'], ['Gallery', 'project']
];

function groupForTitle(title) {
  for (const [needle, group] of TITLE_GROUPS) if (title.includes(needle)) return group;
  return 'import';
}

const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (e) { return {}; }
}
function saveCollapsed(map) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map)); } catch (e) {}
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
    // Hide a panel's own title when it just repeats the group name (wide only).
    if (redundant && titleEl) {
      titleEl.style.display = narrow ? '' : 'none';
      // A title hidden as redundant can't be the collapse control, so keep that
      // section expanded on wide screens (its body must stay visible).
      if (!narrow) el.classList.remove('collapsed');
    }
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

  const labelByGroup = Object.fromEntries(TABS.map(t => [t.id, t.label]));
  const collapsed = loadCollapsed();

  sections = Array.from(sidebar.querySelectorAll('.sidebar-section')).map(el => {
    const titleEl = el.querySelector('.section-title');
    const title = titleEl ? titleEl.textContent : '';
    const group = el.dataset.group || groupForTitle(title);
    el.dataset.group = group;
    const redundant = !!titleEl && norm(title) === norm(labelByGroup[group]);

    // Collapsible: the title row toggles the section body. Persist per section.
    if (titleEl) {
      const key = norm(title) || group;
      if (collapsed[key]) el.classList.add('collapsed');
      titleEl.setAttribute('role', 'button');
      titleEl.setAttribute('tabindex', '0');
      titleEl.setAttribute('aria-expanded', String(!el.classList.contains('collapsed')));
      const toggle = () => {
        const now = el.classList.toggle('collapsed');
        titleEl.setAttribute('aria-expanded', String(!now));
        const map = loadCollapsed();
        if (now) map[key] = true; else delete map[key];
        saveCollapsed(map);
      };
      titleEl.addEventListener('click', toggle);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }
    return { el, group, titleEl, redundant };
  });

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.id = 'panel-header';
  header.innerHTML = '<h2 id="panel-title">Import</h2>';
  sidebar.prepend(header);

  document.querySelectorAll('.rail-btn').forEach(b =>
    b.addEventListener('click', () => setGroup(b.dataset.group)));

  active = (() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'import'; } catch (e) { return 'import'; }
  })();

  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(apply, 150); });

  apply();
}
