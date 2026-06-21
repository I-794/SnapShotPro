// v13 — shared document helpers.
//
// A "page" is a single design payload (the v12 serializeFull envelope). These
// helpers apply one page payload onto the live editor, or onto state only (for
// offscreen deck rendering), and produce thumbnails. Kept DOM-aware but free of
// the pages/projects models so both pages.js and projects.js can import it
// without a cycle.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { render } from '../render/render.js';
import { normalizeProject } from '../state/serialize.js';

// Assign a page payload's design + image into global state WITHOUT touching the
// DOM or re-rendering. Returns a promise that resolves once the image (if any)
// has decoded. Used by the deck render loop, which renders to offscreen canvases.
export function applyDesignToState(payload) {
  const norm = normalizeProject(payload);
  Object.assign(state, norm.design);
  state.svgCode = norm.svgCode || null;
  return new Promise((resolve) => {
    if (norm.image) {
      const img = new Image();
      img.onload = () => { state.image = img; resolve(); };
      img.onerror = () => { resolve(); };
      img.src = norm.image;
    } else {
      state.image = null;
      resolve();
    }
  });
}

function showCanvasUI() {
  if (el.uploadZone) el.uploadZone.style.display = 'none';
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'block';
  if (el.annotationToolbar) el.annotationToolbar.style.display = 'flex';
  if (el.zoomControls) el.zoomControls.style.display = 'flex';
}

function showUploadUI() {
  if (el.uploadZone) el.uploadZone.style.display = '';
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
  if (el.annotationToolbar) el.annotationToolbar.style.display = 'none';
}

// Apply a page payload to the live editor: assign state, decode the image, then
// render + sync the sidebar controls. Toggles the upload zone for blank pages.
export function applyPayload(payload) {
  applyDesignToState(payload).then(() => {
    if (state.image) showCanvasUI(); else showUploadUI();
    render();
    if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
    // v24 — if this design is a code snippet, re-rasterize crisply from its
    // settings (the baked JPEG in the envelope is only a fallback).
    if (typeof window.__reapplyCodeSnippet === 'function') window.__reapplyCodeSnippet();
    // v25 — once state.tour reflects the applied step, refresh the Tour overlay +
    // sidebar (this .then runs AFTER Object.assign, unlike pages.js emitChange()).
    if (typeof window.__refreshTourUi === 'function') window.__refreshTourUi();
  });
}

// Downscale the live preview canvas to a small JPEG thumbnail (page/project cards).
export function makeThumb() {
  const src = el.previewCanvas;
  if (!src || !src.width) return null;
  try {
    const W = 320;
    const scale = W / src.width;
    const H = Math.max(1, Math.round(src.height * scale));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(src, 0, 0, W, H);
    return c.toDataURL('image/jpeg', 0.6);
  } catch (e) { return null; }
}

export function uid() {
  try { return crypto.randomUUID(); }
  catch (e) { return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
}
