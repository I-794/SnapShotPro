// v13 — Multi-Page Canvas & Deck Mode.
//
// A project is a *document* of pages. Each page is a full design payload (v12
// serializeFull envelope), so switching pages = serialize the live one + apply
// the target. The render pipeline and every feature module stay untouched: they
// always operate on the single global `state`, which is just the active page's
// working copy.
//
// Deck Mode renders every page offscreen and exports a multi-page PDF or a
// numbered PNG ZIP, and presents the pages fullscreen.

import { state } from '../state/state.js';
import { render, renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { onHistoryChange } from '../state/history.js';
import { serializeFull } from '../state/serialize.js';
import { applyPayload, applyDesignToState, makeThumb, uid } from './document.js';

const DOC_VERSION = 14;

// pages: [{ id, payload, thumb }]. `active` indexes the live page; its payload
// is refreshed lazily (on switch / serialize / export) from global state.
let pages = [{ id: uid(), payload: serializeFull(), thumb: null }];
let active = 0;

// Document-change subscribers (projects.js registers its autosave here).
const changeListeners = [];
export function onDocumentChange(fn) { changeListeners.push(fn); }
function emitChange() { changeListeners.forEach(fn => { try { fn(); } catch (e) {} }); }

export function pageCount() { return pages.length; }

// v32 — board accessors. The board enumerates pages as cards and resolves a
// card's pageId back to an index for switchTo().
export function getPageMeta() {
  return pages.map(p => {
    const c = (p.payload && p.payload.design && p.payload.design.canvas) || { width: 1280, height: 720 };
    return { id: p.id, thumb: p.thumb, w: c.width, h: c.height, payload: p.payload };
  });
}

export function indexOfPage(id) {
  return pages.findIndex(p => p.id === id);
}

function syncActive() {
  pages[active].payload = serializeFull();
  pages[active].thumb = makeThumb() || pages[active].thumb;
}

// v32 — force-refresh the active page's payload + thumb now (no debounce), so
// returning to the board sees the latest edits. Used by board.js returnToBoard.
export function syncActivePage() {
  syncActive();
}

// ── Document (de)serialization — what projects.js persists ───────────────────
// v32 — schema 14 migration: wrap a pre-v32 document (no board) with a default
// board layout. One page -> one centered card; many pages -> a default grid.
// `card` objects ref pages[i].id. Camera reset to origin/100%.
export function migrateBoardV14(doc) {
  if (!doc) return doc;
  if (doc.board && Array.isArray(doc.board.objects)) {
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
    objects.push({ id: uid(), kind: 'card', pageId: p.id, x: 60 + col * (colW + gap), y: 60 + row * (h + gap + 28), w, h, z: objects.length });
    col = (col + 1) % cols; if (col === 0) row++;
  }
  doc.board = { objects, camera: { x: 0, y: 0, zoom: 1 } };
  return doc;
}

export function serializeDocument() {
  syncActive();
  return {
    docVersion: DOC_VERSION,
    active,
    pages: pages.map(p => ({ id: p.id, payload: p.payload, thumb: p.thumb })),
    board: { objects: JSON.parse(JSON.stringify(state.board.objects)), camera: { ...state.board.camera } }
  };
}

// Accept a v14 document (or a bare v12 single-page payload) and load it.
export function applyDocument(doc) {
  let d = doc;
  if (!d || !Array.isArray(d.pages)) {
    // Legacy v12 project payload (a single serializeFull envelope).
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

// ── Page operations ──────────────────────────────────────────────────────────
export function switchTo(index) {
  if (index === active || index < 0 || index >= pages.length) return;
  syncActive();
  active = index;
  applyPayload(pages[active].payload);
  renderFilmstrip();
  emitChange();
}

// New page inherits the current look (background, brand, size) but starts with
// no screenshot — the common deck case. Duplicate keeps the artwork too.
export function addPage({ duplicate = false } = {}) {
  syncActive();
  const base = JSON.parse(JSON.stringify(pages[active].payload));
  if (!duplicate) { base.image = null; base.svgCode = null; }
  pages.splice(active + 1, 0, { id: uid(), payload: base, thumb: duplicate ? pages[active].thumb : null });
  active += 1;
  applyPayload(pages[active].payload);
  renderFilmstrip();
  emitChange();
  showNotification(duplicate ? 'Page duplicated.' : 'Page added.', 'success');
  // v30 — Brand Brain enforcement: a freshly added page inherits the brand.
  if (state.brand && state.brand.enforce && state.brand.enabled) {
    import('./brand-brain.js').then(m => m.applyBrand());
  }
}

export function deletePage(index) {
  if (pages.length <= 1) { showNotification('A document needs at least one page.', 'error'); return; }
  if (index < 0 || index >= pages.length) return;
  pages.splice(index, 1);
  if (active >= pages.length) active = pages.length - 1;
  else if (index < active) active -= 1;
  applyPayload(pages[active].payload);
  renderFilmstrip();
  emitChange();
}

export function movePage(from, to) {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return;
  const [rec] = pages.splice(from, 1);
  pages.splice(to, 0, rec);
  active = pages.indexOf(rec);
  renderFilmstrip();
  emitChange();
}

// ── Offscreen render of every page (deck export + present) ───────────────────
async function renderAllPages(onProgress) {
  syncActive();
  const savedActive = active;
  const off = document.createElement('canvas');
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    await applyDesignToState(pages[i].payload);
    if (!state.image) { out.push(null); continue; } // skip blank pages
    renderInto(off, true);
    out.push({ dataUrl: off.toDataURL('image/jpeg', 0.92), w: off.width, h: off.height });
    if (onProgress) onProgress(i + 1, pages.length);
    await new Promise(r => setTimeout(r, 0));
  }
  // Restore the live editor to the page the user was on.
  active = savedActive;
  applyPayload(pages[active].payload);
  return out.filter(Boolean);
}

export async function exportDeckPDF() {
  if (!hasContent()) { showNotification('Add a screenshot to a page first.', 'error'); return; }
  setDeckStatus('Rendering deck…');
  try {
    const frames = await renderAllPages((d, n) => setDeckStatus(`Rendering ${d}/${n}…`));
    if (!frames.length) { setDeckStatus('Nothing to export.'); return; }
    const { jsPDF } = await import('jspdf');
    let pdf = null;
    frames.forEach((f, i) => {
      const orient = f.w >= f.h ? 'landscape' : 'portrait';
      if (i === 0) pdf = new jsPDF({ orientation: orient, unit: 'px', format: [f.w, f.h] });
      else pdf.addPage([f.w, f.h], orient);
      pdf.addImage(f.dataUrl, 'JPEG', 0, 0, f.w, f.h);
    });
    pdf.save(`deck-${Date.now()}.pdf`);
    setDeckStatus(`Exported ${frames.length} page${frames.length === 1 ? '' : 's'}.`);
    showNotification(`Deck exported as PDF (${frames.length} page${frames.length === 1 ? '' : 's'}).`, 'success');
  } catch (e) {
    console.error(e);
    setDeckStatus('Failed.');
    showNotification(`Deck PDF failed: ${e.message || e}`, 'error');
  }
}

export async function exportDeckZip() {
  if (!hasContent()) { showNotification('Add a screenshot to a page first.', 'error'); return; }
  setDeckStatus('Rendering deck…');
  try {
    const frames = await renderAllPages((d, n) => setDeckStatus(`Rendering ${d}/${n}…`));
    if (!frames.length) { setDeckStatus('Nothing to export.'); return; }
    const { zipSync } = await import('fflate');
    const entries = {};
    for (let i = 0; i < frames.length; i++) {
      const blob = await (await fetch(frames[i].dataUrl)).blob();
      entries[`page-${String(i + 1).padStart(2, '0')}.jpg`] = new Uint8Array(await blob.arrayBuffer());
    }
    const zipped = zipSync(entries, { level: 0 });
    const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url; a.download = `deck-${Date.now()}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDeckStatus(`Exported ${frames.length} page${frames.length === 1 ? '' : 's'}.`);
    showNotification(`Deck exported as ZIP (${frames.length} image${frames.length === 1 ? '' : 's'}).`, 'success');
  } catch (e) {
    console.error(e);
    setDeckStatus('Failed.');
    showNotification(`Deck ZIP failed: ${e.message || e}`, 'error');
  }
}

// ── Present mode (fullscreen slideshow) ──────────────────────────────────────
let presentFrames = [];
let presentIndex = 0;

export async function presentDeck() {
  if (!hasContent()) { showNotification('Add a screenshot to a page first.', 'error'); return; }
  setDeckStatus('Preparing…');
  presentFrames = await renderAllPages((d, n) => setDeckStatus(`Preparing ${d}/${n}…`));
  setDeckStatus('');
  if (!presentFrames.length) return;
  presentIndex = 0;
  const overlay = document.getElementById('present-overlay');
  if (!overlay) return;
  overlay.classList.add('visible');
  showPresentFrame();
  document.addEventListener('keydown', presentKeys);
}

function showPresentFrame() {
  const img = document.getElementById('present-image');
  const counter = document.getElementById('present-counter');
  if (img) img.src = presentFrames[presentIndex].dataUrl;
  if (counter) counter.textContent = `${presentIndex + 1} / ${presentFrames.length}`;
}
function presentNext() { if (presentIndex < presentFrames.length - 1) { presentIndex++; showPresentFrame(); } }
function presentPrev() { if (presentIndex > 0) { presentIndex--; showPresentFrame(); } }
function closePresent() {
  const overlay = document.getElementById('present-overlay');
  if (overlay) overlay.classList.remove('visible');
  document.removeEventListener('keydown', presentKeys);
}
function presentKeys(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); presentNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); presentPrev(); }
  else if (e.key === 'Escape') closePresent();
}

// ── Filmstrip UI ─────────────────────────────────────────────────────────────
function hasContent() { return Boolean(state.image) || pages.length > 1; }

function setDeckStatus(msg) {
  const s = document.getElementById('deck-status');
  if (s) s.textContent = msg || '';
}

export function renderFilmstrip() {
  const strip = document.getElementById('page-filmstrip');
  if (!strip) return;
  // Keep the active page's thumb fresh from the live canvas.
  if (pages[active]) pages[active].thumb = makeThumb() || pages[active].thumb;

  strip.style.display = hasContent() ? 'flex' : 'none';
  strip.innerHTML = pages.map((p, i) => `
    <div class="page-tile${i === active ? ' active' : ''}" draggable="true" data-idx="${i}">
      <div class="page-tile-thumb">${p.thumb ? `<img src="${p.thumb}" alt="">` : (i + 1)}</div>
      <span class="page-tile-num">${i + 1}</span>
      ${pages.length > 1 ? `<button class="page-tile-del" data-del="${i}" title="Delete page">✕</button>` : ''}
    </div>`).join('') +
    `<button class="page-tile page-add" id="page-add-tile" title="Add page">＋</button>`;

  strip.querySelectorAll('.page-tile[data-idx]').forEach(t => {
    t.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      switchTo(parseInt(t.dataset.idx, 10));
    });
    t.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', t.dataset.idx));
    t.addEventListener('dragover', (e) => e.preventDefault());
    t.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      movePage(from, parseInt(t.dataset.idx, 10));
    });
  });
  strip.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', (e) => { e.stopPropagation(); deletePage(parseInt(b.dataset.del, 10)); }));
  const addTile = document.getElementById('page-add-tile');
  if (addTile) addTile.addEventListener('click', () => addPage());
}

// ── Bind ─────────────────────────────────────────────────────────────────────
let stripTimer = null;
export function bindPages() {
  // Keep the active thumb + filmstrip fresh as the user edits (debounced).
  onHistoryChange(() => {
    clearTimeout(stripTimer);
    stripTimer = setTimeout(renderFilmstrip, 600);
  });

  const dup = document.getElementById('deck-duplicate-btn');
  const add = document.getElementById('deck-add-btn');
  const pdf = document.getElementById('deck-pdf-btn');
  const zip = document.getElementById('deck-zip-btn');
  const present = document.getElementById('deck-present-btn');
  if (add) add.addEventListener('click', () => addPage());
  if (dup) dup.addEventListener('click', () => addPage({ duplicate: true }));
  if (pdf) pdf.addEventListener('click', exportDeckPDF);
  if (zip) zip.addEventListener('click', exportDeckZip);
  if (present) present.addEventListener('click', presentDeck);

  const presentClose = document.getElementById('present-close');
  const presentPrevBtn = document.getElementById('present-prev');
  const presentNextBtn = document.getElementById('present-next');
  if (presentClose) presentClose.addEventListener('click', closePresent);
  if (presentPrevBtn) presentPrevBtn.addEventListener('click', presentPrev);
  if (presentNextBtn) presentNextBtn.addEventListener('click', presentNext);

  renderFilmstrip();
}
