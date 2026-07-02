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
import { resolveBoardRef, clearBoardSelection, selectBoardOnly, toggleBoardRef, hitTopBoardRef, groupBounds } from './board-tools.js';
import { pageCount, getPageMeta, indexOfPage, onDocumentChange, switchTo, syncActivePage, deletePage } from './pages.js';
import { isTypingTarget } from '../utils/dom.js';
import { showNotification } from '../ui/notification.js';

let surface = null;     // .board-surface (camera-transformed)
let viewport = null;    // #canvas-viewport
let toolbar = null;     // .board-toolbar
let spaceDown = false;   // true while Space is held (board pan). Hoisted to module scope so the card/empty-surface mousedown handlers can early-return and let the pan handler run.

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
  // Refresh the active page's thumb if entering from single mode (where edits
  // happen), so the card isn't stale. Skipped for set/batch origins.
  if (state.mode === 'single') syncActivePage();
  state.mode = 'board';
  ensureSurface();
  ensureCards();
  showBoardChrome(true);
  if (_returnPill) _returnPill.style.display = 'none';
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

// v32 — visual teardown of the board surface/toolbar/pill + restore the hidden
// single-canvas wrapper/upload-zone, WITHOUT changing state.mode (the caller —
// set-ui.js setMode — sets the new mode). Mirrors the v25 tour teardown.
export function teardownBoardChrome() {
  showBoardChrome(false);
  if (el.canvasWrapper) el.canvasWrapper.style.display = '';
  if (el.uploadZone) el.uploadZone.style.display = '';
  if (_returnPill) _returnPill.style.display = 'none';
}

export function toggleBoardMode() {
  if (state.mode === 'board') exitBoardMode();
  else enterBoardMode();
}

let _returnPill = null;

