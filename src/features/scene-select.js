import { state } from '../state/state.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showStatus } from '../ui/notification.js';

export function setScene(id) {
  saveStateToHistory();
  state.scene.id = id;
  document.querySelectorAll('.scene-tile').forEach(t => t.classList.toggle('active', t.dataset.scene === id));
  render();
  showStatus(id ? 'Scene: ' + id : 'Scene cleared');
}

export function bindSceneEvents() {
  document.querySelectorAll('.scene-tile').forEach(t => {
    t.addEventListener('click', () => setScene(t.dataset.scene || ''));
  });
}
