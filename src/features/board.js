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
import { screenToBoard, clampZoom } from './board-tools.js';
import { pageCount, getPageMeta, indexOfPage, onDocumentChange } from './pages.js';

let surface = null;     // .board-surface (camera-transformed)
let viewport = null;    // #canvas-viewport
let toolbar = null;     // .board-toolbar

function nextId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }

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

export function enterBoardMode() {
  state.mode = 'board';
  ensureSurface();
  ensureCards();
  showBoardChrome(true);
  // Hide the single-canvas wrapper + upload zone while on the board.
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  if (el.uploadZone) el.uploadZone.style.display = 'none';
  renderBoard();
}

export function exitBoardMode() {
  state.mode = 'single';
  showBoardChrome(false);
  if (el.canvasWrapper) el.canvasWrapper.style.display = '';
  if (el.uploadZone) el.uploadZone.style.display = '';
  // Re-render the single-canvas scene.
  import('../render/render.js').then(({ render }) => render());
}

export function toggleBoardMode() {
  if (state.mode === 'board') exitBoardMode();
  else enterBoardMode();
}

function showBoardChrome(on) {
  if (surface) surface.style.display = on ? 'block' : 'none';
  if (toolbar) toolbar.style.display = on ? 'flex' : 'none';
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
  // zoom already fits content inside (vp - 2*pad), so centering yields exactly pad on the constraining axis — do NOT add + pad here.
  state.board.camera.x = (vp.width - b.w * zoom) / 2 - b.x * zoom;
  state.board.camera.y = (vp.height - b.h * zoom) / 2 - b.y * zoom;
  applyCamera();
}
export function resetBoard() { state.board.camera = { x: 0, y: 0, zoom: 1 }; applyCamera(); }

// v32 — render cards from state.board.objects (text/arrows come in Task 7).
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
    empty.textContent = state.image
      ? 'Board is empty.'
      : 'Upload a screenshot, then open the Board.';
  } else if (empty) { empty.remove(); }

  updateSelectionChrome();
}

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

export function bindBoard() {
  ensureSurface();
  if (!viewport) return;

  // Wheel zoom (no modifier needed on the board; Cmd/Ctrl also works).
  // Board-mode only: in single mode, defer to zoom-pan.js (Ctrl/Cmd+wheel) and
  // leave plain wheel/page-scroll untouched.
  viewport.addEventListener('wheel', (e) => {
    if (state.mode !== 'board') return;
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
}
