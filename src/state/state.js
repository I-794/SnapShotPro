// Single source of truth for the entire app.
// Other modules import this and mutate it directly (kept simple — no observer pattern).
// Call render() from render/render.js after mutating to redraw.

export const state = {
  image: null,
  svgCode: null,
  imageTransform: { rotation: 0, flipH: false, flipV: false },
  imageFilters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 },
  textOverlay: { enabled: false, content: '', size: 48, font: 'Arial', color: '#ffffff', bold: false, italic: false, x: 0.5, y: 0.5 },
  windowOverlay: { enabled: false, style: 'macos', title: 'Screenshot', height: 40, showControls: true },
  watermark: { enabled: false, text: '', position: 'bottom-right', size: 16, opacity: 50, color: '#ffffff' },
  exportSettings: { format: 'png', quality: 92 },
  gradient: { type: 'linear', angle: 135, colors: ['#667eea', '#764ba2'], positions: [0, 100] },
  padding: 60,
  scale: 100,
  borderRadius: 12,
  showBorder: false,
  borderWidth: 2,
  borderColor: '#ffffff',
  shadow: { blur: 40, spread: 10, opacity: 30, x: 0, y: 10, color: '#000000' },
  canvas: { width: 1200, height: 675 },
  theme: 'dark',
  bgMode: 'gradient',
  bgColor: '#1a1a2e',
  bgImage: null,
  deviceFrame: { type: null, color: 'dark', glare: true, url: 'https://example.com', title: 'Screenshot' },
  annotations: [],
  redactions: [],
  spotlight: { enabled: false, x: 0.2, y: 0.2, w: 0.6, h: 0.6, opacity: 0.65 },
  annotationColor: '#ff3b30',
  annotationStrokeWidth: 4,
  tool: 'select',
  selectedAnnotation: null,
  selectedRedaction: null,
  nextNumber: 1,
  redactType: 'pixelate',
  redactIntensity: 12,
  extraImages: [],
  selectedExtraImage: null,
  autoLayout: { pattern: 'free', gap: 40, align: 'center' },
  view: { zoom: 1, panX: 0, panY: 0 },
  tilt3d: { rx: 0, ry: 0, rz: 0, perspective: 1200 },
  meshGradient: {
    points: [
      { x: 0.20, y: 0.25, color: '#667eea', radius: 0.55 },
      { x: 0.80, y: 0.30, color: '#f093fb', radius: 0.55 },
      { x: 0.30, y: 0.80, color: '#4facfe', radius: 0.55 },
      { x: 0.85, y: 0.85, color: '#43e97b', radius: 0.55 }
    ]
  },
  scene: { id: '' },
  animation: {
    enabled: false,
    duration: 3000,
    playing: false,
    currentTime: 0,
    tracks: []
  },
  aiEnhance: {
    stylePreset: null,
    lastSuggestion: null
  },
  share: {
    lastUrl: null
  },
  ui: { layersCollapsed: false, paletteOpen: false, stickerDrawerOpen: false },
  selection: { layerIds: [] },
  lastImageRect: null
};

// Extra-image Image objects live outside state (not JSON-serializable).
export const imageRegistry = {};
