export const gradientPresets = {
  sunset:   { colors: ['#667eea', '#764ba2'], positions: [0, 100], angle: 135 },
  ocean:    { colors: ['#2E3192', '#1BFFFF'], positions: [0, 100], angle: 135 },
  forest:   { colors: ['#134E5E', '#71B280'], positions: [0, 100], angle: 135 },
  fire:     { colors: ['#F2994A', '#F2C94C'], positions: [0, 100], angle: 135 },
  midnight: { colors: ['#0F2027', '#2C5364'], positions: [0, 100], angle: 135 },
  rose:     { colors: ['#ED4264', '#FFEDBC'], positions: [0, 100], angle: 135 },
  purple:   { colors: ['#A8EDEA', '#FED6E3'], positions: [0, 100], angle: 135 },
  mint:     { colors: ['#84fab0', '#8fd3f4'], positions: [0, 100], angle: 135 },
  // v13.6 — twelve more gradients (warm, cool, fresh, soft, and two moody darks)
  coral:    { colors: ['#ff9966', '#ff5e62'], positions: [0, 100], angle: 135 },
  lagoon:   { colors: ['#43cea2', '#185a9d'], positions: [0, 100], angle: 135 },
  flamingo: { colors: ['#f857a6', '#ff5858'], positions: [0, 100], angle: 135 },
  tide:     { colors: ['#00dbde', '#20e3b2'], positions: [0, 100], angle: 135 },
  grape:    { colors: ['#6a3093', '#a044ff'], positions: [0, 100], angle: 135 },
  emerald:  { colors: ['#11998e', '#38ef7d'], positions: [0, 100], angle: 135 },
  peach:    { colors: ['#fceabb', '#f8b88b'], positions: [0, 100], angle: 135 },
  cosmos:   { colors: ['#1f1c2c', '#3a1c71'], positions: [0, 100], angle: 135 },
  slate:    { colors: ['#1a2332', '#2d3e50'], positions: [0, 100], angle: 135 },
  blush:    { colors: ['#ffafbd', '#ffc3a0'], positions: [0, 100], angle: 135 },
  lime:     { colors: ['#a8ff78', '#78ffd6'], positions: [0, 100], angle: 135 },
  ember:    { colors: ['#ff512f', '#f09819'], positions: [0, 100], angle: 135 }
};

export const shadowPresets = {
  soft:   { blur: 40, spread: 10, opacity: 30, x: 0, y: 10 },
  medium: { blur: 60, spread: 20, opacity: 40, x: 0, y: 20 },
  hard:   { blur: 80, spread: 30, opacity: 50, x: 0, y: 30 },
  none:   { blur: 0,  spread: 0,  opacity: 0,  x: 0, y: 0 }
};

