# SnapShot-Pro v9 — Plan

**Status:** proposal / spec — no code written yet
**Author:** drafted 2026-05-31
**Themes (chosen):** (1) App Store screenshot sets + batch · (2) Generative AI background / eraser · (3) Video / clip support

## Release strategy

Ship as three independently-deployable point releases so the Vercel build stays green between them and each lands as a usable feature:

| Release | Theme | Effort | Reuses |
|--------|-------|--------|--------|
| **v9.0** | App Store screenshot sets + batch | Medium | `mockups.js`, `render(forExport)`, offscreen canvas pattern |
| **v9.1** | Generative AI background / outpainting + magic eraser | Medium | `ai-cloud.js`, `api-keys.js` (BYOK), `state.bgImage` |
| **v9.2** | Video / clip support | High | render pipeline, `gif.js`, `mockups.js` |

Build order is also dependency order: v9.0 establishes the **multi-render-to-offscreen** plumbing that v9.2 (frame-by-frame video) reuses.

---

## Architectural ground truth (verified against current code)

These are the facts the plan is built on — confirmed by reading the source:

- **State is a single mutable object** (`src/state/state.js`); mutate then call `render()`. No observer pattern.
- **`render(forExport)`** (`src/render/render.js`) draws to `el.previewCanvas` sized from `state.canvas.{width,height}`. It already supports an offscreen compositing path (`mockCanvas()`) for device mockups, and `forExport` suppresses minimap/CSS-transform sync. **This is the seam we render batch/set panels through.**
- **Device mockups** live in `mockups.js` with `isDeviceMockup(type)`, `drawDeviceMockup()` returning `{rect, radius, overlay}`, and `drawScreenImage()`. `fitDevice()` centers the device in the canvas with padding. Devices: iphone(16pro), ipadpro, macbookpro, watch, studiodisplay, pixel, winlaptop.
- **AI is BYOK, client-side** (`api-keys.js` → localStorage `snapshotpro_api_keys`, providers `openai`/`anthropic`). `ai-cloud.js` already calls OpenAI Images (`dall-e-3`) in `aiGenerateBackground()` and sets `state.bgImage` + `state.bgMode = 'image'`.
- **Export** (`export.js`) is `canvas.toBlob()` → download. **No ZIP dependency yet.**
- **No video/encoding dependency yet.** `gif.js` exists for GIF.

Open architectural question to settle in v9.0: introduce a lightweight **`renderToCanvas(targetCanvas, overrides)`** helper that renders the current state (with per-panel overrides) to an arbitrary canvas, instead of always `el.previewCanvas`. Today `render()` is hard-wired to the preview canvas. Cleanest path: extract the body of `render()` into `renderInto(ctx, canvas, opts)` and have `render()` call it with the preview canvas. Every v9 theme benefits from this refactor, so it's step 0.

---

## v9.0 — App Store screenshot sets + batch

### Goal
Turn the v8 Mockup Studio from a single-image toy into a **workflow**: design once, output a full set of store-ready, captioned marketing panels — and/or apply one design across many uploaded images and download a ZIP.

### Two related but distinct modes

**A. Set mode (one image → N panels).** One screenshot, rendered into multiple device/size/caption panels — the classic App Store / Play Store listing carousel.

**B. Batch mode (N images → N outputs).** Many uploaded screenshots, the *same* design template applied to each, ZIP download. (Set + batch compose: N images × M panels.)

### Store size presets (new)
New preset table `src/state/store-presets.js`:

```js
export const STORE_PRESETS = {
  'ios-6.9':   { w: 1320, h: 2868, label: 'iPhone 6.9"', device: 'iphone16pro' },
  'ios-6.7':   { w: 1290, h: 2796, label: 'iPhone 6.7"', device: 'iphone16pro' },
  'ios-6.5':   { w: 1242, h: 2688, label: 'iPhone 6.5"', device: 'iphone' },
  'ipad-13':   { w: 2064, h: 2752, label: 'iPad 13"',    device: 'ipadpro' },
  'android-phone': { w: 1080, h: 1920, label: 'Play phone', device: 'pixel' },
  'mac':       { w: 2880, h: 1800, label: 'Mac',          device: 'macbookpro' },
  // social carry-overs reuse existing presets
};
```
(Exact pixel sizes to be reconciled against current App Store Connect / Play Console specs at build time — they shift; treat the table above as shape, not gospel.)

### Per-panel caption model (new state)
```js
// state.screenshotSet
{
  enabled: false,
  preset: 'ios-6.7',
  panels: [
    {
      imageId: null,            // null = use state.image; else key into imageRegistry
      headline: 'Capture anything',
      subhead: 'One tap. Done.',
      headlinePos: 'top',       // top | bottom
      bg: { mode: 'gradient', gradient: {...} },  // per-panel bg override (optional)
      deviceOffsetY: 0.0,       // push device down to make room for caption
    },
    // ...
  ],
  shared: { font: 'Geist', headlineColor: '#0b0b0d', headlineSize: 64 }
}
```

