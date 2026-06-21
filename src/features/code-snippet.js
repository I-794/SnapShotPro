// v24 — Code Snippet Studio.
//
// Paste source code → a themed, syntax-highlighted "code screenshot". The code
// is rasterized (render/code-render.js) into state.image, exactly like SVG input
// turns markup into an image — so it flows through the existing background /
// shadow / radius / window-frame / export pipeline with no renderer changes.
// The window chrome reuses the macOS/Windows device frame (state.deviceFrame).

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory, onHistoryChange } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { FRAME_INSETS } from '../state/presets.js';
import { setGroup } from './studio-nav.js';
import { rasterizeCode, CODE_LANGUAGES, THEMES } from '../render/code-render.js';

// The most recent raster we produced. Used to tell "we're still in code mode"
// (state.image is our canvas) apart from "the user loaded a photo over it".
let lastRaster = null;
// Guard so the saveStateToHistory() inside applyCodeSnippet doesn't re-enter the
// history listener and double-raster.
let suppress = false;

const SAMPLE = `function greet(name) {
  const msg = \`Hello, \${name}!\`;
  console.log(msg);
  return msg;
}

greet('world');`;

function chromeInset() {
  const t = state.codeSnippet.windowChrome;
  return (t === 'macos' || t === 'windows') ? FRAME_INSETS[t].top : 0;
}

// Mirror the snippet's chrome choice onto the device frame the renderer draws.
function syncDeviceFrame() {
  const cs = state.codeSnippet;
  if (cs.windowChrome === 'macos' || cs.windowChrome === 'windows') {
    state.deviceFrame.type = cs.windowChrome;
    state.deviceFrame.title = cs.windowTitle || 'untitled';
  } else if (state.deviceFrame.type === 'macos' || state.deviceFrame.type === 'windows') {
    state.deviceFrame.type = null;
  }
}

// Raster + assign + render. Does NOT touch history (callers that represent a
// user edit call saveStateToHistory themselves). resize:true hugs the canvas to
// the card; undo/redo and project load pass resize:false to keep restored size.
async function rasterIntoState({ resize }) {
  const cs = state.codeSnippet;
  if (!cs.code || !cs.code.trim()) return;
  let canvas;
  try {
    canvas = await rasterizeCode(cs);
  } catch (e) {
    console.error(e);
    showNotification('Could not render the code.', 'error');
    return;
  }
  syncDeviceFrame();
  state.image = canvas;
  state.svgCode = null;
  lastRaster = canvas;
  if (resize) {
    state.canvas.width = Math.round(canvas._logicalW + state.padding * 2);
    state.canvas.height = Math.round(canvas._logicalH + state.padding * 2 + chromeInset());
  }
  render();
}

function revealCanvas() {
  if (el.uploadZone) el.uploadZone.style.display = 'none';
  if (el.canvasWrapper) el.canvasWrapper.style.display = 'block';
  if (el.annotationToolbar) el.annotationToolbar.style.display = 'flex';
  if (el.zoomControls) el.zoomControls.style.display = 'flex';
}

// ── State ⇄ controls ─────────────────────────────────────────────────────────
function readUiIntoState() {
  const cs = state.codeSnippet;
  if (el.codeInput) cs.code = el.codeInput.value;
  if (el.codeLanguage) cs.language = el.codeLanguage.value;
  if (el.codeTheme) cs.theme = el.codeTheme.value;
  if (el.codeChrome) cs.windowChrome = el.codeChrome.value;
  if (el.codeWindowTitle) cs.windowTitle = el.codeWindowTitle.value;
  if (el.codeFont) cs.fontFamily = el.codeFont.value;
  if (el.codeFontSize) cs.fontSize = parseInt(el.codeFontSize.value, 10);
  if (el.codePad) cs.pad = parseInt(el.codePad.value, 10);
  if (el.codeTabSize) cs.tabSize = parseInt(el.codeTabSize.value, 10);
  if (el.codeLineNumbers) cs.showLineNumbers = el.codeLineNumbers.checked;
  if (el.codeWrap) cs.wrap = el.codeWrap.checked;
}

