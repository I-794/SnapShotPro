import { state, imageRegistry } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { drawArrow, drawStroke, annotationBBox, drawShape, SHAPE_TYPES } from '../render/annotations.js';
import { hitTestExtraImageAtPoint } from './extra-images.js';
import { getCanvasCoords } from '../utils/geometry.js';
import { activePointers, gesture } from './gesture.js';
import { snapDragPosition, snapTextCenter, snapExtraImageCenter, clearGuides } from './snapping.js';

let drawing = { active: false, startX: 0, startY: 0, points: [] };
let dragOffset = { dx: 0, dy: 0 };
let isDraggingAnnotation = false;
let isDraggingText = false;
let textDragOffset = { dx: 0, dy: 0 };
let isDraggingExtraImage = false;
let capturedPointerId = null;

// Abandon any in-progress one-finger interaction (used when a 2nd finger lands,
// so the viewport can take over for pinch/two-finger pan).
function cancelInteraction() {
  drawing.active = false;
  drawing.points = [];
  isDraggingText = false;
  isDraggingAnnotation = false;
  isDraggingExtraImage = false;
  gesture.canvasBusy = false;
  clearGuides();
  if (capturedPointerId !== null) {
    try { el.previewCanvas.releasePointerCapture(capturedPointerId); } catch (_) {}
    capturedPointerId = null;
  }
  render();
}

export function hitTestAnnotations(x, y) {
  if (!state.annotations) return -1;
  for (let i = state.annotations.length - 1; i >= 0; i--) {
    const ann = state.annotations[i];
    const bb = annotationBBox(ann);
    const pad = 10;
    if (x >= bb.x - pad && x <= bb.x + bb.w + pad &&
        y >= bb.y - pad && y <= bb.y + bb.h + pad) return i;
  }
  return -1;
}

export function hitTestText(x, y) {
  if (!state.textOverlay.enabled || !state.textOverlay.content) return false;
  const ctx = el.previewCanvas.getContext('2d');
  const tx = el.previewCanvas.width * state.textOverlay.x;
  const ty = el.previewCanvas.height * state.textOverlay.y;
  let fontStr = '';
  if (state.textOverlay.italic) fontStr += 'italic ';
  if (state.textOverlay.bold) fontStr += 'bold ';
  fontStr += `${state.textOverlay.size}px ${state.textOverlay.font}`;
  ctx.save();
  ctx.font = fontStr;
  const metrics = ctx.measureText(state.textOverlay.content);
  ctx.restore();
  const hw = metrics.width / 2 + 10;
  const hh = state.textOverlay.size / 2 + 10;
  return Math.abs(x - tx) <= hw && Math.abs(y - ty) <= hh;
}

