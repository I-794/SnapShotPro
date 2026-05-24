import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { isTypingTarget } from '../utils/dom.js';

function clampZoom(z) { return Math.max(0.1, Math.min(4, z)); }

export function applyTransform() {
  const w = el.canvasWrapper;
  if (!w) return;
  const { rx, ry, rz, perspective } = state.tilt3d;
  const base = `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.zoom})`;
  const tilt = (rx || ry || rz) ? ` perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` : '';
  w.style.transform = base + tilt;
  if (el.zoomLabel) el.zoomLabel.textContent = Math.round(state.view.zoom * 100) + '%';
}

export function setZoom(z, anchorXFrac, anchorYFrac) {
  const oldZ = state.view.zoom;
  const newZ = clampZoom(z);
  const vp = el.canvasViewport.getBoundingClientRect();
  const ax = (anchorXFrac == null ? 0.5 : anchorXFrac) * vp.width;
  const ay = (anchorYFrac == null ? 0.5 : anchorYFrac) * vp.height;
  state.view.panX = ax - (ax - state.view.panX) * (newZ / oldZ);
  state.view.panY = ay - (ay - state.view.panY) * (newZ / oldZ);
  state.view.zoom = newZ;
  applyTransform();
  renderMinimap();
}

export function fitZoom() {
  state.view.zoom = 1; state.view.panX = 0; state.view.panY = 0;
  applyTransform(); renderMinimap();
}

let _panActive = false, _panStartX = 0, _panStartY = 0, _panOrigX = 0, _panOrigY = 0;

export function bindZoomPan() {
  const vp = el.canvasViewport;
  if (!vp) return;
  vp.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const ax = (e.clientX - rect.left) / rect.width;
      const ay = (e.clientY - rect.top) / rect.height;
      const delta = -e.deltaY * 0.0015;
      setZoom(state.view.zoom * (1 + delta), ax, ay);
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && !isTypingTarget(e.target)) {
      e.preventDefault();
      vp.classList.add('panning');
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') vp.classList.remove('panning', 'active');
  });
  vp.addEventListener('mousedown', (e) => {
    if (!vp.classList.contains('panning')) return;
    _panActive = true; _panStartX = e.clientX; _panStartY = e.clientY;
    _panOrigX = state.view.panX; _panOrigY = state.view.panY;
    vp.classList.add('active');
  });
  window.addEventListener('mousemove', (e) => {
    if (!_panActive) return;
    state.view.panX = _panOrigX + (e.clientX - _panStartX);
    state.view.panY = _panOrigY + (e.clientY - _panStartY);
    applyTransform(); renderMinimap();
  });
  window.addEventListener('mouseup', () => { _panActive = false; vp.classList.remove('active'); });

  if (el.zoomIn) el.zoomIn.addEventListener('click', () => setZoom(state.view.zoom * 1.2));
  if (el.zoomOut) el.zoomOut.addEventListener('click', () => setZoom(state.view.zoom / 1.2));
  if (el.zoomFit) el.zoomFit.addEventListener('click', fitZoom);
}

export function renderMinimap() {
  if (!state.image) { if (el.minimap) el.minimap.classList.remove('visible'); return; }
  if (!el.minimap || !el.minimapCanvas) return;
  el.minimap.classList.add('visible');
  const mctx = el.minimapCanvas.getContext('2d');
  const mw = el.minimapCanvas.width, mh = el.minimapCanvas.height;
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, mw, mh);
  const cw = el.previewCanvas.width, ch = el.previewCanvas.height;
  const r = Math.min(mw / cw, mh / ch);
  const dw = cw * r, dh = ch * r;
  mctx.drawImage(el.previewCanvas, (mw - dw) / 2, (mh - dh) / 2, dw, dh);
  const vp = el.canvasViewport.getBoundingClientRect();
  const z = state.view.zoom;
  const visW = vp.width / z, visH = vp.height / z;
  const offsetX = -state.view.panX / z, offsetY = -state.view.panY / z;
  const vx = (offsetX / cw) * dw + (mw - dw) / 2;
  const vy = (offsetY / ch) * dh + (mh - dh) / 2;
  const vw = (visW / cw) * dw;
  const vh = (visH / ch) * dh;
  const mv = el.minimapViewport;
  mv.style.left = Math.max(0, vx) + 'px';
  mv.style.top = Math.max(0, vy) + 'px';
  mv.style.width = Math.min(mw, vw) + 'px';
  mv.style.height = Math.min(mh, vh) + 'px';
}
