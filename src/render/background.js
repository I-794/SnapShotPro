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
  } else {
    drawGradient(ctx, canvas);
  }
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
  g.addColorStop(state.gradient.positions[0] / 100, state.gradient.colors[0]);
  g.addColorStop(state.gradient.positions[1] / 100, state.gradient.colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
