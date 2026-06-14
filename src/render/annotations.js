import { state } from '../state/state.js';
import { hexToRgba } from '../utils/color.js';
import { withLayer } from './blend.js';
import { applyEntrance } from '../features/animation.js';

export function drawAnnotations(ctx) {
  if (!state.annotations) return;
  state.annotations.forEach((ann, idx) => {
    if (ann.visible === false) return;
    // v15.2 — per-element entrance, transformed about the annotation's center.
    const bb = annotationBBox(ann);
    let cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    if (!isFinite(cx) || !isFinite(cy)) { cx = ann.x1 || 0; cy = ann.y1 || 0; }
    const pushed = applyEntrance(ctx, 'L:ann:' + ann.id, cx, cy);
    withLayer(ctx, ann, () => drawAnnotation(ctx, ann, idx));
    if (pushed) ctx.restore();
  });
}

function drawAnnotation(ctx, ann, idx) {
    ctx.save();
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isSelected = state.selectedAnnotation === idx;

    if (ann.type === 'arrow') {
      drawArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, ann.strokeWidth);
    } else if (ann.type === 'pen' || ann.type === 'highlighter') {
      drawStroke(ctx, ann);
    } else if (SHAPE_TYPES.has(ann.type)) {
      // v16.0 — rect/circle/line/triangle/polygon/star share one path+paint
      // routine. Pre-v16 rect/circle records (no `fill`) render stroke-only,
      // exactly as before.
      drawShape(ctx, ann);
    } else if (ann.type === 'number') {
      const cx = ann.x1, cy = ann.y1;
      const r = ann.strokeWidth * 4 + 8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, ann.strokeWidth * 3 + 6)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ann.number), cx, cy);
    } else if (ann.type === 'sticker') {
      const cx = (ann.x1 + ann.x2) / 2, cy = (ann.y1 + ann.y2) / 2;
      const size = ann.size || 64;
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ann.color || '#ffffff';
      ctx.fillText(ann.glyph || '✨', cx, cy);
    }

    if (isSelected) {
      ctx.strokeStyle = 'rgba(0, 160, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      const bbox = annotationBBox(ann);
      ctx.strokeRect(bbox.x - 6, bbox.y - 6, bbox.w + 12, bbox.h + 12);
      ctx.setLineDash([]);
    }

    ctx.restore();
}

// v16.0 — annotation types that route through the shared shape renderer.
export const SHAPE_TYPES = new Set(['rect', 'circle', 'line', 'triangle', 'polygon', 'star']);

const HALF_PI = Math.PI / 2;

function regularPolygonPath(ctx, cx, cy, rx, ry, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function starPath(ctx, cx, cy, rx, ry, points, rot) {
  ctx.beginPath();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.45;   // outer / inner vertex
    const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// v16.0 — build a shape's path from its bounding box (x1,y1,x2,y2) and paint it:
// optional fill (closeable shapes only) then stroke. Shared by drawAnnotation
// and the live tool preview in canvas-tools.js. The caller sets strokeStyle /
// lineWidth beforehand; this only overrides fillStyle when ann.fill is set.
export function drawShape(ctx, ann) {
  const { x1, y1, x2, y2 } = ann;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;

  if (ann.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }

  if (ann.type === 'rect') {
    ctx.beginPath();
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (ann.type === 'circle') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else if (ann.type === 'triangle') {
    regularPolygonPath(ctx, cx, cy, rx, ry, 3, -HALF_PI);
  } else if (ann.type === 'polygon') {
    regularPolygonPath(ctx, cx, cy, rx, ry, Math.max(3, ann.sides || 6), -HALF_PI);
  } else if (ann.type === 'star') {
    starPath(ctx, cx, cy, rx, ry, Math.max(3, ann.points || 5), -HALF_PI);
  } else {
    return;
  }

  if (ann.fill) {
    ctx.save();
    ctx.fillStyle = hexToRgba(ann.fillColor || '#ffffff', (ann.fillOpacity ?? 100) / 100);
    ctx.fill();
    ctx.restore();
  }
  ctx.stroke();
}

export function drawStroke(ctx, ann) {
  const pts = ann.points;
  if (!pts || pts.length < 1) return;
  ctx.save();
  if (ann.type === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = hexToRgba(ann.color, 0.45);
    ctx.lineWidth = ann.strokeWidth * 3.5;
  } else {
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function annotationBBox(ann) {
  if (ann.type === 'pen' || ann.type === 'highlighter') {
    const pts = ann.points || [];
    if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return {
    x: Math.min(ann.x1, ann.x2),
    y: Math.min(ann.y1, ann.y2),
    w: Math.abs(ann.x2 - ann.x1),
    h: Math.abs(ann.y2 - ann.y1)
  };
}

export function drawArrow(ctx, x1, y1, x2, y2, color, strokeWidth) {
  const headLen = Math.max(16, strokeWidth * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