export function hitTestRedactions(x, y) {
  if (!state.redactions) return -1;
  for (let i = state.redactions.length - 1; i >= 0; i--) {
    const r = state.redactions[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export function deleteSelected() {
  if (state.selectedAnnotation !== null && state.annotations[state.selectedAnnotation]) {
    saveStateToHistory();
    state.annotations.splice(state.selectedAnnotation, 1);
    state.selectedAnnotation = null;
    render();
  } else if (state.selectedRedaction !== null && state.redactions[state.selectedRedaction]) {
    saveStateToHistory();
    state.redactions.splice(state.selectedRedaction, 1);
    state.selectedRedaction = null;
    render();
  }
}

// v14 — resolve the currently "selected" element into a uniform handle: its
// bounding box (canvas px) and a moveTo(x,y) that repositions its top-left.
// Priority: annotation → redaction → extra image → text overlay (there is no
// multi-select, so one element is active at a time).
function selectedTarget() {
  const canvas = el.previewCanvas;
  const cw = canvas.width, ch = canvas.height;

  if (state.selectedAnnotation !== null && state.annotations[state.selectedAnnotation]) {
    const ann = state.annotations[state.selectedAnnotation];
    const bb = annotationBBox(ann);
    return { box: bb, moveTo(nx, ny) {
      const sx = nx - bb.x, sy = ny - bb.y;
      if (Array.isArray(ann.points)) ann.points.forEach(p => { p.x += sx; p.y += sy; });
      ann.x1 += sx; ann.y1 += sy; ann.x2 += sx; ann.y2 += sy;
    } };
  }
  if (state.selectedRedaction !== null && state.redactions[state.selectedRedaction]) {
    const r = state.redactions[state.selectedRedaction];
    return { box: { x: r.x, y: r.y, w: r.w, h: r.h }, moveTo(nx, ny) { r.x = nx; r.y = ny; } };
  }
  if (state.selectedExtraImage !== null) {
    const ei = state.extraImages.find(e => e.id === state.selectedExtraImage);
    const img = ei && imageRegistry[ei.id];
    if (ei && img) {
      const w = img.width * ei.scaleFrac, h = img.height * ei.scaleFrac;
      return { box: { x: cw * ei.xFrac - w / 2, y: ch * ei.yFrac - h / 2, w, h }, moveTo(nx, ny) {
        ei.xFrac = (nx + w / 2) / cw; ei.yFrac = (ny + h / 2) / ch;
      } };
    }
  }
  if (state.textOverlay.enabled && state.textOverlay.content) {
    const t = state.textOverlay;
    const ctx = canvas.getContext('2d');
    let f = '';
    if (t.italic) f += 'italic ';
    if (t.bold) f += 'bold ';
    ctx.save(); ctx.font = `${f}${t.size}px ${t.font}`;
    const w = ctx.measureText(t.content).width; ctx.restore();
    const h = t.size;
    return { box: { x: cw * t.x - w / 2, y: ch * t.y - h / 2, w, h }, moveTo(nx, ny) {
      t.x = (nx + w / 2) / cw; t.y = (ny + h / 2) / ch;
    } };
  }
  return null;
}

// Arrow-key nudge of the selected element by (dx,dy) canvas px. `save` records a
// single history entry at the start of a key-repeat burst. Returns whether
// anything moved (so the caller can decide to preventDefault).
export function nudgeSelected(dx, dy, save) {
  const t = selectedTarget();
  if (!t) return false;
  if (save) saveStateToHistory();
  t.moveTo(t.box.x + dx, t.box.y + dy);
  render();
  return true;
}

// Align the selected element's bounding box to the canvas.
export function alignSelectedToCanvas(how) {
  const canvas = el.previewCanvas;
  const t = selectedTarget();
  if (!t) return;
  saveStateToHistory();
  const { box } = t;
  let nx = box.x, ny = box.y;
  switch (how) {
    case 'left':    nx = 0; break;
    case 'hcenter': nx = (canvas.width - box.w) / 2; break;
    case 'right':   nx = canvas.width - box.w; break;
    case 'top':     ny = 0; break;
    case 'vcenter': ny = (canvas.height - box.h) / 2; break;
    case 'bottom':  ny = canvas.height - box.h; break;
  }
  t.moveTo(nx, ny);
  render();
}

function drawPreviewAnnotation(startX, startY, curX, curY) {
  if (!state.image) return;
  render();
  const ctx = el.previewCanvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = state.annotationColor;
  ctx.fillStyle = state.annotationColor;
  ctx.lineWidth = state.annotationStrokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tool = state.tool;
  if (tool === 'arrow') {
    drawArrow(ctx, startX, startY, curX, curY, state.annotationColor, state.annotationStrokeWidth);
  } else if (tool === 'pen' || tool === 'highlighter') {
    drawStroke(ctx, {
      type: tool,
      points: drawing.points,
      color: state.annotationColor,
      strokeWidth: state.annotationStrokeWidth
    });
  } else if (SHAPE_TYPES.has(tool)) {
    // v16.0 — live preview mirrors the final paint via the shared renderer.
    drawShape(ctx, {
      type: tool, x1: startX, y1: startY, x2: curX, y2: curY,
      fill: tool !== 'line' && state.annotationFill.enabled,
      fillColor: state.annotationFill.color,
      fillOpacity: state.annotationFill.opacity,
      sides: state.polygonSides,
      points: state.starPoints
    });
  } else if (tool === 'redact') {
    const rx = Math.min(startX, curX), ry = Math.min(startY, curY);
    const rw = Math.abs(curX - startX), rh = Math.abs(curY - startY);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,102,0,0.2)';
    ctx.fillRect(rx, ry, rw, rh);
  } else if (tool === 'spotlight') {
    const cw = el.previewCanvas.width, ch = el.previewCanvas.height;
    const rx = Math.min(startX, curX), ry = Math.min(startY, curY);
    const rw = Math.abs(curX - startX), rh = Math.abs(curY - startY);
    ctx.fillStyle = `rgba(0,0,0,${state.spotlight.opacity})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();
}

function canvasMouseDown(e) {
  if (!state.image) return;
  // A second touch/pen pointer landed → abandon the one-finger interaction and
  // let the viewport handle pinch-zoom / two-finger pan instead.
  if (e.pointerType !== 'mouse' && activePointers.size >= 1) {
    cancelInteraction();
    return;
  }
  canvasDownLogic(e);
  // Claim the pointer only when we actually started drawing or dragging, so an
  // empty-canvas tap with the Select tool falls through to the viewport (pan).
  gesture.canvasBusy = drawing.active || isDraggingText || isDraggingAnnotation || isDraggingExtraImage;
  if (gesture.canvasBusy && e.pointerId != null) {
    try { el.previewCanvas.setPointerCapture(e.pointerId); capturedPointerId = e.pointerId; } catch (_) {}
  }
}

function canvasDownLogic(e) {
  const canvas = el.previewCanvas;
  const { x, y } = getCanvasCoords(e, canvas);

  if (state.tool === 'select') {
    if (hitTestText(x, y)) {
      isDraggingText = true;
      textDragOffset = { dx: x - canvas.width * state.textOverlay.x, dy: y - canvas.height * state.textOverlay.y };
      return;
    }
    const annIdx = hitTestAnnotations(x, y);
    const redIdx = hitTestRedactions(x, y);
    if (annIdx !== -1) {
      state.selectedAnnotation = annIdx;
      state.selectedRedaction = null;
      const ann = state.annotations[annIdx];
      dragOffset = { dx: x - ann.x1, dy: y - ann.y1 };
      isDraggingAnnotation = true;
      isDraggingExtraImage = false;
      render();
    } else if (redIdx !== -1) {
      state.selectedRedaction = redIdx;
      state.selectedAnnotation = null;
      const r = state.redactions[redIdx];
      dragOffset = { dx: x - r.x, dy: y - r.y };
      isDraggingAnnotation = true;
      isDraggingExtraImage = false;
      render();
    } else {
      const eiIdx = hitTestExtraImageAtPoint(x, y, canvas);
      if (eiIdx !== -1) {
        const ei = state.extraImages[eiIdx];
        state.selectedExtraImage = ei.id;
        state.selectedAnnotation = null;
        state.selectedRedaction = null;
        dragOffset = { dx: x - canvas.width * ei.xFrac, dy: y - canvas.height * ei.yFrac };
        isDraggingExtraImage = true;
        isDraggingAnnotation = false;
        render();
      } else {
        state.selectedAnnotation = null;
        state.selectedRedaction = null;
        state.selectedExtraImage = null;
        isDraggingAnnotation = false;
        isDraggingExtraImage = false;
        render();
      }
    }
    return;
  }

  drawing.active = true;
  drawing.startX = x;
  drawing.startY = y;
  drawing.points = (state.tool === 'pen' || state.tool === 'highlighter') ? [{ x, y }] : [];
}

function canvasMouseMove(e) {
  if (!state.image) return;
  const canvas = el.previewCanvas;
  const { x, y } = getCanvasCoords(e, canvas);

  if (isDraggingText) {
    const { cx, cy } = snapTextCenter(x - textDragOffset.dx, y - textDragOffset.dy, canvas);
    state.textOverlay.x = Math.max(0, Math.min(1, cx / canvas.width));
    state.textOverlay.y = Math.max(0, Math.min(1, cy / canvas.height));
    render();
    return;
  }

  if (isDraggingExtraImage && state.selectedExtraImage !== null) {
    const eiIdx = state.extraImages.findIndex(ei => ei.id === state.selectedExtraImage);
    if (eiIdx !== -1) {
      const ei = state.extraImages[eiIdx];
      const { cx, cy } = snapExtraImageCenter(ei, x - dragOffset.dx, y - dragOffset.dy, canvas);
      ei.xFrac = Math.max(0, Math.min(1, cx / canvas.width));
      ei.yFrac = Math.max(0, Math.min(1, cy / canvas.height));
      render();
    }
    return;
  }

  if (state.tool === 'select' && isDraggingAnnotation) {
    if (state.selectedAnnotation !== null && state.annotations[state.selectedAnnotation]) {
      const ann = state.annotations[state.selectedAnnotation];
      // Intended move, then snap the resulting bounding box to canvas/peers.
      const bb = annotationBBox(ann);
      let shiftX = (x - dragOffset.dx) - ann.x1;
      let shiftY = (y - dragOffset.dy) - ann.y1;
      const snapped = snapDragPosition('annotation',
        { x: bb.x + shiftX, y: bb.y + shiftY, w: bb.w, h: bb.h }, canvas, state.selectedAnnotation);
      shiftX += snapped.x - (bb.x + shiftX);
      shiftY += snapped.y - (bb.y + shiftY);
      if ((ann.type === 'pen' || ann.type === 'highlighter') && Array.isArray(ann.points)) {
        ann.points.forEach(p => { p.x += shiftX; p.y += shiftY; });
      }
      ann.x1 += shiftX; ann.y1 += shiftY;
      ann.x2 += shiftX; ann.y2 += shiftY;
      render();
    } else if (state.selectedRedaction !== null && state.redactions[state.selectedRedaction]) {
      const r = state.redactions[state.selectedRedaction];
      const snapped = snapDragPosition('redaction',
        { x: x - dragOffset.dx, y: y - dragOffset.dy, w: r.w, h: r.h }, canvas, state.selectedRedaction);
      r.x = snapped.x;
      r.y = snapped.y;
      render();
    }
    return;
  }

  if (state.tool === 'select') {
    const canMove = hitTestText(x, y) || hitTestExtraImageAtPoint(x, y, canvas) !== -1 ||
                    hitTestAnnotations(x, y) !== -1 || hitTestRedactions(x, y) !== -1;
    canvas.style.cursor = canMove ? 'move' : '';
  }

  if (!drawing.active) return;
  if (state.tool === 'pen' || state.tool === 'highlighter') {
    const last = drawing.points[drawing.points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 1.5) {
      drawing.points.push({ x, y });
    }
  }
  drawPreviewAnnotation(drawing.startX, drawing.startY, x, y);
}

function canvasMouseUp(e) {
  canvasUpLogic(e);
  gesture.canvasBusy = false;
  clearGuides();
  if (capturedPointerId !== null) {
    try { el.previewCanvas.releasePointerCapture(capturedPointerId); } catch (_) {}
    capturedPointerId = null;
  }
  render();
}

function canvasUpLogic(e) {
  if (!state.image) return;
  const canvas = el.previewCanvas;

  if (isDraggingText) {
    saveStateToHistory();
    isDraggingText = false;
    return;
  }
  if (isDraggingExtraImage) {
    saveStateToHistory();
    isDraggingExtraImage = false;
    return;
  }
  if (state.tool === 'select') {
    if (isDraggingAnnotation) {
      saveStateToHistory();
      isDraggingAnnotation = false;
    }
    return;
  }
  if (!drawing.active) return;
  drawing.active = false;

  const { x, y } = getCanvasCoords(e, canvas);
  const dx = Math.abs(x - drawing.startX), dy = Math.abs(y - drawing.startY);
  if (dx < 3 && dy < 3 && state.tool !== 'number') return;

  saveStateToHistory();

  if (state.tool === 'pen' || state.tool === 'highlighter') {
    if (drawing.points.length >= 2) {
      const bb = (() => {
        let mnx = drawing.points[0].x, mxx = mnx, mny = drawing.points[0].y, mxy = mny;
        for (const p of drawing.points) {
          if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
          if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
        }
        return { x1: mnx, y1: mny, x2: mxx, y2: mxy };
      })();
      state.annotations.push({
        id: Date.now(),
        type: state.tool,
        points: drawing.points.slice(),
        x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2,
        color: state.annotationColor,
        strokeWidth: state.annotationStrokeWidth,
        number: null
      });
    }
    drawing.points = [];
  } else if (state.tool === 'arrow' || SHAPE_TYPES.has(state.tool)) {
    const ann = {
      id: Date.now(),
      type: state.tool,
      x1: drawing.startX, y1: drawing.startY,
      x2: x, y2: y,
      color: state.annotationColor,
      strokeWidth: state.annotationStrokeWidth,
      number: null
    };
    // v16.0 — bake the fill + shape params onto closeable shapes at creation, so
    // each record renders independently of the current toolbar state.
    if (state.tool !== 'arrow' && state.tool !== 'line' && state.annotationFill.enabled) {
      ann.fill = true;
      ann.fillColor = state.annotationFill.color;
      ann.fillOpacity = state.annotationFill.opacity;
    }
    if (state.tool === 'polygon') ann.sides = state.polygonSides;
    if (state.tool === 'star') ann.points = state.starPoints;
    state.annotations.push(ann);
  } else if (state.tool === 'number') {
    state.annotations.push({
      id: Date.now(),
      type: 'number',
      x1: x, y1: y, x2: x, y2: y,
      color: state.annotationColor,
      strokeWidth: state.annotationStrokeWidth,
      number: state.nextNumber++
    });
  } else if (state.tool === 'redact') {
    const rx = Math.min(drawing.startX, x);
    const ry = Math.min(drawing.startY, y);
    const rw = Math.abs(x - drawing.startX);
    const rh = Math.abs(y - drawing.startY);
    if (rw > 4 && rh > 4) {
      state.redactions.push({
        id: Date.now(),
        x: rx, y: ry, w: rw, h: rh,
        type: state.redactType,
        intensity: state.redactIntensity
      });
    }
  } else if (state.tool === 'spotlight') {
    const cw = canvas.width, ch = canvas.height;
    const rx = Math.min(drawing.startX, x);
    const ry = Math.min(drawing.startY, y);
    const rw = Math.abs(x - drawing.startX);
    const rh = Math.abs(y - drawing.startY);
    state.spotlight.x = rx / cw;
    state.spotlight.y = ry / ch;
    state.spotlight.w = rw / cw;
    state.spotlight.h = rh / ch;
    state.spotlight.enabled = true;
    if (el.spotlightEnabled) el.spotlightEnabled.checked = true;
    if (el.spotlightControls) el.spotlightControls.style.display = 'block';
  }

  render();
}

export function setTool(t) {
  state.tool = t;
  el.previewCanvas.dataset.tool = t;
  document.querySelectorAll('.ann-tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}

export function bindCanvasTools() {
  // Pointer events give a single code path for mouse + touch + pen.
  el.previewCanvas.addEventListener('pointerdown', canvasMouseDown);
  el.previewCanvas.addEventListener('pointermove', canvasMouseMove);
  el.previewCanvas.addEventListener('pointerup', canvasMouseUp);
  el.previewCanvas.addEventListener('pointercancel', canvasMouseUp);

  document.querySelectorAll('.ann-tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      state.selectedAnnotation = null;
      state.selectedRedaction = null;
      setTool(btn.dataset.tool);
      render();
    });
  });

  const annColor = document.getElementById('ann-color');
  const annStroke = document.getElementById('ann-stroke');
  const annDeleteBtn = document.getElementById('ann-delete-btn');
  const annClearBtn = document.getElementById('ann-clear-btn');
  if (annColor) annColor.addEventListener('input', (e) => { state.annotationColor = e.target.value; });
  if (annStroke) annStroke.addEventListener('change', (e) => { state.annotationStrokeWidth = parseInt(e.target.value); });

  // v16.0 — shape fill + polygon/star params. Live preview reads these on the
  // next drag; they bake onto each new record at creation.
  const annFillEnabled = document.getElementById('ann-fill-enabled');
  const annFillColor = document.getElementById('ann-fill-color');
  const annSides = document.getElementById('ann-sides');
  const annPoints = document.getElementById('ann-points');
  if (annFillEnabled) annFillEnabled.addEventListener('change', (e) => { state.annotationFill.enabled = e.target.checked; });
  if (annFillColor) annFillColor.addEventListener('input', (e) => { state.annotationFill.color = e.target.value; });
  if (annSides) annSides.addEventListener('change', (e) => { state.polygonSides = Math.max(3, Math.min(12, parseInt(e.target.value) || 6)); });
  if (annPoints) annPoints.addEventListener('change', (e) => { state.starPoints = Math.max(3, Math.min(12, parseInt(e.target.value) || 5)); });
  if (annDeleteBtn) annDeleteBtn.addEventListener('click', deleteSelected);
  if (annClearBtn) annClearBtn.addEventListener('click', () => {
    saveStateToHistory();
    state.annotations = [];
    state.selectedAnnotation = null;
    render();
  });

  // v14 — align the selected element to the canvas.
  document.querySelectorAll('.align-canvas-btn[data-align-canvas]').forEach(btn => {
    btn.addEventListener('click', () => alignSelectedToCanvas(btn.dataset.alignCanvas));
  });
}
