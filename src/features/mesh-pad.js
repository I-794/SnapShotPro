import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { meshPresets } from '../state/presets.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { drawMeshGradient } from '../render/background.js';
import { showStatus } from '../ui/notification.js';

export function renderMeshPad() {
  const pad = el.meshPad;
  if (!pad) return;
  const w = 300, h = 169;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawMeshGradient(off.getContext('2d'), off);
  pad.style.backgroundImage = `url(${off.toDataURL()})`;
  pad.style.backgroundSize = '100% 100%';
  pad.innerHTML = state.meshGradient.points.map((p, i) =>
    `<div class="mesh-handle" data-i="${i}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${p.color};">
      <input type="color" value="${p.color}" style="position:absolute;inset:0;opacity:0;cursor:pointer;border-radius:50%;width:100%;height:100%;">
    </div>`
  ).join('');
  pad.querySelectorAll('.mesh-handle').forEach(h => {
    const i = parseInt(h.dataset.i, 10);
    const colorInput = h.querySelector('input[type=color]');
    colorInput.addEventListener('input', (e) => {
      state.meshGradient.points[i].color = e.target.value;
      renderMeshPad();
      if (state.bgMode === 'mesh') render();
    });
    let dragging = false;
    h.addEventListener('pointerdown', (e) => {
      if (e.target === colorInput) return;
      e.preventDefault();
      dragging = true; h.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = pad.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      state.meshGradient.points[i].x = x;
      state.meshGradient.points[i].y = y;
      h.style.left = (x * 100) + '%';
      h.style.top = (y * 100) + '%';
      if (state.bgMode === 'mesh') render();
    });
    const end = () => {
      if (dragging) { dragging = false; h.classList.remove('dragging'); saveStateToHistory(); renderMeshPad(); }
    };
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  });
}

export function applyMeshPreset(name) {
  const colors = meshPresets[name]; if (!colors) return;
  saveStateToHistory();
  state.meshGradient.points.forEach((p, i) => { if (colors[i]) p.color = colors[i]; });
  renderMeshPad();
  render();
  showStatus('Mesh: ' + name);
}
