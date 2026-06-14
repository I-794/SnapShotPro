import { state } from '../state/state.js';
import { hexToRgba } from '../utils/color.js';

export function drawBackground(ctx, canvas, forExport) {
  if (state.bgMode === 'transparent') {
    if (forExport) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      const size = 20;
      for (let px = 0; px < canvas.width; px += size) {
        for (let py = 0; py < canvas.height; py += size) {
          ctx.fillStyle = ((px / size + py / size) % 2 === 0) ? '#888888' : '#aaaaaa';
          ctx.fillRect(px, py, size, size);
        }
      }
    }
  } else if (state.bgMode === 'solid') {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.bgMode === 'mesh') {
    drawMeshGradient(ctx, canvas);
  } else if (state.bgMode === 'pattern') {
    drawPattern(ctx, canvas);
  } else if (state.bgMode === 'image' && state.bgImage) {
    drawImageBackground(ctx, canvas);
  } else {
    drawGradient(ctx, canvas);
  }
}

// v16.2 — tiled pattern background. The tile carries only the foreground motif
// (transparent elsewhere); the solid bg is filled first and the motif drawn over
// it at the chosen opacity, so opacity fades the motif against the bg color.
function patternTile(p) {
  const s = Math.max(4, p.size || 24);
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = p.fg;
  x.strokeStyle = p.fg;
  const lw = Math.max(1, Math.round(s * 0.07));
  if (p.type === 'dots') {
    x.beginPath();
    x.arc(s / 2, s / 2, Math.max(1, s * 0.16), 0, Math.PI * 2);
    x.fill();
  } else if (p.type === 'grid') {
    x.fillRect(0, 0, s, lw);
    x.fillRect(0, 0, lw, s);
  } else if (p.type === 'lines') {
    x.fillRect(0, 0, s, lw);
  } else if (p.type === 'checker') {
    x.fillRect(0, 0, s / 2, s / 2);
    x.fillRect(s / 2, s / 2, s / 2, s / 2);
  } else if (p.type === 'diagonal') {
    x.lineWidth = lw;
    x.beginPath();
    x.moveTo(0, s); x.lineTo(s, 0);
    x.moveTo(-1, 1); x.lineTo(1, -1);
    x.moveTo(s - 1, s + 1); x.lineTo(s + 1, s - 1);
    x.stroke();
  }
  return c;
}

function drawPattern(ctx, canvas) {
  const p = state.pattern || {};
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.fillStyle = p.bg || '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  const pat = ctx.createPattern(patternTile(p), 'repeat');
  if (pat) {
    ctx.globalAlpha = Math.max(0, Math.min(1, (p.opacity ?? 100) / 100));
    ctx.fillStyle = pat;
    if (p.angle) {
      const cx = w / 2, cy = h / 2, d = Math.hypot(w, h);
      ctx.translate(cx, cy);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      ctx.fillRect(cx - d, cy - d, d * 2, d * 2);
    } else {
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.restore();
}

function drawGradient(ctx, canvas) {
  let g;
  if (state.gradient.type === 'linear') {
    const angle = state.gradient.angle * Math.PI / 180;
    const x1 = canvas.width / 2 + Math.cos(angle) * canvas.width;
    const y1 = canvas.height / 2 + Math.sin(angle) * canvas.height;
    const x2 = canvas.width / 2 - Math.cos(angle) * canvas.width;
    const y2 = canvas.height / 2 - Math.sin(angle) * canvas.height;
    g = ctx.createLinearGradient(x1, y1, x2, y2);
  } else {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.max(canvas.width, canvas.height) / 2;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  }
  const colors = state.gradient.colors || [];
  const positions = state.gradient.positions || [];
  const n = Math.min(colors.length, positions.length);
  if (n < 2) {
    g.addColorStop(0, colors[0] || '#000');
    g.addColorStop(1, colors[colors.length - 1] || colors[0] || '#000');
  } else {
    for (let i = 0; i < n; i++) {
      const off = Math.max(0, Math.min(1, positions[i] / 100));
      g.addColorStop(off, colors[i]);
    }
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawImageBackground(ctx, canvas) {
  const img = state.bgImage;
  const cw = canvas.width, ch = canvas.height;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const r = Math.max(cw / iw, ch / ih);
  const dw = iw * r, dh = ih * r;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

export function drawMeshGradient(ctx, canvas) {
  const w = canvas.width, h = canvas.height;
  const pts = state.meshGradient.points;
  ctx.fillStyle = pts[0] ? pts[0].color : '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  pts.forEach(p => {
    const cx0 = p.x * w;
    const cy0 = p.y * h;
    const r = p.radius * Math.max(w, h);
    const g = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, r);
    g.addColorStop(0, p.color);
    g.addColorStop(1, hexToRgba(p.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.restore();
}
