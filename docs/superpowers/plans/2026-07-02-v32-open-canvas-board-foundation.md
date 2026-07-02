# v32 Open Canvas — Board Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infinite Board surface over the existing `pages.js` engine, so every page becomes a freely-arrangeable card on a pan/zoom canvas, openable in the unchanged editor and restorable across save/reload.

**Architecture:** A board card **is a page**. `pages.js` already holds id-keyed pages (`{id, payload, thumb}`), with `switchTo`/`addPage`/`deletePage`/`makeThumb`/`renderAllPages`-style offscreen render. The board adds a document-level `state.board = {objects, camera}` plus a `state.mode === 'board'` branch in `render.js` (one branch, mirroring the existing `'set'` branch). The board surface is a DOM layer (pan/zoom container + absolutely-positioned cards + an SVG overlay for connectors); per-card scene pixels come from the existing `page.thumb`. `renderInto` and the four composition paths are untouched.

**Tech Stack:** Vanilla JS + Vite. No framework, no test runner. New files: `src/features/board.js`, `src/features/board-tools.js`. Modified: `src/state/state.js`, `src/render/render.js`, `src/features/pages.js`, `src/features/palette.js`, `src/styles.css`, `src/main.js`.

**Staging note:** This plan covers only the **Board foundation** (spec §3, §6). Seed (URL→set), Control (conversational agent tools), and the taste-skill marketing/changelog pages are **follow-on plans**, written when we reach them. Each produces working software on its own.

## Global Constraints

