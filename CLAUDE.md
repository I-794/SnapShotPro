# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Models / Preferences

- Always use Opus for all work, including subagents. Do not fall back to Sonnet or Haiku.

## Planning & Feature Ideation

- When planning features, deliver concrete suggestions and lists directly first. Only ask clarifying questions if truly blocked; do not lead with AskUserQuestion prompts.

## Git & Deployment

- "deploy" means commit and push to git, unless explicitly told to push to Vercel/production.

## Environment / Dev Server

- Host OS is Windows/PowerShell. Avoid heredoc syntax for commit messages (it leaves stray `@` characters); use a single `-m` flag or a temp file instead.
- When testing on a phone, bind the dev server to the LAN (e.g., `--host 0.0.0.0`).

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server at http://localhost:5173 (auto-opens)
npm run build      # production build to dist/
npm run preview    # serve the built dist/
```

The editor app lives at `/editor/` (entry `editor/index.html` -> `/src/main.js`). The repo also builds static marketing/info pages (home, changelog, pricing, gallery, `about`, `ai`, etc.) as separate Vite inputs; see `rollupOptions.input` in `vite.config.js`. The marketing nav uses an AI umbrella: the nav "AI" link points at `/ai/` (the AI-suite hub), and the standalone `/agent/` page is reachable from there and the footer.

There is **no test runner and no linter configured**; `dev`, `build`, `preview` are the only scripts. Verify changes by running the editor in `npm run dev` and exercising the feature in-browser.

## Architecture

Vanilla JS + Vite. No framework, no reactive layer. The whole editor is driven by one mutable global state object and a single canvas render function.

### Single source of truth: `state`
`src/state/state.js` exports one mutable `state` object. Every feature reads and writes it directly; there is no store abstraction and no events for state changes. To change what's on screen, mutate `state` and call `render()`.

### Render pipeline: everything bakes into one canvas
`src/render/render.js` -> `render(forExport)` -> `renderInto(canvas, forExport)`. `renderInto` re-derives the entire image from `state` by running ordered `draw*` passes (background -> image+filters -> reflection -> effects -> annotations -> text/watermark/logo -> device frame). Key consequences:

- **Any visual feature must draw inside `renderInto` to appear in exports.** Export (`forExport=true`) renders the same passes into an offscreen canvas; the only difference is that preview-only chrome (minimap, CSS-transform sync, the Tour hotspot-authoring overlay in `src/render/tour-overlay.js`) is suppressed. CSS-only styling on the preview canvas will NOT export. That is deliberate for Tour hotspots, which are interactive HTML in the exported player, not baked pixels.
- There are FOUR composition paths inside `renderInto`, checked in this order: the surface-mockup path (`src/render/surfaces.js`, gated on `state.surface.enabled` + `isSurfaceMockup()`), the 2D device-mockup path (`src/render/mockups.js`), the WebGL 3D-mockup path (`src/render/mockups-3d.js`; renders the device offscreen with lazy-loaded three.js in its own `vendor-three` chunk, then `drawImage`-composites into the same 2D canvas so it bakes into exports), and the flat path. **A change that should apply to all of them must be added to each.**
- The source image is drawn in `render.js` (around line 229; search for `ctx.filter` if the line has drifted) using `ctx.filter` with brightness/contrast/saturation/blur/grayscale/sepia from `state.imageFilters`, which is why those bake into export for free. Effects that `ctx.filter` cannot express need per-pixel `ImageData` passes.
- `renderAtSize` (also in `render.js`) renders offscreen at an arbitrary size; reuse it for anything that needs sized outputs (campaigns, batch, etc.).

### The `bind*` feature pattern
Each file in `src/features/` (and some in `src/render/`) exports a `bind<Feature>()` that attaches DOM listeners and initializes that feature. `src/main.js` `init()` calls every `bind*` once at startup, in order. **Adding a feature = new module exporting `bindX()` + an import and call in `main.js`.** Feature modules are tagged at the top with the version that introduced them (e.g. `// v16.1`); follow this convention.

