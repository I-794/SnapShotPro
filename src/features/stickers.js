import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { stickers } from '../state/presets.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showStatus } from '../ui/notification.js';

let currentCat = 'reactions';

export function openStickerDrawer() {
  state.ui.stickerDrawerOpen = true;
  el.stickerDrawer.classList.add('visible');
  renderStickerGrid();
}

export function closeStickerDrawer() {
  state.ui.stickerDrawerOpen = false;
  el.stickerDrawer.classList.remove('visible');
}

export function renderStickerGrid() {
  if (!el.stickerGrid) return;
  const list = stickers[currentCat] || [];
  el.stickerGrid.innerHTML = list.map(g => `<div class="sticker-tile" data-g="${g}">${g}</div>`).join('');
  el.stickerGrid.querySelectorAll('.sticker-tile').forEach(t => {
    t.addEventListener('click', () => addSticker(t.dataset.g));
  });
}

export function addSticker(glyph) {
  if (!state.image) return;
  saveStateToHistory();
  const cx = el.previewCanvas.width / 2;
  const cy = el.previewCanvas.height / 2;
  state.annotations.push({
    id: Date.now(),
    type: 'sticker',
    glyph,
    x1: cx - 32, y1: cy - 32, x2: cx + 32, y2: cy + 32,
    size: 64,
    color: state.annotationColor || '#ffffff',
    strokeWidth: 0
  });
  render();
  showStatus('Added sticker ' + glyph);
}

export function bindStickerEvents() {
  if (el.stickerBtn) el.stickerBtn.addEventListener('click', () => {
    if (state.ui.stickerDrawerOpen) closeStickerDrawer();
    else openStickerDrawer();
  });
  if (el.stickerClose) el.stickerClose.addEventListener('click', closeStickerDrawer);
  document.querySelectorAll('.sticker-cat-btn').forEach(b => {
    b.addEventListener('click', () => {
      currentCat = b.dataset.cat;
      document.querySelectorAll('.sticker-cat-btn').forEach(x => x.classList.toggle('active', x === b));
      renderStickerGrid();
    });
  });
}
