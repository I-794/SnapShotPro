# Studio Sidebar Tidy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Tidy the editor sidebar: remove all version badges, make sections collapsible (default expanded, remembered), and group sections via an explicit `data-group` attribute with a rebalanced map. No feature/behavior/state changes; a light "more organized" user notice ships with it.

**Architecture:** Sections stay where they are in the markup; each gets an explicit `data-group`. `studio-nav.js` reads `data-group` (instead of fragile title-substring matching) and gains a collapse toggle on each `.section-title` that persists per-section to localStorage. Collapsing is pure CSS (`.sidebar-section.collapsed > *:not(.section-title){display:none}`), so no body-wrapper markup is needed. Element ids are untouched, so every `bind*` keeps working.

**Tech Stack:** Vanilla JS + Vite, NO test runner. Verify with `npm run build` + manual in `npm run dev` (server already running). Files: `editor/index.html`, `src/features/studio-nav.js`, `src/styles.css`, plus a light release notice (`package.json`, `src/features/whats-new.js`, `changelog/index.html`).

> Spec: `docs/superpowers/specs/2026-06-15-studio-sidebar-tidy-design.md`. No test runner — verification is build + manual checks.

---

## File Structure
- **`editor/index.html`** — remove 16 version-badge spans; add `data-group` to each `.sidebar-section`.
- **`src/features/studio-nav.js`** — read `data-group`; add collapse toggle + persistence; refresh fallback map.
- **`src/styles.css`** — collapsible header (chevron), `.collapsed` rule, calmer spacing.
- **Release notice** — `package.json` 20.1.0, `whats-new.js`, editor header v20.1, one changelog line.

---

## Task 1: HTML — remove badges + add explicit `data-group`

**Files:**
- Modify: `editor/index.html`

- [ ] **Step 1: Remove every version badge**

Read `editor/index.html`. Remove every version-badge `<span>` that sits inside a `<h3 class="section-title">` OR inside a feature sub-`<label>`. They match these patterns (delete the whole `<span>...</span>`, leaving the surrounding title/label text intact):
- `<span style="font-size:11px;color:var(--text-secondary);font-weight:400;">vNN</span>` (the common title badge, ~13 of them: v18, v9, v20, v7, v17, v9, v14, v16, v16, v12, v13, v11)
- `<span style="font-size:11px;color:var(--text-secondary);font-weight:400;">v19</span>` and `<span style="font-size:11px;color:var(--text-secondary);font-weight:400;">v14</span>` sub-labels (AI Assets, Text Effects)
- `<span style="font-size:10px;color:var(--text-secondary);">v9 · gpt-image-2</span>` (Generative AI sub-label — remove the whole span)
- `<span style="font-weight:400;color:var(--text-secondary);">v11</span>` (Live collaboration sub-label)

After removal, grep the file: `grep -n 'v[0-9]\{1,2\}<\|>v[0-9]' editor/index.html` should return no version-badge spans in the sidebar (the header app-version `v20.0`/`v20.1` is separate and stays). Trim any now-trailing whitespace inside the titles/labels.

- [ ] **Step 2: Add `data-group` to every `.sidebar-section`**

For each `<div class="sidebar-section">`, add a `data-group="<group>"` attribute, using its `<h3 class="section-title">` text to look up the group in this map:

| Section title contains | data-group |
|---|---|
| Image Upload | import |
| Auto Layout | import |
| Image Editing | adjust |
| Color | adjust |
| Smart Palette | adjust |
| Design Variations | adjust |
| Image Settings | adjust |
| Background | background |
| Mockup Scenes | background |
| Device & Window Frame | frame |
| Mockup Presets | frame |
| Shadow Settings | frame |
| Reflection | frame |
| 3D Tilt | frame |
| Canvas Settings | frame |
| Text & Annotations | markup |
| Animation | markup |
| Spotlight Effect | markup |
| Privacy Tools | markup |
| Watermark | markup |
| Liquid Glass | markup |
| Film Grain | markup |
| Design Agent | ai |
| AI Tools | ai |
| Video / Clip | export |
| App Store Sets | export |
| Export Settings | export |
| Share | export |
| Projects | project |
| Pages & Deck | project |
| Templates | project |
| Brand Kit | project |
| Community Gallery | project |

Example: `<div class="sidebar-section" data-group="markup">` for the Liquid Glass section. If a section's title isn't in this table, leave it without `data-group` (the JS fallback handles it) and note it in the report.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built`. `dist/editor/index.html` has the `data-group` attributes and no version-badge spans in the sidebar.

- [ ] **Step 4: Commit**

```bash
git add editor/index.html
git commit -m "tidy(sidebar): remove version badges, add explicit data-group to sections"
```

---

## Task 2: studio-nav.js — explicit grouping + collapsible sections

**Files:**
- Modify: `src/features/studio-nav.js` (replace the whole file)

- [ ] **Step 1: Replace the file contents with:**

```javascript
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
  ['Device', 'frame'], ['Mockup Presets', 'frame'], ['Shadow', 'frame'], ['Reflection', 'frame'], ['3D Tilt', 'frame'], ['Canvas', 'frame'],
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
```

- [ ] **Step 2: Verify build** — `npm run build` → `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/features/studio-nav.js
git commit -m "tidy(sidebar): read data-group, add collapsible sections with persistence"
```

---

## Task 3: CSS — collapsible header + chevron + spacing

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append at the end of `src/styles.css`:**

```css
/* v20.1 — collapsible sidebar sections. The .section-title row is the toggle;
   the body is everything else in the section, hidden when .collapsed. */
