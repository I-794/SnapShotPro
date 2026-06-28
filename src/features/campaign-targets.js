// v30 — Campaign Generator target sizes + multi-size renderer. Renders the
// CURRENT design (already framed/branded by the generator) at each target via
// renderAtSize(), returning ZIP-ready bytes + small thumbnails. Pure w.r.t.
// state: renderAtSize restores state.canvas itself; we never touch state.image.

import { renderAtSize } from '../render/render.js';

// MVP coordinated set: hero + 3 social + (App Store set handled separately by
// the generator via renderSetPanels). dir groups files into ZIP subfolders.
export const CAMPAIGN_TARGETS = [
  { role: 'hero',      dir: 'hero',   width: 1200, height: 675 },
  { role: 'instagram', dir: 'social', width: 1080, height: 1080 },
  { role: 'twitter',   dir: 'social', width: 1200, height: 630 },
  { role: 'linkedin',  dir: 'social', width: 1200, height: 627 }
];

function canvasToU8(canvas) {
  return new Promise((resolve) => canvas.toBlob(b => b.arrayBuffer().then(ab => resolve(new Uint8Array(ab))), 'image/png'));
}

function thumbDataUrl(canvas, max = 256) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(canvas.width * scale));
  t.height = Math.max(1, Math.round(canvas.height * scale));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.8);
}

// Render every target at full size. Returns ZIP files keyed by `dir/role-WxH.png`
// plus a thumbnail per role for the Campaign folder UI.
export async function renderTargetsToFiles(onProgress) {
  const off = document.createElement('canvas');
  const files = {};
  const thumbs = [];
  for (let i = 0; i < CAMPAIGN_TARGETS.length; i++) {
    const t = CAMPAIGN_TARGETS[i];
    renderAtSize(off, { width: t.width, height: t.height });
    files[`${t.dir}/${t.role}-${t.width}x${t.height}.png`] = await canvasToU8(off);
    thumbs.push({ role: t.role, dataUrl: thumbDataUrl(off) });
    if (onProgress) onProgress(i + 1, CAMPAIGN_TARGETS.length);
    await new Promise(r => setTimeout(r, 0)); // yield so the UI can paint
  }
  return { files, thumbs };
}
