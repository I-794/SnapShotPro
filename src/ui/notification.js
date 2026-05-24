import { el } from './elements.js';

export function showNotification(message, type = 'success') {
  el.notificationText.textContent = message;
  el.notification.className = `notification ${type}`;
  el.notification.classList.add('show');
  setTimeout(() => el.notification.classList.remove('show'), 3000);
}

let statusTimer = null;
export function showStatus(msg, ms = 1400) {
  if (!el.statusPill) return;
  el.statusPill.textContent = msg;
  el.statusPill.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.statusPill.classList.remove('visible'), ms);
}
