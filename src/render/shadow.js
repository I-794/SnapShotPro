import { state } from '../state/state.js';

export function drawShadow(ctx, canvas, x, y, width, height) {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = canvas.width;
  shadowCanvas.height = canvas.height;
  const sctx = shadowCanvas.getContext('2d');

  const opacity = state.shadow.opacity / 100;
  const m = state.shadow.color.match(/^#([0-9A-Fa-f]{6})$/);
  if (m) {
    const r = parseInt(state.shadow.color.slice(1, 3), 16);
    const g = parseInt(state.shadow.color.slice(3, 5), 16);
    const b = parseInt(state.shadow.color.slice(5, 7), 16);
    sctx.shadowColor = `rgba(${r},${g},${b},${opacity})`;
  } else {
    sctx.shadowColor = `rgba(0,0,0,${opacity})`;
  }
  sctx.shadowBlur = state.shadow.blur;
  sctx.shadowOffsetX = state.shadow.x;
  sctx.shadowOffsetY = state.shadow.y;

  const rad = state.borderRadius;
  const spread = state.shadow.spread;
  const sx = x - spread, sy = y - spread;
  const sw = width + spread * 2, sh = height + spread * 2;

  sctx.fillStyle = 'black';
  sctx.beginPath();
  sctx.moveTo(sx + rad, sy);
  sctx.lineTo(sx + sw - rad, sy);
  sctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + rad);
  sctx.lineTo(sx + sw, sy + sh - rad);
  sctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - rad, sy + sh);
  sctx.lineTo(sx + rad, sy + sh);
  sctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - rad);
  sctx.lineTo(sx, sy + rad);
  sctx.quadraticCurveTo(sx, sy, sx + rad, sy);
  sctx.closePath();
  sctx.fill();

  // Punch out the image area
  sctx.globalCompositeOperation = 'destination-out';
  sctx.fillStyle = 'rgba(0,0,0,1)';
  sctx.beginPath();
  sctx.moveTo(x + rad, y);
  sctx.lineTo(x + width - rad, y);
  sctx.quadraticCurveTo(x + width, y, x + width, y + rad);
  sctx.lineTo(x + width, y + height - rad);
  sctx.quadraticCurveTo(x + width, y + height, x + width - rad, y + height);
  sctx.lineTo(x + rad, y + height);
  sctx.quadraticCurveTo(x, y + height, x, y + height - rad);
  sctx.lineTo(x, y + rad);
  sctx.quadraticCurveTo(x, y, x + rad, y);
  sctx.closePath();
  sctx.fill();

  ctx.drawImage(shadowCanvas, 0, 0);
}

export function drawBorder(ctx, x, y, width, height) {
  ctx.strokeStyle = state.borderColor;
  ctx.lineWidth = state.borderWidth;
  const rad = state.borderRadius;
  const offset = state.borderWidth / 2;
  ctx.beginPath();
  ctx.moveTo(x + rad, y + offset);
  ctx.lineTo(x + width - rad, y + offset);
  ctx.quadraticCurveTo(x + width - offset, y + offset, x + width - offset, y + rad);
  ctx.lineTo(x + width - offset, y + height - rad);
  ctx.quadraticCurveTo(x + width - offset, y + height - offset, x + width - rad, y + height - offset);
  ctx.lineTo(x + rad, y + height - offset);
  ctx.quadraticCurveTo(x + offset, y + height - offset, x + offset, y + height - rad);
  ctx.lineTo(x + offset, y + rad);
  ctx.quadraticCurveTo(x + offset, y + offset, x + rad, y + offset);
  ctx.closePath();
  ctx.stroke();
}
