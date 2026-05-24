import { state } from '../state/state.js';
import { roundRectPath, fitContain } from '../utils/geometry.js';

export function drawSceneBackground(ctx, canvas) {
  const id = state.scene.id;
  if (!id) return null;
  const w = canvas.width, h = canvas.height;

  if (id === 'laptop') {
    ctx.save();
    ctx.fillStyle = '#2a2a35';
    const lapW = w * 0.78, lapH = h * 0.66;
    const lapX = (w - lapW) / 2, lapY = (h - lapH) / 2 - h * 0.04;
    ctx.fillStyle = '#0d0d12';
    roundRectPath(ctx, lapX, lapY, lapW, lapH, 14); ctx.fill();
    ctx.fillStyle = '#1a1a25'; ctx.beginPath();
    ctx.arc(lapX + lapW / 2, lapY + 10, 3, 0, Math.PI * 2); ctx.fill();
    const baseY = lapY + lapH + 6;
    ctx.fillStyle = '#3a3a48';
    roundRectPath(ctx, lapX - lapW * 0.08, baseY, lapW * 1.16, 16, 6); ctx.fill();
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(lapX + lapW * 0.35, baseY, lapW * 0.3, 4);
    ctx.restore();
    const pad = 16;
    return { rect: { x: lapX + pad, y: lapY + 22, w: lapW - pad * 2, h: lapH - 32 } };
  }

  if (id === 'phone') {
    ctx.save();
    const pw = h * 0.45, ph = h * 0.86;
    const px = (w - pw) / 2, py = (h - ph) / 2;
    ctx.fillStyle = '#1a1a25';
    roundRectPath(ctx, px, py, pw, ph, 32); ctx.fill();
    ctx.fillStyle = '#0d0d12';
    roundRectPath(ctx, px + 8, py + 8, pw - 16, ph - 16, 26); ctx.fill();
    ctx.fillStyle = '#000';
    roundRectPath(ctx, px + pw / 2 - 40, py + 16, 80, 18, 9); ctx.fill();
    ctx.restore();
    return { rect: { x: px + 12, y: py + 40, w: pw - 24, h: ph - 56 } };
  }

  if (id === 'tablet') {
    ctx.save();
    const tw = w * 0.7, th = h * 0.82;
    const tx = (w - tw) / 2, ty = (h - th) / 2;
    ctx.fillStyle = '#1a1a25';
    roundRectPath(ctx, tx, ty, tw, th, 22); ctx.fill();
    ctx.restore();
    return { rect: { x: tx + 24, y: ty + 24, w: tw - 48, h: th - 48 } };
  }

  if (id === 'blurred') {
    ctx.save();
    ctx.filter = 'blur(40px) saturate(1.4)';
    const ir = fitContain(state.image.width, state.image.height, w * 1.4, h * 1.4);
    ctx.drawImage(state.image, (w - ir.w) / 2, (h - ir.h) / 2, ir.w, ir.h);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, w, h);
    const ir2 = fitContain(state.image.width, state.image.height, w * 0.7, h * 0.7);
    return { rect: { x: (w - ir2.w) / 2, y: (h - ir2.h) / 2, w: ir2.w, h: ir2.h } };
  }

  if (id === 'float') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    return null;
  }

  return null;
}