### Render path
- New `src/render/screenshot-set.js`: `renderPanel(canvas, panel, sharedOpts)` — sets `state.canvas` to the preset size, applies per-panel overrides, draws bg → device mockup (existing `drawDeviceMockup`/`drawScreenImage`) positioned with `deviceOffsetY`, then draws headline/subhead text in the reserved band above/below the device.
- Caption text reuses the text-overlay drawing logic but as a dedicated band layout (not free-positioned), so it never overlaps the device.
- A **filmstrip preview UI** (`src/features/set-ui.js`) shows all panels as thumbnails; click to edit that panel's caption/image. Lives in a new sidebar section, bound from `main.js` (following the `mockup-ui.js` precedent — NOT `bindings.js`).

### Export path
- New dep: **`fflate`** (tiny, tree-shakeable, no worker hassle) for ZIP. Avoid JSZip (heavier).
- `src/features/batch-export.js`:
  - `exportSet()` — render each panel to an offscreen canvas via `renderInto`, `toBlob('image/png')`, collect, zip, download `appstore-set-{ts}.zip`.
  - `exportBatch()` — for each uploaded image in a batch tray, apply the active template, render, zip.
- Progress UI (panels can be large — 1320×2868) with a per-panel status; render sequentially to avoid memory spikes; `await` a microtask between panels so the UI can paint.

### UI surface
- New top-level mode toggle in the sidebar: **Single | Set | Batch**.
- Set mode: preset dropdown · "+ Add panel" · filmstrip · per-panel caption editor.
- Batch mode: multi-file drop tray (reuse `upload.js` drag/paste) · template picker (reuse `templates.js`) · "Export all (ZIP)".
- Command palette entries: `Export App Store set`, `Batch export (ZIP)`, `Add set panel`.

### Acceptance criteria
- [ ] Pick a preset, add 3 panels with captions, export → ZIP of 3 correctly-sized PNGs with device frames + captions, no overlap.
- [ ] Drop 5 images in batch, apply a saved template, export → ZIP of 5.
- [ ] `npm run build` clean; bundle growth from `fflate` < 10KB.

### Risks
- Large canvases (2868px tall) × many panels → memory. Mitigation: sequential render, release blobs, optional 2× cap.
- Caption band layout must adapt to portrait (phone) vs landscape (mac) aspect — needs per-orientation defaults.

---

## v9.1 — Generative AI: background generation, outpainting, magic eraser

### Goal
Extend the existing BYOK AI stack from "generate a backdrop from a prompt" (already shipped) to **prompt-based background replacement that matches the subject, outpainting (extend the canvas), and a magic eraser (remove objects)**.

### Backend decision (per your choice: hosted image API)
- **Provider: OpenAI Images `gpt-image-2`** — it supports the **edits** endpoint with an image + mask (DALL-E 3, currently used, does *not* support edits/masks; DALL-E 2 does but is lower quality). `gpt-image-2` is the right primitive for both outpainting and eraser.
- **Keys: keep BYOK client-side** (existing `api-keys.js`), consistent with current `aiGenerateBackground`. 
- **Recommended hardening (optional, flagged):** add a thin **Vercel serverless proxy** (`/api/image-edit`) so the key can optionally live server-side (Vercel env var) for the hosted/shared deployment, while still allowing BYOK locally. This is the "small proxy" path; gate behind a build flag so local dev stays keyless-BYOK. Decide at implementation time whether to ship the proxy in v9.1 or defer.

### Features
1. **AI background (replace, subject-aware).** Today's `aiGenerateBackground` swaps `state.bgImage` blindly. v9.1: generate a backdrop, then composite the *existing subject* on top (we already have the screenshot as `state.image` and, post-bg-removal, a cutout via `@imgly/background-removal` which is already a dependency). Pipeline: remove bg from subject → generate scene → place subject. 
2. **Outpainting / canvas extend.** User expands the canvas (e.g. 1:1 → 16:9); the new margin is sent to `gpt-image-2` edits with a transparent mask over the new area; result fills the extension to match. New UI: "Extend canvas" with target ratio + a generate button.
3. **Magic eraser.** User brushes a mask over an object (new mask-brush tool in `canvas-tools.js`, reuse the redaction-box interaction model but freehand). Send image + mask to `gpt-image-2` edits with prompt "remove and fill naturally." Replace `state.image` with the result (push to history first).

