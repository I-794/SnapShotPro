import { state, imageRegistry } from '../state/state.js';
import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';

export function renderExtraImages(ctx, canvas) {
  state.extraImages.forEach(ei => {
    if (ei.visible === false) return;
    const img = imageRegistry[ei.id];
    if (!img) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.width * ei.scaleFrac;
    const ih = img.height * ei.scaleFrac;
    const tx = cw * ei.xFrac - iw / 2;
    const ty = ch * ei.yFrac - ih / 2;
    ctx.drawImage(img, tx, ty, iw, ih);
    if (state.selectedExtraImage === ei.id) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,160,255,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(tx - 4, ty - 4, iw + 8, ih + 8);
      ctx.setLineDash([]);
      ctx.restore();
    }
  });
}

export function hitTestExtraImageAtPoint(x, y, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;
  for (let i = state.extraImages.length - 1; i >= 0; i--) {
    const ei = state.extraImages[i];
    const img = imageRegistry[ei.id];
    if (!img) continue;
    const iw = img.width * ei.scaleFrac;
    const ih = img.height * ei.scaleFrac;
    const tx = cw * ei.xFrac - iw / 2;
    const ty = ch * ei.yFrac - ih / 2;
    if (x >= tx && x <= tx + iw && y >= ty && y <= ty + ih) return i;
  }
  return -1;
}

export function loadExtraImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const id = 'extra_' + Date.now();
      imageRegistry[id] = img;
      const maxSize = Math.min(el.previewCanvas.width, el.previewCanvas.height) * 0.4;
      const scaleFrac = Math.min(1.0, maxSize / Math.max(img.width, img.height));
      state.extraImages.push({ id, xFrac: 0.5, yFrac: 0.5, scaleFrac });
      saveStateToHistory();
      render();
      updateExtraImagesList();
      showNotification('Image added!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function updateExtraImagesList() {
  const list = el.extraImagesList;
  if (!list) return;
  list.innerHTML = '';
  if (state.extraImages.length === 0) return;
  state.extraImages.forEach((ei, idx) => {
    const img = imageRegistry[ei.id];
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border-color);cursor:pointer;';
    item.addEventListener('click', () => {
      state.selectedExtraImage = ei.id;
      render();
    });
    if (img) {
      const thumb = document.createElement('canvas');
      thumb.width = 40; thumb.height = 40;
      const tc = thumb.getContext('2d');
      const s = Math.min(40 / img.width, 40 / img.height);
      const tw = img.width * s, th = img.height * s;
      tc.drawImage(img, (40 - tw) / 2, (40 - th) / 2, tw, th);
      thumb.style.cssText = 'border-radius:4px;flex-shrink:0;';
      item.appendChild(thumb);
    }
    const label = document.createElement('span');
    label.textContent = `Image ${idx + 1}`;
    label.style.cssText = 'flex:1;font-size:13px;color:var(--text-primary);';
    item.appendChild(label);
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.style.cssText = 'padding:4px 8px;font-size:12px;flex-shrink:0;';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveStateToHistory();
      state.extraImages.splice(idx, 1);
      if (state.selectedExtraImage === ei.id) state.selectedExtraImage = null;
      render();
      updateExtraImagesList();
    });
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

export function bindExtraImagesEvents() {
  if (el.addImageBtn) el.addImageBtn.addEventListener('click', () => el.extraFileInput.click());
  if (el.extraFileInput) el.extraFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      loadExtraImage(file);
      el.extraFileInput.value = '';
    }
  });
}
