import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';

let modelLoaded = false;
let busy = false;

function setProgress(pct, label) {
  const wrap = document.getElementById('bg-remove-progress');
  if (!wrap) return;
  if (pct === null) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const fill = wrap.querySelector('.ai-progress-fill');
  const lab = wrap.querySelector('.ai-progress-label');
  if (fill) fill.style.width = pct + '%';
  if (lab) lab.textContent = label || `${Math.round(pct)}%`;
}

async function imageToBlob(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(res => c.toBlob(res, 'image/png'));
}

async function removeBackground() {
  if (busy) return;
  if (!state.image) { showNotification('Load an image first.', 'error'); return; }
  busy = true;
  try {
    setProgress(2, modelLoaded ? 'Processing…' : 'Downloading model (one-time, ~40MB)…');
    const { removeBackground: imglyRemove } = await import('@imgly/background-removal');
    const blob = await imageToBlob(state.image);
    const resultBlob = await imglyRemove(blob, {
      progress: (key, current, total) => {
        const pct = total ? Math.round((current / total) * 100) : 0;
        setProgress(Math.max(2, pct), `${key} ${pct}%`);
      }
    });
    modelLoaded = true;
    const url = URL.createObjectURL(resultBlob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    saveStateToHistory();
    state.image = img;
    state.bgMode = 'transparent';
    render();
    setProgress(null);
    showNotification('Background removed.', 'success');
  } catch (e) {
    console.error(e);
    setProgress(null);
    showNotification('Background removal failed: ' + (e.message || e), 'error');
  } finally {
    busy = false;
  }
}

export function bindBgRemove() {
  const btn = document.getElementById('bg-remove-btn');
  if (btn) btn.addEventListener('click', removeBackground);
}
