# V22 Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn SnapShotPro's existing Cmd-K palette into a context-aware "Command Center" with recents, categories, and shortcut hints, backed by a single shortcut registry that also generates the `?` help overlay.

**Architecture:** Add two small modules — a declarative shortcut registry (`shortcuts.js`) and a localStorage usage store (`command-usage.js`) — then extend the existing `palette.js` (command metadata, context filtering, grouped/recents UI) and refactor `keyboard.js` to dispatch global shortcuts from the registry. The mutable-`state` + `render()` model and the `bind*` startup convention are unchanged.

**Tech Stack:** Vanilla JS + Vite. No framework, no test runner, no linter (per `CLAUDE.md`). Verification is manual in `npm run dev`.

## Global Constraints

- **No test runner / no linter.** Verify every task by running `npm run dev` and exercising the editor in-browser. There is nothing to `npm test`.
- **Feature-module convention:** new files in `src/features/` start with a `// v22 — …` tag comment and export their function(s); any module owning DOM listeners exports a `bind*()` called once from `src/main.js` `init()`.
- **DOM refs are centralized** in `src/ui/elements.js` (`el`, populated by `initElements()`); add new ids there, never `getElementById` ad hoc in features that already use `el`.
- **localStorage keys are namespaced** `snapshotpro_*`; reads are wrapped in try/catch and fall back to empty.
- **No new undoable state.** Do not touch `src/state/history.js` `snapshot()`.
- **Version source of truth** is `package.json` `version`; bump to `22.0.0` only in the release-chores task.
- **Changelog entry must be built with the frontend taste skill** (`taste-skill` / `design-taste-frontend`), applying its design judgment to the existing vanilla-JS `changelog/index.html` — no React/Tailwind/Next.

---

### Task 1: Command-usage store

**Files:**
- Create: `src/features/command-usage.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `recordUse(id: string): void`
  - `getRecent(limit?: number): string[]` — command ids, most-recent first
  - `getFrequencyBoost(id: string): number` — additive ranking boost in `[0, 0.5]`

- [ ] **Step 1: Create the store module**

Create `src/features/command-usage.js`:

```js
// v22 — Command Center: lightweight recents/frequents for the command palette.
// Persisted under snapshotpro_cmd_usage as { [id]: { count, last } }.
const KEY = 'snapshotpro_cmd_usage';
const MAX = 50;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function recordUse(id) {
  if (!id) return;
  const data = read();
  const entry = data[id] || { count: 0, last: 0 };
  entry.count += 1;
  entry.last = Date.now();
  data[id] = entry;
  // Prune to the MAX most-recently-used ids so the store can't grow unbounded.
  const ids = Object.keys(data);
  if (ids.length > MAX) {
    ids.sort((a, b) => data[b].last - data[a].last).slice(MAX).forEach((k) => delete data[k]);
  }
  write(data);
}

export function getRecent(limit = 6) {
  const data = read();
  return Object.keys(data).sort((a, b) => data[b].last - data[a].last).slice(0, limit);
}

export function getFrequencyBoost(id) {
  const data = read();
  const e = data[id];
  if (!e) return 0;
  return Math.min(0.5, e.count * 0.05); // small, capped additive boost
}
```

- [ ] **Step 2: Verify in the browser console**

Run `npm run dev`, open the editor, and in the devtools console:

```js
const m = await import('/src/features/command-usage.js');
m.recordUse('test-a'); m.recordUse('test-a'); m.recordUse('test-b');
m.getRecent(5);            // → ['test-b', 'test-a']
m.getFrequencyBoost('test-a'); // → 0.1
localStorage.removeItem('snapshotpro_cmd_usage'); // clean up
```

Expected: `getRecent` returns `test-b` before `test-a`; boost for `test-a` is `0.1`.

- [ ] **Step 3: Commit**

```bash
git add src/features/command-usage.js
git commit -m "feat(v22): command-usage store (recents/frequents) for the palette"
```

---

### Task 2: Shortcut registry + generated `?` overlay

**Files:**
- Create: `src/features/shortcuts.js`
- Modify: `src/features/keyboard.js` (full rewrite of the keydown dispatch)
- Modify: `src/ui/elements.js` (register `shortcuts-grid` id)
- Modify: `editor/index.html:1139-1148` (static grid → empty container)
- Modify: `src/main.js` (call `renderShortcutsOverlay` at init)
- Modify: `src/styles.css` (overlay group title styling)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `SHORTCUTS: Array<{ id, keys, label, group, match?, displayOnly? }>`
  - `formatKeys(keys: string): string[]`
  - `matchEvent(e: KeyboardEvent): string | null` — returns a shortcut `id`
  - `renderShortcutsOverlay(container: HTMLElement): void`

- [ ] **Step 1: Create the registry module**

Create `src/features/shortcuts.js`:

```js
// v22 — Command Center: single source of truth for global keyboard shortcuts.
// keyboard.js dispatches the non-displayOnly entries via matchEvent(); the "?"
// help overlay is generated from this same list so the two can never drift.

