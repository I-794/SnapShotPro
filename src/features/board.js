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

let surface = null;     // .board-surface (camera-transformed)
let viewport = null;    // #canvas-viewport
let toolbar = null;     // .board-toolbar

export function enterBoardMode() {
  state.mode = 'board';
  ensureSurface();
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

// Task 1 stub: show an empty-state hint. Task 3 replaces this with card layout.
export function renderBoard() {
  if (state.mode !== 'board') return;
  ensureSurface();
  if (!surface) return;
  applyCamera();
  if (!surface.querySelector('.board-empty')) {
    const empty = document.createElement('div');
    empty.className = 'board-empty';
    empty.textContent = state.image
      ? 'Board mode — cards arrive in Task 3.'
      : 'Upload a screenshot, then open the Board.';
    surface.appendChild(empty);
  }
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
}
