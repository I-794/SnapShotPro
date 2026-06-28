// v28 — Studio Quality-of-Life: unified canvas-object selection model.
//
// Before v28 the canvas could only select one thing at a time, tracked across
// three separate fields (selectedAnnotation/selectedRedaction by index,
// selectedExtraImage by id, plus the singleton textOverlay). This module gives
// every selectable object a uniform *ref* — { kind, id } — and a uniform handle
// (box / moveBy / clone / remove / raise / lower / style) so multi-select, group
// move, context-menu actions, and align all operate through one code path.
//
// state.canvasSelection (array of refs) is the source of truth. To keep the
// existing sidebar bindings, nudge, and align working unchanged, syncLegacy()
// mirrors a *single* selection back into the legacy selectedAnnotation/etc.
// fields; an empty or multi selection clears them.

import { state, imageRegistry } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { annotationBBox } from '../render/annotations.js';

// kinds: 'annotation' | 'redaction' | 'extraImage' | 'text'
// text is a singleton overlay, so its ref has no id.

function newId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export function refsEqual(a, b) {
  return a && b && a.kind === b.kind && a.id === b.id;
}

export function isRefSelected(ref) {
  return state.canvasSelection.some((r) => refsEqual(r, ref));
}

// Enumerate every currently selectable object on the canvas, top-most last.
export function objectRefs() {
  const refs = [];
  (state.annotations || []).forEach((a) => refs.push({ kind: 'annotation', id: a.id }));
  (state.redactions || []).forEach((r) => refs.push({ kind: 'redaction', id: r.id }));
  (state.extraImages || []).forEach((e) => refs.push({ kind: 'extraImage', id: e.id }));
  if (state.textOverlay.enabled && state.textOverlay.content) refs.push({ kind: 'text' });
  return refs;
}

// Resolve a ref into a uniform handle. Returns null if the object no longer
// exists. box/moveBy work in canvas pixels; extraImage/text convert to/from the
// fractional coords they store internally.
export function resolveRef(ref) {
  const canvas = el.previewCanvas;
  const cw = canvas.width, ch = canvas.height;

  if (ref.kind === 'annotation') {
    const ann = (state.annotations || []).find((a) => a.id === ref.id);
    if (!ann) return null;
    // Indices are recomputed at call time (not captured) so batch reorder/remove
    // stays correct as the array shifts under us.
    const at = () => state.annotations.indexOf(ann);
    return {
      box: annotationBBox(ann),
      moveBy(dx, dy) {
        if (Array.isArray(ann.points)) ann.points.forEach((p) => { p.x += dx; p.y += dy; });
        ann.x1 += dx; ann.y1 += dy; ann.x2 += dx; ann.y2 += dy;
      },
      clone() {
        const copy = JSON.parse(JSON.stringify(ann));
        copy.id = newId();
        const r = { kind: 'annotation', id: copy.id };
        if (Array.isArray(copy.points)) copy.points.forEach((p) => { p.x += CLONE_OFFSET; p.y += CLONE_OFFSET; });
        copy.x1 += CLONE_OFFSET; copy.y1 += CLONE_OFFSET; copy.x2 += CLONE_OFFSET; copy.y2 += CLONE_OFFSET;
        state.annotations.push(copy);
        return r;
      },
      remove() { const i = at(); if (i !== -1) state.annotations.splice(i, 1); },
      raiseToFront() { const i = at(); if (i !== -1) state.annotations.push(state.annotations.splice(i, 1)[0]); },
      sendToBack() { const i = at(); if (i !== -1) state.annotations.unshift(state.annotations.splice(i, 1)[0]); },
      getStyle() {
        return {
          color: ann.color, strokeWidth: ann.strokeWidth,
          fill: ann.fill, fillColor: ann.fillColor, fillOpacity: ann.fillOpacity,
        };
      },
      setStyle(s) {
        if (s.color != null) ann.color = s.color;
        if (s.strokeWidth != null) ann.strokeWidth = s.strokeWidth;
        if (s.fill != null) ann.fill = s.fill;
        if (s.fillColor != null) ann.fillColor = s.fillColor;
        if (s.fillOpacity != null) ann.fillOpacity = s.fillOpacity;
      },
    };
  }

  if (ref.kind === 'redaction') {
    const r = (state.redactions || []).find((x) => x.id === ref.id);
    if (!r) return null;
    const at = () => state.redactions.indexOf(r);
    return {
      box: { x: r.x, y: r.y, w: r.w, h: r.h },
      moveBy(dx, dy) { r.x += dx; r.y += dy; },
      clone() {
        const copy = JSON.parse(JSON.stringify(r));
        copy.id = newId();
        copy.x += CLONE_OFFSET; copy.y += CLONE_OFFSET;
        state.redactions.push(copy);
        return { kind: 'redaction', id: copy.id };
      },
      remove() { const i = at(); if (i !== -1) state.redactions.splice(i, 1); },
      raiseToFront() { const i = at(); if (i !== -1) state.redactions.push(state.redactions.splice(i, 1)[0]); },
      sendToBack() { const i = at(); if (i !== -1) state.redactions.unshift(state.redactions.splice(i, 1)[0]); },
    };
  }

  if (ref.kind === 'extraImage') {
    const ei = (state.extraImages || []).find((e) => e.id === ref.id);
    const img = ei && imageRegistry[ei.id];
    if (!ei || !img) return null;
    const at = () => state.extraImages.indexOf(ei);
    const w = img.width * ei.scaleFrac, h = img.height * ei.scaleFrac;
    return {
      box: { x: cw * ei.xFrac - w / 2, y: ch * ei.yFrac - h / 2, w, h },
      moveBy(dx, dy) { ei.xFrac += dx / cw; ei.yFrac += dy / ch; },
      clone() {
        const id = 'extra_' + newId();
        imageRegistry[id] = img;           // share the same decoded image
        const copy = { ...JSON.parse(JSON.stringify(ei)), id };
        copy.xFrac += CLONE_OFFSET / cw; copy.yFrac += CLONE_OFFSET / ch;
        state.extraImages.push(copy);
        return { kind: 'extraImage', id };
      },
      remove() { const i = at(); if (i !== -1) state.extraImages.splice(i, 1); },
      raiseToFront() { const i = at(); if (i !== -1) state.extraImages.push(state.extraImages.splice(i, 1)[0]); },
      sendToBack() { const i = at(); if (i !== -1) state.extraImages.unshift(state.extraImages.splice(i, 1)[0]); },
    };
  }

  if (ref.kind === 'text') {
    const t = state.textOverlay;
    if (!t.enabled || !t.content) return null;
    const ctx = canvas.getContext('2d');
    let f = '';
    if (t.italic) f += 'italic ';
    if (t.bold) f += 'bold ';
    ctx.save(); ctx.font = `${f}${t.size}px ${t.font}`;
    const w = ctx.measureText(t.content).width; ctx.restore();
    const h = t.size;
    return {
      box: { x: cw * t.x - w / 2, y: ch * t.y - h / 2, w, h },
      moveBy(dx, dy) { t.x += dx / cw; t.y += dy / ch; },
      // Text is a singleton overlay: it can't be duplicated or deleted from the
      // canvas (it's owned by the Text sidebar section), so these are no-ops.
      clone() { return null; },
      remove() {},
      raiseToFront() {},
      sendToBack() {},
    };
  }

  return null;
}

