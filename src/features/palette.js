import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { undo, redo } from '../state/history.js';
import { render } from '../render/render.js';
import { applyTheme } from '../ui/theme.js';
import { setZoom, fitZoom } from './zoom-pan.js';
import { exportImage, copyToClipboard, exportAsHTML } from './export.js';
import { resetTilt, applyTiltPreset } from './tilt.js';
import { applyMeshPreset } from './mesh-pad.js';
import { setScene } from './scene-select.js';
import { setTool } from './canvas-tools.js';
import { toggleLayersPanel } from './layers.js';
import { openStickerDrawer } from './stickers.js';
import { stickers } from '../state/presets.js';
import { addSticker } from './stickers.js';
import { saveStateToHistory } from '../state/history.js';
import { showStatus } from '../ui/notification.js';
import { setMode } from './set-ui.js';
import { exportSet, exportBatch } from './batch-export.js';
import { replaceBackground, extendCanvas, openEraser } from './ai-image-edit.js';
import { togglePlay } from './video.js';
import { focusUrlLoad } from './url-load.js';
import { exportVideoMp4, exportVideoGif } from './video-export.js';

let commands = [];

function setBg(mode) {
  saveStateToHistory();
  state.bgMode = mode;
  document.querySelectorAll('.tab-btn[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === mode));
  ['bgGradientPanel', 'bgMeshPanel', 'bgSolidPanel', 'bgTransparentPanel'].forEach(k => { if (el[k]) el[k].style.display = 'none'; });
  if (mode === 'gradient' && el.bgGradientPanel) el.bgGradientPanel.style.display = 'block';
  if (mode === 'mesh' && el.bgMeshPanel) el.bgMeshPanel.style.display = 'block';
  if (mode === 'solid' && el.bgSolidPanel) el.bgSolidPanel.style.display = 'block';
  if (mode === 'transparent' && el.bgTransparentPanel) el.bgTransparentPanel.style.display = 'block';
  render();
}

export function registerCommands() {
  commands = [
    { id: 'export-png',       label: 'Export as PNG',         icon: '📥', run: () => { state.exportSettings.format = 'png'; exportImage(); } },
    { id: 'export-jpeg',      label: 'Export as JPEG',        icon: '📥', run: () => { state.exportSettings.format = 'jpeg'; exportImage(); } },
    { id: 'export-webp',      label: 'Export as WebP',        icon: '📥', run: () => { state.exportSettings.format = 'webp'; exportImage(); } },
    { id: 'export-html',      label: 'Export as HTML Card',   icon: '🌐', run: exportAsHTML },
    { id: 'copy-clipboard',   label: 'Copy to Clipboard',     icon: '📋', run: copyToClipboard },
    { id: 'load-url',         label: 'Load from URL',         icon: '🔗', run: focusUrlLoad },
    { id: 'undo',             label: 'Undo',                  icon: '↶',  run: () => undo(render) },
    { id: 'redo',             label: 'Redo',                  icon: '↷',  run: () => redo(render) },
    { id: 'theme-dark',       label: 'Theme: Dark',           icon: '🌙', run: () => applyTheme('dark') },
    { id: 'theme-light',      label: 'Theme: Light',          icon: '☀️', run: () => applyTheme('light') },
    { id: 'zoom-in',          label: 'Zoom in',               icon: '🔍', run: () => setZoom(state.view.zoom * 1.2) },
    { id: 'zoom-out',         label: 'Zoom out',              icon: '🔍', run: () => setZoom(state.view.zoom / 1.2) },
    { id: 'zoom-fit',         label: 'Fit to screen',         icon: '⌧',  run: fitZoom },
    { id: 'toggle-layers',    label: 'Toggle Layers Panel',   icon: '☰',  run: toggleLayersPanel },
    { id: 'reset-tilt',       label: 'Reset 3D Tilt',         icon: '⟲',  run: resetTilt },
    { id: 'tilt-iso',         label: 'Tilt: Isometric',       icon: '◆',  run: () => applyTiltPreset('iso') },
    { id: 'tilt-lean',        label: 'Tilt: Lean',            icon: '◆',  run: () => applyTiltPreset('lean') },
    { id: 'tilt-card',        label: 'Tilt: Card',            icon: '◆',  run: () => applyTiltPreset('card') },
    { id: 'bg-gradient',      label: 'Background: Gradient',  icon: '🎨', run: () => setBg('gradient') },
    { id: 'bg-mesh',          label: 'Background: Mesh',      icon: '🎨', run: () => setBg('mesh') },
    { id: 'bg-solid',         label: 'Background: Solid',     icon: '🎨', run: () => setBg('solid') },
    { id: 'bg-transparent',   label: 'Background: Transparent', icon: '🎨', run: () => setBg('transparent') },
    { id: 'mesh-aurora',      label: 'Mesh: Aurora',          icon: '✨', run: () => applyMeshPreset('aurora') },
    { id: 'mesh-sunset',      label: 'Mesh: Sunset',          icon: '✨', run: () => applyMeshPreset('sunset') },
    { id: 'mesh-cyber',       label: 'Mesh: Cyber',           icon: '✨', run: () => applyMeshPreset('cyber') },
    { id: 'mesh-pastel',      label: 'Mesh: Pastel',          icon: '✨', run: () => applyMeshPreset('pastel') },
    { id: 'scene-none',       label: 'Scene: None',           icon: '⊘',  run: () => setScene('') },
    { id: 'scene-laptop',     label: 'Scene: Laptop',         icon: '💻', run: () => setScene('laptop') },
    { id: 'scene-phone',      label: 'Scene: Phone',          icon: '📱', run: () => setScene('phone') },
    { id: 'scene-tablet',     label: 'Scene: Tablet',         icon: '📺', run: () => setScene('tablet') },
    { id: 'scene-blurred',    label: 'Scene: Blurred bg',     icon: '🌫', run: () => setScene('blurred') },
    { id: 'scene-float',      label: 'Scene: Floating',       icon: '🪟', run: () => setScene('float') },
    { id: 'stickers',         label: 'Open Stickers Drawer',  icon: '✨', run: openStickerDrawer },
    { id: 'tool-select',      label: 'Tool: Select',          icon: '↖',  run: () => setTool('select') },
    { id: 'tool-arrow',       label: 'Tool: Arrow',           icon: '→',  run: () => setTool('arrow') },
    { id: 'tool-rect',        label: 'Tool: Rectangle',       icon: '▭',  run: () => setTool('rect') },
    { id: 'tool-circle',      label: 'Tool: Circle',          icon: '○',  run: () => setTool('circle') },
    { id: 'tool-pen',         label: 'Tool: Pen (freehand)',  icon: '✎',  run: () => setTool('pen') },
    { id: 'tool-highlighter', label: 'Tool: Highlighter',     icon: '🖍', run: () => setTool('highlighter') },
    { id: 'tool-number',      label: 'Tool: Number',          icon: '①',  run: () => setTool('number') },
    { id: 'tool-redact',      label: 'Tool: Redact',          icon: '▓',  run: () => setTool('redact') },
    { id: 'clear-annotations', label: 'Clear all annotations', icon: '🗑', run: () => { saveStateToHistory(); state.annotations = []; render(); showStatus('Annotations cleared'); } },
    { id: 'clear-redactions',  label: 'Clear all redactions',  icon: '🗑', run: () => { saveStateToHistory(); state.redactions = []; render(); showStatus('Redactions cleared'); } },
    { id: 'toggle-spotlight',  label: 'Toggle Spotlight',     icon: '◎',  run: () => { saveStateToHistory(); state.spotlight.enabled = !state.spotlight.enabled; render(); } },
    { id: 'ai-enhance',       label: 'AI Auto-Enhance',      icon: '✨', run: () => document.getElementById('ai-enhance-btn')?.click() },
    { id: 'style-watercolor', label: 'Style: Watercolor',    icon: '🎨', run: () => document.querySelector('[data-style-preset="watercolor"]')?.click() },
    { id: 'style-sketch',     label: 'Style: Sketch',        icon: '✏️', run: () => document.querySelector('[data-style-preset="sketch"]')?.click() },
    { id: 'style-vintage',    label: 'Style: Vintage',       icon: '📷', run: () => document.querySelector('[data-style-preset="vintage"]')?.click() },
    { id: 'style-cyber',      label: 'Style: Cyberpunk',     icon: '🌆', run: () => document.querySelector('[data-style-preset="cyber"]')?.click() },
    { id: 'style-noir',       label: 'Style: Noir',          icon: '🖤', run: () => document.querySelector('[data-style-preset="noir"]')?.click() },
    { id: 'style-reset',      label: 'Reset Filters',        icon: '⟲',  run: () => document.getElementById('style-reset-btn')?.click() },
    { id: 'share-image',      label: 'Share Image',          icon: '🔗', run: () => document.getElementById('share-btn')?.click() },
    { id: 'generate-qr',      label: 'Generate QR Code',     icon: '📱', run: () => document.getElementById('qr-btn')?.click() },
    { id: 'export-gif',       label: 'Export as GIF',         icon: '🎬', run: () => document.getElementById('gif-export-btn')?.click() },
    { id: 'anim-play',        label: 'Play/Pause Animation', icon: '▶',  run: () => document.getElementById('animation-play-btn')?.click() },
    { id: 'mode-single',      label: 'Mode: Single',         icon: '🖼', run: () => setMode('single') },
    { id: 'mode-set',         label: 'Mode: App Store Set',  icon: '📱', run: () => setMode('set') },
    { id: 'mode-batch',       label: 'Mode: Batch',          icon: '🗂', run: () => setMode('batch') },
    { id: 'export-set',       label: 'Export App Store set (ZIP)', icon: '📦', run: exportSet },
    { id: 'export-batch',     label: 'Batch export (ZIP)',   icon: '📦', run: exportBatch },
    { id: 'ai-art-director',  label: 'AI: Art Director (full design)', icon: '🎬', run: () => document.getElementById('art-director-btn')?.click() },
    { id: 'ai-replace-bg',    label: 'AI: Replace background', icon: '🪄', run: replaceBackground },
    { id: 'ai-extend',        label: 'AI: Extend canvas (outpaint)', icon: '↔', run: extendCanvas },
    { id: 'ai-eraser',        label: 'AI: Magic Eraser',     icon: '🧽', run: openEraser },
    { id: 'screen-record',    label: 'Record screen',        icon: '⏺', run: () => document.getElementById('screen-record-btn')?.click() },
    { id: 'auto-zoom-toggle', label: 'Toggle auto-zoom',     icon: '🔎', run: () => { const t = document.getElementById('auto-zoom-enabled'); if (t) { t.checked = !t.checked; t.dispatchEvent(new Event('change')); } } },
    { id: 'video-play',       label: 'Video: Play/Pause clip', icon: '🎬', run: togglePlay },
    { id: 'video-mp4',        label: 'Video: Export MP4',    icon: '⬇', run: exportVideoMp4 },
    { id: 'video-gif',        label: 'Video: Export GIF',    icon: '⬇', run: exportVideoGif }
  ];

  // Quick-add stickers as commands
  Object.values(stickers).flat().slice(0, 24).forEach(g => {
    commands.push({ id: 'sticker-' + g, label: 'Add sticker ' + g, icon: g, run: () => addSticker(g) });
  });
}

let activeIdx = 0;
let lastResults = [];

function fuzzyMatch(q, label) {
  if (!q) return 1;
  const qq = q.toLowerCase();
  const ll = label.toLowerCase();
  if (ll.includes(qq)) return 2;
  let qi = 0;
  for (let i = 0; i < ll.length && qi < qq.length; i++) {
    if (ll[i] === qq[qi]) qi++;
  }
  return qi === qq.length ? 1 : 0;
}

function renderPaletteResults() {
  const q = el.paletteInput.value.trim();
  lastResults = commands
    .map(c => ({ c, s: fuzzyMatch(q, c.label) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.c)
    .slice(0, 40);

  if (lastResults.length === 0) {
    el.paletteResults.innerHTML = '<div class="palette-empty">No matching commands</div>';
    return;
  }
  activeIdx = Math.min(activeIdx, lastResults.length - 1);
  el.paletteResults.innerHTML = lastResults.map((c, i) =>
    `<div class="palette-item${i === activeIdx ? ' active' : ''}" data-i="${i}">
      <span class="palette-icon">${c.icon}</span><span>${c.label}</span>
    </div>`
  ).join('');
  el.paletteResults.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => runPaletteIndex(parseInt(item.dataset.i, 10)));
    item.addEventListener('mouseenter', () => {
      activeIdx = parseInt(item.dataset.i, 10);
      el.paletteResults.querySelectorAll('.palette-item').forEach((x, j) => x.classList.toggle('active', j === activeIdx));
    });
  });
}

function runPaletteIndex(i) {
  const cmd = lastResults[i];
  if (!cmd) return;
  closePalette();
  try { cmd.run(); } catch (e) { console.error(e); }
}

export function openPalette() {
  state.ui.paletteOpen = true;
  el.paletteOverlay.classList.add('visible');
  el.paletteInput.value = '';
  activeIdx = 0;
  renderPaletteResults();
  setTimeout(() => el.paletteInput.focus(), 30);
}

export function closePalette() {
  state.ui.paletteOpen = false;
  el.paletteOverlay.classList.remove('visible');
}

export function bindPalette() {
  if (!el.paletteInput) return;
  el.paletteInput.addEventListener('input', () => { activeIdx = 0; renderPaletteResults(); });
  el.paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, lastResults.length - 1);
      renderPaletteResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      renderPaletteResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runPaletteIndex(activeIdx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });
  el.paletteOverlay.addEventListener('click', (e) => {
    if (e.target === el.paletteOverlay) closePalette();
  });
}
