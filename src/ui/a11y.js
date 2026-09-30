// v32.1 — accessibility pass for the editor chrome.
//
// 1. Icon-only buttons (✕, ↶, 🗑, ‹ ›, …) get an accessible name: their `title`
//    if present, else "Close" for close glyphs. `title` alone is not reliably
//    announced by screen readers. Runs once at startup and on DOM additions,
//    so dynamically built buttons are covered too.
// 2. The existing overlays become real modal dialogs without touching each
//    feature: role="dialog" + aria-modal + aria-labelledby, focus moves into the
//    dialog when it opens, Tab/Shift+Tab stay inside it, and focus returns to
//    whatever opened it when it closes. Open/close is detected by watching each
//    overlay's class/style, so the features keep toggling `.visible` /
//    `style.display` exactly as before.

const DIALOGS = '.auth-modal-overlay, .welcome-overlay, .present-overlay, .shortcuts-overlay, .palette-overlay';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CLOSE_GLYPHS = new Set(['✕', '×', '✖', 'x', 'X']);

// Text with no letters or digits (emoji, arrows, symbols) is not a usable name.
function isIconOnly(btn) {
  const text = (btn.textContent || '').trim();
  return !text || !/[\p{L}\p{N}]{2,}/u.test(text);
}

function labelButton(btn) {
  if (btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby')) return;
  if (!isIconOnly(btn)) return;
  const title = btn.getAttribute('title');
  if (title) { btn.setAttribute('aria-label', title); return; }
  if (CLOSE_GLYPHS.has((btn.textContent || '').trim())) btn.setAttribute('aria-label', 'Close');
}

function labelAll(root) {
  if (root.matches && root.matches('button')) labelButton(root);
  if (root.querySelectorAll) root.querySelectorAll('button').forEach(labelButton);
}

function isOpen(overlay) {
  return getComputedStyle(overlay).display !== 'none';
}

function focusables(overlay) {
  return [...overlay.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length);
}

const openState = new WeakMap();   // overlay -> { returnTo }

function onOpen(overlay) {
  openState.set(overlay, { returnTo: document.activeElement });
  // Features that focus their own field (e.g. the palette input) already did so.
  if (overlay.contains(document.activeElement)) return;
  const first = focusables(overlay)[0];
  if (first) first.focus();
  else { overlay.setAttribute('tabindex', '-1'); overlay.focus(); }
}

function onClose(overlay) {
  const s = openState.get(overlay);
  openState.delete(overlay);
  const back = s && s.returnTo;
  if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
}

function setupDialog(overlay) {
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const heading = overlay.querySelector('h1, h2, h3');
  if (heading && !overlay.hasAttribute('aria-labelledby') && !overlay.hasAttribute('aria-label')) {
    if (!heading.id) heading.id = (overlay.id || 'dialog') + '-title';
    overlay.setAttribute('aria-labelledby', heading.id);
  } else if (!heading && !overlay.hasAttribute('aria-label')) {
    const names = { 'palette-overlay': 'Command palette', 'present-overlay': 'Presentation', 'welcome-overlay': 'Welcome' };
    if (names[overlay.id]) overlay.setAttribute('aria-label', names[overlay.id]);
  }

  let wasOpen = isOpen(overlay);
  if (wasOpen) openState.set(overlay, { returnTo: null });
  new MutationObserver(() => {
    const now = isOpen(overlay);
    if (now === wasOpen) return;
    wasOpen = now;
    if (now) onOpen(overlay); else onClose(overlay);
  }).observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });

  // Keep Tab inside the open dialog.
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !isOpen(overlay)) return;
    const f = focusables(overlay);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

export function bindA11y() {
  labelAll(document.body);
  document.querySelectorAll(DIALOGS).forEach(setupDialog);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) labelAll(n); });
  }).observe(document.body, { childList: true, subtree: true });
}
