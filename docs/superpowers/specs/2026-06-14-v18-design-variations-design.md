# v18 "Design Variations" — Design Spec

**Status:** Approved design (not yet implemented)
**Date:** 2026-06-14
**Target version:** 18.0.0 (current: 17.0.0)

> First step of a three-release AI arc. v18 ships a deterministic foundation,
> v19 adds the AI prompt + asset generation, v20 is the flagship conversational
> **AI Design Agent**. The full AI experience is deliberately reserved for v20.

## Goal

A one-click **Variations** generator. With a screenshot loaded, the user hits
Generate and gets ~4 fully-styled presentations of it as preview cards; clicking
one applies it to the canvas (undoably); "Shuffle again" regenerates. v18 is
**deterministic only** — no AI, no prompt box. Its real value to the arc is the
reusable **Design Spec** layer underneath: a validated `spec → canvas` applier
plus a variant gallery, which are the two hard parts of the v20 agent.

## The AI arc (why this is the foundation, not throwaway)

- **v18 (this spec):** Design Spec schema + `applySpec()` + variant gallery,
  driven by curated deterministic recipes.
- **v19:** add a prompt box; AI emits a Design Spec (hybrid: deterministic
  recipes as the no-key fallback). Begin AI asset/background generation.
- **v20:** the conversational **AI Design Agent** — multi-turn refinement,
  asset generation, memory — orchestrating `applySpec` and the gallery from v18.

Nothing in v18 is discarded: v19's AI feeds `applySpec`; v20's agent drives the
same gallery.

## Locked decisions (from brainstorm)

1. **v20 flagship = AI Design Agent.** v18/v19 are deliberate stepping stones.
2. **v18 engine = deterministic only** (no AI, no model call, no prompt box).
3. **Scope = presentation around the screenshot.** Never alters the screenshot
   pixels (that is v19 AI Assets). Designs background, frame, layout, color
   grade/palette. No generated copy in v18.
4. **Output = variant gallery**, pick 1 of ~4, plus "Shuffle again".
5. **Aesthetic = "Generative":** dark studio base + an animated spectrum-gradient
   signature on the Generate button and an animated gradient border on variant
   cards. This becomes the visual signature for the v19/v20 AI features.

## Architecture

### New: `src/state/spec.js` — the Design Spec + applier (the arc's backbone)

A **Design Spec** is a plain object describing presentation only:

```
{
  bg:     { mode, gradient?, mesh?, solid?, pattern? },   // background.* params
  frame:  { type|null, color },                            // deviceFrame
  layout: { padding, scale, borderRadius },
  shadow: <shadowPreset key>,                              // from presets.js
  filter: <artFilterPreset key>,                           // incl. v17 temp/tint
  color:  { mode, paletteId?, intensity?, steps? } | null  // v17 colorMap, optional
}
```

- `applySpec(spec)` — validated, deterministic mapping from spec → `state`
  mutations. Each field is range/enum-checked against existing presets
  (`gradientPresets`, `meshPresets`, `shadowPresets`, `artFilterPresets`) and
  the v17 palette library; unknown/invalid values fall back to a safe default,
  so a malformed spec never corrupts state. Presentation only — it does not
  touch `state.image`, canvas size, annotations, text, or motion.
- This function is the single seam the v19 AI and v20 agent reuse.

### New: `src/features/compose.js` — `bindCompose()` (generator + gallery)

- **Recipes:** ~6 curated style families, each emitting a coherent spec with
  bounded randomization so results look designed, not random:
  *Soft Gradient*, *Bold Mesh*, *Clean Solid*, *Device Hero* (adds a frame),
  *Duotone* (uses a v17 color-map over a palette), *Pattern Pop*.
  A generation draws N (=4) distinct recipes (no duplicates within a set).