- **No test runner, no linter.** Verify every task by running `npm run dev` (dev server already running at http://localhost:5173/, editor at `/editor/`) and exercising the feature in-browser. Each task's final step gives exact actions + expected result. This overrides the writing-plans TDD default (per CLAUDE.md).
- **Use Opus for all work, including subagents.** Never fall back to Sonnet/Haiku (CLAUDE.md).
- **Windows/PowerShell host, bash shell.** Use forward slashes in paths; no heredoc for commit messages (use a single `-m` or a temp file). Commit messages end with the Co-Authored-By line.
- **Commit per task** (frequent commits). Do not commit `dist/`.
- **Do not touch** `renderInto`, the four composition paths in `render.js`, `selection.js` (scene), `history.snapshot()` membership, or `serialize.js`'s `SCHEMA_VERSION`. The board is document-level; it bumps `DOC_VERSION` only (Task 9).
- **`state.board` and `state.boardSelection` are NOT added to `history.snapshot()`.** Board spatial edits are document ops (like `addPage`), not undoable in v1.
- **Feature-module convention:** new files in `src/features/` start with a version-tag comment (e.g. `// v32 — Open Canvas board surface.`) and export a `bind<Feature>()` called once in `main.js`.
- **No emojis in code/markup** beyond what already exists; the upload icon etc. are pre-existing.

---

## File Structure

**Create:**
- `src/features/board.js` — `bindBoard()`, `renderBoard()`, `enterBoardMode()`/`exitBoardMode()`, camera, card rendering, selection, interaction, export. Owns the board DOM surface (created in JS, mounted into `#canvas-viewport`).
- `src/features/board-tools.js` — `hitTopBoardRef(screenX, screenY)`, `resolveBoardRef(ref)`, `screenToBoard/screenToBoard` coord helpers, marquee + snap helpers. Board-space analog of `canvas-tools.js` + `selection.js`.

**Modify:**
- `src/state/state.js` — add `state.board`, `state.boardSelection`; extend the `mode` comment to include `'board'`.
- `src/render/render.js` — add the `state.mode === 'board'` branch (one early-return) + import `renderBoard`.
- `src/features/pages.js` — export `getPageMeta()`, `indexOfPage(id)` accessors; bump `DOC_VERSION` 13→14 (Task 9) + `serializeDocument`/`applyDocument` board key + `migrateBoardV14`.
- `src/features/palette.js` — add `toggleBoard` / `enterBoard` command(s) in `registerCommands()`.
- `src/styles.css` — `.board-surface`, `.board-card`, `.board-card.selected`, handles, connector SVG, board toolbar styles.
- `src/main.js` — import + call `bindBoard()` (near `bindPages()`).

---

## Task 1: Board state, mode branch, DOM mount, and toggle

**Files:**
- Modify: `src/state/state.js` (after the `mergeStudio` block, ~line 176)
- Modify: `src/render/render.js` (the `render()` function, ~line 34)
- Create: `src/features/board.js`
- Modify: `src/main.js` (imports + `bindBoard()` call near `bindPages()`)
- Modify: `src/features/palette.js` (`registerCommands()`)
- Modify: `src/styles.css` (append a board styles block)

**Interfaces:**
- Produces: `bindBoard()` (called once in `main.js`), `renderBoard()` (called from `render.js` when `state.mode === 'board'`), `enterBoardMode()`, `exitBoardMode()`, `toggleBoardMode()`.
- Consumes: `state.board`, `state.mode`, `el.canvasViewport`, `el.canvasWrapper`.

- [ ] **Step 1: Add board state to `state.js`**

In `src/state/state.js`, after the `mergeStudio: { columns: [], rows: [] },` block (around line 176), add:

```js
  // v32 — Open Canvas: the infinite board. Document-level (one layout for the
  // whole document, sibling to pages/active). NOT snapshotted: board spatial
  // edits are document ops like addPage/deletePage, not per-design undo. A
  // `card` object refs a pages[i].id; the scene payload still lives in
  // pages[i].payload (unchanged). `camera` is runtime-only pan/zoom.
  board: {
    objects: [],   // { id, kind:'card'|'text'|'arrow'|'group', x, y, w, h, z, ... }
    camera: { x: 0, y: 0, zoom: 1 }
  },
  boardSelection: [],   // runtime-only array of { kind:'boardObject', id }
```

Also update the `mode:` comment (around line 184) to include `'board'`:

```js
  // mode: 'single' | 'set' | 'batch' | 'tour' | 'board' (v32 — Open Canvas:
  // pages laid out as cards on a pan/zoom surface). 'board' is a view mode; the
  // board layout is document-level (state.board), not serialized per-design.
  mode: 'single',
```

- [ ] **Step 2: Add the board render branch to `render.js`**

In `src/render/render.js`, add the import near the other feature imports (after the `renderSetPreview` import, line 22):

```js
import { renderBoard } from '../features/board.js';
```

In the `render(forExport)` function, immediately after the `'set'` early-return block (after line 41, before `renderInto(el.previewCanvas, forExport);`), add:

```js
  // v32 — Board mode owns the preview: it lays out page cards on a pan/zoom
  // surface instead of rendering one scene. Routed before the no-image guard so
  // the board (and its empty state) previews even with no image loaded.
  if (!forExport && state.mode === 'board') {
    renderBoard();
    return;
  }
```

- [ ] **Step 3: Create `board.js` with mount + stub render + toggle**

Create `src/features/board.js`:

```js
// v32 — Open Canvas board surface.
//
// An infinite canvas laid over the pages.js engine: every page is a card you
// can arrange, connect, and group. The board is a DOM layer (a camera-
// transformed surface + absolutely-positioned cards + an SVG overlay) mounted
// inside #canvas-viewport; per-card scene pixels come from the existing
// page.thumb. renderInto and the four composition paths are untouched — board
// mode is one branch in render(), like 'set' mode.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { pageCount } from './pages.js';

let surface = null;     // .board-surface (camera-transformed)
let viewport = null;    // #canvas-viewport
let toolbar = null;     // .board-toolbar

export function enterBoardMode() {
  state.mode = 'board';
  ensureSurface();
  showBoardChrome(true);
  // Hide the single-canvas wrapper + upload zone while on the board.
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  const uz = document.getElementById('upload-zone');
  if (uz) uz.style.display = 'none';
  renderBoard();
}

export function exitBoardMode() {
  state.mode = 'single';
  showBoardChrome(false);
  if (el.canvasWrapper) el.canvasWrapper.style.display = '';
  renderBoard();   // no-op when not in board mode; re-render single below
  // Re-render the single-canvas scene.
  import('../render/render.js').then(({ render }) => render());
}

export function toggleBoardMode() {
  if (state.mode === 'board') exitBoardMode();
  else enterBoardMode();
}

function showBoardChrome(on) {
  if (surface) surface.style.display = on ? '' : 'none';
  if (toolbar) toolbar.style.display = on ? '' : 'none';
}

// Build the board DOM once (surface + SVG overlay + toolbar). Mounted inside
// #canvas-viewport as a sibling of #canvas-wrapper.
function ensureSurface() {
  if (surface) return;
  viewport = el.canvasViewport;
  if (!viewport) return;

  toolbar = document.createElement('div');
  toolbar.className = 'board-toolbar';
  toolbar.innerHTML = `
    <button class="board-back" title="Back to editor (Esc)">← Editor</button>
    <button class="board-fit" title="Fit board to screen">Fit</button>
    <button class="board-reset" title="Reset zoom">Reset</button>
    <span class="board-zoom-label">100%</span>`;
  toolbar.querySelector('.board-back').addEventListener('click', exitBoardMode);
  toolbar.querySelector('.board-fit').addEventListener('click', fitBoard);
  toolbar.querySelector('.board-reset').addEventListener('click', resetBoard);

  surface = document.createElement('div');
  surface.className = 'board-surface';
  surface.style.display = 'none';

  viewport.appendChild(toolbar);
  viewport.appendChild(surface);
}

// Camera (Task 2 fills pan/zoom; here just a stub transform + label).
function applyCamera() {
  if (!surface) return;
  const { x, y, zoom } = state.board.camera;
  surface.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  const label = toolbar && toolbar.querySelector('.board-zoom-label');
  if (label) label.textContent = Math.round(zoom * 100) + '%';
}

export function fitBoard() {
  state.board.camera = { x: 0, y: 0, zoom: 1 };
  applyCamera();
}
export function resetBoard() { fitBoard(); }

// Task 1 stub: show an empty-state hint. Task 3 replaces this with card layout.
export function renderBoard() {
  if (state.mode !== 'board') return;
  ensureSurface();
  if (!surface) return;
  applyCamera();
  if (!surface.querySelector('.board-empty')) {
    const empty = document.createElement('div');
    empty.className = 'board-empty';
    empty.textContent = pageCount()
      ? 'Board mode — cards arrive in Task 3.'
      : 'Upload a screenshot, then open the Board.';
    surface.appendChild(empty);
  }
}

export function bindBoard() {
  // Task 2 wires camera input here. Task 1 only ensures the surface exists and
  // the toggle command (added in palette.js) can reach enterBoardMode.
  ensureSurface();
}
```

- [ ] **Step 4: Register a palette command in `palette.js`**

In `src/features/palette.js`, add the import with the other board-related imports at the top:

```js
import { toggleBoardMode } from './board.js';
```

In `registerCommands()`, add an entry to the `commands` list (place it near other view/export commands; match the existing object shape used in that file — typically `{ id, label, icon, group, run, when?, keys? }`):

```js
  { id: 'toggleBoard', label: 'Toggle Board view', icon: 'grid', group: 'View',
    run: toggleBoardMode, keys: 'Shift+B',
    when: () => true },
```

(If `group: 'View'` is not a group `groupFor(id)` already returns, use an existing group string you find in `groupFor()` — e.g. the export or display group — so the command appears in a valid category. Do not invent a group the palette won't render.)

- [ ] **Step 5: Wire `bindBoard()` in `main.js`**

In `src/main.js`, add the import near `import { bindPages } from './features/pages.js';`:

```js
import { bindBoard } from './features/board.js';
```

In `init()`, add the call right after `bindPages();` (around line 155):

```js
  bindPages();
  bindBoard();     // v32 — Open Canvas board surface
```

- [ ] **Step 6: Add board styles to `styles.css`**

Append to `src/styles.css`:

```css
/* v32 — Open Canvas board surface */
.board-surface {
  position: absolute; inset: 0; transform-origin: 0 0;
  pointer-events: none;            /* children re-enable pointer events */
}
.board-surface .board-card,
.board-surface .board-text,
.board-surface .board-empty { pointer-events: auto; }
.board-empty {
  position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%);
  color: var(--text-muted, #8a8a92); font-size: 14px; pointer-events: none;
}
.board-toolbar {
  position: absolute; top: 12px; left: 12px; z-index: 20; display: none;
  gap: 6px; align-items: center;
  background: var(--panel, #15151a); border: 1px solid var(--border, #2a2a32);
  border-radius: 8px; padding: 6px;
}
.board-toolbar button {
  background: transparent; color: var(--text, #e6e6ec); border: none;
  padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 12px;
}
.board-toolbar button:hover { background: var(--border, #2a2a32); }
.board-zoom-label { color: var(--text-muted, #8a8a92); font-size: 12px; padding: 0 4px; }
```

- [ ] **Step 7: Verify in-browser**

Run: `npm run dev` (already running). Open http://localhost:5173/editor/.
1. Open the command palette (Cmd/Ctrl+K). Type "board". Run "Toggle Board view".
2. Expected: the single canvas hides; a `.board-toolbar` appears top-left (← Editor, Fit, Reset, 100%); a centered empty-state hint reads "Board mode — cards arrive in Task 3." (or the no-image variant if no screenshot is loaded).
3. Press Shift+B. Expected: returns to the normal editor (canvas visible, toolbar hidden). Shift+B again returns to the board.
4. Click "← Editor". Expected: exits board mode.

- [ ] **Step 8: Commit**

```bash
git add src/state/state.js src/render/render.js src/features/board.js src/features/palette.js src/main.js src/styles.css
git commit -m "feat(v32): board state, mode branch, DOM mount, and toggle" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Board camera — pan, zoom, fit

**Files:**
- Modify: `src/features/board.js` (replace the stub camera section; extend `bindBoard()`)
- Modify: `src/features/board-tools.js` (create; coord helpers)
- Modify: `src/styles.css` (panning cursor)

**Interfaces:**
- Produces: `screenToBoard(clientX, clientY)` and `boardToScreen(x, y)` in `board-tools.js`; `state.board.camera` driven by pan/zoom; `fitBoard()` fits to content (Task 3 sets content bounds).
- Consumes: `el.canvasViewport`, `state.board.camera`.

- [ ] **Step 1: Create `board-tools.js` with coordinate helpers**

Create `src/features/board-tools.js`:

```js
// v32 — board-space hit-testing + coordinate helpers (analog of canvas-tools.js
// for the board). Board coordinates are world px inside the camera-transformed
// .board-surface; screen coordinates are clientX/clientY.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';

export function screenToBoard(clientX, clientY) {
  const vp = el.canvasViewport.getBoundingClientRect();
  const { x, y, zoom } = state.board.camera;
  return { x: (clientX - vp.left - x) / zoom, y: (clientY - vp.top - y) / zoom };
}

export function boardToScreen(x, y) {
  const vp = el.canvasViewport.getBoundingClientRect();
  const { x: cx, y: cy, zoom } = state.board.camera;
  return { x: x * zoom + cx + vp.left, y: y * zoom + cy + vp.top };
}

export function clampZoom(z) { return Math.max(0.1, Math.min(4, z)); }
```

- [ ] **Step 2: Replace the camera section in `board.js`**

In `src/features/board.js`, replace the `applyCamera`/`fitBoard`/`resetBoard` block with a real camera, and add zoom anchored at the cursor. Add imports at the top of `board.js`:

```js
import { screenToBoard, clampZoom } from './board-tools.js';
```

Replace the camera block:

```js
function applyCamera() {
  if (!surface) return;
  const { x, y, zoom } = state.board.camera;
  surface.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  const label = toolbar && toolbar.querySelector('.board-zoom-label');
  if (label) label.textContent = Math.round(zoom * 100) + '%';
}

// Zoom keeping the world point under the cursor fixed.
function zoomAt(clientX, clientY, factor) {
  const vp = el.canvasViewport.getBoundingClientRect();
  const { x, y, zoom } = state.board.camera;
  const newZoom = clampZoom(zoom * factor);
  const ax = clientX - vp.left, ay = clientY - vp.top;
  // World point under cursor: (ax - x)/zoom. Keep it fixed after zoom.
  const wx = (ax - x) / zoom, wy = (ay - y) / zoom;
  state.board.camera.zoom = newZoom;
  state.board.camera.x = ax - wx * newZoom;
  state.board.camera.y = ay - wy * newZoom;
  applyCamera();
}

// fitBoard() fits to content bounds; Task 3 sets contentBounds(). Until cards
// exist, fit = reset to origin/100%.
function contentBounds() {
  const objs = state.board.objects.filter(o => o.kind === 'card' || o.kind === 'text');
  if (!objs.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fitBoard() {
  const vp = el.canvasViewport.getBoundingClientRect();
  const b = contentBounds();
  if (!b || !b.w || !b.h) { state.board.camera = { x: 0, y: 0, zoom: 1 }; applyCamera(); return; }
  const pad = 80;
  const zoom = clampZoom(Math.min((vp.width - pad * 2) / b.w, (vp.height - pad * 2) / b.h));
  state.board.camera.zoom = zoom;
  state.board.camera.x = (vp.width - b.w * zoom) / 2 - b.x * zoom + pad;
  state.board.camera.y = (vp.height - b.h * zoom) / 2 - b.y * zoom + pad;
  applyCamera();
}
export function resetBoard() { state.board.camera = { x: 0, y: 0, zoom: 1 }; applyCamera(); }
```

- [ ] **Step 3: Wire camera input in `bindBoard()`**

Replace the `bindBoard()` body in `board.js`:

```js
export function bindBoard() {
  ensureSurface();
  if (!viewport) return;

  // Wheel zoom (no modifier needed on the board; Cmd/Ctrl also works).
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });

  // Space + drag, or middle-mouse, to pan. Track via module state.
  let panning = false, sx = 0, sy = 0, ox = 0, oy = 0, spaceDown = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state.mode === 'board' && !e.repeat) { spaceDown = true; viewport.classList.add('board-panning'); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; viewport.classList.remove('board-panning'); }
  });

  viewport.addEventListener('mousedown', (e) => {
    if (state.mode !== 'board') return;
    const pan = spaceDown || e.button === 1;
    if (!pan) return;
    e.preventDefault();
    panning = true; sx = e.clientX; sy = e.clientY;
    ox = state.board.camera.x; oy = state.board.camera.y;
  });
  window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    state.board.camera.x = ox + (e.clientX - sx);
    state.board.camera.y = oy + (e.clientY - sy);
    applyCamera();
  });
  window.addEventListener('mouseup', () => { panning = false; });
}
```

- [ ] **Step 4: Add the panning cursor style**

Append to `src/styles.css`:

```css
.canvas-viewport.board-panning { cursor: grab; }
.canvas-viewport.board-panning:active { cursor: grabbing; }
.board-surface { will-change: transform; }
```

- [ ] **Step 5: Verify in-browser**

1. Enter board mode (Cmd+K → "Toggle Board view", or Shift+B).
2. Wheel up/down over the board. Expected: zooms toward/away from the cursor; the 100% label updates.
3. Hold Space and drag. Expected: the board pans; cursor is grab/grabbing.
4. Click "Fit". Expected: with no cards, resets to 100% at origin. Click "Reset". Expected: 100% at origin.

- [ ] **Step 6: Commit**

```bash
git add src/features/board.js src/features/board-tools.js src/styles.css
git commit -m "feat(v32): board camera pan/zoom/fit" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Cards from pages — layout, render, sync