### Canvas object selection & context menu
Canvas objects (annotations, redactions, extra images, and the singleton text overlay) are selected through one unified model in `src/features/selection.js`. A *ref* is `{ kind: 'annotation'|'redaction'|'extraImage'|'text', id }`, keyed by each object's `id` (not array index) so refs survive reorder/delete. `state.canvasSelection` (an array of refs) is the source of truth; `resolveRef(ref)` returns a uniform handle (`box`, `moveBy`, `clone`, `remove`, `raiseToFront`, `sendToBack`, plus `getStyle`/`setStyle` for annotations) that all multi-select, group-move, duplicate, reorder, copy-style, and align ops go through.

For backward compatibility, `syncLegacy()` mirrors a *single* selection back into the old `state.selectedAnnotation`/`selectedRedaction`/`selectedExtraImage` fields, so the existing sidebar bindings, `nudgeSelected`, and `alignSelectedToCanvas` keep working untouched; an empty or multi selection clears them. **Any new code that selects a canvas object must call `selectOnly`/`setSelection`/`clearSelection` from `selection.js`, never poke the legacy fields directly.** The right-click menu (`src/features/context-menu.js`) hit-tests via `hitTopRef` (in `canvas-tools.js`) and acts on `canvasSelection`. Selection chrome is drawn in the render passes keyed off the selection (read directly via `state.canvasSelection.some(...)` to avoid an import cycle); the marquee rubber-band is transient preview-only chrome.

