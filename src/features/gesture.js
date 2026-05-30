// v7 — shared touch-gesture coordination between the canvas (draw/object-drag)
// and the viewport (pan/pinch). Kept in its own module to avoid a circular
// import between canvas-tools.js and zoom-pan.js.

// Live touch/pen pointers tracked by the viewport, keyed by pointerId.
// (Mouse is intentionally excluded — desktop uses the Space+drag mouse path.)
export const activePointers = new Map();

// True while the canvas is actively drawing or dragging an object, so the
// viewport knows not to start a one-finger pan for the same pointer.
export const gesture = { canvasBusy: false };
