import { state } from '../state/state.js';

export function drawTextOverlay(ctx, canvas) {
  if (!state.textOverlay.enabled || !state.textOverlay.content) return;
  ctx.save();
  let fontStyle = '';
  if (state.textOverlay.italic) fontStyle += 'italic ';
  if (state.textOverlay.bold) fontStyle += 'bold ';
  ctx.font = `${fontStyle}${state.textOverlay.size}px ${state.textOverlay.font}`;
  ctx.fillStyle = state.textOverlay.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tx = canvas.width * state.textOverlay.x;
  const ty = canvas.height * state.textOverlay.y;
  ctx.fillText(state.textOverlay.content, tx, ty);
  ctx.restore();
}

export function drawWatermark(ctx, canvas) {
  if (!state.watermark.enabled || !state.watermark.text) return;
  ctx.save();
  ctx.font = `${state.watermark.size}px Arial`;
  ctx.fillStyle = state.watermark.color;
  ctx.globalAlpha = state.watermark.opacity / 100;
  const padding = 20;
  let wx, wy;
  switch (state.watermark.position) {
    case 'bottom-right': ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; wx = canvas.width - padding; wy = canvas.height - padding; break;
    case 'bottom-left':  ctx.textAlign = 'left';  ctx.textBaseline = 'bottom'; wx = padding; wy = canvas.height - padding; break;
    case 'top-right':    ctx.textAlign = 'right'; ctx.textBaseline = 'top';    wx = canvas.width - padding; wy = padding; break;
    case 'top-left':     ctx.textAlign = 'left';  ctx.textBaseline = 'top';    wx = padding; wy = padding; break;
    case 'center':       ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; wx = canvas.width / 2; wy = canvas.height / 2; break;
  }
  ctx.fillText(state.watermark.text, wx, wy);
  ctx.restore();
}