- **Variant rendering (the one real technical decision):** `renderInto` reads
  global `state`. To preview a candidate without disturbing the user's work:
  **snapshot the spec-affected keys → `applySpec(candidate)` →
  `renderInto(offscreenCanvas, true)` → `toDataURL()` → restore the snapshot.**
  Synchronous, reuses the existing pipeline exactly, real state untouched after.
  *Rejected:* threading a `state` param through every `draw*` (large, risky
  refactor).
- **Apply:** on card click → `saveStateToHistory()` → `applySpec(chosen)` →
  `render()` → `updateUIFromState()`.

## UI & aesthetic

New **"Variations"** sidebar section (`editor/index.html`), dark studio base:
- Full-width **Generate** button with an animated spectrum-gradient sweep (the
  AI-arc signature). Honors `prefers-reduced-motion` → static gradient.
- **2×2 grid** of variant cards (thumbnails). Hover animates a gradient border;
  the applied card gets an active ring. Recipe name shown per card.
- **Shuffle again** ghost button.
- Empty state when no image: Generate disabled + hint (matches `palette-extract`).

Reuses existing control classes. Only new CSS: the gradient button + animated
card border + grid, scoped to this section. New DOM ids registered in
`src/ui/elements.js`; `bindCompose()` called in `src/main.js` `init()`.

## Data flow

1. User clicks Generate → `compose.js` builds N candidate specs from recipes.
2. For each: snapshot keys → `applySpec` → `renderInto(offscreen, true)` →
   thumbnail dataURL → restore. Render the gallery.
3. User clicks a card → save history → `applySpec(chosen)` → `render()` →
   `updateUIFromState()`. Card shows active.
4. Shuffle again → repeat step 1 with fresh recipe draws.

## Error handling / edge cases

- No image → Generate disabled, guidance shown.
- Tainted canvas (cross-origin bg/image) → offscreen `toDataURL()` can throw;
  wrap in try/catch and render that card as a solid recipe-colored tile (still
  applyable). Never break the gallery.
- One bad recipe is isolated; other cards still render.
- Large images → thumbnails render at a capped preview size (e.g. long edge
  ~320px) for speed; the applied spec uses full resolution via the normal path.

## Undo / state / persistence

- `applySpec` only mutates keys already in `history.snapshot()` (bg, gradient,
  mesh, pattern, deviceFrame, padding, scale, borderRadius, shadow, imageFilters,
  colorMap). So `saveStateToHistory()` before apply gives full undo with **zero
  new snapshot keys**.
- Variants are transient (not stored in state). No localStorage, no new
  persisted state.

## Testing / verification (no test runner — manual in `npm run dev`)

- Generate with various images, flat path AND device-mockup path.
- Apply a variant → matches its preview AND exports identically (PNG).
- Shuffle again yields fresh, tasteful, non-duplicate results.
- Undo restores the prior design exactly; redo re-applies.
- After apply, every sidebar control reflects the applied spec
  (`updateUIFromState`).
- `prefers-reduced-motion` disables the button shimmer + card animation.
- Edge cases: no image (disabled + hint), tainted canvas (solid-tile fallback,
  no crash).
- `npm run build` succeeds.

## Release chores

- Bump `package.json` to `18.0.0`.
- What's-new toast entry (`src/features/whats-new.js`): `CURRENT_VERSION = '18.0'`.
- **Changelog** (`changelog/index.html`): demote the current `.entry.latest`
  (v17.0) to `.entry`; add a v18 entry and refresh the spotlight. Build the v18
  entry with the **frontend design/taste skill**, with its **own distinct
  treatment** — not v16 glass, not the v17 spectrum; a "generative / variant
  grid" motif that introduces the AI arc.
- Register `bindCompose()` in `src/main.js`; add ids to `src/ui/elements.js`.

## Out of scope (later in the arc)

- Any AI/model call, prompt box, or generated copy (v19).
- AI background / asset generation (v19).
- Conversational refinement, memory, multi-turn agent (v20).
- Changing the screenshot pixels, canvas size, annotations, text, or motion.
