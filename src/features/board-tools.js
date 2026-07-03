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

export function clampZoom(z) { return Math.max(0.1, Math.min(4, z)); }

// v32 Task 7 — bounding box of a group's children (union of child rects).
export function groupBounds(g) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
  for (const cid of g.children) {
    const k = state.board.objects.find(x => x.id === cid);
    if (!k) continue;
    any = true;
    minX = Math.min(minX, k.x); minY = Math.min(minY, k.y);
    maxX = Math.max(maxX, k.x + k.w); maxY = Math.max(maxY, k.y + k.h);
  }
  return any ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: 0, y: 0, w: 0, h: 0 };
}

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
  // No card/text hit directly — check groups (a click inside the group bbox but
  // outside every child selects the group).
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.kind !== 'group') continue;
    const b = groupBounds(o);
    if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
    const insideChild = o.children.some(cid => {
      const k = state.board.objects.find(x => x.id === cid);
      if (!k) return false;
      return p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h;
    });
    if (!insideChild) return { kind: 'boardObject', id: o.id };
  }
  return null;
}

export function resolveBoardRef(ref) {
  const o = state.board.objects.find(x => x.id === ref.id);
  if (!o) return null;
  const at = () => state.board.objects.indexOf(o);
  // v32 Task 7 — a group's box/move are derived from its children (moveBy
  // translates every child, so dragging a group moves all its members).
  if (o.kind === 'group') {
    return {
      box: groupBounds(o),
      moveBy(dx, dy) { for (const cid of o.children) { const k = state.board.objects.find(x => x.id === cid); if (k) { k.x += dx; k.y += dy; } } },
      remove() { const i = at(); if (i !== -1) state.board.objects.splice(i, 1); },
      raiseToFront() {}, sendToBack() {}, clone() { return null; }
    };
  }
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