**Files:**
- Modify: `src/features/pages.js` (export `getPageMeta()`, `indexOfPage(id)`)
- Modify: `src/features/board.js` (replace `renderBoard()` stub; add card creation + sync)

**Interfaces:**
- Produces: `getPageMeta()` → `[{id, thumb, w, h}]` (w/h from `payload.design.canvas`); `indexOfPage(id)` → index or -1. Board cards rendered as `.board-card` with an `<img src=thumb>`, positioned by `{x,y,w,h}`.
- Consumes: `pageCount()`, `onDocumentChange()` from `pages.js`.

- [ ] **Step 1: Add page accessors to `pages.js`**

In `src/features/pages.js`, add these exports (after `pageCount()`):

```js
// v32 — board accessors. The board enumerates pages as cards and resolves a
// card's pageId back to an index for switchTo().
export function getPageMeta() {
  return pages.map(p => {
    const c = (p.payload && p.payload.design && p.payload.design.canvas) || { width: 1280, height: 720 };
    return { id: p.id, thumb: p.thumb, w: c.width, h: c.height };
  });
}

export function indexOfPage(id) {
  return pages.findIndex(p => p.id === id);
}
```

- [ ] **Step 2: Generate card objects on first board entry**

In `src/features/board.js`, add a helper that seeds `state.board.objects` from the current pages if the board is empty. Add near the top (after imports):

```js
import { pageCount, getPageMeta, indexOfPage } from './pages.js';
import { onDocumentChange } from './pages.js';
```

Add the seeder + a default-grid layout:

```js
function ensureCards() {
  // Only seed when the board has no card objects yet. (Existing cards survive
  // page add/delete via the sync in Step 4, which adds/removes by id.)
  const existing = new Set(state.board.objects.filter(o => o.kind === 'card').map(o => o.pageId));
  const meta = getPageMeta();
  const colW = 280, gap = 24, cols = 4;
  let row = 0, col = 0;
  for (const p of meta) {
    if (existing.has(p.id)) { col = (col + 1) % cols; if (col === 0) row++; continue; }
    const ar = p.w && p.h ? p.h / p.w : 0.625;
    const w = colW, h = Math.round(colW * ar);
    state.board.objects.push({
      id: nextId(), kind: 'card', pageId: p.id,
      x: 60 + col * (colW + gap), y: 60 + row * (h + gap + 28),
      w, h, z: state.board.objects.length
    });
    col = (col + 1) % cols; if (col === 0) row++;
  }
}

function nextId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }
```

Call `ensureCards()` at the start of `enterBoardMode()` (before `renderBoard()`):

```js
export function enterBoardMode() {
  state.mode = 'board';
  ensureSurface();
  ensureCards();          // <-- add
  showBoardChrome(true);
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  const uz = document.getElementById('upload-zone');
  if (uz) uz.style.display = 'none';
  renderBoard();
}
```

- [ ] **Step 3: Render card DOM nodes from `state.board.objects`**

Replace the `renderBoard()` stub with a real layout (cards only; text/arrows come in Task 7). Remove the old empty-state append.

```js
export function renderBoard() {
  if (state.mode !== 'board') return;
  ensureSurface();
  if (!surface) return;
  applyCamera();

  // Build/reconcile card nodes by id.
  const cards = state.board.objects.filter(o => o.kind === 'card');
  const seen = new Set();
  for (const o of cards) {
    seen.add(o.id);
    let node = surface.querySelector(`.board-card[data-id="${o.id}"]`);
    const meta = getPageMeta().find(m => m.id === o.pageId);
    const imgSrc = (meta && meta.thumb) || '';
    if (!node) {
      node = document.createElement('div');
      node.className = 'board-card';
      node.dataset.id = String(o.id);
      node.dataset.pageId = String(o.pageId);
      node.innerHTML = `<img class="board-card-img" alt="">` +
        `<div class="board-card-label"></div>`;
      surface.appendChild(node);
      bindCardEvents(node);
    }
    node.style.left = o.x + 'px';
    node.style.top = o.y + 'px';
    node.style.width = o.w + 'px';
    node.style.height = o.h + 'px';
    node.style.zIndex = o.z;
    const img = node.querySelector('.board-card-img');
    if (imgSrc && img.src !== imgSrc) img.src = imgSrc;
    node.querySelector('.board-card-label').textContent = 'Page';
  }
  // Remove DOM cards whose object was deleted.
  surface.querySelectorAll('.board-card').forEach(n => {
    if (!seen.has(Number(n.dataset.id))) n.remove();
  });

  // Empty-state hint only when there are no cards at all.
  let empty = surface.querySelector('.board-empty');
  if (!cards.length) {
    if (!empty) { empty = document.createElement('div'); empty.className = 'board-empty'; surface.appendChild(empty); }
    empty.textContent = pageCount() ? 'Board is empty.' : 'Upload a screenshot, then open the Board.';
  } else if (empty) { empty.remove(); }

  updateSelectionChrome();
}
```

Add a placeholder `bindCardEvents` (Task 4 fills selection/move; Task 5 fills open-in-editor) and `updateSelectionChrome`:

```js
function bindCardEvents(node) {
  node.addEventListener('mousedown', (e) => { onCardMouseDown(e, node); });
  node.addEventListener('dblclick', (e) => { onCardDoubleClick(e, node); });
}
function onCardMouseDown(e, node) { /* Task 4 */ }
function onCardDoubleClick(e, node) { /* Task 5 */ }
function updateSelectionChrome() {
  surface.querySelectorAll('.board-card').forEach(n => {
    n.classList.toggle('selected', state.boardSelection.some(r => r.id === Number(n.dataset.id)));
  });
}
```

- [ ] **Step 4: Sync cards when pages change**

In `bindBoard()`, subscribe to document changes (debounced, like the filmstrip does). Add inside `bindBoard()` (after the camera wiring):

```js
  // Add/remove board cards when pages are added/deleted (keep cards whose page
  // still exists; drop cards whose page is gone; new pages get a card on next
  // board entry or here).
  let syncTimer = null;
  onDocumentChange(() => {
    if (state.mode !== 'board') return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const liveIds = new Set(getPageMeta().map(m => m.id));
      // Remove cards whose page was deleted.
      state.board.objects = state.board.objects.filter(o => o.kind !== 'card' || liveIds.has(o.pageId));
      // Add a card for any new page that lacks one.
      const have = new Set(state.board.objects.filter(o => o.kind === 'card').map(o => o.pageId));
      let row = 0, col = 0;
      for (const p of getPageMeta()) {
        if (have.has(p.id)) continue;
        const ar = p.w && p.h ? p.h / p.w : 0.625;
        state.board.objects.push({ id: nextId(), kind: 'card', pageId: p.id,
          x: 60 + col * 304, y: 60 + row * (280 * ar + 52), w: 280, h: Math.round(280 * ar), z: state.board.objects.length });
        col = (col + 1) % 4; if (col === 0) row++;
      }
      renderBoard();
    }, 200);
  });
```

- [ ] **Step 5: Add card styles**

Append to `src/styles.css`:

```css
.board-card {
  position: absolute; background: var(--panel, #15151a);
  border: 1px solid var(--border, #2a2a32); border-radius: 10px;
  overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
.board-card-img { width: 100%; height: calc(100% - 22px); object-fit: contain; background: #000; display: block; }
.board-card-label { height: 22px; font-size: 11px; color: var(--text-muted, #8a8a92);
  display: flex; align-items: center; padding: 0 8px; border-top: 1px solid var(--border, #2a2a32); }
.board-card.selected { outline: 2px solid var(--accent-primary, #4f7cff); outline-offset: 2px; }
```

- [ ] **Step 6: Verify in-browser**

1. Load a screenshot in the editor (so there is one page with a thumb). Enter board mode.
2. Expected: one card showing the page thumb, at top-left. The empty-state hint is gone.
3. Exit to editor, add a second page (filmstrip ＋), re-enter board mode. Expected: two cards in a row.
4. In board mode, add a page via the filmstrip ＋. Expected: within ~200ms a third card appears on the board.
5. Click "Fit". Expected: the cards fit within the viewport with padding.

- [ ] **Step 7: Commit**

```bash
git add src/features/pages.js src/features/board.js src/styles.css
git commit -m "feat(v32): render pages as board cards with sync" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Card selection, move, resize, raise/lower

**Files:**
- Modify: `src/features/board.js` (`onCardMouseDown`, marquee on empty, `resolveBoardRef` usage)
- Modify: `src/features/board-tools.js` (`hitTopBoardRef`, `resolveBoardRef`)

**Interfaces:**
- Produces: `hitTopBoardRef(clientX, clientY)` → `{kind:'boardObject', id}` or null; `resolveBoardRef(ref)` → uniform handle `{box, moveBy, clone, remove, raiseToFront, sendToBack}` in board px. Selection via `state.boardSelection`; clear on empty-surface mousedown.
- Consumes: `state.board.objects`, `screenToBoard`.

- [ ] **Step 1: Add `resolveBoardRef` and `hitTopBoardRef` to `board-tools.js`**

Append to `src/features/board-tools.js`:

```js
import { isTypingTarget } from '../utils/dom.js';

// Top-most board object under a screen point, or null. Cards/text are rect
// hits (text uses its bounding box); arrows are handled in Task 7.
export function hitTopBoardRef(clientX, clientY) {
  const p = screenToBoard(clientX, clientY);
  const objs = [...state.board.objects].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.kind === 'card' || o.kind === 'text') {
      if (p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h)
        return { kind: 'boardObject', id: o.id };
    }
  }
  return null;
}

export function resolveBoardRef(ref) {
  const o = state.board.objects.find(x => x.id === ref.id);
  if (!o) return null;
  const at = () => state.board.objects.indexOf(o);
  const handle = {
    box: { x: o.x, y: o.y, w: o.w, h: o.h },
    moveBy(dx, dy) { o.x += dx; o.y += dy; },
    remove() { const i = at(); if (i !== -1) state.board.objects.splice(i, 1); },
    raiseToFront() { const i = at(); if (i !== -1) { state.board.objects.splice(i, 1); o.z = (state.board.objects[state.board.objects.length - 1]?.z || 0) + 1; state.board.objects.push(o); } },
    sendToBack() { const i = at(); if (i !== -1) { state.board.objects.splice(i, 1); o.z = (state.board.objects[0]?.z || 0) - 1; state.board.objects.unshift(o); } },
    clone() { return null; }   // card clone is page-level (Task 6); text clone added in Task 7
  };
  return handle;
}

