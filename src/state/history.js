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
    // v15.2 — animation edits (tracks, easing, duration) are now undoable.
    // Snapshot a runtime-stripped copy so undo never restores mid-playback.
    animation: { ...state.animation, playing: false, currentTime: 0 },
    kenBurns: state.kenBurns,
    // v16.1 — Studio Effects overlays.
    glass: state.glass,
    grain: state.grain
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
