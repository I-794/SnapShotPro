// SnapShot-Pro v7 — app entry.
// Initialize DOM refs, bind every module, then render.

import { inject } from '@vercel/analytics';
import { state } from './state/state.js';
import { onHistoryChange, undo, redo } from './state/history.js';
import { initElements, el } from './ui/elements.js';
import { loadSavedTheme, applyTheme } from './ui/theme.js';
import { showNotification } from './ui/notification.js';
import { render } from './render/render.js';

import { bindUploadEvents } from './features/upload.js';
import { bindUrlLoad } from './features/url-load.js';
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
import { bindMockupUi } from './features/mockup-ui.js';
import { bindSetUi } from './features/set-ui.js';
import { bindSvgInput } from './features/svg-input.js';
import { bindTemplates } from './features/templates.js';
import { bindGradientEditor } from './features/gradient-editor.js';
import { bindCustomFont } from './features/custom-font.js';
import { bindPaletteExtractor } from './features/palette-extract.js';
import { bindBrandKit } from './features/brand-kit.js';
import { bindBgRemove } from './features/bg-remove.js';
import { bindOcr } from './features/ocr.js';
import { bindApiKeysPanel } from './features/api-keys.js';
import { bindAiCloud } from './features/ai-cloud.js';
import { bindAiArtDirector } from './features/ai-art-director.js';
import { bindAiImageEdit } from './features/ai-image-edit.js';
import { bindAuth } from './features/auth.js';
import { bindCloudSync } from './features/cloud-sync.js';
import { bindProjects } from './features/projects.js';
import { bindPages } from './features/pages.js';
import { bindGallery } from './features/gallery.js';
import { bindCrop } from './features/crop.js';
import { bindResetButton } from './features/reset.js';
import { bindShare } from './features/share.js';
import { bindCollab } from './features/collab.js';
import { bindAiEnhance } from './features/ai-enhance.js';
import { bindAnimation } from './features/animation.js';
import { bindGifExport } from './features/gif-export.js';
import { bindVideo } from './features/video.js';
import { bindVideoExport } from './features/video-export.js';
import { bindScreenRecord } from './features/screen-record.js';
import { registerCommands, bindPalette } from './features/palette.js';
import { bindKeyboard } from './features/keyboard.js';
import { bindAllControls, updateUIFromState } from './ui/bindings.js';
import { bindMobileNav } from './ui/mobile-nav.js';
import { bindStudioNav } from './features/studio-nav.js';
import { bindWelcome } from './features/welcome.js';

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
  inject();
  initElements();
  loadSavedTheme();

  // History listeners (renders timeline + layers after every snapshot)
  onHistoryChange(renderHistoryTimeline);
  onHistoryChange(renderLayersPanel);

  bindHeader();
  bindUploadEvents();
  bindUrlLoad();
  bindExtraImagesEvents();
  bindCanvasTools();
  bindLayersEvents();
  bindHistoryTimeline();
  bindZoomPan();
  bindTiltEvents();
  bindStickerEvents();
  bindSceneEvents();
  bindMockupUi();
  bindSetUi();
  bindSvgInput();
  bindTemplates();
  bindGradientEditor();
  bindCustomFont();
  bindPaletteExtractor();
  bindBrandKit();
  bindBgRemove();
  bindOcr();
  bindApiKeysPanel();
  bindAiCloud();
  bindAiArtDirector();
  bindAiImageEdit();
  bindAuth();
  bindCloudSync();
  bindPages();
  bindProjects();
  bindGallery();
  bindCrop();
  bindResetButton();
  bindShare();
  bindCollab();
  bindAiEnhance();
  bindAnimation();
  bindGifExport();
  bindVideo();
  bindVideoExport();
  bindScreenRecord();
  registerCommands();
  bindPalette();
  bindAllControls();
  bindKeyboard();
  bindMobileNav();
  bindStudioNav();
  bindWelcome();

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