const CLONE_OFFSET = 16;

// --- Selection mutation ---------------------------------------------------

export function clearSelection() {
  state.canvasSelection = [];
  syncLegacy();
}

export function setSelection(refs) {
  state.canvasSelection = (refs || []).slice();
  syncLegacy();
}

export function selectOnly(ref) {
  setSelection([ref]);
}

export function toggleRef(ref) {
  const i = state.canvasSelection.findIndex((r) => refsEqual(r, ref));
  if (i === -1) state.canvasSelection.push(ref);
  else state.canvasSelection.splice(i, 1);
  syncLegacy();
}

export function selectAll() {
  setSelection(objectRefs());
}

// Mirror a lone selection into the legacy single-select fields so the existing
// sidebar bindings, nudgeSelected, and alignSelectedToCanvas keep working. A
// multi or empty selection clears them.
export function syncLegacy() {
  state.selectedAnnotation = null;
  state.selectedRedaction = null;
  state.selectedExtraImage = null;
  if (state.canvasSelection.length === 1) {
    const r = state.canvasSelection[0];
    if (r.kind === 'annotation') {
      const i = state.annotations.findIndex((a) => a.id === r.id);
      if (i !== -1) state.selectedAnnotation = i;
    } else if (r.kind === 'redaction') {
      const i = state.redactions.findIndex((x) => x.id === r.id);
      if (i !== -1) state.selectedRedaction = i;
    } else if (r.kind === 'extraImage') {
      state.selectedExtraImage = r.id;
    }
  }
}

// Duplicate every selected object (offset slightly) and select the copies.
// Records one history entry. Text (singleton) is skipped. Returns true if any
// object was duplicated. Callers render() afterward.
export function duplicateSelection() {
  if (!state.canvasSelection.length) return false;
  saveStateToHistory();
  const clones = [];
  state.canvasSelection.forEach((ref) => {
    const h = resolveRef(ref);
    if (!h) return;
    const c = h.clone();
    if (c) clones.push(c);
  });
  if (clones.length) setSelection(clones);
  return clones.length > 0;
}

// --- Group operations -----------------------------------------------------

// Union bounding box of the current selection (canvas px), or null if empty.
export function selectionBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  state.canvasSelection.forEach((ref) => {
    const h = resolveRef(ref);
    if (!h) return;
    any = true;
    minX = Math.min(minX, h.box.x); minY = Math.min(minY, h.box.y);
    maxX = Math.max(maxX, h.box.x + h.box.w); maxY = Math.max(maxY, h.box.y + h.box.h);
  });
  return any ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

// Move the whole selection so its union box aligns to a canvas edge/center.
export function groupAlign(how) {
  const canvas = el.previewCanvas;
  const b = selectionBounds();
  if (!b) return;
  let dx = 0, dy = 0;
  switch (how) {
    case 'left':    dx = -b.x; break;
    case 'hcenter': dx = (canvas.width - b.w) / 2 - b.x; break;
    case 'right':   dx = canvas.width - b.w - b.x; break;
    case 'top':     dy = -b.y; break;
    case 'vcenter': dy = (canvas.height - b.h) / 2 - b.y; break;
    case 'bottom':  dy = canvas.height - b.h - b.y; break;
  }
  state.canvasSelection.forEach((ref) => { const h = resolveRef(ref); if (h) h.moveBy(dx, dy); });
}