const k = (e) => (e.key || '').toLowerCase();

export const SHORTCUTS = [
  { id: 'palette',  keys: 'mod+k',       label: 'Command palette',               group: 'General',  displayOnly: true },
  { id: 'help',     keys: '?',           label: 'Toggle shortcuts help',          group: 'General',  match: (e) => e.key === '?' },
  { id: 'export',   keys: 'mod+s',       label: 'Export image',                   group: 'File',     match: (e, mod) => mod && k(e) === 's' && !e.shiftKey },
  { id: 'copy',     keys: 'mod+shift+c', label: 'Copy to clipboard',              group: 'File',     match: (e, mod) => mod && e.shiftKey && k(e) === 'c' },
  { id: 'undo',     keys: 'mod+z',       label: 'Undo',                           group: 'Edit',     match: (e, mod) => mod && k(e) === 'z' && !e.shiftKey },
  { id: 'redo',     keys: 'mod+shift+z', label: 'Redo',                           group: 'Edit',     match: (e, mod) => mod && (k(e) === 'y' || (k(e) === 'z' && e.shiftKey)) },
  { id: 'delete',   keys: 'Delete',      label: 'Delete selected',                group: 'Edit',     displayOnly: true },
  { id: 'deselect', keys: 'Escape',      label: 'Deselect / Select tool',         group: 'Edit',     displayOnly: true },
  { id: 'nudge',    keys: 'arrows',      label: 'Nudge selected (Shift = 10px)',  group: 'Edit',     displayOnly: true },
  { id: 'tl-step',  keys: ', / .',       label: 'Timeline: step frame (clip loaded)', group: 'Timeline', displayOnly: true },
  { id: 'tl-inout', keys: '[ / ]',       label: 'Timeline: set in / out point',   group: 'Timeline', displayOnly: true },
];

const GROUP_ORDER = ['General', 'File', 'Edit', 'Timeline'];

// 'mod+shift+c' -> ['Cmd/Ctrl','Shift','C']; 'arrows' -> ['↑ ↓ ← →']; ', / .' -> [', / .'].
export function formatKeys(keys) {
  if (!keys.includes('+')) {
    if (keys === 'arrows') return ['↑ ↓ ← →'];
    return [keys.length === 1 ? keys.toUpperCase() : keys];
  }
  return keys.split('+').map((p) => {
    if (p === 'mod') return 'Cmd/Ctrl';
    if (p === 'shift') return 'Shift';
    return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
  });
}

export function matchEvent(e) {
  const mod = e.ctrlKey || e.metaKey;
  for (const s of SHORTCUTS) {
    if (s.displayOnly || !s.match) continue;
    if (s.match(e, mod)) return s.id;
  }
  return null;
}

