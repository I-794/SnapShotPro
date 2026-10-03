import { state } from '../state/state.js';

export function drawSpotlight(ctx, canvas) {
  if (!state.spotlight.enabled) return;
  const cw = canvas.width, ch = canvas.height;
  const sx = state.spotlight.x * cw, sy = state.spotlight.y * ch;
  const sw = state.spotlight.w * cw, sh = state.spotlight.h * ch;
  // v33.2 — one even-odd path (canvas minus the hole). The old fill +
  // destination-out also erased the screenshot under the hole, so exports had a
  // transparent window where the highlighted content should be.
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${state.spotlight.opacity})`;
  ctx.beginPath();
  ctx.rect(0, 0, cw, ch);
  ctx.rect(sx, sy, sw, sh);
  ctx.fill('evenodd');
  ctx.restore();
}
