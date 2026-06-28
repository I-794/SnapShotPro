import { state } from '../state/state.js';

export function drawRedactions(ctx, canvas) {
  if (!state.redactions || state.redactions.length === 0) return;
  state.redactions.forEach((r, idx) => {
    if (r.visible === false) return;
    ctx.save();
    if (r.type === 'blur') {
      ctx.filter = `blur(${r.intensity}px)`;
      ctx.drawImage(canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      ctx.filter = `blur(${r.intensity}px)`;
      ctx.drawImage(canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    } else {
      const blockSize = Math.max(4, r.intensity);
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, r.w);
      offscreen.height = Math.max(1, r.h);
      const octx = offscreen.getContext('2d');
      const smallW = Math.max(1, Math.floor(r.w / blockSize));
      const smallH = Math.max(1, Math.floor(r.h / blockSize));
      octx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, smallW, smallH);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, smallW, smallH, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    }
    if (state.selectedRedaction === idx ||
        state.canvasSelection.some((s) => s.kind === 'redaction' && s.id === r.id)) {
      ctx.filter = 'none';
      ctx.strokeStyle = '#0af';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}