export function renderShortcutsOverlay(container) {
  if (!container) return;
  const groups = {};
  for (const s of SHORTCUTS) (groups[s.group] = groups[s.group] || []).push(s);
  const order = [...GROUP_ORDER, ...Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))];
  container.innerHTML = order
    .filter((g) => groups[g])
    .map((g) => `
      <div class="shortcuts-group">
        <h4 class="shortcuts-group-title">${g}</h4>
        ${groups[g].map((s) => `
          <div class="shortcut-item">
            <kbd>${formatKeys(s.keys).join(' + ')}</kbd><span>${s.label}</span>
          </div>`).join('')}
      </div>`).join('');
}
```

- [ ] **Step 2: Register the `shortcuts-grid` DOM id**

In `src/ui/elements.js`, the id list around line 12 currently has:

```js
  'shortcuts-btn', 'shortcuts-overlay', 'close-shortcuts-btn', 'annotation-toolbar',
```

Change to add `'shortcuts-grid'`:

```js
  'shortcuts-btn', 'shortcuts-overlay', 'shortcuts-grid', 'close-shortcuts-btn', 'annotation-toolbar',
```

- [ ] **Step 3: Replace the static overlay grid with an empty container**

In `editor/index.html`, replace lines 1139-1148 (the `<div class="shortcuts-grid">…</div>` block with its 8 hardcoded `.shortcut-item` rows) with:

```html
        <div class="shortcuts-grid" id="shortcuts-grid"></div>
```

- [ ] **Step 4: Generate the overlay at init**

In `src/main.js`, add the import alongside the palette/keyboard imports (near line 62-63):

```js
import { renderShortcutsOverlay } from './features/shortcuts.js';
```

Then in `init()`, add the generate call right after `bindPalette();` and before `bindKeyboard();` (around line 146-148):

```js
  registerCommands();
  bindPalette();
  renderShortcutsOverlay(el.shortcutsGrid);
  bindKeyboard();
```

- [ ] **Step 5: Rewrite the keydown dispatch in `keyboard.js`**

Replace the entire body of `src/features/keyboard.js` with:

```js
import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { undo, redo } from '../state/history.js';
import { render } from '../render/render.js';
import { exportImage, copyToClipboard } from './export.js';
import { openPalette, closePalette } from './palette.js';
import { closeStickerDrawer } from './stickers.js';
import { setTool, deleteSelected, nudgeSelected } from './canvas-tools.js';
import { isTypingTarget } from '../utils/dom.js';
import { timelineActive, timelineStepFrame, timelineSetIn, timelineSetOut } from './timeline.js';
import { matchEvent } from './shortcuts.js';

function showShortcuts(show) {
  if (!el.shortcutsOverlay) return;
  el.shortcutsOverlay.style.display = show ? 'flex' : 'none';
}

