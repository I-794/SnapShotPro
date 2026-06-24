# V30 Studio Intelligence — Plan 02: AI Screenshot Editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Part of the V30 plan series:** 01 Foundations + Brand Brain → **02 (this file)** → 03 Campaign Generator → 04 Producer → 05 Marketing. This plan depends ONLY on Plan 01 Task 1 (`runVisionJson`); otherwise independent.

**Goal:** Edit the *content inside* a screenshot semantically — fix/replace text, recolor an element, redact PII, and remove clutter — by locating regions (vision + OCR boxes), masking them, and regenerating via the existing `gpt-image-2` inpaint path.

**Architecture:** A new `bind*` module (`src/features/ai-screenshot-editor.js`) drives a "Magic Edit" panel. It reuses the existing inpaint (`edit()`) and image-replacement (`applyResultAsImage()`) helpers from `ai-image-edit.js` (promoted to exports), the `ai-shared.js` blob/canvas helpers, OCR word boxes (newly surfaced from `ocr.js`), and `runVisionJson()` (Plan 01). The mask convention is the existing one: **opaque white = keep, transparent = regenerate.** Edits replace `state.image`, so they bake into export for free and are covered by undo.

**Tech Stack:** Vanilla JS + Vite. No test runner — verify in `npm run dev` + `npm run build`. Inpaint via `gpt-image-2` (hosted proxy → BYO OpenAI key). Vision via `runVisionJson` (`claude-sonnet-4-6` / `gpt-4o-mini`). OCR via Tesseract.js (client-side).

## Global Constraints

- **No test runner / linter.** Only `dev`, `build`, `preview`. Each task's "test" = run in-browser + `npm run build` succeeds. No test framework.
- **Feature pattern:** export `bind<Feature>()`, import + call once in `src/main.js` `init()`. Tag new files `// v30 — …`.
- **Single mutable `state`:** mutate then `render()`. Edits to the screenshot mutate `state.image`.
- **Undo:** `state.image` is replaced via `applyResultAsImage`, which already calls `saveStateToHistory()` before swapping — one undo step per edit. Do NOT add `image` to the snapshot allow-list (images are never snapshotted; history covers the swap by snapshotting the surrounding design and the editor calling save before replacing).
- **Mask convention (gpt-image-2 / `api/image-edit.js`):** the mask is a full-resolution canvas; **opaque = keep, transparent = regenerate.**
- **Sidebar group:** the Magic Edit section uses `data-group="ai"`.
- **Never hardcode an unverified AI model id.** Reuse `gpt-image-2` (already used by `edit()`), `claude-sonnet-4-6`/`gpt-4o-mini` (via `runVisionJson`).
- **Commit trailers** (every commit):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc
  ```
- **Branch:** `claude/v30-feature-brainstorm-qidm1d`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/features/ai-image-edit.js` | Inpaint + image-replace helpers. Promote `edit` + `applyResultAsImage` to exports. | Modify |
| `src/features/ocr.js` | OCR. Add exported `recognizeWords(source)` returning text + bounding boxes. | Modify |
| `src/features/ai-screenshot-editor.js` | The feature: locate → mask → edit/redact, + panel. | Create |
| `editor/index.html` | "Magic Edit" sidebar section (AI group). | Modify |
| `src/main.js` | Import + call `bindScreenshotEditor()`. | Modify |
| `src/features/palette.js` | Cmd-K commands for the edit ops. | Modify |

---

## Task 10: Promote `edit` and `applyResultAsImage` to exports

**Files:**
- Modify: `src/features/ai-image-edit.js` (add `export` to two internal functions, lines 63 and 84)

**Interfaces:**
- Produces (for Tasks 13–14):
  - `edit(imageBlob: Blob, maskBlob: Blob|null, prompt: string, size: string) => Promise<string>` — runs the inpaint and returns a **bare base64 PNG** (no `data:` prefix). Proxy → BYO-key fallback already inside.
  - `applyResultAsImage(b64: string) => Promise<void>` — loads the bare b64, calls `saveStateToHistory()`, sets `state.image`, and `render()`s.

These already exist and are correct; they are merely unexported today.

- [ ] **Step 1: Export `edit`**

