# v19 "AI Assets" — Design Spec

**Status:** Approved design (not yet implemented)
**Date:** 2026-06-14
**Target version:** 19.0.0 (current: 18.0.0)

> Middle step of the AI arc. v18 shipped the deterministic spec→canvas engine
> (Design Variations). v19 adds real generated pixels. v20 — the flagship and
> the biggest release — is the conversational AI Design Agent that orchestrates
> v18 (compose) + v19 (assets) as tools, with multi-turn refinement and memory.

## Goal

One polished **AI Assets** panel that generates **on-brand backgrounds** from a
text prompt and cleanly **places the subject** on them. It unifies today's
scattered, BYO-key asset bits (`aiGenerateBackground`, `ai-image-edit` bg
replace/outpaint/eraser, `bg-remove`) into one cohesive, palette-aware feature,
and gives the v20 agent a reliable "generate pixels" tool.

## The AI arc

- **v18 (shipped):** Design Variations — deterministic Design Spec engine
  (`src/state/spec.js` `applySpec`) + variant gallery.
- **v19 (this spec):** AI Assets — on-brand text-to-background + auto subject
  isolation, reusing existing AI plumbing.
- **v20 (biggest):** AI Design Agent — conversational, multi-turn; orchestrates
  compose (v18) + assets (v19) as tools, with "make it more X" refinement and
  memory. The prompt-driven composing experience lands here, not in v19.

## Locked decisions (from brainstorm)

1. **Headline = on-brand backgrounds + auto-isolate** (safest; reuses existing
   code; cleanest for the v20 agent).
2. **AI-only by nature.** Generated pixels can't be faked, so with no hosted AI
   and no BYO key, the panel degrades gracefully (guidance to add a key). Unlike
   v17/v18, there is no deterministic fallback for this feature.
