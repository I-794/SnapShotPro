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