In `src/features/ai-image-edit.js`, change the declaration at line 63 from:
```js
async function edit(imageBlob, maskBlob, prompt, size) {
```
to:
```js
export async function edit(imageBlob, maskBlob, prompt, size) {
```

- [ ] **Step 2: Export `applyResultAsImage`**

Change the declaration at line 84 from:
```js
async function applyResultAsImage(b64) {
```
to:
```js
export async function applyResultAsImage(b64) {
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds. (Adding `export` to functions used elsewhere in the same module is safe — internal call sites still resolve.)

- [ ] **Step 4: Commit**

```bash
git add src/features/ai-image-edit.js
git commit -m "refactor(v30): export edit() + applyResultAsImage() for the screenshot editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 11: Surface OCR word boxes (`recognizeWords`)

**Files:**
- Modify: `src/features/ocr.js` (add an exported `recognizeWords`)

**Interfaces:**
- Produces: `recognizeWords(source: CanvasImageSource) => Promise<Array<{ text: string, bbox: { x0, y0, x1, y1 }, confidence: number }>>` — recognizes text and returns per-word boxes in source-pixel coordinates. Tesseract already returns `data.words` with `bbox`; this exposes it.

**Note:** read `ocr.js` first to reuse its existing Tesseract worker bootstrap (the module currently calls `Tesseract.createWorker('eng', …)` and `w.recognize(c)`). Reuse that worker creation rather than duplicating it — factor the worker access into a small helper if needed.

- [ ] **Step 1: Add the exported function**