export function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const cmd = e.ctrlKey || e.metaKey;

    // Cmd/Ctrl+K toggles the palette and must work even while it's open.
    if (cmd && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.ui.paletteOpen) closePalette(); else openPalette();
      return;
    }
    if (state.ui.paletteOpen) return;

    if (e.key === 'Escape') {
      if (el.shortcutsOverlay && el.shortcutsOverlay.style.display === 'flex') { showShortcuts(false); return; }
      if (state.ui.stickerDrawerOpen) { closeStickerDrawer(); return; }
      if (state.tool !== 'select') { setTool('select'); state.selectedAnnotation = null; state.selectedRedaction = null; state.selectedExtraImage = null; render(); return; }
      state.selectedAnnotation = null;
      state.selectedRedaction = null;
      state.selectedExtraImage = null;
      render();
      return;
    }

    if (isTypingTarget(e.target)) return;

    // Declarative global shortcuts — single source of truth is shortcuts.js.
    const sc = matchEvent(e);
    if (sc) {
      e.preventDefault();
      switch (sc) {
        case 'undo':   undo(render); return;
        case 'redo':   redo(render); return;
        case 'export': exportImage(); return;
        case 'copy':   copyToClipboard(); return;
        case 'help':   showShortcuts(el.shortcutsOverlay.style.display !== 'flex'); return;
      }
    }

    // Bespoke, context-sensitive handlers (listed in shortcuts.js as displayOnly).
    if (!cmd) {
      // v15.1 — frame-accurate timeline control when a clip is loaded.
      if (timelineActive()) {
        if (e.key === ',') { e.preventDefault(); timelineStepFrame(-1); return; }
        if (e.key === '.') { e.preventDefault(); timelineStepFrame(1); return; }
        if (e.key === '[') { e.preventDefault(); timelineSetIn(); return; }
        if (e.key === ']') { e.preventDefault(); timelineSetOut(); return; }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Nudge the selected element: 1px, or 10px with Shift. One history entry
        // per key press (e.repeat skips the save while a key is held).
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (nudgeSelected(dx, dy, !e.repeat)) e.preventDefault();
        return;
      }
    }
  });

  if (el.shortcutsBtn) el.shortcutsBtn.addEventListener('click', () => showShortcuts(true));
  if (el.closeShortcutsBtn) el.closeShortcutsBtn.addEventListener('click', () => showShortcuts(false));
  if (el.shortcutsOverlay) el.shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === el.shortcutsOverlay) showShortcuts(false);
  });
}
```

- [ ] **Step 6: Add overlay group-title CSS**

In `src/styles.css`, after the `.shortcut-item span` rule (line 511), add:

```css
.shortcuts-group { display: flex; flex-direction: column; gap: 10px; }
.shortcuts-group-title {
    margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--text-tertiary);
}
```

- [ ] **Step 7: Verify in the browser**

Run `npm run dev`. Then:
1. Press `?` (with nothing focused) → the shortcuts overlay opens, now showing grouped sections **General / File / Edit / Timeline**, and includes the **Nudge selected** and **Timeline: step frame / set in-out** rows that the old static list was missing. Press `?` or Escape to close.
2. `Cmd/Ctrl+S` exports, `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+Shift+Z` / `Cmd/Ctrl+Y` redoes, `Cmd/Ctrl+Shift+C` copies — all unchanged.
3. `Cmd/Ctrl+K` still opens/closes the palette; arrow-nudge and delete on a selected annotation still work.

Expected: overlay content is generated (no hardcoded rows in `index.html`), all shortcuts behave as before.

- [ ] **Step 8: Commit**

```bash
git add src/features/shortcuts.js src/features/keyboard.js src/ui/elements.js editor/index.html src/main.js src/styles.css
git commit -m "feat(v22): shortcut registry as single source of truth; generated ? overlay"
```

---

### Task 3: Palette command metadata + context filtering + hint chips

**Files:**
- Modify: `src/features/palette.js` (imports, `registerCommands`, `renderPaletteResults`, row template)
- Modify: `src/styles.css` (hint-chip / group-tag styling)

**Interfaces:**
- Consumes: `formatKeys` from `shortcuts.js` (Task 2); `getFrequencyBoost` from `command-usage.js` (Task 1).
- Produces: every command in `commands` now carries `group: string`, optionally `keys: string`, optionally `when: () => boolean`. Helpers `applicable(c)`, `rowHtml(c, i, active)`, `bindResultRows()` for Task 4.

- [ ] **Step 1: Add imports**

At the top of `src/features/palette.js`, after the existing imports, add:

```js
import { formatKeys } from './shortcuts.js';
import { getFrequencyBoost } from './command-usage.js';
```

- [ ] **Step 2: Add the grouping helper and group order (module scope)**

In `src/features/palette.js`, just before `export function registerCommands()` (line 42), add:

```js
const GROUP_ORDER = ['File', 'Edit', 'View', 'Tools', 'AI', 'Motion', 'Stickers', 'More'];

