// v16.1 — Studio Effects control wiring (liquid glass + film grain).
// Mirrors the reflection/spotlight binding style: input → mutate state + render,
// change → saveStateToHistory. The glass region itself is placed with the 🔮
// Glass tool (canvas-tools.js); these are the look controls.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { render } from '../render/render.js';
import { saveStateToHistory } from '../state/history.js';
import { BLEND_MODES } from '../render/blend.js';

function showGlass() { if (el.glassControls) el.glassControls.style.display = state.glass.enabled ? 'block' : 'none'; }
function showGrain() { if (el.grainControls) el.grainControls.style.display = state.grain.enabled ? 'block' : 'none'; }

// Reflect persisted glass/grain state into the controls after a load / undo.
export function refreshEffectsUI() {
  const g = state.glass, n = state.grain;
  if (el.glassEnabled) el.glassEnabled.checked = !!g.enabled;
  if (el.glassBlur) el.glassBlur.value = g.blur;
  if (el.glassBlurValue) el.glassBlurValue.textContent = g.blur;
  if (el.glassRadius) el.glassRadius.value = g.radius;
  if (el.glassRadiusValue) el.glassRadiusValue.textContent = g.radius;
  if (el.glassTint) el.glassTint.value = g.tint;
  if (el.glassTintOpacity) el.glassTintOpacity.value = g.tintOpacity;
  if (el.glassTintOpacityValue) el.glassTintOpacityValue.textContent = g.tintOpacity + '%';
  if (el.glassRim) el.glassRim.checked = g.rim !== false;
  if (el.grainEnabled) el.grainEnabled.checked = !!n.enabled;
  if (el.grainAmount) el.grainAmount.value = n.amount;
  if (el.grainAmountValue) el.grainAmountValue.textContent = n.amount + '%';
  if (el.grainScale) el.grainScale.value = Math.round((n.scale || 1) * 100);
  if (el.grainScaleValue) el.grainScaleValue.textContent = (n.scale || 1).toFixed(1) + '×';
  if (el.grainBlend) el.grainBlend.value = n.blend || 'overlay';
  if (el.grainMonochrome) el.grainMonochrome.checked = n.monochrome !== false;
  showGlass();
  showGrain();
}

export function bindEffects() {
  if (el.grainBlend) {
    el.grainBlend.innerHTML = BLEND_MODES.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    el.grainBlend.value = state.grain.blend || 'overlay';
  }

  // ── Glass ──
  if (el.glassEnabled) el.glassEnabled.addEventListener('change', () => {
    saveStateToHistory(); state.glass.enabled = el.glassEnabled.checked; showGlass(); render();
  });
  const glassSlider = (input, label, key, fmt) => {
    if (!input) return;
    input.addEventListener('input', () => {
      state.glass[key] = parseInt(input.value);
      if (label) label.textContent = fmt ? fmt(input.value) : input.value;
      render();
    });
    input.addEventListener('change', saveStateToHistory);
  };
  glassSlider(el.glassBlur, el.glassBlurValue, 'blur');
  glassSlider(el.glassRadius, el.glassRadiusValue, 'radius');
  glassSlider(el.glassTintOpacity, el.glassTintOpacityValue, 'tintOpacity', v => v + '%');
  if (el.glassTint) {
    el.glassTint.addEventListener('input', () => { state.glass.tint = el.glassTint.value; render(); });
    el.glassTint.addEventListener('change', saveStateToHistory);
  }
  if (el.glassRim) el.glassRim.addEventListener('change', () => {
    saveStateToHistory(); state.glass.rim = el.glassRim.checked; render();
  });

  // ── Grain ──
  if (el.grainEnabled) el.grainEnabled.addEventListener('change', () => {
    saveStateToHistory(); state.grain.enabled = el.grainEnabled.checked; showGrain(); render();
  });
  if (el.grainAmount) {
    el.grainAmount.addEventListener('input', () => {
      state.grain.amount = parseInt(el.grainAmount.value);
      if (el.grainAmountValue) el.grainAmountValue.textContent = el.grainAmount.value + '%';
      render();
    });
    el.grainAmount.addEventListener('change', saveStateToHistory);
  }
  if (el.grainScale) {
    el.grainScale.addEventListener('input', () => {
      state.grain.scale = parseInt(el.grainScale.value) / 100;
      if (el.grainScaleValue) el.grainScaleValue.textContent = state.grain.scale.toFixed(1) + '×';
      render();
    });
    el.grainScale.addEventListener('change', saveStateToHistory);
  }
  if (el.grainBlend) el.grainBlend.addEventListener('change', () => {
    saveStateToHistory(); state.grain.blend = el.grainBlend.value; render();
  });
  if (el.grainMonochrome) el.grainMonochrome.addEventListener('change', () => {
    saveStateToHistory(); state.grain.monochrome = el.grainMonochrome.checked; render();
  });

  refreshEffectsUI();
}