In `src/features/ocr.js`, add (reusing the module's existing worker — if the worker is held in a module variable like `worker`, reuse it; otherwise create one the same way the existing recognize path does):
```js
// v30 — expose per-word bounding boxes (Tesseract returns these in data.words;
// the in-panel OCR path only uses data.text). Used by the AI Screenshot Editor
// to locate text regions for targeted inpainting. Coordinates are in the source
// image's pixel space (bbox: {x0,y0,x1,y1}).
export async function recognizeWords(source) {
  const Tesseract = await import('tesseract.js');
  const w = await Tesseract.createWorker('eng', 1);
  try {
    const { data } = await w.recognize(source);
    return (data.words || []).map(word => ({
      text: word.text || '',
      bbox: word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
      confidence: word.confidence || 0
    }));
  } finally {
    await w.terminate();
  }
}
```
> If `ocr.js` already imports Tesseract and keeps a reusable `worker`, prefer calling that worker's `recognize` instead of creating/terminating a fresh one here — read lines 1–60 and match the existing pattern to avoid double-loading the ~5MB engine.

- [ ] **Step 2: Verify build + output**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a screenshot containing text, console:
```js
const o = await import('/src/features/ocr.js');
const s = (await import('/src/state/state.js')).state;
const words = await o.recognizeWords(s.image);
console.log(words.slice(0, 5)); // [{text, bbox:{x0,y0,x1,y1}, confidence}, ...]
```
Expected: an array of word objects with non-zero bboxes.

- [ ] **Step 3: Commit**

```bash
git add src/features/ocr.js
git commit -m "feat(v30): surface OCR word bounding boxes (recognizeWords)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 12: Mask + image helpers in the editor module

**Files:**
- Create: `src/features/ai-screenshot-editor.js` (helpers half; ops added in Tasks 13–14)

**Interfaces:**
- Consumes: `canvasToBlob`, `imageToDataUrl` (`src/features/ai-shared.js`), `nearestGptImageSize` (`src/features/ai-shared.js`), `state` (`src/state/state.js`).
- Produces (used in Tasks 13–14):
  - `sourceCanvas() => HTMLCanvasElement` — the current `state.image` drawn onto a full-res canvas.
  - `maskFromBoxes(iw, ih, boxes) => HTMLCanvasElement` — a mask canvas (opaque white = keep; the given boxes cleared to transparent = regenerate). `boxes` are `{x,y,w,h}` in source pixels.

- [ ] **Step 1: Create the module with helpers**

Create `src/features/ai-screenshot-editor.js`:
```js
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
```

- [ ] **Step 2: Verify build + mask logic**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a screenshot, console:
```js
const e = await import('/src/features/ai-screenshot-editor.js');
const c = e.sourceCanvas();
const mask = e.maskFromBoxes(c.width, c.height, [{ x: 10, y: 10, w: 50, h: 20 }]);
const px = mask.getContext('2d').getImageData(30, 18, 1, 1).data;
console.log(px[3], '(should be 0 — transparent inside box)');
const px2 = mask.getContext('2d').getImageData(c.width - 1, c.height - 1, 1, 1).data;
console.log(px2[3], '(should be 255 — opaque outside box)');
```
Expected: `0` then `255`.

- [ ] **Step 3: Commit**

```bash
git add src/features/ai-screenshot-editor.js
git commit -m "feat(v30): screenshot-editor mask + source-canvas helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 13: AI ops — fix text, recolor, remove clutter

**Files:**
- Modify: `src/features/ai-screenshot-editor.js` (add the three AI-backed ops)

**Interfaces:**
- Consumes: helpers from Task 12, `runVisionJsonOnDataUrl`, `recognizeWords`, `edit`, `applyResultAsImage`, `nearestGptImageSize`, `canvasToBlob`.
- Produces:
  - `fixText(find: string, replace: string) => Promise<boolean>`
  - `recolorElement(description: string, hex: string) => Promise<boolean>`
  - `removeClutter(description: string) => Promise<boolean>`

Each locates a region, builds a mask, runs `edit()` with an op-specific prompt, and commits via `applyResultAsImage`. Returns `true` on success.

- [ ] **Step 1: Add a shared locate-then-edit core**

Append to `src/features/ai-screenshot-editor.js`:
```js
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
```

- [ ] **Step 2: Add `fixText` (prefers OCR boxes, falls back to vision)**

Append:
```js
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
```

- [ ] **Step 3: Add `recolorElement` and `removeClutter`**

Append:
```js
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
```

- [ ] **Step 4: Verify build + one end-to-end op**

Run: `npm run build` → succeeds.
Run `npm run dev` (with an OpenAI key configured for `gpt-image-2`), load a screenshot containing a clear word, console:
```js
const e = await import('/src/features/ai-screenshot-editor.js');
await e.fixText('Dashboard', 'Overview');
```
Expected: after a few seconds the word changes in the preview; **Cmd/Ctrl+Z** reverts (one undo step). Without a key: a key prompt appears and it returns `false` gracefully.

- [ ] **Step 5: Commit**

```bash
git add src/features/ai-screenshot-editor.js
git commit -m "feat(v30): screenshot editor AI ops (fix text, recolor, remove clutter)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 14: Redact op (no AI)

**Files:**
- Modify: `src/features/ai-screenshot-editor.js` (add `redact`)

**Interfaces:**
- Consumes: `sourceCanvas` (Task 12), `recognizeWords`, `runVisionJsonOnDataUrl`, `saveStateToHistory`, `render`, `applyResultAsImage`.
- Produces: `redact({ autoPII = true, manualBoxes = [] }) => Promise<boolean>` — blurs/blocks PII regions directly on a copy of `state.image`, NO model call. When `autoPII`, it asks vision for PII regions (emails, names, card numbers) and/or matches OCR boxes that look like emails; `manualBoxes` (`{x,y,w,h}[]`) are always redacted.

- [ ] **Step 1: Add the redact op**

Append to `src/features/ai-screenshot-editor.js`:
```js
// Pixelate a region in-place (mosaic) — privacy-grade, irreversible in the
// output. Used for redaction; no AI involved.
function pixelate(ctx, x, y, w, h, block = 12) {
  const sx = Math.max(1, Math.floor(w / block));
  const sy = Math.max(1, Math.floor(h / block));
  const tmp = document.createElement('canvas');
  tmp.width = sx; tmp.height = sy;
  const t = tmp.getContext('2d');
  t.drawImage(ctx.canvas, x, y, w, h, 0, 0, sx, sy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sx, sy, x, y, w, h);
  ctx.imageSmoothingEnabled = true;
}

// Redact PII. Auto-detection uses OCR (email-like tokens) plus an optional
// vision pass for names/cards; manualBoxes are always redacted. Commits the
// pixelated image as the new state.image (one undo step). No model regeneration.
export async function redact({ autoPII = true, manualBoxes = [] } = {}) {
  if (!state.image) { showNotification('Load a screenshot first.', 'error'); return false; }
  const canvas = sourceCanvas();
  const ctx = canvas.getContext('2d');
  let boxes = [...manualBoxes];

  if (autoPII) {
    // OCR: email-like tokens.
    try {
      const words = await recognizeWords(state.image);
      for (const w of words) {
        if (/@|\d{4,}/.test(w.text) && w.bbox) {
          boxes.push({ x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 });
        }
      }
    } catch (_) {}
    // Vision: names / card numbers / addresses (best-effort; tolerated on fail).
    const v = await runVisionJsonOnDataUrl(
      `The image is ${canvas.width}px wide and ${canvas.height}px tall (top-left origin). ` +
      `Return JSON {"regions":[{"x":int,"y":int,"w":int,"h":int}]} for every region containing personally identifiable information (full names, emails, phone numbers, card numbers, street addresses). Empty array if none.`,
      canvas.toDataURL('image/png')
    );
    if (v && Array.isArray(v.regions)) {
      for (const r of v.regions) boxes.push({ x: r.x | 0, y: r.y | 0, w: r.w | 0, h: r.h | 0 });
    }
  }

  boxes = boxes.filter(b => b.w > 1 && b.h > 1);
  if (!boxes.length) { showNotification('No PII detected to redact.', 'success'); return false; }
  for (const b of boxes) pixelate(ctx, Math.max(0, b.x), Math.max(0, b.y), b.w, b.h);

  // Commit via the shared image-replace path (bare b64).
  await applyResultAsImage(canvas.toDataURL('image/png').split(',')[1]);
  showNotification(`Redacted ${boxes.length} region${boxes.length === 1 ? '' : 's'}.`, 'success');
  return true;
}
```

- [ ] **Step 2: Verify build + redact (works with NO AI key for the OCR path)**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a screenshot containing an email address, console:
```js
const e = await import('/src/features/ai-screenshot-editor.js');
await e.redact({ autoPII: true });
```
Expected: the email becomes pixelated in the preview (OCR path runs without any AI key; the vision pass simply no-ops without a key). Undo reverts.

- [ ] **Step 3: Commit**

```bash
git add src/features/ai-screenshot-editor.js
git commit -m "feat(v30): screenshot editor redact op (OCR + vision PII, no regen)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 15: Magic Edit panel + bind + wiring

**Files:**
- Modify: `editor/index.html` (Magic Edit section, AI group)
- Modify: `src/features/ai-screenshot-editor.js` (add `bindScreenshotEditor`)
- Modify: `src/main.js` (import + call)
- Modify: `src/features/palette.js` (Cmd-K commands)

**Interfaces:**
- Consumes: `fixText`, `recolorElement`, `removeClutter`, `redact`.
- Produces: `bindScreenshotEditor() => void`.

- [ ] **Step 1: Add the sidebar markup**

In `editor/index.html`, find a `data-group="ai"` section (e.g. the existing "AI Tools" / `#ai-edit-eraser-btn` block) and add after it:
```html
<div class="sidebar-section" data-group="ai">
  <div class="section-title">Magic Edit</div>
  <div class="section-body">
    <p class="hint">Edit the screenshot's own content with AI.</p>

    <label class="field-label">Fix / replace text</label>
    <div class="row"><input type="text" id="medit-find" placeholder="Find text…" /></div>
    <div class="row">
      <input type="text" id="medit-replace" placeholder="Replace with…" />
      <button id="medit-fixtext" class="btn">Replace</button>
    </div>

    <label class="field-label">Recolor an element</label>
    <div class="row">
      <input type="text" id="medit-recolor-desc" placeholder="e.g. the primary button" />
      <input type="color" id="medit-recolor-hex" value="#4f46e5" />
      <button id="medit-recolor" class="btn">Recolor</button>
    </div>

    <label class="field-label">Remove clutter</label>
    <div class="row">
      <input type="text" id="medit-remove-desc" placeholder="e.g. the mouse cursor" />
      <button id="medit-remove" class="btn">Remove</button>
    </div>

    <label class="field-label">Redact PII</label>
    <div class="row">
      <button id="medit-redact" class="btn btn-primary">Auto-redact emails &amp; names</button>
    </div>
    <p class="info-text" id="medit-status"></p>
  </div>
</div>
```
> Match the existing AI-group section's exact class names by reading the neighboring section first. Do not add a version badge to the title.

- [ ] **Step 2: Add `bindScreenshotEditor`**

Append to `src/features/ai-screenshot-editor.js`:
```js
const $ = (id) => document.getElementById(id);

export function bindScreenshotEditor() {
  $('medit-fixtext')?.addEventListener('click', () => {
    fixText($('medit-find')?.value?.trim(), $('medit-replace')?.value ?? '');
  });
  $('medit-recolor')?.addEventListener('click', () => {
    recolorElement($('medit-recolor-desc')?.value?.trim(), $('medit-recolor-hex')?.value || '#4f46e5');
  });
  $('medit-remove')?.addEventListener('click', () => {
    removeClutter($('medit-remove-desc')?.value?.trim());
  });
  $('medit-redact')?.addEventListener('click', () => redact({ autoPII: true }));
}
```

- [ ] **Step 3: Wire into `main.js`**

Add the import near the other AI feature imports (around line 48, by `bindAiImageEdit`):
```js
import { bindScreenshotEditor } from './features/ai-screenshot-editor.js';
```
Call it in `init()` next to `bindAiImageEdit();` (around line 143):
```js
  bindAiImageEdit();
  bindScreenshotEditor();
```

- [ ] **Step 4: Add Cmd-K commands**

In `src/features/palette.js` `registerCommands()`, add (match the neighbor entry shape; `when` gates on a loaded image):
```js
    { id: 'medit-redact', label: 'Redact PII (auto)', icon: '🛡️', group: groupFor('medit-redact'),
      run: () => import('./ai-screenshot-editor.js').then(m => m.redact({ autoPII: true })),
      when: () => !!state.image },
```

- [ ] **Step 5: Full end-to-end verification**

Run `npm run dev`:
1. Open the **AI** group → "Magic Edit" section appears.
2. **Redact** (no key needed): load a screenshot with an email → click Auto-redact → the email pixelates; undo reverts.
3. **Fix text** (key required): enter find/replace → Replace → the word changes; undo reverts.
4. **Recolor / Remove** (key required): describe an element → it recolors / a cursor disappears.
5. **Cmd-K:** "Redact PII (auto)" appears (only with an image) and runs.
6. **Export check:** after an edit, export a PNG → the edited pixels are present (edits live in `state.image`, baked by `renderInto`).
7. `npm run build` → succeeds.

- [ ] **Step 6: Commit + push**

```bash
git add editor/index.html src/features/ai-screenshot-editor.js src/main.js src/features/palette.js
git commit -m "feat(v30): Magic Edit panel + bind + Cmd-K (AI Screenshot Editor)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
git push -u origin claude/v30-feature-brainstorm-qidm1d
```

---

## Self-Review (against the spec — Pillar 2)

**Spec coverage:**
- Four ops (fix/replace text, recolor, redact, remove clutter) → Tasks 13–14. ✓
- Locate via `runVisionJson` + OCR word boxes (cross-check) → Tasks 11, 13. ✓
- Mask (opaque=keep, transparent=regenerate) → Task 12. ✓
- Reuse existing `edit()` inpaint (gpt-image-2, proxy→BYOK) → Tasks 10, 13. ✓
- Redact short-circuits the AI (local pixelate, optional vision) → Task 14. ✓
- Commit via `applyResultAsImage` → `state.image` → render/export/undo → Tasks 10, 13, 14. ✓
- Panel in AI group + Cmd-K → Task 15. ✓

**Deferred (out of scope, per spec):** full multi-language in-place re-render, object insertion, batch ops.

**Placeholder scan:** none — every step has concrete code or commands. The "read the neighbor first" notes (Task 11 worker reuse, Task 15 CSS classes) are explicit verification instructions tied to the insertion site, not placeholders.

**Type consistency:** `recognizeWords` returns `{text, bbox:{x0,y0,x1,y1}, confidence}` (Task 11), consumed identically in `fixText`/`redact` (Tasks 13–14). `maskFromBoxes` takes `{x,y,w,h}` boxes (Task 12), produced by `locateRegion`/OCR conversion identically. `edit`/`applyResultAsImage` signatures (Task 10) match every call site.