function groupFor(id) {
  if (id.startsWith('sticker-')) return 'Stickers';
  if (id.startsWith('ai-')) return 'AI';
  if (id.startsWith('tool-') || id.startsWith('clear-')) return 'Tools';
  if (id.startsWith('video') || id.startsWith('anim') || id === 'export-gif' ||
      id === 'screen-record' || id === 'auto-zoom-toggle') return 'Motion';
  if (id.startsWith('export') || id === 'copy-clipboard' || id === 'load-url' ||
      id.startsWith('share') || id === 'generate-qr' || id.startsWith('mode-')) return 'File';
  if (id === 'undo' || id === 'redo') return 'Edit';
  if (id.startsWith('bg-') || id.startsWith('mesh-') || id.startsWith('scene-') ||
      id.startsWith('tilt-') || id === 'reset-tilt' || id.startsWith('style-') ||
      id === 'toggle-layers' || id.startsWith('zoom') || id.startsWith('theme') ||
      id === 'toggle-spotlight') return 'View';
  return 'More';
}
```

- [ ] **Step 3: Attach metadata at the end of `registerCommands`**

In `registerCommands()`, immediately after the sticker-push `forEach` block (the loop ending around line 123, before the closing `}` of the function), add:

```js
  // v22 — Command Center metadata: category, optional shortcut hint, and an
  // optional context predicate ('when'), applied in one pass so the command
  // definitions above stay readable.
  const WHEN = {
    'video-play':        () => state.video.loaded,
    'video-mp4':         () => state.video.loaded,
    'video-gif':         () => state.video.loaded,
    'anim-play':         () => state.animation.enabled,
    'export-set':        () => state.mode === 'set',
    'export-batch':      () => state.mode === 'batch',
    'clear-annotations': () => state.annotations.length > 0,
    'clear-redactions':  () => state.redactions.length > 0,
  };
  const KEYS = {
    'export-png':     'mod+s',
    'copy-clipboard': 'mod+shift+c',
    'undo':           'mod+z',
    'redo':           'mod+shift+z',
  };
  commands.forEach((c) => {
    c.group = groupFor(c.id);
    if (WHEN[c.id]) c.when = WHEN[c.id];
    if (KEYS[c.id]) c.keys = KEYS[c.id];
  });
```

- [ ] **Step 4: Add `applicable`, `rowHtml`, and `bindResultRows` helpers**

In `src/features/palette.js`, just above the existing `function renderPaletteResults()` (line 141), add:

```js
function applicable(c) {
  if (!c.when) return true;
  try { return !!c.when(); } catch { return false; }
}

function rowHtml(c, i, active) {
  const right = c.keys
    ? `<span class="palette-keys">${formatKeys(c.keys).map((x) => `<kbd>${x}</kbd>`).join('')}</span>`
    : `<span class="palette-group">${c.group}</span>`;
  return `<div class="palette-item${active ? ' active' : ''}" data-i="${i}">
    <span class="palette-icon">${c.icon}</span><span class="palette-label">${c.label}</span>${right}
  </div>`;
}

