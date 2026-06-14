import { state, brandAssets } from '../state/state.js';
import { roundRectPath } from '../utils/geometry.js';
import { withLayer } from './blend.js';
import { applyEntrance } from '../features/animation.js';

export function drawTextOverlay(ctx, canvas) {
  const t = state.textOverlay;
  if (!t.enabled || !t.content) return;
  // v15.2 — per-element entrance, about the text anchor.
  const pushed = applyEntrance(ctx, 'L:text', canvas.width * t.x, canvas.height * t.y);
  withLayer(ctx, t, () => drawTextOverlayBody(ctx, canvas, t));
  if (pushed) ctx.restore();
}

function drawTextOverlayBody(ctx, canvas, t) {

  // v14 — effect sub-objects. `|| {}` keeps pre-v14 saves (which lack these)
  // rendering: an absent group reads as disabled.
  const hl = t.highlight || {};
  const sh = t.shadow || {};
  const st = t.stroke || {};
  const gr = t.gradient || {};

  ctx.save();
  let fontStyle = '';
  if (t.italic) fontStyle += 'italic ';
  if (t.bold) fontStyle += 'bold ';
  ctx.font = `${fontStyle}${t.size}px ${t.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tx = canvas.width * t.x;
  const ty = canvas.height * t.y;
  const w = ctx.measureText(t.content).width;
  const h = t.size;

  // 1) Highlight box behind the text — drawn before the shadow is set so the box
  //    itself casts none.
  if (hl.enabled) {
    const pad = hl.padding ?? 8;
    ctx.save();
    ctx.fillStyle = hl.color || '#ffff00';
    roundRectPath(ctx, tx - w / 2 - pad, ty - h / 2 - pad, w + pad * 2, h + pad * 2, hl.radius ?? 6);
    ctx.fill();
    ctx.restore();
  }

  // 2) Drop shadow — cast by the outermost text paint (the stroke if present,
  //    otherwise the fill).
  if (sh.enabled) {
    ctx.shadowColor = sh.color || '#000000';
    ctx.shadowBlur = sh.blur ?? 6;
    ctx.shadowOffsetX = sh.x ?? 2;
    ctx.shadowOffsetY = sh.y ?? 2;
  }

  // 3) Outline.
  if (st.enabled) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = st.width ?? 2;
    ctx.strokeStyle = st.color || '#000000';
    ctx.strokeText(t.content, tx, ty);
    // The stroke already cast the shadow; clear it so the fill doesn't double it.
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // 4) Fill — gradient across the text box, or a solid color.
  if (gr.enabled) {
    const a = (gr.angle ?? 0) * Math.PI / 180;
    const hw = w / 2, hh = h / 2;
    const g = ctx.createLinearGradient(
      tx - Math.cos(a) * hw, ty - Math.sin(a) * hh,
      tx + Math.cos(a) * hw, ty + Math.sin(a) * hh
    );
    g.addColorStop(0, gr.color1 || '#ffffff');
    g.addColorStop(1, gr.color2 || '#2348ff');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = t.color;
  }
  ctx.fillText(t.content, tx, ty);

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
