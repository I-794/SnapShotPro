# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server at http://localhost:5173 (auto-opens)
npm run build      # production build to dist/
npm run preview    # serve the built dist/
```

The editor app lives at `/editor/` (entry `editor/index.html` → `/src/main.js`). The repo also builds a set of static marketing/info pages (home, changelog, pricing, gallery, `about`, `ai`, etc.) as separate Vite inputs — see `rollupOptions.input` in `vite.config.js`. The marketing nav uses an **AI umbrella**: the nav "AI" link points at `/ai/` (the AI-suite hub), and the standalone `/agent/` Design Agent page is reachable from there and the footer.

There is **no test runner and no linter configured** — `dev`, `build`, `preview` are the only scripts. Verify changes by running the editor in `npm run dev` and exercising the feature in-browser.

## Architecture

Vanilla JS + Vite. No framework, no reactive layer. The whole editor is driven by one mutable global state object and a single canvas render function.

### Single source of truth: `state`
`src/state/state.js` exports one mutable `state` object. Every feature reads and writes it directly — there is no store abstraction, no events for state changes. To change what's on screen you mutate `state` and call `render()`.

### Render pipeline: everything bakes into one canvas
`src/render/render.js` → `render(forExport)` → `renderInto(canvas, forExport)`. `renderInto` re-derives the entire image from `state` by running ordered `draw*` passes (background → image+filters → reflection → effects → annotations → text/watermark/logo → device frame). Key consequences:
- **Any visual feature must draw inside `renderInto` to appear in exports.** Export (`forExport=true`) renders the same passes into an offscreen canvas; the only difference is preview-only chrome (minimap, CSS-transform sync) is suppressed. CSS-only styling on the preview canvas will NOT export.
- There are three composition paths inside `renderInto` — the flat path, the 2D device-mockup path (`src/render/mockups.js`), and the **WebGL 3D-mockup path** (`src/render/mockups-3d.js`, v21). The 3D path renders the device offscreen with three.js (lazy-loaded, its own `vendor-three` chunk) and `drawImage`-composites it into the same 2D canvas, so it bakes into exports like everything else. A change that should apply to all of them must be added to each.
- The source image is drawn around `render.js:229` using `ctx.filter` (brightness/contrast/saturation/blur/grayscale/sepia from `state.imageFilters`), which is why those bake into export for free. Effects that `ctx.filter` can't express need per-pixel `ImageData` passes.

### The `bind*` feature pattern
Each file in `src/features/` (and some in `src/render/`) exports a `bind<Feature>()` that attaches DOM listeners and initializes that feature. `src/main.js` `init()` calls every `bind*` once at startup, in order. **Adding a feature = new module exporting `bindX()` + an import and call in `main.js`.** Feature modules are tagged at the top with the version that introduced them (e.g. `// v16.1 — …`); follow this convention.

### Undo/redo is an explicit allow-list
`src/state/history.js` `snapshot()` deep-clones a hand-maintained list of `state` keys. `saveStateToHistory()` is called *before* a mutation. **When you add new undoable state, you must add its key to `snapshot()` or it won't be tracked by undo/redo.** Runtime-only fields (e.g. animation `playing`/`currentTime`, the 3D mockup's `orbitProgress`) are deliberately stripped from the snapshot. (The `mockup3d` key, v21, is in the allow-list.)

### DOM access is centralized
`src/ui/elements.js` exports `el`, populated by `initElements()` — all `getElementById` refs live here. `src/ui/bindings.js` wires the sidebar controls and exposes `updateUIFromState()`, which pushes `state` → DOM (call it after programmatically changing state so controls reflect it). Cross-module calls go through a few `window.__*` globals (`window.__updateUIFromState`, `window.__openWhatsNew`, `window.__refreshSetUi`, `window.__refreshTemplateList`, etc.) to avoid import cycles.

