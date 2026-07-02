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

// Top-most board object under a screen point, or null. Cards/text are rect
// hits (text uses its bounding box); arrows are handled in Task 7.
export function hitTopBoardRef(clientX, clientY) {
  const p = screenToBoard(clientX, clientY);
  const objs = [...state.board.objects].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.kind === 'card' || o.kind === 'text') {
      if (p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h)
        return { kind: 'boardObject', id: o.id };
    }
  }
  return null;
}

export function resolveBoardRef(ref) {
  const o = state.board.objects.find(x => x.id === ref.id);
  if (!o) return null;
  const at = () => state.board.objects.indexOf(o);
  return {
    box: { x: o.x, y: o.y, w: o.w, h: o.h },
    moveBy(dx, dy) { o.x += dx; o.y += dy; },
    remove() { const i = at(); if (i !== -1) state.board.objects.splice(i, 1); },
    raiseToFront() { const i = at(); if (i !== -1) { state.board.objects.splice(i, 1); o.z = (state.board.objects[state.board.objects.length - 1]?.z || 0) + 1; state.board.objects.push(o); } },
    sendToBack() { const i = at(); if (i !== -1) { state.board.objects.splice(i, 1); o.z = (state.board.objects[0]?.z || 0) - 1; state.board.objects.unshift(o); } },
    clone() { return null; }   // card clone is page-level (Task 6); text clone added in Task 7
  };
}

export function clearBoardSelection() { state.boardSelection = []; }
export function selectBoardOnly(ref) { state.boardSelection = [ref]; }
export function toggleBoardRef(ref) {
  const i = state.boardSelection.findIndex(r => r.id === ref.id);
  if (i === -1) state.boardSelection.push(ref); else state.boardSelection.splice(i, 1);
}