function bindResultRows() {
  el.paletteResults.querySelectorAll('.palette-item').forEach((item) => {
    item.addEventListener('click', () => runPaletteIndex(parseInt(item.dataset.i, 10)));
    item.addEventListener('mouseenter', () => {
      activeIdx = parseInt(item.dataset.i, 10);
      el.paletteResults.querySelectorAll('.palette-item').forEach((x, j) => x.classList.toggle('active', j === activeIdx));
    });
  });
}
```

- [ ] **Step 5: Replace `renderPaletteResults` with the filtered version**

Replace the entire existing `function renderPaletteResults() { … }` (lines 141-167) with:

```js
function renderPaletteResults() {
  const q = el.paletteInput.value.trim();
  const pool = commands.filter(applicable);
  lastResults = pool
    .map((c) => { const m = fuzzyMatch(q, c.label); return { c, s: m > 0 ? m + getFrequencyBoost(c.id) : 0 }; })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .slice(0, 40);

  if (lastResults.length === 0) {
    el.paletteResults.innerHTML = '<div class="palette-empty">No matching commands</div>';
    return;
  }
  activeIdx = Math.min(activeIdx, lastResults.length - 1);
  el.paletteResults.innerHTML = lastResults.map((c, i) => rowHtml(c, i, i === activeIdx)).join('');
  bindResultRows();
}
```

- [ ] **Step 6: Add hint-chip / group-tag CSS**

In `src/styles.css`, after the `.palette-item .palette-icon` rule (line 721), add:

```css
.palette-item .palette-label { flex: 1; }
.palette-item .palette-keys { margin-left: auto; display: flex; gap: 4px; flex: 0 0 auto; }
.palette-item .palette-keys kbd {
    font-family: var(--font-mono); font-size: 10px; padding: 1px 5px;
    border-radius: 4px; background: var(--bg-tertiary); color: var(--text-secondary);
    border: 1px solid var(--border);
}
.palette-item .palette-group {
    margin-left: auto; flex: 0 0 auto; font-size: 10px; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 0.04em;
}
```

- [ ] **Step 7: Verify in the browser**

Run `npm run dev`, then `Cmd/Ctrl+K`:
1. Type `export` → `Export as PNG` shows a `Cmd/Ctrl + S` chip; other rows show a muted group tag (e.g. `File`).
2. With no video clip loaded, type `video` → the three Video commands do **not** appear. (Load a video via the editor, reopen palette, type `video` → they now appear.)
3. In Single mode, type `set` → `Export App Store set` is absent; switch to App Store Set mode → it appears.
4. Type `redact` before adding any redaction → `Clear all redactions` is absent.

Expected: inapplicable commands are filtered out; shortcut chips and group tags render.

- [ ] **Step 8: Commit**

```bash
git add src/features/palette.js src/styles.css
git commit -m "feat(v22): palette command metadata, context filtering, shortcut-hint chips"
```

---

### Task 4: Recents + grouped empty-state + usage recording

**Files:**
- Modify: `src/features/palette.js` (`renderPaletteResults` empty-query branch, `runPaletteIndex`, imports)
- Modify: `src/styles.css` (section-header styling)

**Interfaces:**
- Consumes: `getRecent`, `recordUse` from `command-usage.js` (Task 1); `applicable`, `rowHtml`, `bindResultRows`, `GROUP_ORDER` from Task 3.
- Produces: final palette behavior. No new exports.

- [ ] **Step 1: Extend the command-usage import**

In `src/features/palette.js`, change the Task 3 import line:

```js
import { getFrequencyBoost } from './command-usage.js';
```

to:

```js
import { getFrequencyBoost, getRecent, recordUse } from './command-usage.js';
```

- [ ] **Step 2: Add the grouped empty-query branch to `renderPaletteResults`**

In `renderPaletteResults()` (from Task 3), insert this block immediately after `const pool = commands.filter(applicable);` and before the existing `lastResults = pool` ranking line:

```js
  if (!q) {
    // Empty query → a "Recent" section, then categories in fixed order.
    const byId = Object.fromEntries(pool.map((c) => [c.id, c]));
    const recent = getRecent(6).map((id) => byId[id]).filter(Boolean);
    const recentIds = new Set(recent.map((c) => c.id));

    const sections = [];
    if (recent.length) sections.push({ title: 'Recent', items: recent });
    for (const g of GROUP_ORDER) {
      const items = pool.filter((c) => c.group === g && !recentIds.has(c.id));
      if (items.length) sections.push({ title: g, items });
    }

    lastResults = [];
    let html = '';
    for (const sec of sections) {
      html += `<div class="palette-section-header">${sec.title}</div>`;
      for (const c of sec.items) {
        const i = lastResults.length;
        lastResults.push(c);
        html += rowHtml(c, i, i === activeIdx);
      }
    }
    activeIdx = Math.min(activeIdx, Math.max(0, lastResults.length - 1));
    el.paletteResults.innerHTML = html;
    bindResultRows();
    return;
  }
