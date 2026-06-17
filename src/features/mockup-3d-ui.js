// v21 — 3D device mockups.
//
// Wires the "3D Mockup" sidebar section to state.mockup3d and adds drag-to-orbit
// on the preview canvas. The actual WebGL render lives in render/mockups-3d.js;
// here we only mutate state and call render() (every visual feature in this app
// is driven by mutating the global `state` and re-rendering).

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { isDeviceMockup3d } from '../render/mockups-3d.js';
import { showStatus } from '../ui/notification.js';

// One-click 3D hero demos: set the device + scene + material + a flattering
// orbit angle together with a complementary background and canvas size, the same
// idea as the flat Mockup Presets (mockup-ui.js). "spin" arms the turntable so
// the normal GIF/MP4 export buttons produce a rotating clip.
const DEMOS_3D = {
  floating: {
    device: 'iphone', scene: 'float', material: 'graphite',
    orbitX: 14, orbitY: -32, zoom: 1.05, envReflections: true, spin: { enabled: false, turns: 1 },
    bgMode: 'gradient', gradient: { type: 'linear', angle: 135, colors: ['#2348ff', '#23c4ff'], positions: [0, 100] },
    padding: 120, canvas: { width: 1200, height: 1500 }
  },
  isomac: {
    device: 'macbook', scene: 'iso', material: 'silver',
    orbitX: 24, orbitY: -30, zoom: 1, envReflections: true, spin: { enabled: false, turns: 1 },
    bgMode: 'solid', bgColor: '#0c0f1a', padding: 90, canvas: { width: 1280, height: 960 }
  },
  ipad: {
    device: 'ipad', scene: 'studio', material: 'silver',
    orbitX: 10, orbitY: -18, zoom: 1, envReflections: true, spin: { enabled: false, turns: 1 },
    bgMode: 'mesh', padding: 110, canvas: { width: 1600, height: 1200 }
  },
  spin: {
    device: 'iphone', scene: 'studio', material: 'gold',
    orbitX: 6, orbitY: 0, zoom: 1, envReflections: true, spin: { enabled: true, turns: 1 },
    bgMode: 'gradient', gradient: { type: 'linear', angle: 120, colors: ['#6a5cff', '#23c4ff'], positions: [0, 100] },
    padding: 110, canvas: { width: 1080, height: 1080 }
  }
};

export function apply3dDemo(name) {
  const d = DEMOS_3D[name];
  if (!d) return;
  saveStateToHistory();
  const m = state.mockup3d;
  m.enabled = true;
  m.device = d.device; m.scene = d.scene; m.material = d.material;
  m.orbitX = d.orbitX; m.orbitY = d.orbitY; m.zoom = d.zoom;
  m.envReflections = d.envReflections;
  m.spin = { ...d.spin };
  m.orbitProgress = 0;
  // Clear competing 2D framing so the 3D path owns the composition.
  state.deviceFrame.type = '';
  if (state.scene) state.scene.id = '';
  state.tilt3d = { rx: 0, ry: 0, rz: 0, perspective: 1200 };
  // Background + canvas.
  state.bgMode = d.bgMode;
  if (d.bgColor) state.bgColor = d.bgColor;
  if (d.gradient) state.gradient = { ...state.gradient, ...d.gradient };
  if (d.padding != null) state.padding = d.padding;
  if (d.canvas) state.canvas = { ...d.canvas };
  toggleControls();
  refreshMockup3dUI();
  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  showStatus('3D demo: ' + name);
}

function toggleControls() {
  const on = !!(state.mockup3d.enabled && isDeviceMockup3d(state.mockup3d.device));
  if (el.mockup3dControls) el.mockup3dControls.style.display = on ? 'block' : 'none';
}

