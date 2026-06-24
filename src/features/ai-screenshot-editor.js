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