export function clearBoardSelection() { state.boardSelection = []; }
export function selectBoardOnly(ref) { state.boardSelection = [ref]; }
export function toggleBoardRef(ref) {
  const i = state.boardSelection.findIndex(r => r.id === ref.id);
  if (i === -1) state.boardSelection.push(ref); else state.boardSelection.splice(i, 1);
}
```

- [ ] **Step 2: Implement `onCardMouseDown` — select + drag-move**

Replace the stub in `board.js`:

```js
function onCardMouseDown(e, node) {
  if (e.button !== 0) return;
  const id = Number(node.dataset.id);
  const ref = { kind: 'boardObject', id };
  // Shift-click toggles; plain click selects only.
  if (e.shiftKey) toggleBoardRef(ref);
  else if (!state.boardSelection.some(r => r.id === id)) selectBoardOnly(ref);
  if (state.boardSelection.length > 1 || !state.boardSelection.some(r => r.id === id)) {
    // If this card isn't in the selection after toggle, don't start a move.
    if (!state.boardSelection.some(r => r.id === id)) { updateSelectionChrome(); return; }
  }
  updateSelectionChrome();

  // Begin drag-move of the whole selection (board px deltas).
  const start = screenToBoard(e.clientX, e.clientY);
  const origs = state.boardSelection.map(r => {
    const o = state.board.objects.find(x => x.id === r.id);
    return { id: r.id, x: o.x, y: o.y };
  });
  let moved = false;
  const onMove = (ev) => {
    const cur = screenToBoard(ev.clientX, ev.clientY);
    const dx = cur.x - start.x, dy = cur.y - start.y;
    moved = true;
    for (const or of origs) { const o = state.board.objects.find(x => x.id === or.id); if (o) { o.x = or.x + dx; o.y = or.y + dy; } }
    renderBoard();
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (moved) raiseLatestToTop();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  e.stopPropagation();
}

function raiseLatestToTop() {
  // Bring the most-recently interacted selected card to front (visual feedback).
  const sel = state.boardSelection;
  if (!sel.length) return;
  const topRef = sel[sel.length - 1];
  resolveBoardRef(topRef)?.raiseToFront();
  renderBoard();
}
```

Add the imports for the selection helpers at the top of `board.js`:

```js
import { hitTopBoardRef, resolveBoardRef, clearBoardSelection, selectBoardOnly, toggleBoardRef } from './board-tools.js';
```

- [ ] **Step 3: Clear selection + marquee on empty-surface mousedown**

In `bindBoard()`, add (after the camera `mousedown` handler — note: the camera handler returns early unless space/middle, so a plain left-click on empty surface falls through to here):

```js
  viewport.addEventListener('mousedown', (e) => {
    if (state.mode !== 'board' || e.button !== 0) return;
    if (e.target.closest('.board-card') || e.target.closest('.board-toolbar')) return;
    clearBoardSelection(); updateSelectionChrome();
    // Marquee (Task 6 expands this).
    startMarquee(e);
  });
```

Add a minimal `startMarquee` (full rubber-band lands in Task 6; here it just swallows the drag so the camera pan doesn't trigger):

```js
function startMarquee(e) {
  const start = screenToBoard(e.clientX, e.clientY);
  const onMove = () => {};
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
```

- [ ] **Step 4: Add resize handles to the selected card**

In `renderBoard()`, after positioning each card node, add/remove a handle element based on selection. Replace the card-positioning loop's tail and add a handle routine. After the `for (const o of cards)` loop and before the remove-stale loop, add:

```js
  // Resize handle on the sole-selected card.
  surface.querySelectorAll('.board-card').forEach(n => {
    const sel = state.boardSelection.length === 1 && state.boardSelection[0].id === Number(n.dataset.id);
    let h = n.querySelector('.board-resize');
    if (sel && !h) {
      h = document.createElement('div'); h.className = 'board-resize'; n.appendChild(h);
      h.addEventListener('mousedown', (e) => onResizeStart(e, n));
    } else if (!sel && h) { h.remove(); }
  });
```

Add the resize routine:

```js
function onResizeStart(e, node) {
  e.stopPropagation(); e.preventDefault();
  const id = Number(node.dataset.id);
  const o = state.board.objects.find(x => x.id === id);
  if (!o) return;
  const start = screenToBoard(e.clientX, e.clientY);
  const ow = o.w, oh = o.h, oar = ow / oh;
  const onMove = (ev) => {
    const cur = screenToBoard(ev.clientX, ev.clientY);
    // Bottom-right handle: width follows cursor, height preserves aspect.
    o.w = Math.max(80, ow + (cur.x - start.x));
    o.h = Math.round(o.w / oar);
    renderBoard();
  };
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
```

- [ ] **Step 5: Add handle + marquee styles**

Append to `src/styles.css`:

```css
.board-resize {
  position: absolute; right: -5px; bottom: -5px; width: 12px; height: 12px;
  background: var(--accent-primary, #4f7cff); border: 2px solid #fff; border-radius: 50%;
  cursor: nwse-resize;
}
```

- [ ] **Step 6: Verify in-browser**

1. Board mode with ≥2 cards. Click one: it gets the selected outline + a resize handle. Click another: selection moves.
2. Drag a card: it moves; the selection follows. Release: it raises to front (z-index).
3. Shift-click a second card: both selected. Drag: both move together.
4. Click empty surface: selection clears.
5. Drag the resize handle: card resizes, preserving aspect ratio.

- [ ] **Step 7: Commit**

```bash
git add src/features/board.js src/features/board-tools.js src/styles.css
git commit -m "feat(v32): card select, move, resize, raise/lower" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Open a card in the editor and return with a refreshed thumb

**Files:**
- Modify: `src/features/board.js` (`onCardDoubleClick`, `exitBoardMode` already restores)
- Modify: `src/features/pages.js` (export a `syncActiveNow()` thin wrapper, or reuse `switchTo`)

**Interfaces:**
- Produces: double-click a card → `switchTo(indexOfPage(pageId))` + `state.mode='single'`; "← Editor" / Esc → `state.mode='board'` + refresh that card's thumb.
- Consumes: `switchTo`, `indexOfPage`, `syncActive` (via `switchTo`).

- [ ] **Step 1: Implement `onCardDoubleClick`**

Replace the stub in `board.js`. Add the import:

```js
import { switchTo } from './pages.js';
```

```js
function onCardDoubleClick(e, node) {
  const pageId = Number(node.dataset.pageId);
  const idx = indexOfPage(pageId);
  if (idx < 0) return;
  // Remember which card we came from so returning to the board refreshes it.
  _lastEditedPageId = pageId;
  switchTo(idx);
  state.mode = 'single';
  showBoardChrome(false);
  if (el.canvasWrapper) el.canvasWrapper.style.display = '';
  import('../render/render.js').then(({ render }) => render());
}
let _lastEditedPageId = null;
```

- [ ] **Step 2: Add the `returnToBoard` path and a "Back to board" pill**

Do **not** change `exitBoardMode()` — Task 1's version (board → editor) is correct. This step adds the reverse path (editor → board) used after editing a card, plus a floating pill that survives Task 7's `toolbar.innerHTML` replacement because it is appended to the **viewport**, not the toolbar.

Add a module-level variable and the function (near the other mode functions):

```js
let _returnPill = null;

export function returnToBoard() {
  // Coming back from editing a card: switchTo already synced the active page's
  // payload+thumb (pages.js switchTo -> syncActive). Just flip the view back.
  if (state.mode === 'board') return;
  state.mode = 'board';
  ensureCards();
  showBoardChrome(true);
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  if (_returnPill) _returnPill.style.display = 'none';
  renderBoard();
}
```

Create the pill once in `ensureSurface()` (append to `viewport`, store on the module var). Add at the end of `ensureSurface()`:

```js
  if (!_returnPill) {
    _returnPill = document.createElement('button');
    _returnPill.className = 'board-return-pill';
    _returnPill.textContent = '← Back to board';
    _returnPill.style.display = 'none';
    _returnPill.addEventListener('click', returnToBoard);
    viewport.appendChild(_returnPill);
  }
```

Show the pill when a card is opened: in `onCardDoubleClick` (Step 1 above) add at the end, before the dynamic `render()` import call:

```js
  if (_returnPill) _returnPill.style.display = '';
```

(Exit paths out of a card are: the "← Back to board" pill, and the Shift+B toggle which calls `toggleBoardMode`. Do not add an Escape handler here — `keyboard.js` owns the Escape cascade and a second listener risks double-firing. The toolbar's "← Editor" button remains the board→editor exit.)

- [ ] **Step 3: Add the return-pill style**

Append to `src/styles.css`:

```css
.board-return-pill {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 30;
  background: var(--accent-primary, #4f7cff); color: #fff; border: none;
  padding: 6px 12px; border-radius: 999px; font-size: 12px; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

- [ ] **Step 4: Verify in-browser**

1. Board mode, two cards. Double-click one. Expected: that page opens in the normal editor; a "← Back to board" pill appears top-center.
2. Change something visible (e.g. background color) so the thumb will differ.
3. Click "← Back to board" (or it also works to click the toolbar's ← Editor then re-enter, but the pill is the primary path). Expected: returns to the board; the card you edited shows the updated thumb.
4. Esc while on the board exits to the editor; Esc is not captured while typing in a text field.

- [ ] **Step 5: Commit**

```bash
git add src/features/board.js src/styles.css
git commit -m "feat(v32): open card in editor and return with refreshed thumb" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Marquee multi-select and delete

**Files:**
- Modify: `src/features/board.js` (`startMarquee` real rubber-band; Delete key)
- Modify: `src/features/keyboard.js` (Delete handler respects board mode) — only if the existing Delete handler would misfire; otherwise handle in `board.js`.

**Interfaces:**
- Produces: marquee rubber-band selects all cards whose rect intersects the marquee; Delete/Backspace removes selected board objects (cards delete their page via `deletePage`).

- [ ] **Step 1: Implement the marquee rubber-band**

Replace `startMarquee` in `board.js`:

```js
function startMarquee(e) {
  const start = screenToBoard(e.clientX, e.clientY);
  let box = document.createElement('div');
  box.className = 'board-marquee';
  surface.appendChild(box);
  const onMove = (ev) => {
    const cur = screenToBoard(ev.clientX, ev.clientY);
    const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = w + 'px'; box.style.height = h + 'px';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const b = box.getBoundingClientRect();
    const vp = el.canvasViewport.getBoundingClientRect();
    const sx0 = (b.left - vp.left - state.board.camera.x) / state.board.camera.zoom;
    const sy0 = (b.top - vp.top - state.board.camera.y) / state.board.camera.zoom;
    const sx1 = sx0 + b.width / state.board.camera.zoom, sy1 = sy0 + b.height / state.board.camera.zoom;
    box.remove();
    const hits = state.board.objects.filter(o =>
      (o.kind === 'card' || o.kind === 'text') &&
      o.x < sx1 && o.x + o.w > sx0 && o.y < sy1 && o.y + o.h > sy0
    ).map(o => ({ kind: 'boardObject', id: o.id }));
    state.boardSelection = hits;
    updateSelectionChrome();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
```

- [ ] **Step 2: Add the Delete handler for board mode**

In `bindBoard()` (board.js), add a keydown for Delete/Backspace:

```js
  window.addEventListener('keydown', (e) => {
    if (state.mode !== 'board') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTypingTarget(e.target) && state.boardSelection.length) {
      e.preventDefault();
      deleteBoardSelection();
    }
  });
```

Add the deleter. Card deletion removes the page too (cards ARE pages); text/arrows just remove the object:

```js
function deleteBoardSelection() {
  for (const ref of [...state.boardSelection]) {
    const o = state.board.objects.find(x => x.id === ref.id);
    if (!o) continue;
    if (o.kind === 'card') {
      const idx = indexOfPage(o.pageId);
      if (idx >= 0) deletePage(idx);   // pages.js keeps ≥1 page; may reindex active
    } else {
      resolveBoardRef(ref)?.remove();
    }
  }
  state.boardSelection = [];
  renderBoard();
}
```

Add the import:

```js
import { deletePage } from './pages.js';
```

- [ ] **Step 3: Add marquee style**

Append to `src/styles.css`:

```css
.board-marquee {
  position: absolute; border: 1px solid var(--accent-primary, #4f7cff);
  background: rgba(79,124,255,0.12); pointer-events: none;
}
```

- [ ] **Step 4: Verify in-browser**

1. Board mode, ≥3 cards. Drag on empty surface to draw a marquee over two cards. Expected: both selected on mouseup.
2. Press Delete. Expected: those two cards (and their pages) are removed; remaining cards stay.
3. Try to delete the last remaining card: pages.js keeps ≥1 page, so one card remains.

- [ ] **Step 5: Commit**

```bash
git add src/features/board.js src/styles.css
git commit -m "feat(v32): marquee multi-select and board delete" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Board text, arrows, and groups (overlays)

**Files:**
- Modify: `src/features/board.js` (text + arrow + group object kinds; SVG overlay)
- Modify: `src/features/board-tools.js` (`resolveBoardRef` for text/arrow; group hit)
- Modify: `src/features/palette.js` (add-text-on-board command)

**Interfaces:**
- Produces: `.board-text` nodes; an SVG `.board-connectors` overlay rendering arrows between cards by `from`/`to` ids; group objects with `children` ids and a group bounding box; group-move moves all children.

- [ ] **Step 1: Add an SVG connector overlay + a text node renderer to `renderBoard()`**

In `renderBoard()`, after the cards loop and before the empty-state check, add overlay reconciliation. Add a module-level svg reference:

```js
function ensureOverlay() {
  if (!surface) return null;
  let svg = surface.querySelector('.board-connectors');
  if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'board-connectors'); surface.appendChild(svg); }
  return svg;
}
```

Extend `renderBoard()` (before the empty-state check) to render text + arrows:

```js
  // Text nodes.
  const texts = state.board.objects.filter(o => o.kind === 'text');
  const textSeen = new Set();
  for (const o of texts) {
    textSeen.add(o.id);
    let n = surface.querySelector(`.board-text[data-id="${o.id}"]`);
    if (!n) { n = document.createElement('div'); n.className = 'board-text'; n.dataset.id = String(o.id); surface.appendChild(n); }
    n.style.left = o.x + 'px'; n.style.top = o.y + 'px';
    n.style.width = o.w + 'px'; n.style.fontSize = (o.fontSize || 24) + 'px';
    n.style.color = o.color || '#fff';
    n.textContent = o.text || '';
    n.style.zIndex = o.z;
  }
  surface.querySelectorAll('.board-text').forEach(n => { if (!textSeen.has(Number(n.dataset.id))) n.remove(); });

  // Arrows (SVG overlay).
  const svg = ensureOverlay();
  if (svg) {
    const arrows = state.board.objects.filter(o => o.kind === 'arrow');
    svg.innerHTML = '';
    for (const a of arrows) {
      const f = state.board.objects.find(o => o.id === a.from);
      const t = state.board.objects.find(o => o.id === a.to);
      if (!f || !t) continue;
      const x1 = f.x + f.w / 2, y1 = f.y + f.h / 2, x2 = t.x + t.w / 2, y2 = t.y + t.h / 2;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', a.color || '#4f7cff');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#board-arrowhead)');
      svg.appendChild(line);
    }
    if (!svg.querySelector('#board-arrowhead')) {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.id = 'board-arrowhead'; m.setAttribute('markerWidth','8'); m.setAttribute('markerHeight','8');
      m.setAttribute('refX','6'); m.setAttribute('refY','4'); m.setAttribute('orient','auto');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d','M0,0 L8,4 L0,8 z'); p.setAttribute('fill', '#4f7cff');
      m.appendChild(p); svg.appendChild(m);
    }
  }
```

- [ ] **Step 2: Add toolbar buttons for text + connect + group**

In `ensureSurface()`, extend `toolbar.innerHTML` to include:

```js
toolbar.innerHTML = `
  <button class="board-back" title="Back to editor (Esc)">← Editor</button>
  <button class="board-text-add" title="Add text">Text</button>
  <button class="board-connect" title="Connect two cards (click from → to)">Connect</button>
  <button class="board-group" title="Group selected">Group</button>
  <button class="board-fit" title="Fit board to screen">Fit</button>
  <button class="board-reset" title="Reset zoom">Reset</button>
  <span class="board-zoom-label">100%</span>`;
```

Wire them at the end of `ensureSurface()` (replace the existing back/fit/reset wiring block; keep those three plus add the new ones):

```js
  toolbar.querySelector('.board-back').addEventListener('click', exitBoardMode);
  toolbar.querySelector('.board-fit').addEventListener('click', fitBoard);
  toolbar.querySelector('.board-reset').addEventListener('click', resetBoard);
  toolbar.querySelector('.board-text-add').addEventListener('click', addBoardText);
  toolbar.querySelector('.board-connect').addEventListener('click', startConnectMode);
  toolbar.querySelector('.board-group').addEventListener('click', groupSelected);
```

- [ ] **Step 3: Implement add-text, connect-mode, and group**

Add to `board.js`:

```js
function addBoardText() {
  const o = { id: nextId(), kind: 'text', x: 120, y: 120, w: 240, h: 40,
    text: 'Label', fontSize: 24, color: '#ffffff', z: state.board.objects.length };
  state.board.objects.push(o);
  selectBoardOnly({ kind: 'boardObject', id: o.id });
  renderBoard();
}

let connectMode = false;
function startConnectMode() {
  connectMode = true;
  const label = toolbar.querySelector('.board-zoom-label');
  label.textContent = 'click from → to';
}
// Two-click connect: handled in onCardMouseDown.
function maybeConnect(id) {
  if (!connectMode) return false;
  if (!connectFrom) { connectFrom = id; return true; }
  if (connectFrom !== id) {
    state.board.objects.push({ id: nextId(), kind: 'arrow', from: connectFrom, to: id, color: '#4f7cff', z: state.board.objects.length });
  }
  connectFrom = null; connectMode = false;
  const label = toolbar.querySelector('.board-zoom-label');
  label.textContent = Math.round(state.board.camera.zoom * 100) + '%';
  renderBoard();
  return true;
}
let connectFrom = null;

function groupSelected() {
  if (state.boardSelection.length < 2) return;
  const childIds = state.boardSelection.map(r => r.id);
  const g = { id: nextId(), kind: 'group', children: childIds, x:0,y:0,w:0,h:0, z: state.board.objects.length };
  state.board.objects.push(g);
  // Replace the selection with the group.
  state.board.selection = state.board.selection || {};
  selectBoardOnly({ kind: 'boardObject', id: g.id });
  renderBoard();
}
```

- [ ] **Step 4: Extract `dragSelection`, hook connect-mode, drag text, group hit + move**

First add a reusable `dragSelection(e)` to `board.js` (it moves each selected object via the uniform `resolveBoardRef(...).moveBy` handle, so cards, text, and groups all drag correctly — a group's `moveBy` moves its children). Add this function:

```js
function dragSelection(e) {
  const start = screenToBoard(e.clientX, e.clientY);
  const origs = state.boardSelection.map(r => {
    const h = resolveBoardRef(r);
    return { ref: r, box: h ? { ...h.box } : null };
  });
  let moved = false;
  const onMove = (ev) => {
    const cur = screenToBoard(ev.clientX, ev.clientY);
    const dx = cur.x - start.x, dy = cur.y - start.y;
    if (!dx && !dy) return;
    moved = true;
    for (const or of origs) {
      if (!or.box) continue;
      const h = resolveBoardRef(or.ref);          // live box (re-read each move)
      if (!h) continue;
      h.moveBy((or.box.x + dx) - h.box.x, (or.box.y + dy) - h.box.y);
    }
    renderBoard();
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (moved) raiseLatestToTop();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
```

Now **replace** Task 4's `onCardMouseDown` body with this version (adds the connect-mode guard and calls `dragSelection` instead of the inline drag):

```js
function onCardMouseDown(e, node) {
  if (e.button !== 0) return;
  const id = Number(node.dataset.id);
  if (connectMode) { maybeConnect(id); return; }
  const ref = { kind: 'boardObject', id };
  if (e.shiftKey) toggleBoardRef(ref);
  else if (!state.boardSelection.some(r => r.id === id)) selectBoardOnly(ref);
  if (!state.boardSelection.some(r => r.id === id)) { updateSelectionChrome(); return; }
  updateSelectionChrome();
  dragSelection(e);
  e.stopPropagation();
}
```

Make text nodes draggable too via event delegation on `surface` (text nodes are created dynamically). Add inside `bindBoard()` (near the viewport mousedown):

```js
  surface.addEventListener('mousedown', (e) => {
    const textNode = e.target.closest('.board-text');
    if (!textNode || state.mode !== 'board') return;
    e.stopPropagation();
    const id = Number(textNode.dataset.id);
    const ref = { kind: 'boardObject', id };
    if (e.shiftKey) toggleBoardRef(ref); else selectBoardOnly(ref);
    updateSelectionChrome();
    dragSelection(e);
  });
```

Groups have no visual of their own except a bounding box around their children. Add group hit-testing to `hitTopBoardRef` in `board-tools.js` — **after** the card/text loop, so a click inside a child still selects the child, and a click on the group frame (inside the bbox but outside every child) selects the group. Add `groupBounds` and the loop:

```js
function groupBounds(g) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,any=false;
  for (const cid of g.children) { const k = state.board.objects.find(x=>x.id===cid); if(!k) continue; any=true;
    minX=Math.min(minX,k.x); minY=Math.min(minY,k.y); maxX=Math.max(maxX,k.x+k.w); maxY=Math.max(maxY,k.y+k.h); }
  return any ? {x:minX,y:minY,w:maxX-minX,h:maxY-minY} : {x:0,y:0,w:0,h:0};
}

// (inside hitTopBoardRef, after the card/text for-loop's closing brace)
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.kind !== 'group') continue;
    const b = groupBounds(o);
    if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
    const insideChild = o.children.some(cid => {
      const k = state.board.objects.find(x => x.id === cid); if (!k) return false;
      return p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h;
    });
    if (!insideChild) return { kind: 'boardObject', id: o.id };
  }
  return null;
```

Add the `group` branch to `resolveBoardRef` in `board-tools.js` (before the final `return null;`):

```js
  if (o.kind === 'group') {
    return {
      box: groupBounds(o),
      moveBy(dx, dy) { for (const cid of o.children) { const k = state.board.objects.find(x => x.id === cid); if (k) { k.x += dx; k.y += dy; } } },
      remove() { const i = at(); if (i !== -1) state.board.objects.splice(i, 1); },
      raiseToFront() {}, sendToBack() {}, clone() { return null; }
    };
  }
```

- [ ] **Step 5: Add text + connector styles**

Append to `src/styles.css`:

```css
.board-text { position: absolute; pointer-events: auto; cursor: move; white-space: pre-wrap;
  font-family: Geist, system-ui, sans-serif; line-height: 1.2; }
.board-text.selected { outline: 1px dashed var(--accent-primary, #4f7cff); outline-offset: 2px; }
.board-connectors { position: absolute; inset: 0; width: 100%; height: 100%;
  overflow: visible; pointer-events: none; }
```

- [ ] **Step 6: Add a palette command for board text**

In `palette.js`, add (alongside the `toggleBoard` command):

```js
  { id: 'boardAddText', label: 'Board: add text', icon: 'type', group: 'View',
    run: () => { import('./board.js').then(m => { if (state.mode !== 'board') m.enterBoardMode(); m.addBoardText(); }); },
    when: () => state.mode === 'board' },
```

- [ ] **Step 7: Verify in-browser**

1. Board mode. Click "Text". Expected: a "Label" text node appears, selected; drag it; the resize handle (from Task 4) does not apply to text in v1 (text wraps to width) — acceptable.
2. Click "Connect", then click card A, then card B. Expected: an arrow drawn from A's center to B's center with an arrowhead. Move A: the arrow follows.
3. Marquee two cards, click "Group". Expected: a group object created; dragging one child moves only that child in v1 (group-move via selecting the group ref is the path; selecting a group requires clicking its bbox). Verify group-move by selecting the group: click on the overlap area of the two children — `hitTopBoardRef` returns the group; dragging moves both children.

- [ ] **Step 8: Commit**

```bash
git add src/features/board.js src/features/board-tools.js src/features/palette.js src/styles.css
git commit -m "feat(v32): board text, arrows, and groups" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Board export — composite all cards to one PNG

**Files:**
- Modify: `src/features/board.js` (add `exportBoard()`)
- Modify: `src/features/palette.js` (an `exportBoard` command)
- Modify: `src/features/pages.js` (export `applyDesignToState` passthrough is already in document.js; reuse `renderInto`)

**Interfaces:**
- Produces: `exportBoard()` → renders every card's page offscreen (mirroring `renderAllPages`), composites each at its board rect plus text/arrows onto one canvas, downloads `board.png`.

- [ ] **Step 1: Expose each page's payload via `getPageMeta()`**

`exportBoard()` needs each page's full payload to re-render its scene offscreen. Modify the `getPageMeta()` added in Task 3 (`src/features/pages.js`) to include `payload` (additive — Task 3's renderBoard only reads `thumb`/`w`/`h`, so adding `payload` is safe):

```js
export function getPageMeta() {
  return pages.map(p => {
    const c = (p.payload && p.payload.design && p.payload.design.canvas) || { width: 1280, height: 720 };
    return { id: p.id, thumb: p.thumb, w: c.width, h: c.height, payload: p.payload };
  });
}
```

- [ ] **Step 2: Implement `exportBoard()` (complete)**

Add to `src/features/board.js`. It composites every card's page (re-rendered offscreen via the existing `applyDesignToState` + `renderInto`, exactly as `renderAllPages` does) at its board rect, plus text and arrows, onto one canvas, then downloads `board.png`. It saves and restores the live editor state so the board is unchanged after export. Use dynamic imports for `renderInto`/`applyDesignToState`/`applyPayload`/`serializeFull` to avoid a static import cycle with `render.js` (board.js already dynamically imports `render`).

```js
export async function exportBoard() {
  if (state.mode !== 'board') return;
  const objs = state.board.objects;
  const cards = objs.filter(o => o.kind === 'card');
  if (!cards.length) return;
  // Composite bounds in board px.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    if (o.kind === 'card' || o.kind === 'text') {
      minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
    }
  }
  const pad = 32;
  const W = Math.ceil(maxX - minX) + pad * 2, H = Math.ceil(maxY - minY) + pad * 2;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, W, H);

  const { renderInto } = await import('../render/render.js');
  const { applyDesignToState, applyPayload } = await import('./document.js');
  const { serializeFull } = await import('../state/serialize.js');
  const saved = serializeFull();
  const savedMode = state.mode;
  try {
    const meta = getPageMeta();
    for (const c of cards) {
      const m = meta.find(p => p.id === c.pageId);
      if (!m || !m.payload) continue;
      await applyDesignToState(m.payload);
      if (!state.image) continue;
      const scene = document.createElement('canvas');
      renderInto(scene, true);                 // renders at state.canvas size
      ctx.drawImage(scene, c.x - minX + pad, c.y - minY + pad, c.w, c.h);
      await new Promise(r => setTimeout(r, 0)); // yield so large boards don't freeze
    }
    for (const o of objs) {                     // text overlays
      if (o.kind !== 'text') continue;
      ctx.fillStyle = o.color || '#fff';
      ctx.font = `${o.fontSize || 24}px Geist, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(o.text || '', o.x - minX + pad, o.y - minY + pad);
    }
    for (const a of objs) {                     // arrows
      if (a.kind !== 'arrow') continue;
      const f = objs.find(o => o.id === a.from), t = objs.find(o => o.id === a.to);
      if (!f || !t) continue;
      ctx.strokeStyle = a.color || '#4f7cff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x + f.w / 2 - minX + pad, f.y + f.h / 2 - minY + pad);
      ctx.lineTo(t.x + t.w / 2 - minX + pad, t.y + t.h / 2 - minY + pad);
      ctx.stroke();
    }
  } finally {
    state.mode = savedMode;
    applyPayload(saved);   // restore the live editor (decodes image, re-renders)
    if (state.mode === 'board') renderBoard();
  }
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'board.png';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Add a palette command for board export**

In `palette.js`:

```js
  { id: 'exportBoard', label: 'Board: export PNG', icon: 'download', group: 'Export',
    run: () => import('./board.js').then(m => m.exportBoard()),
    when: () => state.mode === 'board' },
```

- [ ] **Step 4: Verify in-browser**

1. Board mode, ≥2 cards arranged with one text label and one arrow.
2. Cmd+K → "Board: export PNG". Expected: a `board.png` downloads; opening it shows both card scenes composited at their board positions, plus the text and arrow, on a dark background.
3. After export, the board is unchanged (live state restored).

- [ ] **Step 5: Commit**

```bash
git add src/features/board.js src/features/pages.js src/features/palette.js
git commit -m "feat(v32): composite board export to PNG" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Persistence — board in the document + DOC_VERSION migration

**Files:**
- Modify: `src/features/pages.js` (`DOC_VERSION` 13→14, `serializeDocument`/`applyDocument`, `migrateBoardV14`)

**Interfaces:**
- Produces: `serializeDocument()` includes `board` (objects only; camera stripped); `applyDocument()` restores it; `migrateBoardV14(doc)` wraps pre-v32 documents with default cards.

- [ ] **Step 1: Bump DOC_VERSION and add the migration**

In `src/features/pages.js`, change:

```js
const DOC_VERSION = 13;
```

to:

```js
const DOC_VERSION = 14;
```

Add the migration (before `serializeDocument`):

```js
// v32 — schema 14 migration: wrap a pre-v32 document (no board) with a default
// board layout. One page -> one centered card; many pages -> a default grid.
// `card` objects ref pages[i].id. Camera reset to origin/100%.
export function migrateBoardV14(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc.board) || (doc.board && Array.isArray(doc.board.objects))) {
    // ensure camera exists
    if (!doc.board.camera) doc.board.camera = { x: 0, y: 0, zoom: 1 };
    return doc;
  }
  const ps = doc.pages || [];
  const colW = 280, gap = 24, cols = 4;
  const objects = [];
  let row = 0, col = 0;
  for (const p of ps) {
    const c = (p.payload && p.payload.design && p.payload.design.canvas) || { width: 1280, height: 720 };
    const ar = c.h / c.w;
    const w = colW, h = Math.round(colW * ar);
    objects.push({ id: Date.now()*1000 + Math.floor(Math.random()*1000) + objects.length,
      kind: 'card', pageId: p.id, x: 60 + col*(colW+gap), y: 60 + row*(h+gap+28), w, h, z: objects.length });
    col = (col + 1) % cols; if (col === 0) row++;
  }
  doc.board = { objects, camera: { x: 0, y: 0, zoom: 1 } };
  return doc;
}
```

- [ ] **Step 2: Serialize the board**

Update `serializeDocument()`:

```js
export function serializeDocument() {
  syncActive();
  return {
    docVersion: DOC_VERSION,
    active,
    pages: pages.map(p => ({ id: p.id, payload: p.payload, thumb: p.thumb })),
    board: { objects: JSON.parse(JSON.stringify(state.board.objects)), camera: { ...state.board.camera } }
  };
}
```

- [ ] **Step 3: Restore the board on load + run the migration**

Update `applyDocument()` to migrate and restore the board:

```js
export function applyDocument(doc) {
  let d = doc;
  if (!d || !Array.isArray(d.pages)) {
    d = { docVersion: DOC_VERSION, active: 0, pages: [{ id: uid(), payload: doc, thumb: null }] };
  }
  d = migrateBoardV14(d);
  pages = d.pages.map(p => ({ id: p.id || uid(), payload: p.payload, thumb: p.thumb || null }));
  if (!pages.length) pages = [{ id: uid(), payload: serializeFull(), thumb: null }];
  active = Math.min(Math.max(0, d.active | 0), pages.length - 1);
  state.board = d.board || { objects: [], camera: { x: 0, y: 0, zoom: 1 } };
  if (!state.board.camera) state.board.camera = { x: 0, y: 0, zoom: 1 };
  state.boardSelection = [];
  applyPayload(pages[active].payload);
  renderFilmstrip();
}
```

- [ ] **Step 4: Verify in-browser**

1. Board mode: arrange several cards, add a text label and an arrow. Save the project (Projects → Save), then reload the page and open the project.
2. Expected: the board reopens with the same card positions, text, and arrow. (If the project UI auto-loads the last project, confirm the board matches; otherwise load it from the Projects list.)
3. Open a pre-v32 project (any saved project from before this change, docVersion 13). Expected: it loads without error; entering board mode shows its page(s) as a default-grid card layout (migration ran).
4. Confirm undo of a scene edit (inside a card) still works and does not wipe the board layout.

- [ ] **Step 5: Commit**

```bash
git add src/features/pages.js
git commit -m "feat(v32): persist board layout in the document (DOC_VERSION 14)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (run after writing; fix inline)

