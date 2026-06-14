# v17 "Color" — Design Spec

**Status:** Draft plan (saved, not yet implemented)
**Date:** 2026-06-14
**Target version:** 17.0.0 (current: 16.2.0)

> Saved at the user's request mid-brainstorm. Section 1 (architecture) was
> presented and was awaiting final approval; Sections 2+ (data flow, error
> handling, testing) are sketched here from the locked decisions but have not
> been individually approved. Resume from "Open questions / next steps" before
> implementing.

## Goal

A cohesive **Color release**: give users real control over color in their
designs — adjustable color filters, a saved custom-palette library, hex
extraction from images, and palette-driven color mapping onto the image.
Everything bakes into export, with no new heavy dependency.

## Locked decisions (from brainstorm)

1. **Render engine — Canvas 2D color pipeline (safest).** No WebGL. All color
   work stays in the existing canvas render path so it bakes into every export
   (PNG/JPEG/WebP/GIF/MP4). The "shader feel" comes from well-crafted per-pixel
   passes, not GLSL.
2. **Color Map — all three modes** in one panel: gradient-map / duotone,
   recolor-to-palette (posterize/quantize), and color transfer (LAB mean/std
   match to a target palette or reference).
3. **Color Filters — presets + a few core sliders.** New cinematic grade
   presets plus a small set of sliders: warmth/temperature, contrast,
   saturation (extending the existing `state.imageFilters`).
4. **Custom Palette — full: library + editor + harmonies.** Save/name/load
   multiple palettes (localStorage), add/edit/reorder/delete swatches with a
   picker + hex paste, and auto-generate harmonies (complementary, analogous,
   triadic, etc.) from a base color. Extraction saves into this library; Color
   Map pulls from it.

## Architecture (Approach A — offscreen graded-image cache)

The cheap adjustments (brightness/contrast/saturation, and warmth via
hue/overlay) stay on the existing `ctx.filter` seam for instant slider
feedback. The expensive per-pixel transforms (gradient-map, recolor, transfer,
temperature/tint) are computed once into a **cached offscreen canvas**, keyed by
a signature hash of `(source image, colorMap settings, relevant filter
settings)`, and invalidated only when that signature changes. Normal renders
just `drawImage` the cached result, so pan/zoom/animation/video stay smooth.
Recompute is debounced.

Rejected: inline per-pixel pass every render (reprocesses pixels every frame —
janky for animation/video); CSS-filter + blend-overlays only (can't do true
gradient-map/recolor/transfer).

### New state (`src/state/state.js`)

- `state.colorPalettes` — `{ active: <id>, library: { [id]: { name, swatches: ['#hex', …] } } }`, persisted to localStorage (mirrors brand-kit storage style).
- `state.colorMap` — `{ mode: 'off'|'gradient'|'recolor'|'transfer', paletteId, intensity, steps, … }`.
- Extend `state.imageFilters` with `temperature`, `tint`, and a `preset` field.

### Modules

| File | Purpose | Depends on |
|---|---|---|
| `src/utils/color.js` (extend) | Pure color math: hex⇄rgb⇄hsl⇄lab, gradient-ramp build, nearest-swatch, harmony generation, mean/std transfer | nothing |
| `src/render/color-grade.js` (new) | Offscreen graded-image cache + per-pixel passes (gradient-map, recolor, transfer, temperature/tint). Exposes `getGradedImage(srcImage)` returning a cached canvas, invalidated by signature hash | `utils/color`, `state` |
| `src/features/palettes.js` (new) | Custom Palette library + editor + harmonies UI; `bindPalettes()` | `utils/color`, `state`, `history` |
| `src/features/color-map.js` (new) | Color Map panel (3 modes) wiring; `bindColorMap()` | `render/color-grade`, `state`, `history` |
| `src/features/palette-extract.js` (extend) | "Save extracted colors as a palette" → writes into `state.colorPalettes` | `palettes` |
| `src/features/effects-ui.js` (extend) | New grade presets + temperature/tint/contrast/saturation sliders | `state`, `render` |

### Render integration (single seam)

`render.js:229` currently draws `state.image` with `ctx.filter`. Change it to
draw `getGradedImage(state.image)` instead — per-pixel color work is baked in
*before* the cheap CSS filters apply on top. This one seam covers both the flat
and device-mockup paths, so all export formats inherit it automatically.

## Data flow

1. User edits filters / color-map / palette → mutate `state` (after
   `saveStateToHistory()`), call `render()`.
2. `renderInto` calls `getGradedImage(state.image)`.
3. `color-grade.js` computes a signature; on cache hit returns the cached
   canvas; on miss it runs the per-pixel passes into the offscreen canvas
   (debounced for live drags), caches, and returns it.
4. `renderInto` draws the graded canvas, then applies the cheap `ctx.filter`
   adjustments, then the rest of the passes.
5. Export calls the same path with `forExport=true` → identical pixels.

## Error handling / edge cases

- No image loaded → color modes are no-ops (panels show guidance, like
  palette-extract today).
- Empty / single-swatch palette → gradient-map and recolor disabled until ≥2
  swatches; surface an inline hint.
- Tainted canvas (cross-origin image) → `getImageData` can throw; wrap in
  try/catch, fall back to the un-graded image and notify once.
- localStorage full when saving a palette → reuse the brand-kit pattern
  (catch + error toast).
- Large images → cap the per-pixel pass to the canvas resolution already in
  use; debounce recompute so dragging a slider doesn't thrash.

## Undo/redo

Add `colorPalettes`, `colorMap`, and the extended `imageFilters` (already in the
list) to `snapshot()` in `history.js`. Palette *library* persistence is
localStorage; the *active selection* + color-map settings are undoable.

## Testing / verification

No test runner exists. Verify in `npm run dev`:
- Each filter slider + preset updates live and bakes into PNG export.
- Each Color Map mode (gradient/recolor/transfer) produces correct output and
  exports identically to preview.
- Palette: create/rename/delete/reorder, paste hex, generate harmonies,
  persists across reload.
- Extract → save as palette → use in Color Map.
- Undo/redo across all of the above.
- Device-mockup path shows the same grading as the flat path.
- Animation/video export stays smooth (cache not recomputing per frame).

## Release chores

- Bump `package.json` to `17.0.0`.
- What's-new toast entry (`src/features/whats-new.js`); changelog page entry
  (per memory: v16 used a glassy treatment — v17 should get its own distinct
  taste, not a repeat).
- Register new `bind*` calls in `src/main.js`; add DOM refs to
  `src/ui/elements.js`; wire sidebar controls in `src/ui/bindings.js`.

## Resolved (2026-06-14) + status: IMPLEMENTED

- Architecture + four locked decisions: **confirmed**.
- Panel IA: **dedicated "Color" studio section** for the headline features
  (Custom Palette + Color Map); temperature/tint sliders + cinematic presets
  extend the existing Filters block since they belong with brightness/contrast.
- Harmonies shipped: **all five** — complementary, analogous, triadic,
  split-complementary, tetradic.

Built this session (target 17.0.0): color math in `utils/color.js`; offscreen
graded-image cache `render/color-grade.js` swapped into both render seams;
`features/palettes.js` + `features/color-map.js`; "Save as palette" in
`palette-extract.js`; temperature/tint + 4 cinematic presets; state/history/UI
wiring; version bump, whats-new, and a color-motif changelog entry (built with
the frontend taste skill, distinct from v16's glass treatment). `npm run build`
passes.
