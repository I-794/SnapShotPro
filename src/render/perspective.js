// v8.1 — Perspective baking.
//
// Canvas 2D has no native perspective transform, so to make a tilted device
// mockup actually *export* (v8 tilt was preview-only CSS on the wrapper) we
// project the flat mockup onto a 3D-rotated quad and rasterize it by texture-
// mapping a subdivided grid of triangles. Each grid vertex is rotated and
// perspective-divided individually (exact at vertices, linear within cells), so
// a fine enough grid looks smooth.
//
// Matches the CSS transform the preview used: perspective(P) rotateX rotateY
// rotateZ, applied about the element centre.

const GRID = 18;            // subdivisions per axis (GRID^2 * 2 triangles)
const BLEED = 0.6;          // px — expand each triangle to hide hairline seams

const deg = (d) => (d * Math.PI) / 180;

// Rotate a point (relative to centre) by Rx·Ry·Rz, then perspective-project.
function project(x, y, rx, ry, rz, P) {
  let c = Math.cos(rz), s = Math.sin(rz);
  let x1 = x * c - y * s, y1 = x * s + y * c, z1 = 0;

  c = Math.cos(ry); s = Math.sin(ry);
  let x2 = x1 * c + z1 * s, y2 = y1, z2 = -x1 * s + z1 * c;

  c = Math.cos(rx); s = Math.sin(rx);
  let x3 = x2, y3 = y2 * c - z2 * s, z3 = y2 * s + z2 * c;

  const denom = P - z3;
  const sc = denom > 1 ? P / denom : P; // guard points at/behind the viewer
  return { x: x3 * sc, y: y3 * sc };
}

// Affine-map a source triangle onto a destination triangle (clipped, with a
// small outward bleed to avoid seams between adjacent cells).
function tri(ctx, img, sx0, sy0, sx1, sy1, sx2, sy2, d0, d1, d2) {
  const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (!den) return;

  // expand destination triangle around its centroid
  const gx = (d0.x + d1.x + d2.x) / 3, gy = (d0.y + d1.y + d2.y) / 3;
  const push = (p) => {
    const dx = p.x - gx, dy = p.y - gy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * BLEED, y: p.y + (dy / len) * BLEED };
  };
  const e0 = push(d0), e1 = push(d1), e2 = push(d2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0.x, e0.y);
  ctx.lineTo(e1.x, e1.y);
  ctx.lineTo(e2.x, e2.y);
  ctx.closePath();
  ctx.clip();

  const a = ((d1.x - d0.x) * (sy2 - sy0) - (d2.x - d0.x) * (sy1 - sy0)) / den;
  const c = ((d2.x - d0.x) * (sx1 - sx0) - (d1.x - d0.x) * (sx2 - sx0)) / den;
  const e = d0.x - a * sx0 - c * sy0;
  const b = ((d1.y - d0.y) * (sy2 - sy0) - (d2.y - d0.y) * (sy1 - sy0)) / den;
  const d = ((d2.y - d0.y) * (sx1 - sx0) - (d1.y - d0.y) * (sx2 - sx0)) / den;
  const f = d0.y - b * sx0 - d * sy0;

  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// Bake `src` (a flat composited mockup canvas) into `destCtx` under a 3D tilt.
// opts.fit (default true) scales the projected quad to stay inside the canvas
// with opts.margin px of breathing room.
export function bakePerspective(destCtx, src, tilt, opts = {}) {
  const W = src.width, H = src.height;
  const cx = W / 2, cy = H / 2;
  const P = Math.max(200, tilt.perspective || 1200);
  const rx = deg(tilt.rx || 0), ry = deg(tilt.ry || 0), rz = deg(tilt.rz || 0);
  const N = GRID;
  const fit = opts.fit !== false;
  const margin = opts.margin || 0;

  const pts = new Array((N + 1) * (N + 1));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const su = (i / N) * W, sv = (j / N) * H;
      const p = project(su - cx, sv - cy, rx, ry, rz, P);
      const dx = cx + p.x, dy = cy + p.y;
      pts[j * (N + 1) + i] = { x: dx, y: dy };
      if (dx < minX) minX = dx; if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy; if (dy > maxY) maxY = dy;
    }
  }

  let sc = 1, ox = 0, oy = 0;
  if (fit) {
    const bw = maxX - minX, bh = maxY - minY;
    sc = Math.min(1, (W - margin * 2) / bw, (H - margin * 2) / bh);
    const bcx = (minX + maxX) / 2, bcy = (minY + maxY) / 2;
    ox = cx - bcx * sc;
    oy = cy - bcy * sc;
  }
  const D = (p) => ({ x: p.x * sc + ox, y: p.y * sc + oy });

  destCtx.save();
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = 'high';
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const su = (i / N) * W, sv = (j / N) * H;
      const su2 = ((i + 1) / N) * W, sv2 = ((j + 1) / N) * H;
      const p00 = D(pts[j * (N + 1) + i]);
      const p10 = D(pts[j * (N + 1) + i + 1]);
      const p01 = D(pts[(j + 1) * (N + 1) + i]);
      const p11 = D(pts[(j + 1) * (N + 1) + i + 1]);
      tri(destCtx, src, su, sv, su2, sv, su, sv2, p00, p10, p01);
      tri(destCtx, src, su2, sv, su2, sv2, su, sv2, p10, p11, p01);
    }
  }
  destCtx.restore();
}
