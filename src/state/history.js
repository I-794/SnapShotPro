import { state } from './state.js';

export const history = { past: [], future: [], maxSize: 50 };

// Subscribers (e.g. layers panel, history timeline) call onChange after every snapshot/undo/redo.
const listeners = [];
export function onHistoryChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => fn()); }

function snapshot() {
  return JSON.parse(JSON.stringify({
    imageTransform: state.imageTransform,
    imageFilters: state.imageFilters,
    imageLayer: state.imageLayer,
    textOverlay: state.textOverlay,
    windowOverlay: state.windowOverlay,
    watermark: state.watermark,
    gradient: state.gradient,
    padding: state.padding,
    scale: state.scale,
    borderRadius: state.borderRadius,
    showBorder: state.showBorder,
    borderWidth: state.borderWidth,
    borderColor: state.borderColor,
    shadow: state.shadow,
    reflection: state.reflection,
    canvas: state.canvas,
    bgMode: state.bgMode,
    bgColor: state.bgColor,
    deviceFrame: state.deviceFrame,
    annotations: state.annotations,
    redactions: state.redactions,
    spotlight: state.spotlight,
    annotationColor: state.annotationColor,
    annotationStrokeWidth: state.annotationStrokeWidth,
    annotationFill: state.annotationFill,
    polygonSides: state.polygonSides,
    starPoints: state.starPoints,
    nextNumber: state.nextNumber,
    redactType: state.redactType,
    redactIntensity: state.redactIntensity,
    extraImages: state.extraImages,
    autoLayout: state.autoLayout,
    meshGradient: state.meshGradient,
    tilt3d: state.tilt3d,
    scene: state.scene,
    // v21 — 3D mockup. Strip the runtime-only orbitProgress (set per export
    // frame for the turntable spin) so undo never restores mid-spin, mirroring
    // how animation playing/currentTime are stripped above.
    mockup3d: { ...state.mockup3d, orbitProgress: 0 },
    // v15.2 — animation edits (tracks, easing, duration) are now undoable.
    // Snapshot a runtime-stripped copy so undo never restores mid-playback.
    animation: { ...state.animation, playing: false, currentTime: 0 },
    kenBurns: state.kenBurns,
    // v16.1 — Studio Effects overlays.
    glass: state.glass,
    grain: state.grain,
    // v16.2 — pattern background.
    pattern: state.pattern,
    // v17 — Color: active palette + edits and the color-map settings are
    // undoable. imageFilters (above) already carries temperature/tint. The
    // persisted palette library is localStorage-only, deliberately not snapshotted.
    colorPalettes: state.colorPalettes,
    colorMap: state.colorMap,
    // v24 — Code Snippet Studio settings are undoable. The raster (state.image)
    // is rebuilt from these by code-snippet.js's onHistoryChange listener, since
    // images are never snapshotted (same as the SVG/photo source).
    codeSnippet: state.codeSnippet,
    // v25 — Interactive Tour hotspots/callouts for the active step are undoable.
    tour: state.tour,
    // v27 — Surface Studio (physical & print mockup) settings are undoable.
    surface: state.surface
  }));
}

function restore(snap) {
  Object.assign(state, snap);
}

export function saveStateToHistory() {
  history.past.push(snapshot());
  if (history.past.length > history.maxSize) history.past.shift();
  history.future = [];
  emit();
}

export function undo(rerender) {
  if (history.past.length === 0) return;
  history.future.push(snapshot());
  restore(history.past.pop());
  rerender && rerender();
  emit();
}

export function redo(rerender) {
  if (history.future.length === 0) return;
  history.past.push(snapshot());
  restore(history.future.pop());
  rerender && rerender();
  emit();
}
