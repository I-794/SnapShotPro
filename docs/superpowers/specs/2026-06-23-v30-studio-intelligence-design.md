# v30 "Studio Intelligence" — Design Spec

**Status:** Approved design (not yet implemented)
**Date:** 2026-06-23
**Target version:** 30.0.0 (current: 29.0.0)

> The largest update in SnapShotPro history. Every prior flagship operated on
> **one canvas**. The v20 Design Agent refines *presentation only* (frame,
> background, text overlay, filters) and never touches screenshot content or
> produces more than one design. V30 breaks that ceiling on four fronts at once —
> each a standalone product surface that is bigger than, and separate from, the
> Design Agent — plus a taste-skill marketing page and the in-app announcement.

## Goal

Four new capabilities, shipped together at a deliberately MVP-bounded depth:

1. **Brand Brain** — extract a full brand system once (from a URL or uploaded
   assets) and enforce/auto-apply it app-wide. *Persistent intelligence, not a
   one-shot canvas.*
2. **AI Screenshot Editor** — edit the *content inside* a screenshot semantically
   (fix a typo, recolor an element, redact text, remove clutter). *Crosses the
   exact line the Agent won't.*
3. **Campaign Generator** — one prompt + a screenshot → a coordinated set of
   finished, correctly-sized assets (hero, social variants, App Store set, teaser
   video), stored in a revisitable **Campaign folder**. *N coordinated designs.*
4. **Autonomous Operator ("Producer")** — a **new, separate** autopilot surface:
   give it a goal ("make me a launch kit"), walk away, return to a finished,
   brand-consistent Campaign folder. *Copilot → autopilot.*

Plus **(5)** a taste-skill marketing page and **(6)** changelog + what's-new
announcement.

## Locked decisions (from brainstorm)

1. **Build order = dependency order:** shared foundations → **Brand Brain** →
   **AI Screenshot Editor** (independent, can overlap) → **Campaign Generator** →
   **Producer**. Brand Brain is the foundation the Generator and Producer consume.
2. **Producer is its OWN surface,** separate from the conversational Design Agent
   (`ai-agent.js`). It reuses the agent *runtime* (`runAgentTurn`) under the hood
   but ships as a distinct panel — honoring "separate from the Design Agent."
3. **Campaigns are persisted in-app** as a revisitable Campaign folder
   (localStorage, optional Supabase), not just a one-shot ZIP.
4. **All four at MVP depth.** Each pillar has explicit deferred-scope lines; we
   ship breadth with bounded depth rather than one pillar fully built.
5. **Marketing + changelog + what's-new use the `taste-skill`** for visual design,
   adapted to this repo's vanilla HTML/CSS (NOT React/Tailwind).
