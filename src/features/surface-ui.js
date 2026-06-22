// v27 — Surface Studio UI.
//
// Wires the "Physical & Print" sidebar section: pick a surface (t-shirt, mug,
// poster, framed print, business card, packaging box), choose a colour/material
// variant, and place the artwork (scale / offset / rotation / shading / shadow).
// Mutates state.surface and re-renders; the actual compositing lives in
// render/surfaces.js. Follows the bind* pattern (called once from main.js).

import { state } from '../state/state.js';
import { render } from '../render/render.js';
import { saveStateToHistory } from '../state/history.js';
import { showStatus } from '../ui/notification.js';

// Colour/material swatches per surface (paper goods print on white → no variant).
const VARIANTS = {
  tshirt: [
    ['white', '#f4f5f7'], ['black', '#1c1d21'], ['navy', '#23304d'],
    ['heather', '#9aa0aa'], ['sand', '#d9cfc0'], ['forest', '#27433a'], ['red', '#9e2b2b']
  ],
  mug: [['white', '#f4f5f7'], ['black', '#1c1d21'], ['navy', '#23304d']],
  poster: [], framedprint: [], businesscard: [], box: []
};

// One-click presets: surface + sensible canvas/background for a hero shot.
const PRESETS = {
  merch:     { type: 'tshirt', variant: 'black', canvas: { width: 1200, height: 1200 } },
  posterwall:{ type: 'poster', variant: 'white', canvas: { width: 1000, height: 1300 } },
  packaging: { type: 'box',    variant: 'white', canvas: { width: 1200, height: 1000 } }
};

const $ = (id) => document.getElementById(id);

function setSurface(type) {
  saveStateToHistory();
  if (!type) {
    state.surface.enabled = false;
  } else {
    state.surface.enabled = true;
    state.surface.type = type;
    // Surface owns the composition — clear the screen-mockup paths so they don't
    // fight it (the surface path is checked first anyway, this keeps UI honest).
    state.deviceFrame.type = null;
    if (state.mockup3d) state.mockup3d.enabled = false;
    if (state.scene) state.scene.id = '';
    // Default the variant to the first valid swatch for this surface.
    const list = VARIANTS[type] || [];
    if (list.length && !list.some(([k]) => k === state.surface.variant)) {
      state.surface.variant = list[0][0];
    }
  }
  render();
  refresh();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  saveStateToHistory();
  state.surface.enabled = true;
  state.surface.type = p.type;
  state.surface.variant = p.variant;
  state.surface.scale = 1; state.surface.offsetX = 0; state.surface.offsetY = 0; state.surface.rotation = 0;
  state.deviceFrame.type = null;
  if (state.mockup3d) state.mockup3d.enabled = false;
  if (state.scene) state.scene.id = '';
  if (p.canvas) state.canvas = { ...p.canvas };
  render();
  refresh();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  showStatus('Surface: ' + name);
}

// Reflect state.surface into the controls (tiles, variants, sliders). Exposed as
// window.__refreshSurfaceUi so updateUIFromState (templates/reset/project load)
// can resync without an import cycle.
function refresh() {
  const s = state.surface || {};
  const active = s.enabled ? s.type : '';

  document.querySelectorAll('[data-surface]').forEach((t) => {
    t.classList.toggle('active', (t.dataset.surface || '') === active);
  });

  const controls = $('surface-controls');
  if (controls) controls.style.display = s.enabled ? '' : 'none';

  // Variant swatches for the active surface.
  const vWrap = $('surface-variants');
  if (vWrap) {
    const list = (s.enabled && VARIANTS[s.type]) || [];
    if (vWrap.previousElementSibling) vWrap.previousElementSibling.style.display = list.length ? '' : 'none';
    vWrap.style.display = list.length ? 'flex' : 'none';
    vWrap.innerHTML = list.map(([key, col]) =>
      `<button type="button" class="surface-swatch${s.variant === key ? ' active' : ''}" data-surface-variant="${key}" title="${key}" style="width:26px;height:26px;border-radius:50%;background:${col};border:2px solid ${s.variant === key ? 'var(--accent,#2348ff)' : 'rgba(128,128,128,0.4)'};cursor:pointer;"></button>`
    ).join('');
  }

  const setRange = (id, val, label) => {
    const e = $(id); if (e) e.value = val;
    const l = $(id + '-value'); if (l) l.textContent = label;
  };
  setRange('surface-scale', s.scale ?? 1, Math.round((s.scale ?? 1) * 100) + '%');
  setRange('surface-offset-x', s.offsetX ?? 0, String(Math.round((s.offsetX ?? 0) * 100)));
  setRange('surface-offset-y', s.offsetY ?? 0, String(Math.round((s.offsetY ?? 0) * 100)));
  setRange('surface-rotation', s.rotation ?? 0, (s.rotation ?? 0) + '°');
  setRange('surface-shading', s.shadingOpacity ?? 0.85, Math.round((s.shadingOpacity ?? 0.85) * 100) + '%');
  const sh = $('surface-shadow'); if (sh) sh.checked = s.shadow !== false;
}

// Live slider: update on input (no history spam), snapshot once on change.
function bindRange(id, key, transform) {
  const e = $(id);
  if (!e) return;
  let snapped = false;
  e.addEventListener('pointerdown', () => { saveStateToHistory(); snapped = true; });
  e.addEventListener('input', () => {
    if (!snapped) { saveStateToHistory(); snapped = true; }
    state.surface[key] = transform ? transform(e.value) : parseFloat(e.value);
    render();
    refresh();
  });
  e.addEventListener('change', () => { snapped = false; });
}

export function bindSurfaceUi() {
  document.querySelectorAll('[data-surface]').forEach((tile) => {
    tile.addEventListener('click', () => setSurface(tile.dataset.surface || ''));
  });
  document.querySelectorAll('[data-surface-preset]').forEach((tile) => {
    tile.addEventListener('click', () => applyPreset(tile.dataset.surfacePreset));
  });

  // Variant swatches are rendered dynamically — delegate clicks.
  const vWrap = $('surface-variants');
  if (vWrap) {
    vWrap.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-surface-variant]');
      if (!btn) return;
      saveStateToHistory();
      state.surface.variant = btn.dataset.surfaceVariant;
      render();
      refresh();
    });
  }

  bindRange('surface-scale', 'scale');
  bindRange('surface-offset-x', 'offsetX');
  bindRange('surface-offset-y', 'offsetY');
  bindRange('surface-rotation', 'rotation', (v) => parseInt(v, 10));
  bindRange('surface-shading', 'shadingOpacity');

  const sh = $('surface-shadow');
  if (sh) {
    sh.addEventListener('change', () => {
      saveStateToHistory();
      state.surface.shadow = sh.checked;
      render();
    });
  }

  window.__refreshSurfaceUi = refresh;
  refresh();
}
