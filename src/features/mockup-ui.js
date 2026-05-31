// v8 — Mockup presets + screen-glare toggle.
//
// One-click "hero shot" presets that set device + colorway + background +
// shadow + canvas size together, plus the glare checkbox in the Device Frame
// panel. Bound from main.js. Kept in its own module so the (large) bindings.js
// stays untouched; the preset buttons are wired by data attribute.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { render } from '../render/render.js';
import { saveStateToHistory } from '../state/history.js';
import { showStatus } from '../ui/notification.js';

const PRESETS = {
  appstore: {
    device: 'iphone16pro', color: 'titanium',
    bgMode: 'gradient',
    gradient: { type: 'linear', angle: 135, colors: ['#6a5cff', '#23c4ff'], positions: [0, 100] },
    padding: 120,
    shadow: { blur: 80, spread: 20, opacity: 35, x: 0, y: 30, color: '#000000' },
    canvas: { width: 1200, height: 1500 }
  },
  producthunt: {
    device: 'macbookpro', color: 'graphite',
    bgMode: 'solid', bgColor: '#13141a',
    padding: 90,
    shadow: { blur: 90, spread: 30, opacity: 40, x: 0, y: 40, color: '#000000' },
    canvas: { width: 1280, height: 960 }
  },
  twitter: {
    device: 'macbookpro', color: 'silver',
    bgMode: 'gradient',
    gradient: { type: 'linear', angle: 120, colors: ['#2348ff', '#5470ff'], positions: [0, 100] },
    padding: 80,
    shadow: { blur: 70, spread: 20, opacity: 35, x: 0, y: 30, color: '#000000' },
    canvas: { width: 1200, height: 675 }
  },
  dribbble: {
    device: 'ipadpro', color: 'silver',
    bgMode: 'mesh',
    padding: 110,
    shadow: { blur: 80, spread: 25, opacity: 35, x: 0, y: 30, color: '#000000' },
    canvas: { width: 1600, height: 1200 }
  }
};

export function applyMockupPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  saveStateToHistory();
  state.deviceFrame.type = p.device;
  state.deviceFrame.color = p.color;
  state.deviceFrame.glare = true;
  if (state.scene) state.scene.id = '';          // device mockup takes over
  state.bgMode = p.bgMode;
  if (p.bgColor) state.bgColor = p.bgColor;
  if (p.gradient) state.gradient = { ...state.gradient, ...p.gradient };
  if (p.padding != null) state.padding = p.padding;
  if (p.shadow) state.shadow = { ...state.shadow, ...p.shadow };
  if (p.canvas) state.canvas = { ...p.canvas };
  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  showStatus('Mockup: ' + name);
}

export function bindMockupUi() {
  document.querySelectorAll('[data-mockup-preset]').forEach((btn) => {
    btn.addEventListener('click', () => applyMockupPreset(btn.dataset.mockupPreset));
  });

  if (el.deviceFrameGlare) {
    el.deviceFrameGlare.checked = state.deviceFrame.glare !== false;
    el.deviceFrameGlare.addEventListener('change', (e) => {
      saveStateToHistory();
      state.deviceFrame.glare = e.target.checked;
      render();
    });
  }
}