export function returnToBoard() {
  // Coming back from editing a card: force-refresh the active page's thumb now
  // (the onHistoryChange->renderFilmstrip->makeThumb chain is debounced 600ms,
  // so without this a fast edit-then-return would show a stale card thumb).
  if (state.mode === 'board') return;
  syncActivePage();
  state.mode = 'board';
  ensureCards();
  showBoardChrome(true);
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  if (el.uploadZone) el.uploadZone.style.display = 'none';
  if (_returnPill) _returnPill.style.display = 'none';
  renderBoard();
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
    <button class="board-text-add" title="Add text">Text</button>
    <button class="board-connect" title="Connect two cards (click from → to)">Connect</button>
    <button class="board-group" title="Group selected">Group</button>
    <button class="board-fit" title="Fit board to screen">Fit</button>
    <button class="board-reset" title="Reset zoom">Reset</button>
    <span class="board-zoom-label">100%</span>`;
  toolbar.querySelector('.board-back').addEventListener('click', exitBoardMode);
  toolbar.querySelector('.board-fit').addEventListener('click', fitBoard);
  toolbar.querySelector('.board-reset').addEventListener('click', resetBoard);
  toolbar.querySelector('.board-text-add').addEventListener('click', addBoardText);
  toolbar.querySelector('.board-connect').addEventListener('click', startConnectMode);
  toolbar.querySelector('.board-group').addEventListener('click', groupSelected);

  surface = document.createElement('div');
  surface.className = 'board-surface';
  surface.style.display = 'none';

  viewport.appendChild(toolbar);
  viewport.appendChild(surface);

  if (!_returnPill) {
    _returnPill = document.createElement('button');
    _returnPill.className = 'board-return-pill';
    _returnPill.textContent = '← Back to board';
    _returnPill.style.display = 'none';
    _returnPill.addEventListener('click', returnToBoard);
    viewport.appendChild(_returnPill);
  }
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

// fitBoard() fits to content bounds (the card/text bbox from contentBounds()).
// When there are no cards/text yet, fall back to origin/100%.
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

// v32 Task 7 — add a text node, selected ready to drag/edit.
export function addBoardText() {
  const vp = el.canvasViewport.getBoundingClientRect();
  const center = screenToBoard(vp.left + vp.width / 2, vp.top + vp.height / 2);
  const o = { id: nextId(), kind: 'text',
    x: Math.round(center.x - 120), y: Math.round(center.y - 20), w: 240, h: 40,
    text: 'Label', fontSize: 24, color: '#ffffff', z: state.board.objects.length };
  state.board.objects.push(o);
  selectBoardOnly({ kind: 'boardObject', id: o.id });
  renderBoard();
}

// v32 Task 7 — two-click connect mode. Click a card (from), then another (to);
// an arrow is pushed. The first click is captured in onCardMouseDown via
// maybeConnect(); the zoom label doubles as the mode hint.
let connectMode = false;
let connectFrom = null;
function startConnectMode() {
  connectMode = true;
  connectFrom = null;
  const label = toolbar.querySelector('.board-zoom-label');
  if (label) label.textContent = 'click from → to';
}
// Two-click connect: triggered from onCardMouseDown.
function maybeConnect(id) {
  if (!connectMode) return false;
  if (connectFrom == null) { connectFrom = id; return true; }
  if (connectFrom !== id) {
    state.board.objects.push({ id: nextId(), kind: 'arrow', from: connectFrom, to: id, color: '#4f7cff', z: state.board.objects.length });
  }
  connectFrom = null; connectMode = false;
  const label = toolbar.querySelector('.board-zoom-label');
  if (label) label.textContent = Math.round(state.board.camera.zoom * 100) + '%';
  renderBoard();
  return true;
}

// v32 Task 7 — group the current selection into one group object. The group's
// children keep their own ids/positions; the group is just a membership record
// (its box is derived in board-tools.groupBounds).
function groupSelected() {
  if (state.boardSelection.length < 2) return;
  const childIds = state.boardSelection.map(r => r.id);
  const g = { id: nextId(), kind: 'group', children: childIds, x: 0, y: 0, w: 0, h: 0, z: state.board.objects.length };
  state.board.objects.push(g);
  selectBoardOnly({ kind: 'boardObject', id: g.id });
  renderBoard();
}

// v32 Task 7 — reusable drag-move of the whole selection via the uniform
// resolveBoardRef(...).moveBy handle, so cards, text, AND groups all drag (a
// group's moveBy translates its children). Extracted from onCardMouseDown.
function dragSelection(e) {
  const start = screenToBoard(e.clientX, e.clientY);
  // Drop refs that are children of a selected group — the group's moveBy already
  // translates them, so including them would double-move the child.
  const groupIds = new Set(state.boardSelection.map(r => r.id));
  const childOfSelectedGroup = (id) => state.board.objects.some(
    o => o.kind === 'group' && groupIds.has(o.id) && o.children.includes(id)
  );
  const refs = state.boardSelection.filter(r => !childOfSelectedGroup(r.id));
  const origs = refs.map(r => {
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
      const h = resolveBoardRef(or.ref);          // live handle (re-read each move)
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

// v32 Task 7 — the SVG connector overlay (one <svg> over the surface; arrows
// are redrawn from state.board.objects on every renderBoard).
function ensureOverlay() {
  if (!surface) return null;
  let svg = surface.querySelector('.board-connectors');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'board-connectors');
    surface.appendChild(svg);
  }
  return svg;
}

// v32 — render cards from state.board.objects (text/arrows come in Task 7).
export function renderBoard() {
  if (state.mode !== 'board') return;
  ensureSurface();
  if (!surface) return;
  applyCamera();

  // Build/reconcile card nodes by id.
  const cards = state.board.objects.filter(o => o.kind === 'card');
  const allMeta = getPageMeta();
  const seen = new Set();
  for (const o of cards) {
    seen.add(o.id);
    let node = surface.querySelector(`.board-card[data-id="${o.id}"]`);
    const meta = allMeta.find(m => m.id === o.pageId);
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

  // Text nodes.
  const texts = state.board.objects.filter(o => o.kind === 'text');
  const textSeen = new Set();
  for (const o of texts) {
    textSeen.add(o.id);
    let n = surface.querySelector(`.board-text[data-id="${o.id}"]`);
    if (!n) {
      n = document.createElement('div');
      n.className = 'board-text';
      n.dataset.id = String(o.id);
      surface.appendChild(n);
    }
    n.style.left = o.x + 'px'; n.style.top = o.y + 'px';
    n.style.width = o.w + 'px'; n.style.fontSize = (o.fontSize || 24) + 'px';
    n.style.color = o.color || '#fff';
    n.textContent = o.text || '';
    n.style.zIndex = o.z;
  }
  surface.querySelectorAll('.board-text').forEach(n => {
    if (!textSeen.has(Number(n.dataset.id))) n.remove();
  });

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
      m.id = 'board-arrowhead'; m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '8');
      m.setAttribute('refX', '6'); m.setAttribute('refY', '4'); m.setAttribute('orient', 'auto');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0,0 L8,4 L0,8 z'); p.setAttribute('fill', '#4f7cff');
      m.appendChild(p); svg.appendChild(m);
    }
    // Group bounding boxes (drawn always so groups are findable; brighter when selected).
    const groups = state.board.objects.filter(o => o.kind === 'group');
    for (const g of groups) {
      const b = groupBounds(g);
      if (!b.w || !b.h) continue;
      const isSel = state.boardSelection.some(r => r.id === g.id);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', b.x); rect.setAttribute('y', b.y);
      rect.setAttribute('width', b.w); rect.setAttribute('height', b.h);
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', isSel ? 'var(--accent-primary, #4f7cff)' : 'rgba(154,156,168,0.5)');
      rect.setAttribute('stroke-width', isSel ? '2' : '1.5');
      rect.setAttribute('stroke-dasharray', '6 4');
      rect.setAttribute('rx', '8');
      svg.appendChild(rect);
    }
  }

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
function onCardMouseDown(e, node) {
  // Space is held: defer entirely to the viewport camera-pan handler (don't
  // select/drag the card; don't stopPropagation, so the event bubbles up).
  if (spaceDown) return;
  if (e.button !== 0) return;
  const id = Number(node.dataset.id);
  // v32 Task 7 — two-click connect mode: this click just records from/to.
  if (connectMode) { maybeConnect(id); return; }
  const ref = { kind: 'boardObject', id };
  if (e.shiftKey) toggleBoardRef(ref);
  else if (!state.boardSelection.some(r => r.id === id)) selectBoardOnly(ref);
  // If this card isn't in the (possibly shift-toggled) selection, don't move.
  if (!state.boardSelection.some(r => r.id === id)) { updateSelectionChrome(); return; }
  updateSelectionChrome();
  dragSelection(e);
  e.stopPropagation();
}

function raiseLatestToTop() {
  const sel = state.boardSelection;
  if (!sel.length) return;
  resolveBoardRef(sel[sel.length - 1])?.raiseToFront();
  renderBoard();
}

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
function onCardDoubleClick(e, node) {
  const pageId = Number(node.dataset.pageId);
  const idx = indexOfPage(pageId);
  if (idx < 0) return;
  switchTo(idx);
  state.mode = 'single';
  showBoardChrome(false);
  if (el.canvasWrapper) el.canvasWrapper.style.display = '';
  if (el.uploadZone) el.uploadZone.style.display = '';
  if (_returnPill) _returnPill.style.display = '';
  import('../render/render.js').then(({ render }) => render());
}
function updateSelectionChrome() {
  surface.querySelectorAll('.board-card, .board-text').forEach(n => {
    const sel = state.boardSelection.some(r => r.id === Number(n.dataset.id));
    n.classList.toggle('selected', sel);
  });
  // Resize handle only on the SOLE-selected CARD (text wraps to width; no handle in v1).
  surface.querySelectorAll('.board-card').forEach(n => {
    const sel = state.boardSelection.some(r => r.id === Number(n.dataset.id));
    const sole = sel && state.boardSelection.length === 1;
    let h = n.querySelector('.board-resize');
    if (sole && !h) {
      h = document.createElement('div'); h.className = 'board-resize'; n.appendChild(h);
      h.addEventListener('mousedown', (e) => onResizeStart(e, n));
    } else if (!sole && h) { h.remove(); }
  });
}

// v32 Task 6 — marquee rubber-band multi-select. The marquee box lives inside
// the camera-transformed surface, so its left/top/width/height are in BOARD px;
// we read them back with parseFloat (no getBoundingClientRect needed).
function startMarquee(e) {
  const start = screenToBoard(e.clientX, e.clientY);
  const box = document.createElement('div');
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
    // Compute the marquee rect in board px from the DOM box (already in board
    // coords because .board-marquee lives inside the camera-transformed surface).
    const bx = parseFloat(box.style.left) || 0;
    const by = parseFloat(box.style.top) || 0;
    const bw = parseFloat(box.style.width) || 0;
    const bh = parseFloat(box.style.height) || 0;
    box.remove();
    if (bw < 3 && bh < 3) { return; }   // a click, not a drag — keep the clear from the handler
    const hits = state.board.objects.filter(o =>
      (o.kind === 'card' || o.kind === 'text') &&
      o.x < bx + bw && o.x + o.w > bx && o.y < by + bh && o.y + o.h > by
    ).map(o => ({ kind: 'boardObject', id: o.id }));
    state.boardSelection = hits;
    updateSelectionChrome();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// v32 Task 6 — delete the current board selection. Cards remove their board
// object now (instant) AND delete the underlying page; the onDocumentChange sync
// would drop the card too, but resolving+removing first avoids the 200ms wait.
function deleteBoardSelection() {
  for (const ref of [...state.boardSelection]) {
    const o = state.board.objects.find(x => x.id === ref.id);
    if (!o) continue;
    if (o.kind === 'card') {
      const idx = indexOfPage(o.pageId);
      // Remove the board object now (instant) ONLY if the page is actually
      // deletable (pages.js keeps >= 1 page). Otherwise deletePage no-ops and
      // the card must stay, else it would vanish then pop back 200ms later.
      if (pageCount() > 1) resolveBoardRef(ref)?.remove();
      if (idx >= 0) deletePage(idx);
    } else {
      resolveBoardRef(ref)?.remove();
    }
  }
  // Prune stale ids left in groups' children and arrows' from/to by the deletions above.
  const liveIds = new Set(state.board.objects.map(o => o.id));
  for (const o of state.board.objects) {
    if (o.kind === 'group') o.children = o.children.filter(cid => liveIds.has(cid));
  }
  state.board.objects = state.board.objects.filter(o =>
    o.kind !== 'arrow' || (liveIds.has(o.from) && liveIds.has(o.to))
  );
  state.boardSelection = [];
  renderBoard();
}

// v32 Task 8 — composite board export to PNG. Re-renders every card's page
// offscreen (applyDesignToState + renderInto, exactly as pages.js renderAllPages
// does) at its board rect, plus text and arrows (NOT group bboxes — those are
// editor chrome), onto one canvas, then downloads board.png. The live editor
// state is saved (serializeFull) and restored (applyDesignToState, NOT
// applyPayload — that calls showCanvasUI and would un-hide #canvas-wrapper in
// board mode) so the board is
// unchanged after export. Dynamic imports avoid a static cycle with render.js
// (board.js already dynamic-imports render elsewhere); board/mode are not in
// PROJECT_FIELDS, so the per-card applyDesignToState leaves state.board/mode
// untouched while the captured objs/cards refs stay valid.
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
  const { applyDesignToState } = await import('./document.js');
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
      const fx = f.x + f.w / 2 - minX + pad, fy = f.y + f.h / 2 - minY + pad;
      const tx = t.x + t.w / 2 - minX + pad, ty = t.y + t.h / 2 - minY + pad;
      const color = a.color || '#4f7cff';
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
      // Filled arrowhead at the 'to' end (matches the live SVG marker).
      const ang = Math.atan2(ty - fy, tx - fx);
      const head = 9;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - head * Math.cos(ang - Math.PI / 6), ty - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(tx - head * Math.cos(ang + Math.PI / 6), ty - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    const blob = await new Promise(res => out.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Export produced no image (canvas too large).');
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = 'board.png';
    document.body.appendChild(dl); dl.click(); dl.remove(); URL.revokeObjectURL(url);
    showNotification('Board exported as PNG.', 'success');
  } catch (e) {
    console.error(e);
    showNotification(`Board export failed: ${e.message || e}`, 'error');
  } finally {
    state.mode = savedMode;
    // Restore with applyDesignToState (NOT applyPayload): applyPayload calls
    // showCanvasUI()/showUploadUI(), which would un-hide #canvas-wrapper in
    // board mode and let the stale preview canvas show through the board.
    // applyDesignToState only restores state design + image (no DOM toggle);
    // renderBoard() then repaints the board surface.
    await applyDesignToState(saved);
    if (state.mode === 'board') renderBoard();
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
  let panning = false, sx = 0, sy = 0, ox = 0, oy = 0;

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

  // Empty-surface click: clear selection + (Task 6) marquee. Cards/toolbar are
  // excluded so clicks on them keep their own handlers (the card handler calls
  // stopPropagation, but this guard is belt-and-suspenders for the early-return
  // path where it does not).
  viewport.addEventListener('mousedown', (e) => {
    if (state.mode !== 'board' || e.button !== 0) return;
    if (spaceDown) return;   // space-pan: don't clear selection, let the camera pan
    if (e.target.closest('.board-card') || e.target.closest('.board-toolbar')) return;
    clearBoardSelection(); updateSelectionChrome();
    startMarquee(e);
  });

  // v32 Task 7 — text nodes are created dynamically, so drag them via
  // delegation on the surface. Also hit-tests GROUPS (which have no DOM node):
  // a click inside a group's bbox but outside every child selects the group.
  // stopPropagation keeps the viewport marquee/clear handler from also firing.
  surface.addEventListener('mousedown', (e) => {
    if (state.mode !== 'board') return;
    if (spaceDown) return;        // defer to the viewport camera-pan handler
    if (e.button !== 0) return;   // only left button selects/drags
    const textNode = e.target.closest('.board-text');
    if (textNode) {
      e.stopPropagation();
      const id = Number(textNode.dataset.id);
      const ref = { kind: 'boardObject', id };
      if (e.shiftKey) toggleBoardRef(ref); else selectBoardOnly(ref);
      updateSelectionChrome();
      dragSelection(e);
      return;
    }
    // No card/text DOM node under the cursor (their own handlers stopPropagation
    // on a normal left-click). Use the point hit-test to find a group whose bbox
    // contains the click but no child does — select + drag it. Acting on groups
    // ONLY avoids re-selecting a card that the card handler just shift-deselected
    // (that path returns without stopPropagation) and avoids interfering with
    // connect-mode card clicks (maybeConnect handles those).
    const gref = hitTopBoardRef(e.clientX, e.clientY);
    if (gref) {
      const obj = state.board.objects.find(o => o.id === gref.id);
      if (obj && obj.kind === 'group') {
        e.stopPropagation();
        if (e.shiftKey) toggleBoardRef(gref); else selectBoardOnly(gref);
        updateSelectionChrome();
        dragSelection(e);
      }
    }
    // else: truly empty surface — let it bubble to the viewport marquee/clear handler.
  });

  // Double-click a text node to edit its content (delegated, since text nodes are
  // created dynamically and have no per-node listener).
  surface.addEventListener('dblclick', (e) => {
    if (state.mode !== 'board') return;
    const textNode = e.target.closest('.board-text');
    if (!textNode) return;
    const id = Number(textNode.dataset.id);
    const o = state.board.objects.find(x => x.id === id);
    if (!o || o.kind !== 'text') return;
    const next = window.prompt('Text', o.text || '');
    if (next != null) { o.text = next; renderBoard(); }
  });

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
      // Add a card for any new page that lacks one. ensureCards() skips pages
      // that already have a card (advancing the grid cursor) and places new
      // cards at the next free cell, instead of stacking them on (60,60).
      ensureCards();
      renderBoard();
    }, 200);
  });

  // Delete/Backspace removes selected board objects (cards delete their page too).
  window.addEventListener('keydown', (e) => {
    if (state.mode !== 'board') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTypingTarget(e.target) && state.boardSelection.length) {
      e.preventDefault();
      deleteBoardSelection();
    }
  });

  // v32 — expose board teardown/exit to set-ui.js (setMode) and keyboard.js (Esc)
  // via globals, mirroring the v25 window.__exitTourMode pattern, to avoid import
  // cycles (board.js dynamic-imports render.js).
  window.__teardownBoardChrome = teardownBoardChrome;
  window.__exitBoardMode = exitBoardMode;
}