.section-title { cursor: pointer; user-select: none; }
.section-title::after {
  content: ''; width: 7px; height: 7px; margin-left: auto; flex-shrink: 0;
  border-right: 2px solid var(--text-secondary);
  border-bottom: 2px solid var(--text-secondary);
  transform: rotate(45deg); transition: transform .2s ease; opacity: 0.75;
}
.section-title:hover::after { opacity: 1; }
.sidebar-section.collapsed .section-title { margin-bottom: 0; }
.sidebar-section.collapsed .section-title::after { transform: rotate(-45deg); }
.sidebar-section.collapsed > *:not(.section-title) { display: none; }
@media (prefers-reduced-motion: reduce) { .section-title::after { transition: none; } }
```

- [ ] **Step 2: Verify build** — `npm run build` → `✓ built`. (The `.section-title` is already `display:flex; align-items:center;` with a `::before` accent dot, so the chevron sits at the right via `margin-left:auto`.)

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "tidy(sidebar): collapsible header chevron + collapse rule"
```

---

## Task 4: Light user-facing notice (version + what's-new + changelog line)

**Files:**
- Modify: `package.json:4`, `editor/index.html`, `src/features/whats-new.js`, `changelog/index.html`

- [ ] **Step 1: Version bump** — in `package.json`, `"version": "20.0.0",` → `"version": "20.1.0",`.

- [ ] **Step 2: Editor header** — in `editor/index.html`, change `v20.0` → `v20.1` in the `<title>` (line ~8) and the header `<span>` (line ~32).

- [ ] **Step 3: What's-new toast** — in `src/features/whats-new.js`, set `const CURRENT_VERSION = '20.1';` and replace `WHATS_NEW` with:

```javascript
const WHATS_NEW = {
  heading: "A tidier studio",
  items: [
    { title: 'Cleaner, more organized sidebar',
      desc: 'Every panel now lives in the right tab, sections collapse so you only see what you need, and the version tags are gone.' }
  ]
};
```

- [ ] **Step 4: Changelog line** — in `changelog/index.html`, demote the current `<li class="entry latest reveal">` (v20.0) to `<li class="entry reveal">`, and add ABOVE it (leave the v20 spotlight untouched):

```html
            <li class="entry latest reveal">
                <div class="entry-meta"><span class="ver">v20.1</span><span class="entry-date">June 2026</span></div>
                <div>
                    <h2>A tidier studio</h2>
                    <ul class="changes">
                        <li><b>Cleaner sidebar.</b> Every panel now sits in the right tab, sections collapse so you only see what you need, and the version tags next to feature names are gone. Nothing moved that you rely on, it is just easier to scan.</li>
                    </ul>
                </div>
            </li>
```

- [ ] **Step 5: Verify build** — `npm run build` → `✓ built`, header shows `snapshot-pro@20.1.0`. Scan the new changelog line for em/en dashes (none).

- [ ] **Step 6: Commit**

```bash
git add package.json editor/index.html src/features/whats-new.js changelog/index.html
git commit -m "tidy(sidebar): 20.1.0 + a tidier-studio notice (whats-new + changelog)"
```

---

## Task 5: Verify

- [ ] **Step 1: Full build** — `npm run build` → `✓ built`.

- [ ] **Step 2: Manual (`npm run dev`)**:
  - No version badges anywhere in the sidebar.
  - Each rail tab shows exactly its mapped sections; Liquid Glass / Film Grain under Markup, Brand Kit under Project, AI tab = Design Agent + AI Tools only.
  - Click a section title → it collapses (chevron flips), click again → expands; state survives a reload and tab switches.
  - First load with cleared `snapshotpro_section_collapsed` → all expanded.
  - Spot-check a moved section's controls still work (e.g. Film Grain toggle, Brand Kit save) — ids unchanged.
  - Narrow window (≤860px): single scroll, collapsing still works.
  - Returning-user what's-new toast shows the "A tidier studio" card once.

- [ ] **Step 3: Final commit (if cleanup)** — `git add -A && git commit -m "tidy(sidebar): verification pass"`.

---

## Self-Review (by plan author)
- **Spec coverage:** badges removed (T1), explicit data-group + rebalance (T1 map + T2 reader), collapsible default-expanded + persistence (T2 + T3), tidy visuals (T3), robust grouping replacing substring matching (T2), light notice 20.1.0 + whats-new + changelog (T4), verification incl. ids-unchanged spot-checks (T5). All spec sections mapped.
- **Placeholders:** none — full file given for studio-nav.js, exact CSS, exact map, exact release snippets.
- **Consistency:** group ids (`import/adjust/background/frame/markup/ai/export/project`) match the rail `data-group`s and `TABS`; collapse key `snapshotpro_section_collapsed`; per-section key = normalized title; `.collapsed` class used identically in JS (toggle) and CSS (rule). Redundant-title sections force-expanded on wide screens so a hidden title never traps a collapsed body.
- **Risk note:** Task 1 is a wide mechanical edit; ids and control markup are preserved (only badge spans removed + `data-group` added), so feature wiring is unaffected.
