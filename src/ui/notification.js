import { el } from './elements.js';

// v33 — optional action button (e.g. { label: 'Undo', run }) and a single
// shared hide timer, so a newer toast is never cut short by an older one's timer.
let hideTimer = null;
export function showNotification(message, type = 'success', { action = null, duration } = {}) {
  el.notificationText.textContent = message;
  el.notification.className = `notification ${type}`;
  el.notification.querySelector('.notification-action')?.remove();
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notification-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      btn.remove();
      el.notification.classList.remove('show');
      action.run();
    }, { once: true });
    el.notification.appendChild(btn);
  }
  el.notification.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.notification.classList.remove('show');
    el.notification.querySelector('.notification-action')?.remove();
  }, duration || (action ? 6000 : 3000));
}

let statusTimer = null;
export function showStatus(msg, ms = 1400) {
  if (!el.statusPill) return;
  el.statusPill.textContent = msg;
  el.statusPill.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.statusPill.classList.remove('visible'), ms);
}