### Studio sidebar IA
The editor sidebar is an icon rail + one contextual panel (`src/features/studio-nav.js`). Each `<div class="sidebar-section">` in `editor/index.html` carries an explicit `data-group="import|adjust|background|frame|markup|ai|export|project"`; the active rail tab shows only its group (a title-substring fallback exists if a section ever lacks `data-group`). Sections are **collapsible** — the `.section-title` row toggles `.collapsed` on its section (CSS hides everything but the title), persisted per-section in `localStorage` (`snapshotpro_section_collapsed`). **When adding a new feature section, give it a `data-group`**; don't add a per-feature version badge next to the title (those were removed in the v20.1 tidy).

### Command palette & keyboard shortcuts (v22 — Command Center)
The Cmd-K command palette lives in `src/features/palette.js`. `registerCommands()` builds a hand-maintained `commands` list; each command carries `id`, `label`, `icon`, `run`, plus v22 metadata: `group` (assigned by `groupFor(id)`), an optional `keys` shortcut-hint string, and an optional `when()` context predicate. `renderPaletteResults()` filters out commands whose `when()` is false (`applicable()`), shows a grouped **Recent + categories** view on an empty query, and a flat fuzzy-ranked list (with a small `getFrequencyBoost`) when typing. Usage is tracked in `src/features/command-usage.js` (`snapshotpro_cmd_usage`). **A new palette command = a new entry in `registerCommands()`** (give it a sensible `group`; add a `when`/`keys` only if it's context-specific or has a global shortcut).

Global keyboard shortcuts have a **single source of truth**: `src/features/shortcuts.js` exports `SHORTCUTS`. `keyboard.js` dispatches the non-`displayOnly` entries via `matchEvent(e)`, and the `?` help overlay is *generated* from the same list by `renderShortcutsOverlay()` — so the two can't drift. Context-sensitive handlers (the Escape cascade, arrow-nudge, timeline scrubbing, delete) stay bespoke in `keyboard.js` and are listed in `SHORTCUTS` as `displayOnly` purely so the overlay shows them. **Add or change a global shortcut in `shortcuts.js`, not in `keyboard.js` and the overlay separately.**

### Persistence
User data (templates, brand kits, projects, onboarding flags) is stored in `localStorage` under `snapshotpro_*` keys, each feature managing its own. `src/state/serialize.js` handles project save/load. Cloud sync (optional) goes through Supabase.

### AI backend (optional)
`api/*.js` are Vercel serverless functions (`ai-enhance`, `ai-vision`, `image-generate`, `image-edit`, `fetch-url`; shared helpers in `api/_shared.js`). With `OPENAI_API_KEY` set on the deployment, hosted AI features work for all visitors; without it the editor falls back to browser/user-supplied-key paths. See `docs/BACKEND.md`.

## Build details worth knowing
- **HTML partials**: `vite.config.js` injects shared markup from `site/partials/` into pages that contain `<!--PARTIAL:…-->` placeholders (the editor has none, so it's untouched). `{{VERSION}}` in the footer is filled from `package.json`.
- **Versioning**: `package.json` `version` is the single version source — it drives the footer and the returning-user "what's new" toast (`src/features/whats-new.js`). Bump it for a release.
- **OG/social**: `__OG_BASE__` in HTML is replaced with the absolute site URL at build (from Vercel env, or `OG_BASE_URL` locally).
- **PWA**: `vite-plugin-pwa` with `autoUpdate`; CDN model files (jsdelivr/unpkg/staticimgly) are runtime-cached.

## Reference docs
- `docs/BACKEND.md` — the Vercel AI serverless routes and the hosted-vs-BYO-key fallback.
- `DEPLOY.md` — deployment.
- `MIGRATION.md` — migration notes from the legacy single-file app.
- `README.md` — project layout overview.

## Things that look like project rules but aren't
- `SKILL.md` and `Taste.md` at the repo root are **vendored copies of generic frontend design skills** (`design-taste-frontend`, `redesign-existing-projects`). They describe React/Tailwind/Next conventions and do **not** apply to this codebase (vanilla JS, no framework). Don't treat them as repo conventions.
- `SnapShot-Pro-main/` is a legacy pre-Vite single-file version of the app, kept for reference. The live app is everything under `src/` + `editor/`. Don't edit the legacy copy.