6. **Tagline:** "One screenshot in. A whole campaign out." (sub: "The AI studio
   that learns your brand, edits your pixels, and ships the rest — on autopilot.")

## Shared foundations (build once, reused by all pillars)

### New AI primitive — `runVisionJson(prompt, dataUrl)` in `src/features/ai-cloud.js`
Mirrors the existing `runVisionPrompt` but requests a JSON object and returns a
parsed object (or null). OpenAI path sets `response_format:{type:'json_object'}`;
Anthropic path uses a JSON-instructing system prompt. Parses via the existing
`parseJsonLoose()`. Hosted-proxy→BYOK fallback identical to `runVisionPrompt`.
**Reused by Brand Brain (URL→system), the Screenshot Editor (locate regions),
and the Producer (goal→plan).**

### New render helper — `renderAtSize(canvas, { width, height })` in `src/render/render.js`
Thin wrapper: stash `state.canvas`, set `state.canvas = { width, height }`, call
`renderInto(canvas, true)` (forExport — suppresses preview chrome), restore
`state.canvas`. Returns nothing; caller reads pixels via `canvas.toBlob()`.
**Reused by the Campaign Generator and Producer for multi-size rendering.**

### Schema / undo / serialize plumbing
- `state.brand` added to `snapshot()` (`src/state/history.js`) and
  `SERIALIZED_FIELDS` (`src/state/serialize.js`).
- `SCHEMA_VERSION` bumped (18→19) with `migrateStudioIntelligenceV19()` adding a
  default disabled `state.brand` for pre-v30 projects (mirrors the
  `migrateTimelineV18()` precedent).
- Campaigns are stored in their own localStorage store (like `projects.js`), NOT
  in `snapshot()` / `SERIALIZED_FIELDS` — they are deliverables, not undoable
  per-project design state.

---

## Pillar 1 — Brand Brain (`state.brand`)

### New state
```js
state.brand = {
  enabled: false,
  name: '',
  sourceUrl: '',
  palette: [],                                  // ["#hex", ...]
  background: { mode, gradient|solid|mesh },     // applySpec-compatible bg block
  frame: { type, color },
  typography: { headlineFont, captionFont },
  colorMap: { mode, intensity, steps },          // on-brand recolor
  filter: 'none',                                // artFilterPresets key
  logo: { dataUrl: null, position, scale, opacity },
  watermark: { text, color, position, size, opacity },
  enforce: false                                 // auto-adopt on new page/project
}
```

### New: `src/features/brand-brain.js` — `bindBrandBrain()`
A collapsible sidebar section in the **Background** group (`data-group="background"`).
Inputs: a URL field + "Extract", an asset/logo upload, an editable preview of the
extracted system, **Apply** and an **Enforce** toggle.

- **URL extraction:** new `api/brand-extract.js` (Vercel function, mirrors
  `api/fetch-url.js` + `api/ai-vision.js`) fetches the page and a render/screenshot,
  then the client calls `runVisionJson()` with a fixed prompt → dominant colors,
  logo guess, type feel → normalized into the `state.brand` schema. Palette
  refined with `palette-extract.js` `kmeans()` over the page screenshot and
  completed via `generateHarmony()` (`src/utils/color.js`). Without a hosted key,
  fall back to palette-only extraction from an uploaded asset (no vision).
- **Asset extraction:** uploaded logo → `kmeans()` palette; logo stored as a
  dataURL exactly like `brand-kit.js` `logo.src` (decoded by `loadLogoImage()`).
- **`applyBrand()`** maps `state.brand` → `applySpec()` (`src/state/spec.js`) for
  bg / frame / filter / colorMap, sets `state.textOverlay.font`, `state.logo`,
  `state.watermark`, and registers `palette` into `state.colorPalettes.library`
  (+ sets `colorPalettes.active`). It is essentially a smarter
  `brand-kit.js` `applyKitObject()` driven by an extracted system. Followed by
  `render()` + `window.__updateUIFromState()`.
- **Enforce:** when `state.brand.enforce`, `applyBrand()` is invoked on new-page
  (`pages.js` `addPage`) and new-project (`projects.js` `newProject`) creation.

### MVP / deferred
MVP: one active brand; URL **or** asset extraction; Apply + Enforce. Deferred:
multiple saved brands, web-font auto-download/matching, voice/tone copy gen.

---

## Pillar 2 — AI Screenshot Editor (edits `state.image`)

### New: `src/features/ai-screenshot-editor.js` — `bindScreenshotEditor()`
A "Magic Edit" panel/mode in the **AI** group (or Markup). Four ops:
**fix/replace text**, **recolor element/region**, **redact** (PII/email or
user-selected → blur/box), **remove clutter** (cursor/notification).

- **Locate:** `runVisionJson()` returns `{ regions:[{ label, x, y, w, h }] }` in
  source-image pixel coordinates. For text ops, cross-check with OCR word boxes —
  extend `src/features/ocr.js` to surface `data.words[].bbox` (Tesseract already
  returns these; currently discarded). The user confirms the highlighted target
  box before any regeneration (a picker overlay over the vision-returned boxes).
- **Mask → edit:** build a full-resolution mask canvas from the chosen box
  (transparent = regenerate, opaque = keep — the convention `api/image-edit.js`
  uses) and call the existing `edit(imageBlob, maskBlob, prompt, size)` in
  `src/features/ai-image-edit.js` (model `gpt-image-2`, proxy→BYOK fallback
  already handled). Op-specific prompts: "replace the text with '…'", "recolor
  this element to #hex", "remove this UI element seamlessly".
- **Redact short-circuits the AI:** draw a blur/blackbox into the region directly
  on an offscreen copy of `state.image` — no model call (privacy + zero cost). AI
  path optional for redaction.
- **Commit:** reuse the `applyResultAsImage(b64)` pattern —
  `saveStateToHistory()` then `state.image = editedImage; render()`. Undo already
  covers `state.image`. The edited pixels bake into export for free (normal
  render path).
- **UI:** reuse the existing eraser modal's brush/mask canvas
  (`ai-image-edit.js` ~lines 225–292) for manual masking, plus the vision-box
  picker for guided masking.

### MVP / deferred
MVP: the four ops above, one region at a time. Deferred: full in-place
multi-language re-render of every string, object/element insertion, batch ops.

---

## Pillar 3 — Campaign Generator (Campaign folder)

### New: `src/features/campaign-generator.js` — `bindCampaignGenerator()`
The generation flow. Input: a prompt + the current screenshot (+ active
`state.brand`). Output set (MVP): Hero 1200×675; social IG 1080×1080, X 1200×630,
LinkedIn 1200×627; one App Store set (a `STORE_PRESETS` size); one teaser MP4.

- **Art direction → base design:** reuse `ai-art-director.js` / `applySpec()` to
  turn the prompt (+ brand) into one base design spec applied to `state`.
- **Multi-size render:** for each social/hero target,
  `renderAtSize(offscreen, { w, h })` → `canvas.toBlob()`. App Store panels via
  the existing `renderSetPanels()` (`src/features/screenshot-set.js`). Teaser via
  `exportTimeline('mp4')` (`src/features/timeline-export.js`) →
  `encodeMp4(frameProvider)`.
- **Brand-consistent:** if `state.brand.enabled`, `applyBrand()` runs before the
  base spec so every asset inherits the system.

### New: `src/features/campaigns.js` — `bindCampaigns()` (storage + folder UI)
- **Storage:** `localStorage:snapshotpro_campaigns` mirroring `projects.js`
  shape; optional Supabase `campaigns` table + Storage bucket reusing the
  `gallery.js` publish/browse pattern (gated behind sign-in; localStorage works
  offline). Shape:
  ```js
  { id, name, createdAt, brandId,
    assets: [{ role, width, height, format, thumb, blob|blobKey|url }] }
  ```
- **UI:** a "Campaigns" panel in the **Project** group — each campaign is a
  folder/grid of asset cards. Actions: re-download a single asset, download the
  whole campaign as a ZIP via `downloadZip()` (`batch-export.js`), or re-open an
  asset as a new page (`pages.js` `addPage`). Cmd-K entry registered in
  `registerCommands()`.

### MVP / deferred
MVP: the fixed output set, one campaign run at a time, persisted + re-downloadable.
Deferred: per-platform copy variants, A/B seeds, scheduled/bulk runs.

---

## Pillar 4 — Autonomous Operator "Producer" (new surface)

### New: `src/features/producer.js` — `bindProducer()`
Its own icon-rail surface (`studio-nav.js`), distinct from `ai-agent.js`. Inputs:
preset goals ("Launch kit", "App Store pack", "Social pack") + a free-text goal;
a **Run** / **Pause** / **Stop** control; a live progress log.

- **Planner:** `runVisionJson()` / `runTextPrompt(prompt, { json:true })` turns
  the goal into a bounded step list (which screenshot, which brand, which campaign
  outputs) — capped at ~N steps.
- **Executor:** sequentially drives the other pillars' programmatic entry points —
  `applyBrand()` (Brand Brain), the Campaign Generator's render+persist functions,
  optionally the Screenshot Editor's redact/clean pass. The agent runtime
  `runAgentTurn()` (`ai-cloud.js`) is used only where genuine tool-choice is
  needed; most steps are deterministic calls. Narration streams via the existing
  `onText` callback into the progress log.
- **Output:** a single Campaign folder (Pillar 3 storage), surfaced when done.
  A Stop flag is checked between steps.

### MVP / deferred
MVP: preset + free-text goals, bounded plan, Campaign-folder output, progress log,
pause/stop. Deferred: open-ended multi-tool autonomy, self-critique/retry loops,
cross-session resumable runs.

---

## Pillar 5 — Marketing page (taste-skill)

New static page `studio-intelligence/index.html`, registered as a Vite input in
`rollupOptions.input` (`vite.config.js`), built exactly like `/product-mockups/`,
`/ai/`, `/agent/`: shared `<!--PARTIAL:…-->` nav/footer from `site/partials/`,
`{{VERSION}}` footer, `__OG_BASE__` OG tags. Wired into the marketing nav (the
`/ai/` AI-umbrella hub + footer).

- **Design via `taste-skill`:** invoke the `taste-skill` for layout, type scale,
  spacing, and anti-generic composition; express its decisions as **vanilla
  HTML/CSS** consistent with existing pages (the repo's vendored React/Tailwind
  skills do NOT apply here).
- **Content:** hero (tagline + CTA into `/editor/`) + four feature sections
  (Brand Brain, AI Screenshot Editor, Campaign Generator, Producer) with
  before/after or output-grid visuals. MVP: static page; visuals may be
  placeholders until features land.

## Pillar 6 — Changelog + What's-New (taste-skill)

- **Changelog** (`changelog/index.html`): demote the current `.entry.latest` →
  `.entry`; add a v30 "Studio Intelligence" entry + refresh the spotlight. Use the
  `taste-skill` for the entry's visual treatment, expressed in the page's existing
  vanilla HTML/CSS, with a motif distinct from prior entries.
- **What's-New toast** (`src/features/whats-new.js`): set the current-version
  constant to `30.0`; add the v30 entry (headline + the four features as concise
  bullets + a CTA). Apply `taste-skill` design direction to elevate the toast's
  markup/styling; keep its existing trigger/render mechanics.

---

## Data flow

**Brand Brain:** URL/asset → `api/brand-extract` + `runVisionJson` + `kmeans` →
`state.brand` → `applyBrand()` → `applySpec`/state setters → `render()` +
`updateUIFromState`.

**Screenshot Editor:** `state.image` → `runVisionJson`/OCR boxes → user confirms
box → mask → `edit()` → `applyResultAsImage` → `state.image` → `render()`.

**Campaign Generator:** prompt (+brand) → `applyBrand` + art-director `applySpec`
→ per-target `renderAtSize`/`renderSetPanels`/`exportTimeline` → assets →
`campaigns.js` store → Campaigns folder UI.

**Producer:** goal → `runVisionJson` plan → executor drives Brand Brain +
Campaign Generator (+ Editor) → Campaign folder; progress streamed via `onText`.

Everything visual bakes into export through the normal `renderInto` path.

## Error handling / edge cases

- **No key / hosted AI absent:** reuse the existing NO_KEY pattern — vision/edit
  calls show guidance and open the API-keys panel. Brand Brain degrades to
  palette-only (asset) extraction; Redact still works (no AI).
- **URL fetch blocked / vision fails:** Brand Brain reports and falls back to
  asset/manual entry; never throws.
- **Edit failure / no image:** the editor reports gracefully and leaves
  `state.image` unchanged.
- **Campaign generation partial failure:** persist successfully-rendered assets;
  mark missing roles; let the user re-run just those.
- **Producer step failure:** log the error, continue with remaining independent
  steps, surface a summary; Stop aborts after the current step.
- **localStorage full:** campaigns store reuses the projects.js quota-guard
  pattern (prune/skip with a message); never lose the active project.

## Undo / state / persistence

- **Brand Brain:** `applyBrand()` is one `saveStateToHistory()` (whole apply =
  one undo step); `state.brand` is snapshotted + serialized. Generated bgImage
  pixels are not snapshotted (consistent with v19).
- **Screenshot Editor:** one `saveStateToHistory()` per edit; `state.image` is
  already in history, so undo reverts the edit.
- **Campaigns:** live in their own store (not history) — deliverables, not
  undoable design state.
- **Producer:** drives the above; each underlying op manages its own history.

## Testing / verification (no test runner — manual in `npm run dev`)

1. **Brand Brain:** paste a URL → a palette/logo/type system populates
   `state.brand`; Apply → bg/frame/colors/logo change; Enforce on → add a page →
   it inherits the brand.
2. **Screenshot Editor:** typo screenshot → fix-text replaces it in-place (export
   shows the fix); redact blurs an email with no AI key; undo reverts each.
3. **Campaign Generator:** prompt + screenshot → Campaign folder with hero + 3
   social + an App Store set + an MP4; re-download as ZIP; reopen an asset as a
   page; each asset is correctly sized.
4. **Producer:** "Launch kit" → progress log streams → a brand-consistent
   Campaign folder with the expected assets; Stop aborts cleanly.
5. **Regression:** Design Agent, Motion Studio export, projects save/load, and a
   pre-v30 project (migration) all still work.
6. `npm run build` succeeds (all new Vite inputs build).

## Release chores

- Bump `package.json` → `30.0.0` (footer + what's-new trigger); editor
  header/title → v30.0.
- Changelog v30 entry + what's-new toast (`taste-skill`).
- New marketing page wired into nav/footer + OG.

## Out of scope (v1)

- Multiple saved brands; web-font auto-download/matching; brand voice/tone copy.
- Full multi-language in-place screenshot re-render; object insertion.
- Per-platform campaign copy variants; A/B seeds; scheduled/bulk campaign runs.
- Open-ended Producer autonomy; self-critique loops; resumable runs.
- Cross-device sync of brands/campaigns beyond the optional Supabase mirror.
