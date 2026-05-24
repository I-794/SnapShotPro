import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';

export function toggleSvgInput() {
  const wrap = el.svgInputContainer;
  if (!wrap) return;
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

export function renderSvgCode() {
  const code = el.svgCodeInput.value.trim();
  if (!code) { showNotification('Paste some SVG code first.', 'error'); return; }
  const blob = new Blob([code], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    state.image = img;
    state.svgCode = code;
    el.uploadZone.style.display = 'none';
    el.canvasWrapper.style.display = 'block';
    el.annotationToolbar.style.display = 'flex';
    if (el.zoomControls) el.zoomControls.style.display = 'flex';
    saveStateToHistory();
    render();
    showNotification('SVG rendered.', 'success');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    showNotification('Invalid SVG code.', 'error');
  };
  img.src = url;
}

export function bindSvgInput() {
  if (el.svgBtn) el.svgBtn.addEventListener('click', toggleSvgInput);
  if (el.renderSvgBtn) el.renderSvgBtn.addEventListener('click', renderSvgCode);
}
