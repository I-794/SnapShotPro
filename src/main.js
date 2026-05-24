// SnapShot-Pro v4 — app entry.
// Initialize DOM refs, bind every module, then render.

import { state } from './state/state.js';
import { onHistoryChange, undo, redo } from './state/history.js';
import { initElements, el } from './ui/elements.js';
import { loadSavedTheme, applyTheme } from './ui/theme.js';
import { showNotification } from './ui/notification.js';
import { render } from './render/render.js';

import { bindUploadEvents } from './features/upload.js';
import { bindExtraImagesEvents } from './features/extra-images.js';
import { exportImage, copyToClipboard, exportAsHTML } from './features/export.js';
import { bindCanvasTools, setTool } from './features/canvas-tools.js';
import { bindLayersEvents, renderLayersPanel } from './features/layers.js';
import { bindHistoryTimeline, renderHistoryTimeline } from './features/history-timeline.js';
import { bindZoomPan, applyTransform } from './features/zoom-pan.js';
import { renderMeshPad } from './features/mesh-pad.js';
import { bindTiltEvents } from './features/tilt.js';
import { bindStickerEvents } from './features/stickers.js';
import { bindSceneEvents } from './features/scene-select.js';
import { bindSvgInput } from './features/svg-input.js';
import { bindTemplates } from './features/templates.js';
import { bindResetButton } from './features/reset.js';
import { registerCommands, bindPalette } from './features/palette.js';
import { bindKeyboard } from './features/keyboard.js';
import { bindAllControls, updateUIFromState } from './ui/bindings.js';

function bindHeader() {
  el.themeToggleBtn.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
  el.undoBtn.addEventListener('click', () => undo(render));
  el.redoBtn.addEventListener('click', () => redo(render));
  el.exportBtn.addEventListener('click', exportImage);
  if (el.copyClipboardBtn) el.copyClipboardBtn.addEventListener('click', copyToClipboard);
  if (el.exportHtmlBtn) el.exportHtmlBtn.addEventListener('click', exportAsHTML);
}

function setInitialActivePresets() {
  document.querySelectorAll('.preset-button[data-preset="sunset"]').forEach(b => b.classList.add('active'));
  document.querySelectorAll('.shadow-preset-btn[data-shadow="soft"]').forEach(b => b.classList.add('active'));
  document.querySelectorAll('.layout-btn[data-layout="free"]').forEach(b => b.classList.add('active'));
  document.querySelectorAll('.align-btn[data-align="center"]').forEach(b => b.classList.add('active'));
  document.querySelectorAll('.scene-tile[data-scene=""]').forEach(t => t.classList.add('active'));
}

function init() {
  initElements();
  loadSavedTheme();

  // History listeners (renders timeline + layers after every snapshot)
  onHistoryChange(renderHistoryTimeline);
  onHistoryChange(renderLayersPanel);

  bindHeader();
  bindUploadEvents();
  bindExtraImagesEvents();
  bindCanvasTools();
  bindLayersEvents();
  bindHistoryTimeline();
  bindZoomPan();
  bindTiltEvents();
  bindStickerEvents();
  bindSceneEvents();
  bindSvgInput();
  bindTemplates();
  bindResetButton();
  registerCommands();
  bindPalette();
  bindAllControls();
  bindKeyboard();

  setInitialActivePresets();
  renderMeshPad();
  renderHistoryTimeline();
  renderLayersPanel();
  updateUIFromState();
  applyTransform();
  setTool('select');

  showNotification('SnapShot-Pro loaded. Drag, paste, or upload an image to begin.', 'success');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
