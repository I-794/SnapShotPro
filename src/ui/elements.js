// All getElementById calls in one place. Initialized after DOMContentLoaded.

export const el = {};

const IDS = [
  // Core
  'upload-zone', 'canvas-wrapper', 'preview-canvas', 'file-input', 'upload-btn',
  'svg-btn', 'render-svg-btn', 'svg-input-container', 'svg-code-input',
  'export-btn', 'reset-btn', 'undo-btn', 'redo-btn', 'drop-zone',
  'notification', 'notification-text', 'theme-toggle-btn',
  'shortcuts-btn', 'shortcuts-overlay', 'close-shortcuts-btn', 'annotation-toolbar',

  // Image editing
  'rotate-left-btn', 'rotate-right-btn', 'flip-h-btn', 'flip-v-btn',
  'brightness', 'brightness-value', 'contrast', 'contrast-value',
  'saturation', 'saturation-value', 'blur', 'blur-value',
  'grayscale', 'grayscale-value', 'sepia', 'sepia-value',

  // Gradient
  'gradient-type', 'gradient-angle', 'gradient-angle-value', 'gradient-angle-group',
  'angle-indicator', 'gradient-color-1', 'gradient-color-2',
  'gradient-pos-1', 'gradient-pos-2', 'gradient-pos-1-value', 'gradient-pos-2-value',
  'gradient-preview',

  // Background panels
  'bg-gradient-panel', 'bg-solid-panel', 'bg-transparent-panel', 'bg-mesh-panel',
  'bg-solid-color', 'bg-solid-color-text',

  // Image settings
  'padding', 'padding-value', 'scale', 'scale-value',
  'border-radius', 'border-radius-value', 'show-border', 'border-controls',
  'border-width', 'border-width-value', 'border-color', 'border-color-text',

  // Device frame
  'device-frame-type', 'device-frame-controls', 'device-frame-color',
  'frame-url-group', 'frame-title-group', 'frame-url', 'frame-title',

  // Shadow
  'shadow-blur', 'shadow-blur-value', 'shadow-spread', 'shadow-spread-value',
  'shadow-opacity', 'shadow-opacity-value', 'shadow-x', 'shadow-x-value',
  'shadow-y', 'shadow-y-value', 'shadow-color', 'shadow-color-text',

  // Redaction
  'redact-type', 'redact-intensity', 'redact-intensity-value', 'clear-redactions-btn',

  // Spotlight
  'spotlight-enabled', 'spotlight-controls', 'spotlight-opacity', 'spotlight-opacity-value',

  // Canvas
  'canvas-width', 'canvas-height',

  // Text overlay
  'add-text-btn', 'text-controls', 'text-content', 'text-size', 'text-size-value',
  'text-font', 'text-color', 'text-color-text', 'text-bold', 'text-italic', 'remove-text-btn',

  // Watermark
  'watermark-enabled', 'watermark-controls', 'watermark-text', 'watermark-position',
  'watermark-size', 'watermark-size-value', 'watermark-opacity', 'watermark-opacity-value',
  'watermark-color', 'watermark-color-text',

  // Export
  'export-format', 'quality-controls', 'export-quality', 'export-quality-value',
  'copy-clipboard-btn', 'export-html-btn',

  // Templates
  'template-name', 'save-template-btn', 'clear-templates-btn', 'template-list',
  'load-template-btn', 'template-info',

  // v4 — layers, history, palette, zoom, stickers, tilt, scenes
  'layers-panel', 'layers-list', 'layers-toggle-btn',
  'history-track', 'history-position', 'history-undo-btn', 'history-redo-btn',
  'palette-overlay', 'palette-input', 'palette-results',
  'canvas-viewport', 'zoom-controls', 'zoom-label', 'zoom-in', 'zoom-out', 'zoom-fit',
  'minimap', 'minimap-canvas', 'minimap-viewport',
  'sticker-btn', 'sticker-drawer', 'sticker-close', 'sticker-grid', 'sticker-cats',
  'status-pill', 'mesh-pad',
  'tilt-rx', 'tilt-ry', 'tilt-rz', 'tilt-perspective', 'tilt-reset-btn',
  'tilt-rx-value', 'tilt-ry-value', 'tilt-rz-value', 'tilt-perspective-value',
  'scenes-grid',

  // Extra images / auto layout
  'add-image-btn', 'extra-file-input', 'extra-images-list',
  'layout-gap', 'layout-gap-value'
];

export function initElements() {
  for (const id of IDS) {
    // Convert kebab-case to camelCase (handles letters and digits)
    const key = id.replace(/-(.)/g, (_, c) => c.toUpperCase());
    el[key] = document.getElementById(id);
  }
  return el;
}