3. **Model = `gpt-image-2`** for BOTH the hosted route (already so) AND the
   BYO-key path (today's client fallback uses DALL·E 3 — standardize on
   gpt-image-2 for consistent output and to match the maintainer's setup).
4. **Reuse, don't rebuild.** Build on `ai-cloud.js`, `api/image-generate.js`,
   `api-keys.js`, and `bg-remove.js`. Minimal new server work.

## Capabilities (one panel)

1. **On-brand text-to-background.** Prompt → generated background image. The
   prompt is auto-augmented with the active v17 palette / brand-kit colors when
   "Use my palette" is on, generated at the **canvas aspect ratio**, with a few
   **style chips** (Photographic, Abstract, Studio, Gradient) that prepend a
   style phrase. Result sets `state.bgMode = 'image'` and `state.bgImage`.
2. **Auto subject isolation.** A "Place behind subject" toggle: after generating
   (or on demand), remove the *screenshot's own* background via the existing
   `bg-remove.js` (@imgly) so the generated scene shows behind the subject — the
   classic product-shot composite.
3. **Cohesion.** Absorb the scattered `#ai-bg-*` controls into this one AI Assets
   panel; share the v18 "Generative" spectrum-gradient signature on the generate
   button.

## Architecture

### New: `src/features/ai-assets.js` — `bindAiAssets()`
Orchestrates the flow; owns the new panel's events. Pure coordination — it reuses
existing helpers rather than reimplementing generation or removal.

- **Prompt building:** `buildAssetPrompt(userText, { style, useBrand })` →
  prepends the style phrase and, when `useBrand`, appends the active palette hex
  list (from `state.colorPalettes`) / brand-kit colors so output is on-brand.
- **Generation:** call the existing generate path. Refactor `ai-cloud.js`'s
  `aiGenerateBackground` into a parameterized `generateBackground({ prompt, size })`
  that (a) tries hosted `/api/image-generate` (gpt-image-2), (b) falls back to a
  BYO OpenAI key calling the OpenAI images API with **gpt-image-2** (not DALL·E
  3), (c) returns a dataURL or throws. `bindAiAssets` calls it with a
  canvas-aspect `size`, sets `state.bgImage` + `bgMode:'image'`, then `render()`.
- **Isolation:** when "Place behind subject" is on, run the existing bg-remove
  routine on `state.image` after the background is set.

### Reused as-is
- `api/image-generate.js` (hosted, gpt-image-2; returns `{ b64 }`; 501 → fall back).
- `src/features/api-keys.js` (`getKey('openai')`), `src/features/ai-cloud.js`
  (provider/availability, status pill), `src/features/bg-remove.js` (subject cut).
- Background rendering for `bgMode:'image'` already exists (today's
  `aiGenerateBackground` uses it) and bakes into export.

### Size mapping
Map `state.canvas` aspect → the nearest gpt-image-2 supported size
(`1024x1024`, `1536x1024`, `1024x1536`). Landscape → 1536x1024, portrait →
1024x1536, square → 1024x1024.

## UI & aesthetic

Upgrade the existing "AI Background" area in the **AI Tools** section into an
**AI Assets** panel: prompt input, style chips, "Use my palette" toggle, "Place
behind subject" toggle, and a generate button carrying the v18 spectrum-gradient
signature (honors `prefers-reduced-motion`). Status via the existing
`#ai-cloud-status` / a local status line. New ids registered in
`src/ui/elements.js`; `bindAiAssets()` called from `src/main.js`. Retire the old
`#ai-bg-prompt`/`#ai-bg-btn` (route them into the new panel) and leave the
separate magic-eraser / extend tools where they are.

## Data flow

1. User enters a prompt, picks a style, toggles palette/isolate, clicks Generate.
2. `buildAssetPrompt` composes the final prompt; size derived from canvas aspect.
3. `generateBackground` → hosted gpt-image-2, else BYO-key gpt-image-2 → dataURL.
4. `state.bgImage` set, `state.bgMode = 'image'`; if isolate on, run bg-remove on
   `state.image`. `render()`; `updateUIFromState()` reflects bg mode.
5. Export uses the same render path → identical pixels.

## Error handling / edge cases

- **No hosted AI and no key:** panel controls disabled with a clear hint ("Add an
  OpenAI key in AI settings, or use the hosted deployment"). Detected via the
  existing key/availability check.
- **Generation failure / timeout / quota:** toast the error; leave state
  unchanged (don't half-apply). Re-enable the button.
- **No image loaded + isolate on:** skip isolation with a hint (background still
  generates).
- **bg-remove unavailable (model fetch blocked):** generate the background but
  surface that isolation could not run; don't crash.
- **Large canvas:** generated image is fixed-size and scaled to cover; existing
  background-image rendering handles fit.

## Undo / state / persistence

- `bgMode` is already in `history.snapshot()`, so the *mode switch* is undoable.
- `state.bgImage` is a large dataURL; treat it like `state.image` — **kept out of
  the deep-cloned history snapshot** to avoid bloating undo (50 entries × a
  multi-MB dataURL). Practical effect: undo after a generate returns to the prior
  background **mode**; the generated image itself isn't re-pushed through history
  (matches how the source image is handled today). Document this in the panel if
  needed.
- Subject isolation replaces `state.image` through the existing bg-remove flow,
  which already integrates with history.
- No new persisted/localStorage state.

## Testing / verification (no test runner — manual in `npm run dev`)

- With a valid OpenAI key (gpt-image-2): generate a background from a prompt →
  appears on canvas and exports.
- "Use my palette" on → generated colors visibly track the active palette.
- Style chips change the look (Photographic vs Abstract vs Studio vs Gradient).
- Aspect: portrait/landscape/square canvases request the right size and cover
  correctly.
- "Place behind subject" → screenshot background removed, generated scene shows
  behind the subject; exports correctly.
- No key + no hosted → panel disabled with guidance (no crash).
- Generation error → toast, state unchanged.
- Undo after generate returns to the prior background mode.
- `npm run build` succeeds.

## Release chores

- Bump `package.json` to `19.0.0`.
- What's-new toast (`src/features/whats-new.js`): `CURRENT_VERSION='19.0'`,
  v19 highlights.
- Editor header version badge + `<title>` → v19.0.
- **Changelog** (`changelog/index.html`): demote v18.0 `.entry.latest` → `.entry`;
  add a v19 entry + refresh the spotlight. Build with the **frontend taste
  skill**, with its **own distinct motif** (an "asset generation" / prompt→image
  treatment) — not v16 glass, v17 spectrum, or v18 variant-grid.

## Out of scope (later in the arc)

- Conversational / multi-turn refinement, "make it more X", memory (v20 agent).
- Prompt-driven *composing* of the whole design spec (that's the v20 agent; v19
  only generates the background/asset pixels).
- Generated decorative elements / object generation (deferred; could be a later
  asset expansion).
- Any new server provider beyond the existing OpenAI gpt-image-2 route.