- **Spec coverage:** Board object model + camera (§3.2) → Tasks 1-2. Cards from pages (§3.2) → Task 3. Selection (§3.3) → Tasks 4,6. Open-in-editor + thumb refresh (§3.2) → Task 5. Undo/persistence (§3.4, §3.5) → Task 9 (board NOT in snapshot, consistent with page ops; DOC_VERSION bump, migration). Export (§3.2) → Task 8. Text/arrows/groups (§3.1) → Task 7. **Board foundation is fully covered.** Seed (§4), Control (§5), marketing/changelog (§7) are explicitly staged as follow-on plans — not gaps in this plan.
- **Placeholder scan:** No "TODO"/"implement later"/"handle edge cases" steps remain. Task 8 is now two clean steps (extend `getPageMeta` with `payload`, then the complete `exportBoard`) — no deliberate gap.
- **Type consistency:** `state.board.objects[*].id` is a Number (from `nextId()`); `state.boardSelection` refs use `{kind:'boardObject', id}` with matching Number ids; `getPageMeta()` returns `{id, thumb, w, h, payload}` used consistently in Tasks 3,7,8; `resolveBoardRef`/`hitTopBoardRef` use `kind:'boardObject'` throughout. `enterBoardMode`/`exitBoardMode`/`returnToBoard`/`toggleBoardMode` named consistently. `bindCardEvents` defined in Task 3; `dragSelection` defined in Task 7 Step 4 and used by both card and text mousedown. `deletePage`/`switchTo`/`indexOfPage`/`getPageMeta` imported where used.
- **Note for the implementer:** Task 7 Step 4 replaces Task 4's `onCardMouseDown` body and extracts `dragSelection` — apply it as written. Task 8 Step 1 additively modifies the `getPageMeta` added in Task 3. `applyDesignToState` is exported from `document.js` (line 17) and decodes `state.image`; `renderInto` early-returns when `state.image` is null, which is why `exportBoard` skips blank pages.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-v32-open-canvas-board-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. (Use Opus for subagents per CLAUDE.md.)

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