function syncUiFromState() {
  const cs = state.codeSnippet;
  if (el.codeInput && document.activeElement !== el.codeInput) el.codeInput.value = cs.code || '';
  if (el.codeLanguage) el.codeLanguage.value = cs.language;
  if (el.codeTheme) el.codeTheme.value = cs.theme;
  if (el.codeChrome) el.codeChrome.value = cs.windowChrome;
  if (el.codeWindowTitle) el.codeWindowTitle.value = cs.windowTitle || '';
  if (el.codeFont) el.codeFont.value = cs.fontFamily;
  if (el.codeFontSize) el.codeFontSize.value = cs.fontSize;
  if (el.codeFontSizeValue) el.codeFontSizeValue.textContent = `${cs.fontSize}px`;
  if (el.codePad) el.codePad.value = cs.pad;
  if (el.codePadValue) el.codePadValue.textContent = `${cs.pad}px`;
  if (el.codeTabSize) el.codeTabSize.value = cs.tabSize;
  if (el.codeLineNumbers) el.codeLineNumbers.checked = cs.showLineNumbers;
  if (el.codeWrap) el.codeWrap.checked = cs.wrap;
}

// User edit: snapshot the previous state, pull the controls, raster (hugging the
// canvas), reveal the editor.
async function applyCodeSnippet() {
  if (el.codeInput && !el.codeInput.value.trim()) {
    showNotification('Paste some code first.', 'error');
    return;
  }
  suppress = true;
  const firstEnable = !state.codeSnippet.enabled;
  saveStateToHistory();
  readUiIntoState();
  state.codeSnippet.enabled = true;
  await rasterIntoState({ resize: true });
  if (firstEnable) revealCanvas();
  suppress = false;
}

// Command-palette / footer entry: jump to the panel and focus the editor.
export function openCodeStudio() {
  setGroup('import');
  const panel = el.codeSnippetPanel;
  if (panel) {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (el.codeInput) {
    if (!el.codeInput.value) el.codeInput.value = SAMPLE;
    el.codeInput.focus();
  }
}

let applyTimer = null;
function debouncedApply() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyCodeSnippet, 250);
}

export function bindCodeSnippet() {
  // Populate the language + theme selects from the single source of truth.
  if (el.codeLanguage && !el.codeLanguage.options.length) {
    el.codeLanguage.innerHTML = CODE_LANGUAGES
      .map((l) => `<option value="${l.id}">${l.label}</option>`).join('');
  }
  if (el.codeTheme && !el.codeTheme.options.length) {
    el.codeTheme.innerHTML = Object.entries(THEMES)
      .map(([id, t]) => `<option value="${id}">${t.label}</option>`).join('');
  }
  syncUiFromState();

  // Toggle the panel open from the "</> Code" button.
  if (el.codeBtn && el.codeSnippetPanel) {
    el.codeBtn.addEventListener('click', () => {
      const open = el.codeSnippetPanel.style.display !== 'none';
      el.codeSnippetPanel.style.display = open ? 'none' : 'block';
      if (!open && el.codeInput) {
        if (!el.codeInput.value) el.codeInput.value = SAMPLE;
        el.codeInput.focus();
      }
    });
  }

  // The textarea is debounced; everything else applies immediately.
  if (el.codeInput) el.codeInput.addEventListener('input', debouncedApply);
  [el.codeLanguage, el.codeTheme, el.codeChrome, el.codeFont, el.codeTabSize]
    .forEach((c) => c && c.addEventListener('change', applyCodeSnippet));
  if (el.codeWindowTitle) el.codeWindowTitle.addEventListener('input', debouncedApply);
  [el.codeLineNumbers, el.codeWrap]
    .forEach((c) => c && c.addEventListener('change', applyCodeSnippet));
  if (el.codeFontSize) el.codeFontSize.addEventListener('input', () => {
    if (el.codeFontSizeValue) el.codeFontSizeValue.textContent = `${el.codeFontSize.value}px`;
    debouncedApply();
  });
  if (el.codePad) el.codePad.addEventListener('input', () => {
    if (el.codePadValue) el.codePadValue.textContent = `${el.codePad.value}px`;
    debouncedApply();
  });
  if (el.codeApplyBtn) el.codeApplyBtn.addEventListener('click', applyCodeSnippet);

  // Undo/redo: history restores the codeSnippet settings but not state.image
  // (images are never snapshotted). Regenerate the raster to match — but only
  // while we're still in code mode (the live image is our last raster).
  onHistoryChange(() => {
    if (suppress) return;
    if (state.codeSnippet.enabled && state.image === lastRaster) {
      syncUiFromState();
      rasterIntoState({ resize: false });
    }
  });

  // Project / page load: applyPayload() calls this after restoring the design.
  window.__reapplyCodeSnippet = () => {
    if (!state.codeSnippet || !state.codeSnippet.enabled) return;
    syncUiFromState();
    if (el.codeSnippetPanel) el.codeSnippetPanel.style.display = 'block';
    rasterIntoState({ resize: false });
  };
}
