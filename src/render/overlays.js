import { state, brandAssets } from '../state/state.js';

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

// v10 — brand logo watermark. Draws the decoded logo (brandAssets.logoImage,
// loaded by brand-kit.js) scaled to a fraction of canvas width, in a corner or
// centered. No-op until the image has decoded; brand-kit.js re-renders on load.
export function drawLogo(ctx, canvas) {
  const lg = state.logo;
  const img = brandAssets.logoImage;
  if (!lg || !lg.enabled || !lg.src) return;
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, lg.opacity / 100));
  const w = canvas.width * lg.scale;
  const h = w * (img.naturalHeight / img.naturalWidth);
  const pad = Math.round(canvas.width * 0.025);
  let x, y;
  switch (lg.position) {
    case 'bottom-left':  x = pad;                       y = canvas.height - h - pad; break;
    case 'top-right':    x = canvas.width - w - pad;    y = pad;                     break;
    case 'top-left':     x = pad;                       y = pad;                     break;
    case 'center':       x = (canvas.width - w) / 2;    y = (canvas.height - h) / 2; break;
    case 'bottom-right':
    default:             x = canvas.width - w - pad;    y = canvas.height - h - pad; break;
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