### Undo/redo is an explicit allow-list
`src/state/history.js` `snapshot()` deep-clones a hand-maintained list of `state` keys. `saveStateToHistory()` is called *before* a mutation. **When you add new undoable state, you must add its key to `snapshot()` or it will not be tracked by undo/redo.** Runtime-only fields (animation `playing`/`currentTime`, the 3D mockup's `orbitProgress`, `state.canvasSelection`, `state.mergeStudio`) are deliberately stripped from or never added to the snapshot. See the State registry table below for the current membership of every major key.

### DOM access is centralized
`src/ui/elements.js` exports `el`, populated by `initElements()`; all `getElementById` refs live here. `src/ui/bindings.js` wires the sidebar controls and exposes `updateUIFromState()`, which pushes `state` -> DOM (call it after programmatically changing state so controls reflect it). Cross-module calls go through a few `window.__*` globals (`window.__updateUIFromState`, `window.__openWhatsNew`, `window.__refreshSetUi`, `window.__refreshTemplateList`, `window.__motionStudioRefresh`, etc.) to avoid import cycles.

### Studio sidebar IA
The editor sidebar is an icon rail + one contextual panel (`src/features/studio-nav.js`). Each `<div class="sidebar-section">` in `editor/index.html` carries an explicit `data-group="import|adjust|background|frame|markup|ai|export|project"`; the active rail tab shows only its group (a title-substring fallback exists if a section ever lacks `data-group`). Sections are collapsible: the `.section-title` row toggles `.collapsed` on its section (CSS hides everything but the title), persisted per-section in `localStorage` (`snapshotpro_section_collapsed`). **When adding a new feature section, give it a `data-group`.** Do not add per-feature version badges next to section titles.

### Command palette & keyboard shortcuts
The Cmd-K command palette lives in `src/features/palette.js`. `registerCommands()` builds a hand-maintained `commands` list; each command carries `id`, `label`, `icon`, `run`, plus metadata: `group` (assigned by `groupFor(id)`), an optional `keys` shortcut-hint string, and an optional `when()` context predicate. `renderPaletteResults()` filters out commands whose `when()` is false, shows a grouped Recent + categories view on an empty query, and a flat fuzzy-ranked list (with a small `getFrequencyBoost`) when typing. Usage is tracked in `src/features/command-usage.js` (`snapshotpro_cmd_usage`). **A new palette command = a new entry in `registerCommands()`** (give it a sensible `group`; add `when`/`keys` only if context-specific or globally bound).

Global keyboard shortcuts have a single source of truth: `src/features/shortcuts.js` exports `SHORTCUTS`. `keyboard.js` dispatches the non-`displayOnly` entries via `matchEvent(e)`, and the `?` help overlay is *generated* from the same list by `renderShortcutsOverlay()`, so the two cannot drift. Context-sensitive handlers (the Escape cascade, arrow-nudge, timeline scrubbing, delete) stay bespoke in `keyboard.js` and are listed in `SHORTCUTS` as `displayOnly` purely so the overlay shows them. **Add or change a global shortcut in `shortcuts.js`, never in `keyboard.js` and the overlay separately.**

### Motion Studio: one clock unifies all motion
The editor historically ran three independent playback clocks (`state.animation.currentTime` for entrance + Ken Burns, `videoEl.currentTime` for clips, `state.mockup3d.orbitProgress` for turntable). Motion Studio layers one shared clock + a multi-lane timeline on top without rewriting any of them:

- Single source of truth: `state.timeline.currentTime` (ms). `state.timeline.lanes` is the undoable/serialized lane+clip layout (one lane per motion source; each clip carries `start`/`duration`).
- The render stays pull-based: getters map the unified clock down to each source's local progress via `src/state/motion-clock.js` `localProgress(kind, target, fallback)`. `animation.js` `getElementAnimState()` and `ken-burns.js` `getKenBurnsProgress()` call it, returning the legacy clock as `fallback` when Motion Studio is not the active driver.
- The driver is gated on the runtime flag `state.timeline._driving` (true while the unified clock plays/scrubs; legacy Play buttons and legacy exporters set it false to reclaim the preview).
- `src/features/playback.js` is the single RAF engine (`sampleAt(ms)` pushes the two non-pullable sources, async video seek + turntable orbit cache, then `render()`). `src/features/motion-studio.js` is the sidebar panel (`syncLanesFromState()` reconciles lanes from the live editors, `renderLanes()` rebuilds the DOM, drag sets clip `start`/`duration`). `src/features/timeline-export.js` `exportTimeline()` renders the whole timeline through the existing `motion-export.js` encoders.
- The per-feature editors (Animation, Ken Burns, Video trim, 3D turntable) remain the property editors; the timeline owns when/ordering/playback/export. When a motion source is added/removed/toggled, poke `window.__motionStudioRefresh`.

### Open Canvas: an infinite board over `pages.js` (v32)
v32 adds a board view where every page is a card on a freeform, pan-and-zoom canvas. Three pillars share one board:

- **Space — the board surface** (`features/board.js` + `features/board-tools.js`). The load-bearing reuse: **a board card IS a page**. `pages.js` already held id-keyed pages (`{ id, payload, thumb }`) with `switchTo`/`addPage`/`deletePage`/`renderAllPages`-style offscreen render, so the board is a **DOM layer over that engine**, not a new multi-scene renderer. `state.mode === 'board'` is one early-return branch in `render()` (mirroring `'set'`), routing to `renderBoard()`; `renderInto` and the four composition paths are untouched. The board surface is a camera-transformed `.board-surface` holding absolutely-positioned `.board-card`/`.board-text` DOM nodes + an SVG `.board-connectors` overlay (arrows + group bboxes). Cards show the cached `page.thumb`; `exportBoard()` re-renders each card's page offscreen via `applyDesignToState` + `renderInto` and composites them at their board rects. Double-click a card -> `switchTo(indexOfPage(pageId))` (NOTE: `pageId` is a `uid()` UUID string — never `Number()`-coerce it; the card's own `id` from `nextId()` IS a number and IS `Number()`-coerced). Board objects: `card` (refs `pages[i].id`), `text`, `arrow` (`from`/`to` ids), `group` (`children` hold board OBJECT ids; `groupCards(pageIds)` resolves page ids -> object ids). Two runtime-only selection stores (NOT in `history.snapshot()`): `canvasSelection` (scene, inside a card) and `boardSelection` (board). Board spatial edits are document ops, not undoable in v1. Persistence is document-level (`serializeDocument`/`applyDocument`, `DOC_VERSION` 13->14, `migrateBoardV14()`). Mode teardown: `set-ui.js` `setMode` + `keyboard.js` Esc tear the board down via `window.__teardownBoardChrome`/`window.__exitBoardMode` (mirrors the v25 tour guard); `keyboard.js`'s Delete/arrow-nudge are gated to `state.mode === 'single'`.
- **Seed — URL to set** (`features/seed.js` + `api/scrape-page.js`). Paste a page URL in the board toolbar (or Cmd-K "Board: add from URL"); `api/scrape-page.js` fetches the HTML server-side (reusing the SSRF guard in `api/_shared.js` — `fetchPublic`/`assertPublicHost`/`isPrivateIp`, shared with `api/fetch-url.js`) and returns `{title, images}`. `seed.js` `seedFromUrlCore(url)` loads each image CORS-clean via `loadImageEl` (which goes through `/api/fetch-url`) and drops each as a page via `pages.js` `addPageWithImage(img)` (off-editor: builds the payload from `serializeFull()` + a thumb, sizes `design.canvas` to the image, emits `onDocumentChange` so the board sync adds a card). `seedFromUrl` (UI) wraps it with notifications. `imageToDataUrl(img, maxEdge, mime, q)` in `serialize.js` is the shared cap-and-encode helper (also used by `getImageDataURL`). Deferred v1.1: headless live-page screenshots via `@sparticuz/chromium` (`api/screenshot.js`).
- **Control — conversational board agent** (`features/agent-tools.js` + `features/ai-agent.js`). The Design Agent's `TOOLS` registry gains 6 board-aware tools: `add_page_from_url` (wraps `seedFromUrlCore`), `add_page` (wraps `pages.addPage`), `arrange_cards` (`grid`/`row`/`hero`/`bento` via `board.js` `arrangeCards`), `group_cards` (wraps `groupCards`, returns the group id), `ungroup` (wraps `ungroupCards`), `export_board` (wraps `exportBoard`). Each tool dynamically imports its helper, ensures board mode (`if (state.mode !== 'board') enterBoardMode()`), mutates `state.board`/pages, and returns a short string; the agent loop's `render()` then routes to `renderBoard()`. `ai-agent.js` `systemPrompt()` adds a board-context block (card count + the cards' page ids + the 6 tools) when `state.mode === 'board'` (static `getPageMeta` import — no cycle). Cmd-K `askAgentBoard` opens the agent panel (`setGroup('ai')`) + ensures board mode. The "primary interface" rewrite of Cmd-K is deferred — v32 ships board tools reachable from the existing agent panel. `style_cards` (per-page `applySpec` via state-swap + offscreen thumb refresh) is deferred to v32.2.

### Persistence
User data (templates, brand kits, projects, onboarding flags) is stored in `localStorage` under `snapshotpro_*` keys, each feature managing its own. `src/state/serialize.js` handles project save/load (`SERIALIZED_FIELDS` for the lean payload, `PROJECT_FIELDS` for heavier fields like dataURLs). Cloud sync (optional) goes through Supabase. The Campaign folder lives in its own `snapshotpro_campaigns_v1` localStorage store (optional Supabase mirror ships but is unwired) and is never snapshotted.

### AI backend (optional)
`api/*.js` are Vercel serverless functions (`ai-enhance`, `ai-vision`, `image-generate`, `image-edit`, `brand-extract`, `fetch-url`; shared helpers in `api/_shared.js`). With `OPENAI_API_KEY` set on the deployment, hosted AI features work for all visitors; without it the editor falls back to browser/user-supplied-key paths. Two shared AI primitives to reuse rather than reinvent: `runVisionJson`/`runVisionJsonOnDataUrl` in `src/features/ai-cloud.js` (structured-JSON vision) and `renderAtSize` in `src/render/render.js`. See `docs/BACKEND.md`.

## State registry (keep this table current)

When you add, serialize, or migrate a state key, update this table in the same change. It is the fastest way to prevent undo/persistence drift.

| Key | In `snapshot()` (undo) | Serialized | Notes |
|---|---|---|---|
| `mockup3d` | yes | yes | `orbitProgress` is runtime-only and stripped |
| `tour` | yes | `PROJECT_FIELDS` | per-step hotspots persist with the project; each page is a tour step |
| `surface` | yes | `SERIALIZED_FIELDS` | Surface Studio mockups |
| `canvasSelection` | no (deliberate) | no | runtime-only unified selection |
| `timeline` | yes (runtime fields stripped, e.g. `_driving`) | `SERIALIZED_FIELDS` | schema v17 -> v18 via `migrateTimelineV18()` (builds default lanes from old `animation`/`kenBurns`/`mockup3d.spin`) |
| `brand` | yes | `PROJECT_FIELDS` (carries a logo dataURL, so kept out of lean `SERIALIZED_FIELDS`, mirroring `logo`) | schema v18 -> v19 via `ensureBrandDefaults()` |
| `mergeStudio` | no (deliberate) | no | `{{tokens}}` ride the already-serialized text/color fields, so the template travels with the project for free; the CSV is re-uploaded per session |
| `board` | no (deliberate; document op, mirrors `pages`/`active`) | document layer (`serializeDocument`), `DOC_VERSION` 13->14 via `migrateBoardV14()` | `camera` is runtime-only and stripped; a `card` object refs a `pages[i].id`; the scene payload still lives in `pages[i].payload` (unchanged); board view is `state.mode === 'board'`, one branch in `render()` |
| `boardSelection` | no (deliberate) | no | runtime-only, parallel to `canvasSelection`; cleared on document load |
| Campaign folder | never snapshotted | own store `snapshotpro_campaigns_v1` | not part of project payload |

Current `SCHEMA_VERSION` is 19 (the per-design payload; unchanged by v32). The board is document-level: `pages.js` `DOC_VERSION` is 14, migrated by `migrateBoardV14()`. Bump `SCHEMA_VERSION` (with a migration in `serialize.js`) whenever the per-design serialized shape changes; bump `DOC_VERSION` (with a migration in `pages.js`) when the document envelope shape changes.

## Checklist: adding a new feature

1. New module in `src/features/` exporting `bindX()`; import + call in `main.js`; version tag comment at the top.
2. If it draws anything: draw inside `renderInto`, and decide which of the four composition paths it applies to.
3. If it adds undoable state: add the key to `snapshot()` in `history.js`.
4. If it should persist: add to `SERIALIZED_FIELDS` or `PROJECT_FIELDS` in `serialize.js`; bump `SCHEMA_VERSION` and write a migration if the shape changed.
5. Sidebar section: add `data-group`; wire controls through `elements.js` + `bindings.js`; keep `updateUIFromState()` in sync.
6. Palette: add a command in `registerCommands()`. Shortcut: add to `SHORTCUTS` in `shortcuts.js`.
7. If it selects canvas objects: go through `selection.js`, not legacy fields.
8. If it touches motion: integrate via `motion-clock.js` + poke `window.__motionStudioRefresh`.
9. Update the State registry table above and, if it ships, the Shipped features table below.
10. Verify in `npm run dev` (no tests/linter exist).

## Build details worth knowing

- **HTML partials**: `vite.config.js` injects shared markup from `site/partials/` into pages that contain `<!--PARTIAL:...-->` placeholders (the editor has none, so it is untouched). `{{VERSION}}` in the footer is filled from `package.json`.
- **Versioning**: `package.json` `version` is the single version source; it drives the footer and the returning-user "what's new" toast (`src/features/whats-new.js`). Bump it for a release.
- **OG/social**: `__OG_BASE__` in HTML is replaced with the absolute site URL at build (from Vercel env, or `OG_BASE_URL` locally).
- **PWA**: `vite-plugin-pwa` with `autoUpdate`; CDN model files (jsdelivr/unpkg/staticimgly) are runtime-cached.
- **Browser extension**: `chrome-extension/` is a standalone MV3 bundle (manifest + background + content scripts + popup + a self-contained quick editor), **NOT part of the Vite build**. Load-unpacked for dev; zip for the Chrome Web Store (`chrome-extension/store/` holds listing copy, the upload `.zip`, and generated screenshots from `scripts/build-store-shots.mjs`). The popup captures a page (visible / full-page scroll-stitch / region); `background.js` stashes the PNG under a nonce in `chrome.storage.local` and by default opens the extension's own quick editor (`chrome-extension/editor/`: crop, padding + background, arrow/text, Download PNG) so the extension works without the web app. Cross-origin handoff to the web studio: the extension cannot touch the site's Cache Storage (origin-scoped), so `content/bridge.js` relays the capture into `/editor/?ext=<nonce>` via `window.postMessage`; `src/features/ext-receiver.js` (`bindExtReceiver()`, wired in `main.js`) validates origin+nonce and feeds it through the same `loadImage()` entry point as upload/drop/paste. The `/extension/` marketing page lives at repo `extension/index.html` (a Vite input; distinct folder from the bundle).

## Shipped features (map of where things live)

| Version | Feature | Key files / notes |
|---|---|---|
| v21 | 3D device mockups | `src/render/mockups-3d.js`; three.js lazy-loaded as `vendor-three` |
| v22 | Command Center | `palette.js`, `shortcuts.js`, `command-usage.js` |
| v24 | Code Snippet Studio | `src/features/code-snippet.js`, `src/render/code-render.js`; paste code -> themed code screenshot rasterized into the canvas |
| v25 | Interactive Tours | `tours.js` (authoring, reuses `pages.js` for steps), `render/tour-overlay.js` (preview chrome, outside `renderInto`), `tour-export.js` (offscreen render-all + inline vanilla player). Linear only; self-contained HTML only |
| v26 | Chrome extension | see Build details above |
| v27 | Surface Studio (physical/print mockups) | `render/surfaces.js` (geometric/cylinder warp + procedural shading; reuses the subdivided-triangle idea from `perspective.js`; apparel uses a runtime-generated fold displacement, no asset packs), `features/surface-ui.js`. Marketing at `/product-mockups/` |
| v28 | Studio QoL | unified selection (`selection.js`), context menu (`context-menu.js`), asset library (`asset-library.js`, quota-guarded `snapshotpro_assets`), export presets (`export-presets.js`, format + quality + 1x/2x/3x offscreen upscale) |
| v29 | Motion Studio | see the Motion Studio architecture section |
| v30 | Studio Intelligence | Brand Brain (`brand-brain.js`, optional `api/brand-extract.js`; `applyBrand()` routes through `applySpec` + `palettes`, reuses `extractPalette()` from `palette-extract.js`), AI Screenshot Editor (`ai-screenshot-editor.js`; vision + OCR `recognizeWords()` locate -> mask -> `gpt-image-2` `edit()` inpaint, plus no-AI redact via OCR + local pixelate; every edit replaces `state.image` via `applyResultAsImage()` so it bakes into export and undo), Campaign Generator (`campaign-generator.js`, `campaign-targets.js`, `campaigns.js`; reuses `renderAtSize`, `renderSetPanels`, `renderTimelineBlob()` from `timeline-export.js`, `downloadZip` from `batch-export.js`), Producer (`producer.js`, a separate autopilot surface, not the Design Agent). Marketing at `/studio-intelligence/`; `/agent/` rebranded to a general AI page |
| v31 | Merge Studio (CSV -> N designs) | `merge-studio.js`; fixed `MERGE_FIELDS` allow-list (`textOverlay.content`, `watermark.text`, `deviceFrame.title/url`, `bgColor`, `textOverlay.color`) scanned for `{{tokens}}`; tiny built-in RFC-4180 CSV parser; batch loop mirrors `exportBatch()` (mutate live state per row -> `renderInto(off, true)` -> PNG) into a ZIP via `downloadZip`. Reserved `image` column swaps the screenshot per row through side-effect-free `loadImageEl()` (exported from `url-load.js`; remote URLs go via `/api/fetch-url` proxy so exports stay untainted, with a URL cache); reserved `filename`/`name` names each output. Row preview applies substitutions to live state and calls `render()` without touching history, restoring the template on exit. Color tokens get two dedicated panel inputs (sidebar color pickers validate hex and cannot hold a token). Sidebar section in the Export group; Cmd-K commands `openMergeStudio`/`exportMerge`; marketing at `/merge/` |
| v32 | Open Canvas (infinite board + URL-to-set Seed + conversational Control) | **Space:** `features/board.js` + `features/board-tools.js` — a board card IS a page; the board is a DOM layer over `pages.js`, one `state.mode === 'board'` branch in `render()`, `renderInto` untouched; `exportBoard()` composites cards offscreen; persistence via `DOC_VERSION` 13->14 (`migrateBoardV14`); `state.board`/`boardSelection` runtime-only (not in `history.snapshot()`); mode teardown via `window.__teardownBoardChrome`/`__exitBoardMode`. **Seed:** `features/seed.js` (`seedFromUrlCore`/`seedFromUrl`) + `api/scrape-page.js` (SSRF-guarded page scrape, reuses `api/_shared.js` `fetchPublic`); `pages.js` `addPageWithImage(img)` (off-editor) + `serialize.js` `imageToDataUrl`. **Control:** `features/agent-tools.js` adds 6 board tools (`add_page_from_url`/`add_page`/`arrange_cards`/`group_cards`/`ungroup`/`export_board`) wrapping `board.js` `groupCards`/`ungroupCards`/`arrangeCards`; `ai-agent.js` `systemPrompt` adds board context. Cmd-K commands `toggleBoard`/`boardAddText`/`exportBoard`/`seedFromUrl`/`askAgentBoard`. **Deferred:** headless live-page screenshots (v32.1), `style_cards` per-page styling (v32.2), the "primary interface" Cmd-K rewrite. **First version directed under GLM-5.2.** |

## Backlog (unbuilt; next flagship slot is open)

- **New creative outputs:** Tour branching + hosted `/tour/:id` URLs (deferred v25 stretch); AI Storyboard / multi-panel generator.
- **New mockup classes:** print-ready PDF export (bleed / crop marks / CMYK); billboard/large-format and more apparel bases (deferred v27 stretches).
- **Automation & scale:** public REST API + CLI (headless generation).
- **More capture surfaces:** element-pick + Firefox/Edge port for the extension (deferred v26 stretch); mobile camera capture.
- **Collab & platform:** async review / approvals (pinned threaded comments, sign-off; distinct from live cursors); template marketplace + creator monetization; plugin / extension SDK.
- **Deferred from shipped releases:** Motion Studio full per-property keyframing + bottom-dock timeline (v29); Supabase campaign mirror wiring, in-place multi-language re-render, open-ended Producer autonomy (v30).

## Things that look like project rules but aren't

- `SKILL.md` and `Taste.md` at the repo root are **vendored copies of generic frontend design skills** (`design-taste-frontend`, `redesign-existing-projects`). They describe React/Tailwind/Next conventions and do **not** apply to this codebase (vanilla JS, no framework). Do not treat them as repo conventions.
- `SnapShot-Pro-main/` is a legacy pre-Vite single-file version of the app, kept for reference. The live app is everything under `src/` + `editor/`. Do not edit the legacy copy.