export const sizePresets = {
  twitter:   { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  facebook:  { width: 1200, height: 630 },
  linkedin:  { width: 1200, height: 627 }
};

export const meshPresets = {
  aurora: ['#667eea', '#f093fb', '#4facfe', '#43e97b'],
  sunset: ['#fa709a', '#fee140', '#ff6a00', '#ee0979'],
  cyber:  ['#00f2fe', '#4facfe', '#a855f7', '#ec4899'],
  pastel: ['#ffecd2', '#fcb69f', '#a1c4fd', '#c2e9fb']
};

export const tiltPresets = {
  iso:  { rx: -20, ry: 25, rz:  0, perspective: 1200 },
  lean: { rx:   0, ry: 18, rz:  0, perspective: 1400 },
  card: { rx:  -8, ry:  0, rz: -4, perspective: 1600 }
};

// v16.2 — art-filter presets. Each is a complete imageFilters object, so
// applying one replaces the current filters wholesale (and exports for free,
// since render reads state.imageFilters). "None" is the neutral reset.
// v17 — every preset now carries temperature/tint (baked per-pixel in
// render/color-grade.js). They MUST be present on every preset or a previous
// preset's warmth would leak through on switch; "none" resets them to 0.
export const artFilterPresets = {
  none:    { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, temperature: 0, tint: 0 },
  noir:    { brightness: 100, contrast: 120, saturation: 100, blur: 0, grayscale: 100, sepia: 0, temperature: 0, tint: 0 },
  vintage: { brightness: 100, contrast: 110, saturation: 80,  blur: 0, grayscale: 0,   sepia: 60, temperature: 18, tint: 6 },
  vivid:   { brightness: 100, contrast: 115, saturation: 160, blur: 0, grayscale: 0,   sepia: 0, temperature: 0, tint: 0 },
  faded:   { brightness: 108, contrast: 95,  saturation: 70,  blur: 0, grayscale: 0,   sepia: 0, temperature: 6, tint: -4 },
  // v17 — cinematic color grades. The "feel" comes mostly from temperature/tint
  // plus contrast/saturation, so they read as deliberate looks, not just tone.
  tealorange: { brightness: 102, contrast: 118, saturation: 125, blur: 0, grayscale: 0, sepia: 0, temperature: 24, tint: -10 },
  moody:      { brightness: 94,  contrast: 122, saturation: 78,  blur: 0, grayscale: 0, sepia: 0, temperature: -18, tint: 8 },
  bleach:     { brightness: 110, contrast: 130, saturation: 55,  blur: 0, grayscale: 0, sepia: 0, temperature: 4, tint: 0 },
  golden:     { brightness: 104, contrast: 106, saturation: 120, blur: 0, grayscale: 0, sepia: 15, temperature: 30, tint: 4 }
};

// v15.2 — Ken Burns pan/zoom keyframes. Focal points are 0..1 of the image,
// scale is >=1. Pan presets keep a constant scale > 1 so there is room to move
// the crop window; the zoom presets hold the center and change scale.
export const kenBurnsPresets = {
  zoomIn:   { fromScale: 1.0,  toScale: 1.25, fromX: 0.5,  fromY: 0.5,  toX: 0.5,  toY: 0.5 },
  zoomOut:  { fromScale: 1.25, toScale: 1.0,  fromX: 0.5,  fromY: 0.5,  toX: 0.5,  toY: 0.5 },
  panLeft:  { fromScale: 1.18, toScale: 1.18, fromX: 0.72, fromY: 0.5,  toX: 0.28, toY: 0.5 },
  panRight: { fromScale: 1.18, toScale: 1.18, fromX: 0.28, fromY: 0.5,  toX: 0.72, toY: 0.5 },
  classic:  { fromScale: 1.05, toScale: 1.22, fromX: 0.4,  fromY: 0.42, toX: 0.6,  toY: 0.58 }
};

export const stickers = {
  reactions: ['🔥','👍','💡','⭐','❤️','🎉','😍','🚀','💯','✨','👀','🤯','💎','⚡','🏆','🎯','💪','🙌','👏','🤝'],
  badges:    ['NEW','HOT','FREE','PRO','BETA','SALE','TOP','LIVE','TIP','★','✓','!'],
  arrows:    ['→','←','↑','↓','↗','↘','↙','↖','⇒','⇐','⇑','⇓','➜','➤','➡','⮕'],
  callouts:  ['💬','🗨','📢','📣','🔔','📌','📍','⚠','❗','❓','ℹ','🎈']
};

export const FRAME_INSETS = {
  iphone:  { top: 60, bottom: 40, left: 24, right: 24 },
  chrome:  { top: 90, bottom: 0,  left: 0,  right: 0 },
  safari:  { top: 80, bottom: 0,  left: 0,  right: 0 },
  firefox: { top: 90, bottom: 0,  left: 0,  right: 0 },
  macos:   { top: 40, bottom: 0,  left: 0,  right: 0 },
  windows: { top: 40, bottom: 0,  left: 0,  right: 0 }
};
