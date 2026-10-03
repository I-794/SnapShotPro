// v34 — Subject Bokeh render pass. Keeps the subject (from a saved mask) sharp
// and swaps the background for a lens-blurred copy with bright-spot bloom.
// Called from getGradedImage(), the seam all four composition paths draw
// through, so it bakes into every path and every export. Cached by input +
// settings, so animation frames reuse one compute.
import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';
import { lensBlur } from './bokeh-core.js';

const cache = { key: null, maskSrc: null, canvas: null };
const maskCache = { src: null, img: null };
let onMaskReady = null;
let taintWarned = false;

export function setBokehMaskListener(fn) { onMaskReady = fn; }

export function bokehActive() {
  const b = state.bokeh;
  return !!(b && b.enabled && b.maskDataUrl) && !(state.video && state.video.loaded);
}

// Aspect-ratio signature: survives the JPEG re-encode a saved project gets, and
// changes when the image is cropped or swapped for a different shape.
export function aspectSig(img) {
  return (img.width / img.height).toFixed(3);
}

function maskImage(src) {
  if (maskCache.src !== src) {
    maskCache.src = src;
    maskCache.img = new Image();
    maskCache.img.onload = () => { if (onMaskReady) onMaskReady(); };
    maskCache.img.src = src;
  }
  const img = maskCache.img;
  return img.complete && img.naturalWidth ? img : null;
}

export function applyBokeh(src, baseKey) {
  if (!bokehActive() || !src || !src.width || !src.height) return src;
  const b = state.bokeh;
  if (b.maskSig && b.maskSig !== aspectSig(src)) return src;   // stale mask
  const mask = maskImage(b.maskDataUrl);
  if (!mask) return src;                                      // still decoding

  const key = [baseKey, b.amount, b.highlights, b.shape].join('|');
  if (cache.key === key && cache.maskSrc === b.maskDataUrl && cache.canvas) return cache.canvas;

  const w = src.width, h = src.height;
  // Work small: the heavier the blur, the less detail survives anyway, so the
  // working size shrinks with the amount to keep the kernel near 8px.
  const amount = Math.max(1, b.amount || 12);
  const workLong = Math.max(160, Math.min(640, Math.round(8000 / amount)));
  const s = Math.min(1, workLong / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * s)), sh = Math.max(1, Math.round(h * s));
  const work = document.createElement('canvas');
  work.width = sw; work.height = sh;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.drawImage(src, 0, 0, sw, sh);
  let data;
  try {
    data = wctx.getImageData(0, 0, sw, sh);
  } catch (e) {
    if (!taintWarned) { taintWarned = true; showNotification('Bokeh is unavailable for this cross-origin image.', 'error'); }
    return src;
  }
  const radius = Math.max(1, amount * Math.max(sw, sh) / 1000);
  data.data.set(lensBlur(data.data, sw, sh, radius, b.shape, b.highlights));
  wctx.putImageData(data, 0, 0);

  // A fresh canvas per recompute (not the cached one redrawn in place): the 3D
  // screen texture is cached by image identity, so reusing the object would
  // leave the 3D mockup showing the previous amount/shape.
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.clearRect(0, 0, w, h);
  o.imageSmoothingQuality = 'high';
  o.drawImage(work, 0, 0, w, h);

  // Sharp subject on top, cut by a slightly softened mask so edges blend.
  const subj = document.createElement('canvas');
  subj.width = w; subj.height = h;
  const sc = subj.getContext('2d');
  sc.drawImage(src, 0, 0);
  sc.globalCompositeOperation = 'destination-in';
  sc.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) / 600))}px)`;
  sc.drawImage(mask, 0, 0, w, h);
  o.drawImage(subj, 0, 0);

  cache.key = key; cache.maskSrc = b.maskDataUrl; cache.canvas = out;
  return out;
}
