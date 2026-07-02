// v32 — board-space hit-testing + coordinate helpers (analog of canvas-tools.js
// for the board). Board coordinates are world px inside the camera-transformed
// .board-surface; screen coordinates are clientX/clientY.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';

export function screenToBoard(clientX, clientY) {
  const vp = el.canvasViewport.getBoundingClientRect();
  const { x, y, zoom } = state.board.camera;
  return { x: (clientX - vp.left - x) / zoom, y: (clientY - vp.top - y) / zoom };
}

export function boardToScreen(x, y) {
  const vp = el.canvasViewport.getBoundingClientRect();
  const { x: cx, y: cy, zoom } = state.board.camera;
  return { x: x * zoom + cx + vp.left, y: y * zoom + cy + vp.top };
}

export function clampZoom(z) { return Math.max(0.1, Math.min(4, z)); }
