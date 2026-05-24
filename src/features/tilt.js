import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { tiltPresets } from '../state/presets.js';
import { saveStateToHistory } from '../state/history.js';
import { applyTransform } from './zoom-pan.js';
import { showStatus } from '../ui/notification.js';

export function resetTilt() {
  state.tilt3d = { rx: 0, ry: 0, rz: 0, perspective: 1200 };
  if (el.tiltRx) el.tiltRx.value = 0;
  if (el.tiltRy) el.tiltRy.value = 0;
  if (el.tiltRz) el.tiltRz.value = 0;
  if (el.tiltPerspective) el.tiltPerspective.value = 1200;
  if (el.tiltRxValue) el.tiltRxValue.textContent = '0°';
  if (el.tiltRyValue) el.tiltRyValue.textContent = '0°';
  if (el.tiltRzValue) el.tiltRzValue.textContent = '0°';
  if (el.tiltPerspectiveValue) el.tiltPerspectiveValue.textContent = '1200px';
  applyTransform();
}

export function applyTiltPreset(name) {
  const p = tiltPresets[name];
  if (!p) return;
  saveStateToHistory();
  state.tilt3d = { ...p };
  if (el.tiltRx) el.tiltRx.value = p.rx;
  if (el.tiltRy) el.tiltRy.value = p.ry;
  if (el.tiltRz) el.tiltRz.value = p.rz;
  if (el.tiltPerspective) el.tiltPerspective.value = p.perspective;
  if (el.tiltRxValue) el.tiltRxValue.textContent = p.rx + '°';
  if (el.tiltRyValue) el.tiltRyValue.textContent = p.ry + '°';
  if (el.tiltRzValue) el.tiltRzValue.textContent = p.rz + '°';
  if (el.tiltPerspectiveValue) el.tiltPerspectiveValue.textContent = p.perspective + 'px';
  applyTransform();
  showStatus('Tilt: ' + name);
}

export function bindTiltEvents() {
  const update = () => {
    state.tilt3d.rx = parseInt(el.tiltRx.value, 10);
    state.tilt3d.ry = parseInt(el.tiltRy.value, 10);
    state.tilt3d.rz = parseInt(el.tiltRz.value, 10);
    state.tilt3d.perspective = parseInt(el.tiltPerspective.value, 10);
    el.tiltRxValue.textContent = state.tilt3d.rx + '°';
    el.tiltRyValue.textContent = state.tilt3d.ry + '°';
    el.tiltRzValue.textContent = state.tilt3d.rz + '°';
    el.tiltPerspectiveValue.textContent = state.tilt3d.perspective + 'px';
    applyTransform();
  };
  if (el.tiltRx) el.tiltRx.addEventListener('input', update);
  if (el.tiltRy) el.tiltRy.addEventListener('input', update);
  if (el.tiltRz) el.tiltRz.addEventListener('input', update);
  if (el.tiltPerspective) el.tiltPerspective.addEventListener('input', update);
  [el.tiltRx, el.tiltRy, el.tiltRz, el.tiltPerspective].forEach(ele => {
    if (ele) ele.addEventListener('change', () => saveStateToHistory());
  });
  if (el.tiltResetBtn) el.tiltResetBtn.addEventListener('click', () => { saveStateToHistory(); resetTilt(); });
  document.querySelectorAll('.tab-btn[data-tilt-preset]').forEach(b => {
    b.addEventListener('click', () => applyTiltPreset(b.dataset.tiltPreset));
  });
}
