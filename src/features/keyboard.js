import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { undo, redo } from '../state/history.js';
import { render } from '../render/render.js';
import { exportImage, copyToClipboard } from './export.js';
import { openPalette, closePalette } from './palette.js';
import { closeStickerDrawer } from './stickers.js';
import { setTool, deleteSelected, nudgeSelected } from './canvas-tools.js';
import { clearSelection, selectAll, duplicateSelection } from './selection.js';
import { isTypingTarget } from '../utils/dom.js';
import { timelineActive, timelineStepFrame, timelineSetIn, timelineSetOut } from './timeline.js';
import { matchEvent } from './shortcuts.js';

function showShortcuts(show) {
  if (!el.shortcutsOverlay) return;
  el.shortcutsOverlay.style.display = show ? 'flex' : 'none';
}

export function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const cmd = e.ctrlKey || e.metaKey;

    // Cmd/Ctrl+K toggles the palette and must work even while it's open.
    if (cmd && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.ui.paletteOpen) closePalette(); else openPalette();
      return;
    }
    if (state.ui.paletteOpen) return;

    if (e.key === 'Escape') {
      // v32 — Esc exits board mode (the toolbar promises it).
      if (state.mode === 'board' && typeof window.__exitBoardMode === 'function') { window.__exitBoardMode(); return; }
      if (el.shortcutsOverlay && el.shortcutsOverlay.style.display === 'flex') { showShortcuts(false); return; }
      if (state.ui.stickerDrawerOpen) { closeStickerDrawer(); return; }
      if (state.tool !== 'select') { setTool('select'); clearSelection(); render(); return; }
      clearSelection();
      render();
      return;
    }

    if (isTypingTarget(e.target)) return;

    // Declarative global shortcuts — single source of truth is shortcuts.js.
    const sc = matchEvent(e);
    if (sc) {
      e.preventDefault();
      switch (sc) {
        case 'undo':   undo(render); return;
        case 'redo':   redo(render); return;
        case 'export': exportImage(); return;
        case 'copy':   copyToClipboard(); return;
        case 'help':   showShortcuts(el.shortcutsOverlay.style.display !== 'flex'); return;
        case 'duplicate':  if (duplicateSelection()) render(); return;
        case 'select-all': if (state.image && state.tool === 'select') { selectAll(); render(); } return;
      }
    }

    // Bespoke, context-sensitive handlers (listed in shortcuts.js as displayOnly).
    if (!cmd) {
      // v15.1 — frame-accurate timeline control when a clip is loaded.
      if (timelineActive()) {
        if (e.key === ',') { e.preventDefault(); timelineStepFrame(-1); return; }
        if (e.key === '.') { e.preventDefault(); timelineStepFrame(1); return; }
        if (e.key === '[') { e.preventDefault(); timelineSetIn(); return; }
        if (e.key === ']') { e.preventDefault(); timelineSetOut(); return; }
      }
      // v32 — these bespoke canvas handlers own Delete/Backspace and arrow-nudge
      // for the SINGLE-canvas editor. In board mode the board's own window-level
      // handler owns Delete (acting on boardSelection); skip here so Delete
      // doesn't also run deleteSelected() on a stale canvasSelection.
      if (state.mode === 'single') {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          if (nudgeSelected(dx, dy, !e.repeat)) e.preventDefault();
          return;
        }
      }
    }
  });

  if (el.shortcutsBtn) el.shortcutsBtn.addEventListener('click', () => showShortcuts(true));
  if (el.closeShortcutsBtn) el.closeShortcutsBtn.addEventListener('click', () => showShortcuts(false));
  if (el.shortcutsOverlay) el.shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === el.shortcutsOverlay) showShortcuts(false);
  });
}
