# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server at http://localhost:5173 (auto-opens)
npm run build      # production build to dist/
npm run preview    # serve the built dist/
```

The editor app lives at `/editor/` (entry `editor/index.html` → `/src/main.js`). The repo also builds a set of static marketing/info pages (home, changelog, pricing, gallery, etc.) as separate Vite inputs — see `rollupOptions.input` in `vite.config.js`.

There is **no test runner and no linter configured** — `dev`, `build`, `preview` are the only scripts. Verify changes by running the editor in `npm run dev` and exercising the feature in-browser.

## Architecture

Vanilla JS + Vite. No framework, no reactive layer. The whole editor is driven by one mutable global state object and a single canvas render function.

### Single source of truth: `state`
`src/state/state.js` exports one mutable `state` object. Every feature reads and writes it directly — there is no store abstraction, no events for state changes. To change what's on screen you mutate `state` and call `render()`.

### Render pipeline: everything bakes into one canvas
`src/render/render.js` → `render(forExport)` → `renderInto(canvas, forExport)`. `renderInto` re-derives the entire image from `state` by running ordered `draw*` passes (background → image+filters → reflection → effects → annotations → text/watermark/logo → device frame). Key consequences:
- **Any visual feature must draw inside `renderInto` to appear in exports.** Export (`forExport=true`) renders the same passes into an offscreen canvas; the only difference is preview-only chrome (minimap, CSS-transform sync) is suppressed. CSS-only styling on the preview canvas will NOT export.
- There are two composition paths inside `renderInto` — the flat path and the device-mockup path (`src/render/mockups.js`). A change that should apply to both must be added to both.
- The source image is drawn around `render.js:229` using `ctx.filter` (brightness/contrast/saturation/blur/grayscale/sepia from `state.imageFilters`), which is why those bake into export for free. Effects that `ctx.filter` can't express need per-pixel `ImageData` passes.

### The `bind*` feature pattern
Each file in `src/features/` (and some in `src/render/`) exports a `bind<Feature>()` that attaches DOM listeners and initializes that feature. `src/main.js` `init()` calls every `bind*` once at startup, in order. **Adding a feature = new module exporting `bindX()` + an import and call in `main.js`.** Feature modules are tagged at the top with the version that introduced them (e.g. `// v16.1 — …`); follow this convention.

### Undo/redo is an explicit allow-list
`src/state/history.js` `snapshot()` deep-clones a hand-maintained list of `state` keys. `saveStateToHistory()` is called *before* a mutation. **When you add new undoable state, you must add its key to `snapshot()` or it won't be tracked by undo/redo.** Runtime-only fields (e.g. animation `playing`/`currentTime`) are deliberately stripped from the snapshot.

### DOM access is centralized
`src/ui/elements.js` exports `el`, populated by `initElements()` — all `getElementById` refs live here. `src/ui/bindings.js` wires the sidebar controls and exposes `updateUIFromState()`, which pushes `state` → DOM (call it after programmatically changing state so controls reflect it). Cross-module calls go through a few `window.__*` globals (`window.__updateUIFromState`, `window.__openWhatsNew`, `window.__refreshSetUi`, `window.__refreshTemplateList`, etc.) to avoid import cycles.

### Studio sidebar IA
The editor sidebar is an icon rail + one contextual panel (`src/features/studio-nav.js`). Each `<div class="sidebar-section">` in `editor/index.html` carries an explicit `data-group="import|adjust|background|frame|markup|ai|export|project"`; the active rail tab shows only its group (a title-substring fallback exists if a section ever lacks `data-group`). Sections are **collapsible** — the `.section-title` row toggles `.collapsed` on its section (CSS hides everything but the title), persisted per-section in `localStorage` (`snapshotpro_section_collapsed`). **When adding a new feature section, give it a `data-group`**; don't add a per-feature version badge next to the title (those were removed in the v20.1 tidy).

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
