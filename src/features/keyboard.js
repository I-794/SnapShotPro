import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { undo, redo } from '../state/history.js';
import { render } from '../render/render.js';
import { exportImage, copyToClipboard } from './export.js';
import { openPalette, closePalette } from './palette.js';
import { closeStickerDrawer } from './stickers.js';
import { setTool, deleteSelected } from './canvas-tools.js';
import { isTypingTarget } from '../utils/dom.js';

function showShortcuts(show) {
  if (!el.shortcutsOverlay) return;
  el.shortcutsOverlay.style.display = show ? 'flex' : 'none';
}

export function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.ui.paletteOpen) closePalette(); else openPalette();
      return;
    }
    if (state.ui.paletteOpen) return;

    if (e.key === 'Escape') {
      if (el.shortcutsOverlay && el.shortcutsOverlay.style.display === 'flex') { showShortcuts(false); return; }
      if (state.ui.stickerDrawerOpen) { closeStickerDrawer(); return; }
      if (state.tool !== 'select') { setTool('select'); state.selectedAnnotation = null; state.selectedRedaction = null; state.selectedExtraImage = null; render(); return; }
      state.selectedAnnotation = null;
      state.selectedRedaction = null;
      state.selectedExtraImage = null;
      render();
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (cmd) {
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(render); return; }
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(render); return; }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); exportImage(); return; }
      if (e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyToClipboard(); return; }
    } else {
      if (e.key === '?') { e.preventDefault(); showShortcuts(el.shortcutsOverlay.style.display !== 'flex'); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    }
  });

  if (el.shortcutsBtn) el.shortcutsBtn.addEventListener('click', () => showShortcuts(true));
  if (el.closeShortcutsBtn) el.closeShortcutsBtn.addEventListener('click', () => showShortcuts(false));
  if (el.shortcutsOverlay) el.shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === el.shortcutsOverlay) showShortcuts(false);
  });
}
