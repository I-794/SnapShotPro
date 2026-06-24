// v30 — AI Screenshot Editor. Semantic edits to the screenshot's own pixels:
// fix/replace text, recolor an element, redact PII, remove clutter. Locates
// regions with runVisionJson()/OCR boxes, masks them (opaque=keep, transparent=
// regenerate — the gpt-image-2 convention), and regenerates via the existing
// edit() inpaint. Redaction short-circuits the AI (local blur/box). Every edit
// replaces state.image via applyResultAsImage() → bakes into export + undoable.

import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';
import { canvasToBlob, nearestGptImageSize, imageToDataUrl } from './ai-shared.js';
import { edit, applyResultAsImage } from './ai-image-edit.js';
import { runVisionJsonOnDataUrl } from './ai-cloud.js';
import { recognizeWords } from './ocr.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';

// Draw the current screenshot onto a full-resolution canvas.
export function sourceCanvas() {
  const img = state.image;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

// Build an inpaint mask: starts opaque white (keep everything), then clears the
// given boxes to transparent (the regions gpt-image-2 will regenerate). Boxes
// are padded slightly so the model has room to blend edges.
export function maskFromBoxes(iw, ih, boxes) {
  const mask = document.createElement('canvas');
  mask.width = iw; mask.height = ih;
  const m = mask.getContext('2d');
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, iw, ih);
  m.globalCompositeOperation = 'destination-out';
  const pad = Math.round(Math.min(iw, ih) * 0.01);
  for (const b of boxes) {
    m.fillRect(Math.max(0, b.x - pad), Math.max(0, b.y - pad), b.w + pad * 2, b.h + pad * 2);
  }
  return mask;
}

// Ask vision for the bounding box of a described target, in source pixels.
// Returns {x,y,w,h} or null. The prompt pins the coordinate space explicitly.
async function locateRegion(description) {
  const canvas = sourceCanvas();
  const dataUrl = canvas.toDataURL('image/png');
  const prompt =
    `The image is ${canvas.width}px wide and ${canvas.height}px tall (top-left origin). ` +
    `Find: ${description}. Return JSON {"found":true|false,"x":<int>,"y":<int>,"w":<int>,"h":<int>} ` +
    `where x,y,w,h is the tight pixel bounding box of that element. If not present, found=false.`;
  const v = await runVisionJsonOnDataUrl(prompt, dataUrl);
  if (!v || !v.found) return null;
  const x = Math.max(0, Math.min(canvas.width, v.x | 0));
  const y = Math.max(0, Math.min(canvas.height, v.y | 0));
  const w = Math.max(1, Math.min(canvas.width - x, v.w | 0));
  const h = Math.max(1, Math.min(canvas.height - y, v.h | 0));
  return { x, y, w, h };
}

// Run an inpaint over the given boxes with an op-specific prompt, then commit.
async function inpaintBoxes(boxes, prompt) {
  const canvas = sourceCanvas();
  const mask = maskFromBoxes(canvas.width, canvas.height, boxes);
  const size = nearestGptImageSize(canvas.width, canvas.height);
  const b64 = await edit(await canvasToBlob(canvas), await canvasToBlob(mask), prompt, size);
  await applyResultAsImage(b64);
}

// Replace on-screen text. Prefer OCR word boxes (exact glyph positions) for the
// matched phrase; fall back to a vision-located region. The inpaint prompt asks
// the model to render the replacement text in the same style.
export async function fixText(find, replace) {
  if (!state.image) { showNotification('Load a screenshot first.', 'error'); return false; }
  if (!find) { showNotification('Enter the text to find.', 'error'); return false; }
  let boxes = [];
  try {
    const words = await recognizeWords(state.image);
    const needle = find.trim().toLowerCase();
    const hits = words.filter(w => w.text && needle.includes(w.text.toLowerCase()) && w.text.length > 1);
    boxes = hits.map(w => ({ x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 }))
                .filter(b => b.w > 0 && b.h > 0);
  } catch (_) { /* OCR optional */ }
  if (!boxes.length) {
    const r = await locateRegion(`the text that reads "${find}"`);
    if (!r) { showNotification(`Couldn't find "${find}" in the screenshot.`, 'error'); return false; }
    boxes = [r];
  }
  try {
    await inpaintBoxes(boxes, `Replace the text in the masked area with "${replace}", matching the original font, size, weight, color, and alignment. Keep the surrounding UI pixel-identical.`);
    showNotification('Text updated.', 'success');
    return true;
  } catch (e) { showNotification(`Edit failed: ${e.message || e}`, 'error'); return false; }
}

// Recolor a described UI element to a target hex.
export async function recolorElement(description, hex) {
  if (!state.image) { showNotification('Load a screenshot first.', 'error'); return false; }
  const r = await locateRegion(description);
  if (!r) { showNotification(`Couldn't find "${description}".`, 'error'); return false; }
  try {
    await inpaintBoxes([r], `Recolor the masked UI element to ${hex}. Preserve its exact shape, text, icon, shadow, and position — only change its fill color. Keep everything else identical.`);
    showNotification('Element recolored.', 'success');
    return true;
  } catch (e) { showNotification(`Edit failed: ${e.message || e}`, 'error'); return false; }
}

// Remove a described distraction (stray cursor, OS notification, debug banner)
// and fill the area to match the surrounding UI.
export async function removeClutter(description) {
  if (!state.image) { showNotification('Load a screenshot first.', 'error'); return false; }
  const r = await locateRegion(description);
  if (!r) { showNotification(`Couldn't find "${description}".`, 'error'); return false; }
  try {
    await inpaintBoxes([r], `Remove the masked element and realistically fill the area to match the surrounding UI background. No text, no artifacts.`);
    showNotification('Removed.', 'success');
    return true;
  } catch (e) { showNotification(`Edit failed: ${e.message || e}`, 'error'); return false; }
}