### New modules / changes
- `src/features/ai-image-edit.js` — `extendCanvas()`, `magicErase(maskCanvas)`, `replaceBackground(prompt)`. Shares helpers (`imageToDataUrl`, `dataUrlToBase64`, key selection) with `ai-cloud.js` — extract those into `src/features/ai-shared.js`.
- `canvas-tools.js` — new `'mask'` tool producing a 1-bit mask canvas.
- State: `state.aiEdit = { maskActive: false, lastPrompt: '' }`.
- `ai-cloud.js` `aiGenerateBackground` — migrate from `dall-e-3` to `gpt-image-2` for consistency, keep behavior.

### Acceptance criteria
- [ ] Brush over an object, magic-erase → object removed, area plausibly filled, undoable.
- [ ] Extend a 1:1 screenshot to 16:9 → margins filled coherently.
- [ ] Generate-background → subject preserved on a new AI scene.
- [ ] Clear error + key-prompt when no OpenAI key present (reuse `promptForKey`).

### Risks
- Cost/latency per edit (seconds, real $). Show spinner + cost-aware copy.
- `gpt-image-2` access/availability per key — feature-detect and fall back with a clear message.
- Browser CORS / `dangerouslyAllowBrowser` already accepted in current code; proxy removes the key-exposure concern for the hosted build.

---

## v9.2 — Video / clip support

### Goal
Import a short clip, trim it, drop it into a device mockup (or any current design), and export — MP4 (and the existing GIF path) — so the whole frame/background/shadow/mockup system applies to motion, not just stills.

### Pipeline
- **Import:** `<video>` element + `state.video = { src, duration, in, out, fps }`. Reuse `upload.js` drop/paste; accept `video/mp4`, `video/webm`.
- **Trim UI:** scrubber with in/out handles (new `src/features/video-trim.js`); thumbnail strip via seeking + canvas grabs.
- **Compose:** the clip plays *as `state.image` source* — i.e., `drawScreenImage`/`drawImageContent` draw the current video frame. On each `requestVideoFrameCallback` (or rAF), redraw the canvas so the live preview shows the clip inside the mockup with all effects.
- **Export MP4:** **WebCodecs `VideoEncoder` + `mp4-muxer`** (or `webm-muxer` for WebM) — modern, fast, no 25MB ffmpeg.wasm. Render each source frame into the full design canvas → `VideoEncoder.encode()` → mux → download. Fallback to **ffmpeg.wasm** only if WebCodecs unavailable (Safari quirks) — lazy-loaded so it never bloats the default bundle.
- **Export GIF:** reuse existing `gif.js` path — feed it the composited frames instead of animation tween frames.

### New modules
- `src/render/video.js` — `drawVideoFrame(ctx, ...)` (mirrors `drawScreenImage` but from the `<video>`/`VideoFrame`).
- `src/features/video-trim.js` — trim UI + state.
- `src/features/video-export.js` — WebCodecs encode + mux pipeline, GIF reuse, progress UI.
- New deps: `mp4-muxer` (tiny). `ffmpeg.wasm` only behind the fallback, dynamically imported.

### Acceptance criteria
- [ ] Import a 5s clip, trim to 3s, place in iPhone mockup → live preview plays inside the frame.
- [ ] Export MP4 → plays, correct duration, mockup + bg + shadow baked in.
- [ ] Export GIF → works via existing path.
- [ ] No bundle growth on the still-image path (video code lazy-loaded).

### Risks
- **Biggest theme.** WebCodecs browser coverage (good in Chrome/Edge, improving in Safari) — fallback needed.
- Memory for long/high-res clips — cap duration (e.g. ≤15s) and resolution, warn otherwise.
- Per-frame full-design re-render is expensive — encode off the main thread where possible; show progress.
- `state.image` currently assumed to be a static `Image` in several modules — auditing every `state.image` consumer is required (annotations, redactions sample pixels, mockups). Plan a `getCurrentFrameSource()` indirection.

---

## Cross-cutting work (do once, in v9.0)

1. **`renderInto(ctx, canvas, opts)` refactor** — decouple `render()` from `el.previewCanvas`. Prerequisite for sets, batch, and video frame export.
2. **`ai-shared.js`** — extract `imageToDataUrl` / `dataUrlToBase64` / provider-key selection from `ai-cloud.js` (needed by v9.1).
3. **`getCurrentFrameSource()`** indirection over `state.image` — lays groundwork for v9.2 without churning v9.0.
4. Version bumps + README/memory updates per release.

## Dependencies to add
- v9.0: `fflate` (ZIP)
- v9.1: none new (uses existing `openai` SDK + `@imgly/background-removal`); optional Vercel `/api` proxy
- v9.2: `mp4-muxer`; `@ffmpeg/ffmpeg` only as lazy fallback

## What I'd want decided before coding each release
- **v9.0:** exact store preset sizes to target (iOS-only vs iOS+Android+Mac); default caption layouts per orientation.
- **v9.1:** ship the Vercel key proxy now, or stay pure-BYOK and defer the proxy?
- **v9.2:** MP4 only, or MP4+WebM+GIF? Max clip length/resolution caps.