// Push state.mockup3d into the controls. Exposed so updateUIFromState (project
// load / reset) can re-sync the section.
export function refreshMockup3dUI() {
  const m = state.mockup3d;
  if (!m) return;
  if (el.mockup3dDevice) el.mockup3dDevice.value = m.enabled ? (m.device || '') : '';
  if (el.mockup3dScene) el.mockup3dScene.value = m.scene || 'studio';
  if (el.mockup3dMaterial) el.mockup3dMaterial.value = m.material || 'graphite';
  if (el.mockup3dRx) el.mockup3dRx.value = m.orbitX;
  if (el.mockup3dRxValue) el.mockup3dRxValue.textContent = Math.round(m.orbitX) + '°';
  if (el.mockup3dRy) el.mockup3dRy.value = m.orbitY;
  if (el.mockup3dRyValue) el.mockup3dRyValue.textContent = Math.round(m.orbitY) + '°';
  if (el.mockup3dZoom) el.mockup3dZoom.value = m.zoom;
  if (el.mockup3dZoomValue) el.mockup3dZoomValue.textContent = (m.zoom || 1).toFixed(1) + '×';
  if (el.mockup3dReflections) el.mockup3dReflections.checked = m.envReflections !== false;
  if (el.mockup3dSpin) el.mockup3dSpin.checked = !!(m.spin && m.spin.enabled);
  if (el.mockup3dTurns) el.mockup3dTurns.value = (m.spin && m.spin.turns) || 1;
  if (el.mockup3dTurnsValue) el.mockup3dTurnsValue.textContent = String((m.spin && m.spin.turns) || 1);
  toggleControls();
}

function linkRange(input, valueEl, fmt, apply) {
  if (!input) return;
  input.addEventListener('input', (e) => {
    apply(parseFloat(e.target.value));
    if (valueEl) valueEl.textContent = fmt(parseFloat(e.target.value));
    render();
  });
  input.addEventListener('change', () => saveStateToHistory());
}

export function bind3dMockupUi() {
  const m = () => state.mockup3d;

  document.querySelectorAll('[data-demo3d]').forEach((btn) => {
    btn.addEventListener('click', () => apply3dDemo(btn.dataset.demo3d));
  });

  if (el.mockup3dDevice) {
    el.mockup3dDevice.addEventListener('change', (e) => {
      const v = e.target.value;
      saveStateToHistory();
      if (v && isDeviceMockup3d(v)) {
        m().device = v;
        m().enabled = true;
      } else {
        m().enabled = false;
      }
      toggleControls();
      render();
    });
  }

  if (el.mockup3dScene) {
    el.mockup3dScene.addEventListener('change', (e) => {
      saveStateToHistory(); m().scene = e.target.value; render();
    });
  }
  if (el.mockup3dMaterial) {
    el.mockup3dMaterial.addEventListener('change', (e) => {
      saveStateToHistory(); m().material = e.target.value; render();
    });
  }

  linkRange(el.mockup3dRx, el.mockup3dRxValue, (v) => Math.round(v) + '°', (v) => { m().orbitX = v; });
  linkRange(el.mockup3dRy, el.mockup3dRyValue, (v) => Math.round(v) + '°', (v) => { m().orbitY = v; });
  linkRange(el.mockup3dZoom, el.mockup3dZoomValue, (v) => v.toFixed(1) + '×', (v) => { m().zoom = v; });
  linkRange(el.mockup3dTurns, el.mockup3dTurnsValue, (v) => String(v), (v) => {
    if (!m().spin) m().spin = { enabled: false, turns: 1 };
    m().spin.turns = v;
  });

  if (el.mockup3dReflections) {
    el.mockup3dReflections.addEventListener('change', (e) => {
      saveStateToHistory(); m().envReflections = e.target.checked; render();
    });
  }
  if (el.mockup3dSpin) {
    el.mockup3dSpin.addEventListener('change', (e) => {
      saveStateToHistory();
      if (!m().spin) m().spin = { enabled: false, turns: 1 };
      m().spin.enabled = e.target.checked;
    });
  }

  bindOrbitDrag();
  refreshMockup3dUI();
}

// Drag-to-orbit on the preview canvas. Only active while a 3D mockup is enabled,
// so it doesn't fight the Space+drag pan or annotation tools.
function bindOrbitDrag() {
  const cv = el.previewCanvas;
  if (!cv) return;
  let dragging = false, lastX = 0, lastY = 0, moved = false;
  const K = 0.4;

  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!(state.mockup3d && state.mockup3d.enabled && isDeviceMockup3d(state.mockup3d.device))) return;
    // Don't hijack space-drag panning.
    if (el.canvasViewport && el.canvasViewport.classList.contains('panning')) return;
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });

  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (dx || dy) moved = true;
    const m = state.mockup3d;
    m.orbitY += dx * K;
    m.orbitX = Math.max(-40, Math.min(40, m.orbitX + dy * K));
    refreshMockup3dUI();
    render();
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) saveStateToHistory();
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}
