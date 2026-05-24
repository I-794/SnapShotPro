import { state } from '../state/state.js';

export function drawAnnotations(ctx) {
  if (!state.annotations) return;
  state.annotations.forEach((ann, idx) => {
    if (ann.visible === false) return;
    ctx.save();
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isSelected = state.selectedAnnotation === idx;

    if (ann.type === 'arrow') {
      drawArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, ann.strokeWidth);
    } else if (ann.type === 'rect') {
      const rx = Math.min(ann.x1, ann.x2), ry = Math.min(ann.y1, ann.y2);
      const rw = Math.abs(ann.x2 - ann.x1), rh = Math.abs(ann.y2 - ann.y1);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (ann.type === 'circle') {
      const cx = (ann.x1 + ann.x2) / 2, cy = (ann.y1 + ann.y2) / 2;
      const rx2 = Math.abs(ann.x2 - ann.x1) / 2, ry2 = Math.abs(ann.y2 - ann.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx2, ry2, 0, 0, Math.PI * 2);
      ctx.stroke();
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
      const minX = Math.min(ann.x1, ann.x2) - 6;
      const minY = Math.min(ann.y1, ann.y2) - 6;
      const maxW = Math.abs(ann.x2 - ann.x1) + 12;
      const maxH = Math.abs(ann.y2 - ann.y1) + 12;
      ctx.strokeRect(minX, minY, maxW, maxH);
      ctx.setLineDash([]);
    }

    ctx.restore();
  });
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