```

- [ ] **Step 3: Record usage when a command runs**

In `src/features/palette.js`, update `runPaletteIndex` to record usage before running:

```js
function runPaletteIndex(i) {
  const cmd = lastResults[i];
  if (!cmd) return;
  recordUse(cmd.id);
  closePalette();
  try { cmd.run(); } catch (e) { console.error(e); }
}
```

- [ ] **Step 4: Add section-header CSS**

In `src/styles.css`, after the `.palette-empty` rule (line 722), add:

```css
.palette-section-header {
    padding: 8px 14px 4px; font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary);
}
```

- [ ] **Step 5: Verify in the browser**

Run `npm run dev`, then `Cmd/Ctrl+K`:
1. With an empty input the palette now shows **section headers** — categories (File, Edit, View, …) in order. Arrow-Down / Arrow-Up still moves only between command rows (headers are skipped), Enter runs the highlighted command.
2. Run a few commands (e.g. "Zoom in", "Theme: Dark"). Reopen the palette empty → a **Recent** section appears at the top listing those, and they're de-duplicated from their categories.
3. Reload the page, reopen empty palette → Recent persists.
4. Type a query → reverts to the flat ranked list from Task 3 (no headers); a frequently-run command ranks slightly higher among equal fuzzy matches.

Expected: grouped empty state with a working Recent section; keyboard nav and click both run and record usage.

- [ ] **Step 6: Commit**

```bash
git add src/features/palette.js src/styles.css
git commit -m "feat(v22): palette recents + grouped categories + usage recording"
```

---

### Task 5: Release chores — version, what's-new, changelog

**Files:**
- Modify: `package.json` (`version`)
- Modify: `src/features/whats-new.js` (v22 toast entry)
- Modify: `changelog/index.html` (v22 spotlight — built with the frontend taste skill)

**Interfaces:**
- Consumes: nothing.
- Produces: the user-facing release surface for v22.

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "21.0.0"` to `"version": "22.0.0"`.

- [ ] **Step 2: Add the what's-new entry**

Open `src/features/whats-new.js`, locate the data structure that holds per-version entries (the array/object the returning-user toast reads, keyed by version). Following the exact shape already used for the v21 entry, add a `22.0.0` entry whose copy describes the Command Center: a context-aware Cmd-K palette with recents, categories, and inline keyboard-shortcut hints, plus a shortcuts help overlay that's always in sync. Match the surrounding entries' field names and tone; do not invent new fields.

- [ ] **Step 3: Build the v22 changelog spotlight with the frontend taste skill**

This step is design work — **invoke the frontend taste skill** (`taste-skill` / `design-taste-frontend`) and apply its judgment to `changelog/index.html`. Constraints:
- The editor/site is **vanilla JS, no framework** — apply the skill's layout/type/motion/motif judgment to the existing changelog HTML/CSS. Do **not** introduce React/Tailwind/Next.
- Add a `v22 · <Month Year>` entry at the top of the changelog, consistent with the existing per-release spotlight cards (each prior release has "its own motif" — e.g. v21's 3D device, v20's chat thread). Give v22 a **command-line / palette motif** (e.g. a stylized command bar resolving a query into results, or a key-cap row).
- Keep the existing v16 frosted-glass card framing and the running motif stack referenced in earlier entries; this is an addition, not a redesign of older cards.

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`:
1. Editor footer shows `v22.0.0` (sourced from `package.json`).
2. Trigger the what's-new toast (or call `window.__openWhatsNew()` from the console) → the v22 Command Center entry renders correctly.
3. Open `/changelog/` → the v22 spotlight card renders at the top with its palette motif and no layout regressions on older cards.

Run a production build to confirm nothing broke:

```bash
npm run build
```

Expected: build completes without errors; `dist/` is produced.

- [ ] **Step 5: Commit**

```bash
git add package.json src/features/whats-new.js changelog/index.html
git commit -m "chore(v22): bump to 22.0.0, what's-new toast, changelog spotlight"
```

---

## Self-Review Notes

- **Spec coverage:** Unit 1 (shortcut registry) → Task 2. Unit 2 (command metadata) → Task 3. Unit 3 (context filtering) → Task 3. Unit 4 (recents/frequents) → Tasks 1 + 4. Unit 5 (palette UI polish: headers/tags/chips) → Tasks 3 + 4. Release chores incl. taste-skill changelog → Task 5. All spec sections mapped.
- **Type consistency:** `recordUse` / `getRecent` / `getFrequencyBoost` (Task 1) used identically in Task 4; `matchEvent` returns a shortcut **id string** consumed by the `switch` in `keyboard.js`; `formatKeys` returns `string[]` consumed by both the overlay and the row chips; `GROUP_ORDER` / `groupFor` / `applicable` / `rowHtml` / `bindResultRows` defined in Tasks 2-3 and reused in Task 4.
- **Verification model:** no test runner exists (per `CLAUDE.md`), so each task ends with concrete in-browser checks plus a `npm run build` smoke test in the final task.
