// v18 — Design Variations (Composer foundation).
//
// One-click generator: builds N candidate Design Specs from curated recipes,
// renders each to a thumbnail off-screen, and shows them as a pick-one gallery.
// Deterministic (no AI). Recipes draw tasteful, coherent combos from the
// existing preset/palette library so results look designed, not random. The
// spec applier (state/spec.js) and this gallery are reused by the v19 AI and
// the v20 agent.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render, renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { applySpec } from '../state/spec.js';
import { gradientPresets, meshPresets } from '../state/presets.js';

const N = 4;                    // variants per generation
const THUMB_MAX_EDGE = 400;     // thumbnail long-edge px

const GRAD_KEYS = Object.keys(gradientPresets);
const MESH_KEYS = Object.keys(meshPresets);
const FRAMES = ['iphone16pro', 'macbookpro', 'pixel', 'winlaptop', 'chrome', 'safari'];
const PATTERNS = ['dots', 'grid', 'lines', 'checker', 'diagonal'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Each recipe returns a Design Spec with a human name. Bounded randomization
// keeps variety while staying tasteful.
const RECIPES = {
  'Soft Gradient': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Soft Gradient', bg: { mode: 'gradient', gradient: { colors: [...g.colors], type: 'linear', angle: pick([120, 135, 160, 200]) } }, frame: { type: null }, layout: { padding: pick([60, 80, 100]), scale: 100, borderRadius: pick([12, 16, 20]) }, shadow: pick(['soft', 'medium']), filter: 'none' };
  },
  'Bold Mesh': () => {
    const m = meshPresets[pick(MESH_KEYS)];
    return { name: 'Bold Mesh', bg: { mode: 'mesh', mesh: [...m] }, frame: { type: null }, layout: { padding: pick([70, 90]), scale: 100, borderRadius: pick([14, 18, 24]) }, shadow: 'medium', filter: pick(['none', 'vivid']) };
  },
  'Clean Solid': () => {
    const solids = ['#0b0d14', '#11131c', '#1a1a2e', '#f4f4f6', '#e7e7ea', '#101317'];
    return { name: 'Clean Solid', bg: { mode: 'solid', solid: pick(solids) }, frame: { type: null }, layout: { padding: pick([80, 100, 120]), scale: 100, borderRadius: pick([10, 14]) }, shadow: pick(['soft', 'hard']), filter: 'none' };
  },
  'Device Hero': () => {
    const bg = pick([
      { mode: 'gradient', gradient: { colors: [...gradientPresets[pick(GRAD_KEYS)].colors], type: 'linear', angle: 135 } },
      { mode: 'mesh', mesh: [...meshPresets[pick(MESH_KEYS)]] }
    ]);
    return { name: 'Device Hero', bg, frame: { type: pick(FRAMES), color: pick(['dark', 'graphite', 'silver', 'titanium']) }, layout: { padding: pick([50, 70]), scale: 100, borderRadius: 0 }, shadow: 'medium', filter: 'none' };
  },
  'Pattern Pop': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Pattern Pop', bg: { mode: 'pattern', pattern: { type: pick(PATTERNS), fg: g.colors[0], bg: g.colors[1], size: pick([20, 28, 36]), angle: pick([0, 45]) } }, frame: { type: null }, layout: { padding: pick([70, 90]), scale: 100, borderRadius: pick([12, 18]) }, shadow: 'soft', filter: 'none' };
  },
  'Cinematic': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Cinematic', bg: { mode: 'gradient', gradient: { colors: [...g.colors], type: pick(['linear', 'radial']), angle: pick([135, 180, 200]) } }, frame: { type: null }, layout: { padding: pick([60, 80]), scale: 100, borderRadius: pick([14, 20]) }, shadow: 'medium', filter: pick(['tealorange', 'moody', 'golden', 'bleach', 'vintage']) };
  }
};
const RECIPE_NAMES = Object.keys(RECIPES);

function generateSpecs(n) {
  const names = [...RECIPE_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map(name => RECIPES[name]());
}

// Snapshot/restore only the keys applySpec touches, so previewing a candidate
// never disturbs the user's real design.
const SPEC_KEYS = ['bgMode', 'gradient', 'meshGradient', 'bgColor', 'pattern', 'deviceFrame', 'padding', 'scale', 'borderRadius', 'shadow', 'imageFilters', 'colorMap'];
function snapshotKeys() {
  const s = {};
  for (const k of SPEC_KEYS) s[k] = JSON.parse(JSON.stringify(state[k]));
  s.activePalette = state.colorPalettes.active;
  return s;
}
function restoreKeys(s) {
  for (const k of SPEC_KEYS) state[k] = s[k];
  state.colorPalettes.active = s.activePalette;
}

// Render a candidate spec to a thumbnail dataURL via the real render pipeline.
// Returns null if the canvas is tainted (cross-origin image) — caller shows a
// solid fallback tile.
function renderThumb(spec) {
  const snap = snapshotKeys();
  let url = null;
  try {
    applySpec(spec);
    const off = document.createElement('canvas');
    renderInto(off, true);                       // sizes itself to state.canvas
    const r = Math.min(1, THUMB_MAX_EDGE / Math.max(off.width, off.height));
    const tw = Math.max(1, Math.round(off.width * r));
    const th = Math.max(1, Math.round(off.height * r));
    const thumb = document.createElement('canvas');
    thumb.width = tw; thumb.height = th;
    thumb.getContext('2d').drawImage(off, 0, 0, tw, th);
    url = thumb.toDataURL('image/png');
  } catch (e) {
    url = null;
  } finally {
    restoreKeys(snap);
  }
  return url;
}

function fallbackColor(spec) {
  if (spec.bg?.solid) return spec.bg.solid;
  if (spec.bg?.gradient?.colors?.[0]) return spec.bg.gradient.colors[0];
  if (spec.bg?.mesh?.[0]) return spec.bg.mesh[0];
  if (spec.bg?.pattern?.bg) return spec.bg.pattern.bg;
  return '#1a1a2e';
}

function applyVariant(spec, card) {
  saveStateToHistory();
  applySpec(spec);
  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  el.varyGrid.querySelectorAll('.vary-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  showNotification(`Applied "${spec.name}".`, 'success');
}

function renderGallery(specs) {
  if (!el.varyGrid) return;
  el.varyGrid.innerHTML = '';
  specs.forEach(spec => {
    const url = renderThumb(spec);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vary-card';
    card.innerHTML = url
      ? `<img src="${url}" alt="${spec.name} variation"><span class="vary-card-label">${spec.name}</span>`
      : `<span class="vary-card-fallback" style="background:${fallbackColor(spec)}"></span><span class="vary-card-label">${spec.name}</span>`;
    card.addEventListener('click', () => applyVariant(spec, card));
    el.varyGrid.appendChild(card);
  });
  if (el.varyShuffle) el.varyShuffle.style.display = 'block';
}

function generate() {
  if (!state.image) { showNotification('Load an image first.', 'error'); return; }
  renderGallery(generateSpecs(N));
}

export function bindCompose() {
  el.varyGenerate?.addEventListener('click', generate);
  el.varyShuffle?.addEventListener('click', generate);
}
