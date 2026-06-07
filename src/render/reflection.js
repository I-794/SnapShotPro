// v14 — Device / subject reflection.
//
// Draws a faded, vertically-mirrored copy of `rect` (a region of `source`) just
// below it, for the classic glossy product-shot look. Used by both render paths:
//   • standard frame  — rect = state.lastImageRect, source = the main canvas.
//   • device mockup    — rect = the device bounds, source = the offscreen device
//                        canvas, so the reflection bakes into the 3D tilt too.

import { state } from '../state/state.js';

export function drawReflection(ctx, source, rect) {
  const r = state.reflection || {};
  const length = Math.max(0, Math.min(1, r.length ?? 0.5));
  const opacity = Math.max(0, Math.min(1, r.opacity ?? 0.35));
  const gap = r.gap ?? 8;
  if (length <= 0 || opacity <= 0) return;
  if (!rect || rect.w <= 0 || rect.h <= 0) return;

  const tw = Math.round(rect.w);
  const th = Math.round(rect.h * length);
  if (tw < 2 || th < 2) return;

  // Mirror the subject's bottom band onto a temp canvas. After the vertical flip,
  // the temp's top row is the subject's bottom row (so they meet seamlessly),
  // then we fade alpha to zero going downward, away from the subject.
  const tmp = document.createElement('canvas');
  tmp.width = tw;
  tmp.height = th;
  const t = tmp.getContext('2d');

  t.save();
  t.translate(0, th);
  t.scale(1, -1);
  t.drawImage(source, rect.x, rect.y + rect.h - th, rect.w, th, 0, 0, tw, th);
  t.restore();

  t.globalCompositeOperation = 'destination-out';
  const grad = t.createLinearGradient(0, 0, 0, th);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  t.fillStyle = grad;
  t.fillRect(0, 0, tw, th);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(tmp, rect.x, rect.y + rect.h + gap, rect.w, th);
  ctx.restore();
}
