// Single source of truth for the entire app.
// Other modules import this and mutate it directly (kept simple — no observer pattern).
// Call render() from render/render.js after mutating to redraw.

export const state = {
  image: null,
  svgCode: null,
  imageTransform: { rotation: 0, flipH: false, flipV: false },
  imageFilters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 },
  textOverlay: {
    enabled: false, content: '', size: 48, font: 'Arial', color: '#ffffff', bold: false, italic: false, x: 0.5, y: 0.5,
    // v14 — richer text effects. All default off; pre-v14 saves lack these and
    // render fine (drawTextOverlay + updateUIFromState default-merge them).
    stroke: { enabled: false, width: 2, color: '#000000' },
    gradient: { enabled: false, color1: '#ffffff', color2: '#2348ff', angle: 0 },
    highlight: { enabled: false, color: '#ffff00', padding: 8, radius: 6 },
    shadow: { enabled: false, blur: 6, x: 2, y: 2, color: '#000000' }
  },
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
  // v14 — mirrored reflection beneath the device/subject. length = fraction of
  // subject height that is mirrored; gap = px between subject and reflection.
  reflection: { enabled: false, opacity: 0.35, length: 0.5, gap: 8 },
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
  lastImageRect: null,

  // v9 — App Store screenshot sets + batch.
  // mode: 'single' (normal editor) | 'set' (one design → N captioned store
  // panels) | 'batch' (one template → N uploaded images → ZIP).
  mode: 'single',
  screenshotSet: {
    preset: 'ios-6.7',
    active: 0,
    // Each panel: { imageId, headline, subhead, position: 'top'|'bottom' }.
    // imageId is null to reuse the globally-loaded screenshot, else a key into
    // imageRegistry (panels can each show a different app screen).
    panels: [
      { imageId: null, headline: 'Capture anything', subhead: 'One tap and done.', position: 'top' }
    ],
    // Caption styling shared across panels. headlineSize/subheadSize are
    // fractions of canvas width so they scale across preset sizes.
    shared: { font: 'Geist', headlineColor: '#0b0b0d', subheadColor: '#4a4a52', headlineSize: 0.05, subheadSize: 0.028 },
    // v11.2 — locales to export. 'en' uses the original captions; each other
    // locale gets AI-translated captions in its own ZIP subfolder.
    locales: ['en']
  },
  batch: { images: [] },   // [{ id, name }] — Image objects live in imageRegistry

  // v9.2 — video/clip support. The <video> element + frame canvas live in
  // video.js (not JSON-serializable); this just holds trim + playback params.
  video: { loaded: false, duration: 0, in: 0, out: 0, fps: 30, playing: false, w: 0, h: 0 },

  // v11.1 — screen recording cursor/click track (normalized coords, t in ms
  // from record start) used to build auto-zoom keyframes; and the auto-zoom
  // toggle/intensity. `keyframes` is derived from events when a recording loads.
  recording: { events: [] },
  autoZoom: { enabled: false, intensity: 1.6, keyframes: [] },

  // v10 — Brand Kit logo watermark. `src` is a dataUrl (JSON-serializable so it
  // travels with brand kits/templates); the decoded Image lives in `brandAssets`
  // below. `scale`/`opacity` are fractions/percent; position mirrors watermark.
  logo: { enabled: false, src: null, position: 'bottom-right', scale: 0.12, opacity: 90 }
};

// Extra-image Image objects live outside state (not JSON-serializable).
export const imageRegistry = {};

// v10 — decoded brand-logo Image lives here (not in state, like imageRegistry).
// brand-kit.js loads state.logo.src into this; overlays.js draws it.
export const brandAssets = { logoImage: null };
