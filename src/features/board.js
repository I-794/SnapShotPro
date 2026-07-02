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
    empty.textContent = state.image
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
