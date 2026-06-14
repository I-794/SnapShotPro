// v17 — Color Map.
//
// Palette-driven per-pixel grade. The actual pixel work lives in
// render/color-grade.js (so it bakes into every export); this module is just the
// panel: mode select (off / gradient-map / recolor / transfer), intensity, and
// posterize steps. It reads the active palette from state.colorPalettes and
// surfaces guidance when the chosen mode needs more swatches or an image.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';

function activeSwatches() {
  const cp = state.colorPalettes;
  if (!cp || !cp.active) return [];
  const p = cp.library && cp.library[cp.active];
  return (p && Array.isArray(p.swatches)) ? p.swatches : [];
}

// Min swatches a mode needs to do anything meaningful.
function minSwatches(mode) {
  if (mode === 'gradient' || mode === 'recolor') return 2;
  if (mode === 'transfer') return 1;
  return 0;
}

export function refreshColorMapUI() {
  const cm = state.colorMap;
  if (!cm) return;
  if (el.colorMapMode) el.colorMapMode.value = cm.mode || 'off';

  const on = cm.mode && cm.mode !== 'off';
  if (el.colorMapControls) el.colorMapControls.style.display = on ? 'block' : 'none';
  // Posterize steps only meaningful for the gradient-map / duotone mode.
  if (el.colorMapStepsRow) el.colorMapStepsRow.style.display = cm.mode === 'gradient' ? 'block' : 'none';

  if (el.colorMapIntensity) el.colorMapIntensity.value = cm.intensity ?? 100;
  if (el.colorMapIntensityValue) el.colorMapIntensityValue.textContent = (cm.intensity ?? 100) + '%';
  if (el.colorMapSteps) el.colorMapSteps.value = cm.steps ?? 6;
  if (el.colorMapStepsValue) el.colorMapStepsValue.textContent = String(cm.steps ?? 6);

  if (el.colorMapHint) {
    let hint = 'Maps your active palette onto the image. Bakes into exports.';
    if (on) {
      if (!state.image) hint = 'Load an image to use the Color Map.';
      else {
        const need = minSwatches(cm.mode);
        const have = activeSwatches().length;
        if (have < need) hint = `Select a palette with at least ${need} color${need > 1 ? 's' : ''}.`;
      }
    }
    el.colorMapHint.textContent = hint;
  }
}

export function bindColorMap() {
  el.colorMapMode?.addEventListener('change', e => {
    saveStateToHistory();
    state.colorMap.mode = e.target.value;
    refreshColorMapUI();
    render();
  });

  if (el.colorMapIntensity) {
    el.colorMapIntensity.addEventListener('input', e => {
      state.colorMap.intensity = parseInt(e.target.value, 10);
      if (el.colorMapIntensityValue) el.colorMapIntensityValue.textContent = state.colorMap.intensity + '%';
      render();
    });
    el.colorMapIntensity.addEventListener('change', () => saveStateToHistory());
  }
  if (el.colorMapSteps) {
    el.colorMapSteps.addEventListener('input', e => {
      state.colorMap.steps = parseInt(e.target.value, 10);
      if (el.colorMapStepsValue) el.colorMapStepsValue.textContent = String(state.colorMap.steps);
      render();
    });
    el.colorMapSteps.addEventListener('change', () => saveStateToHistory());
  }

  refreshColorMapUI();
}
