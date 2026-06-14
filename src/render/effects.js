// v16.1 — Studio Effects: full-canvas overlay passes.
//
// Both are guarded by `enabled` so they cost nothing when off, and both run
// inside renderInto (after reflection, before text/watermark/logo) in BOTH the
// flat and device-mockup paths, so they bake into every export.

import { state } from '../state/state.js';
import { roundRectPath } from '../utils/geometry.js';
import { hexToRgba } from '../utils/color.js';
import { withLayer } from './blend.js';

// ── Liquid glass ───────────────────────────────────────────────────────────
// CSS backdrop-filter can't export, so we sample the pixels behind the panel
// and draw them back blurred + clipped to a rounded rect, then a translucent
// tint and a rim highlight. The sample is a drawImage-region copy (taint-safe),
// the same technique the redaction blur uses.

let _glassOff = null;
function glassCanvas(w, h) {
  if (!_glassOff) _glassOff = document.createElement('canvas');
  if (_glassOff.width !== w) _glassOff.width = w;
  if (_glassOff.height !== h) _glassOff.height = h;
  return _glassOff;
}

export function drawGlass(ctx, canvas) {
  const g = state.glass;
  if (!g || !g.enabled) return;
  const W = canvas.width, H = canvas.height;
  const x = Math.round(g.x * W), y = Math.round(g.y * H);
  const w = Math.round(g.w * W), h = Math.round(g.h * H);
  if (w < 4 || h < 4) return;
  const radius = Math.max(0, Math.min(g.radius ?? 24, w / 2, h / 2));
  const blur = Math.max(0, g.blur ?? 12);

  // Sample a margin around the panel so the blur has real neighbours to pull
  // from (no transparent-edge darkening inside the panel). The margin lies
  // outside the clip, so it never shows.
  const m = Math.ceil(blur * 2) + 2;
  const sx = Math.max(0, x - m), sy = Math.max(0, y - m);
  const sw = Math.min(W - sx, w + (x - sx) + m), sh = Math.min(H - sy, h + (y - sy) + m);
  if (sw < 1 || sh < 1) return;

  const off = glassCanvas(sw, sh);
  const octx = off.getContext('2d');
  octx.clearRect(0, 0, sw, sh);
  octx.filter = blur ? `blur(${blur}px)` : 'none';
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  octx.filter = 'none';

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(off, sx, sy);
  ctx.fillStyle = hexToRgba(g.tint || '#ffffff', (g.tintOpacity ?? 12) / 100);
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  if (g.rim) {
    ctx.save();
    roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(0, radius - 0.75));
    ctx.strokeStyle = hexToRgba('#ffffff', (g.rimOpacity ?? 40) / 100);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ── Film grain ───────────────────────────────────────────────────────────--
// A small noise tile is generated once and cached at module scope, then tiled
// with createPattern. Strength is the layer opacity (state.grain.amount), so
// dragging the amount slider never regenerates the tile — only toggling
// monochrome does. No per-pixel work per frame.

const GRAIN_TILE = 128;
let _grainTile = null;
let _grainKey = '';

function grainTile(monochrome) {
  const key = monochrome ? 'm' : 'c';
  if (_grainTile && _grainKey === key) return _grainTile;
  const c = document.createElement('canvas');
  c.width = GRAIN_TILE; c.height = GRAIN_TILE;
  const cx = c.getContext('2d');
  const img = cx.createImageData(GRAIN_TILE, GRAIN_TILE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (monochrome) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    } else {
      d[i] = (Math.random() * 255) | 0;
      d[i + 1] = (Math.random() * 255) | 0;
      d[i + 2] = (Math.random() * 255) | 0;
    }
    d[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  _grainTile = c; _grainKey = key;
  return c;
}

export function drawGrain(ctx, canvas) {
  const g = state.grain;
  if (!g || !g.enabled || g.amount <= 0) return;
  const tile = grainTile(g.monochrome !== false);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  const s = g.scale || 1;
  withLayer(ctx, { blend: g.blend || 'overlay', opacity: g.amount }, () => {
    ctx.save();
    if (s !== 1) ctx.scale(s, s);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width / s, canvas.height / s);
    ctx.restore();
  });
}

// Glass first (a placed panel), grain last (texture over everything beneath it).
export function drawEffects(ctx, canvas) {
  drawGlass(ctx, canvas);
  drawGrain(ctx, canvas);
}
