import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { drawArrow } from '../render/annotations.js';
import { hitTestExtraImageAtPoint } from './extra-images.js';
import { getCanvasCoords } from '../utils/geometry.js';

let drawing = { active: false, startX: 0, startY: 0 };
let dragOffset = { dx: 0, dy: 0 };
let isDraggingAnnotation = false;
let isDraggingText = false;
let textDragOffset = { dx: 0, dy: 0 };
let isDraggingExtraImage = false;

export function hitTestAnnotations(x, y) {
  if (!state.annotations) return -1;
  for (let i = state.annotations.length - 1; i >= 0; i--) {
    const ann = state.annotations[i];
    const minX = Math.min(ann.x1, ann.x2) - 10;
    const maxX = Math.max(ann.x1, ann.x2) + 10;
    const minY = Math.min(ann.y1, ann.y2) - 10;
    const maxY = Math.max(ann.y1, ann.y2) + 10;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) return i;
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
  } else if (tool === 'rect') {
    const rx = Math.min(startX, curX), ry = Math.min(startY, curY);
    const rw = Math.abs(curX - startX), rh = Math.abs(curY - startY);
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (tool === 'circle') {
    const cx = (startX + curX) / 2, cy = (startY + curY) / 2;
    const rx2 = Math.abs(curX - startX) / 2, ry2 = Math.abs(curY - startY) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx2, ry2, 0, 0, Math.PI * 2);
    ctx.stroke();
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
}

function canvasMouseMove(e) {
  if (!state.image) return;
  const canvas = el.previewCanvas;
  const { x, y } = getCanvasCoords(e, canvas);

  if (isDraggingText) {
    state.textOverlay.x = Math.max(0, Math.min(1, (x - textDragOffset.dx) / canvas.width));
    state.textOverlay.y = Math.max(0, Math.min(1, (y - textDragOffset.dy) / canvas.height));
    render();
    return;
  }

  if (isDraggingExtraImage && state.selectedExtraImage !== null) {
    const eiIdx = state.extraImages.findIndex(ei => ei.id === state.selectedExtraImage);
    if (eiIdx !== -1) {
      state.extraImages[eiIdx].xFrac = Math.max(0, Math.min(1, (x - dragOffset.dx) / canvas.width));
      state.extraImages[eiIdx].yFrac = Math.max(0, Math.min(1, (y - dragOffset.dy) / canvas.height));
      render();
    }
    return;
  }

  if (state.tool === 'select' && isDraggingAnnotation) {
    if (state.selectedAnnotation !== null && state.annotations[state.selectedAnnotation]) {
      const ann = state.annotations[state.selectedAnnotation];
      const dx = ann.x2 - ann.x1;
      const dy = ann.y2 - ann.y1;
      ann.x1 = x - dragOffset.dx;
      ann.y1 = y - dragOffset.dy;
      ann.x2 = ann.x1 + dx;
      ann.y2 = ann.y1 + dy;
      render();
    } else if (state.selectedRedaction !== null && state.redactions[state.selectedRedaction]) {
      const r = state.redactions[state.selectedRedaction];
      r.x = x - dragOffset.dx;
      r.y = y - dragOffset.dy;
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
  drawPreviewAnnotation(drawing.startX, drawing.startY, x, y);
}

function canvasMouseUp(e) {
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

  if (state.tool === 'arrow' || state.tool === 'rect' || state.tool === 'circle') {
    state.annotations.push({
      id: Date.now(),
      type: state.tool,
      x1: drawing.startX, y1: drawing.startY,
      x2: x, y2: y,
      color: state.annotationColor,
      strokeWidth: state.annotationStrokeWidth,
      number: null
    });
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
  el.previewCanvas.addEventListener('mousedown', canvasMouseDown);
  el.previewCanvas.addEventListener('mousemove', canvasMouseMove);
  el.previewCanvas.addEventListener('mouseup', canvasMouseUp);
  el.previewCanvas.addEventListener('mouseleave', canvasMouseUp);

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
  if (annDeleteBtn) annDeleteBtn.addEventListener('click', deleteSelected);
  if (annClearBtn) annClearBtn.addEventListener('click', () => {
    saveStateToHistory();
    state.annotations = [];
    state.selectedAnnotation = null;
    render();
  });
}
