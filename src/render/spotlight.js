import { state } from '../state/state.js';

export function drawSpotlight(ctx, canvas) {
  if (!state.spotlight.enabled) return;
  const cw = canvas.width, ch = canvas.height;
  const sx = state.spotlight.x * cw, sy = state.spotlight.y * ch;
  const sw = state.spotlight.w * cw, sh = state.spotlight.h * ch;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${state.spotlight.opacity})`;
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();
}
