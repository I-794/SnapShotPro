# V30 Studio Intelligence — Plan 01: Foundations + Brand Brain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two shared primitives (`runVisionJson`, `renderAtSize`), the schema plumbing for `state.brand`, and the **Brand Brain** feature — extract a brand system from a URL or uploaded asset and apply/enforce it app-wide.

**Architecture:** Brand Brain is a new `bind*` feature module (`src/features/brand-brain.js`) that writes one mutable `state.brand` object and applies it by routing through the existing validated `applySpec()` plus the same state-mutation patterns `brand-kit.js` already uses. Extraction reuses a refactored, exported `extractPalette()` (k-means) and an optional Vercel function (`api/brand-extract.js`) feeding a new structured-vision primitive `runVisionJson()`. Everything bakes into export through the normal `renderInto` path — no render changes beyond a thin multi-size wrapper.

**Tech Stack:** Vanilla JS + Vite (no framework, no reactive layer). No test runner or linter exists — **verification is manual in `npm run dev` + `npm run build`**, never unit tests. AI calls go through `src/features/ai-cloud.js` (hosted-proxy → BYO-key fallback). Persistence is `localStorage` + optional Supabase.

## Global Constraints

- **No test runner / linter.** Per CLAUDE.md the only scripts are `dev`, `build`, `preview`. Every task's "test" is: run `npm run dev`, exercise the feature in-browser, and confirm `npm run build` succeeds. Do not add a test framework.
- **Feature pattern:** each feature module exports `bind<Feature>()`, imported and called once in `src/main.js` `init()`. Tag new files with `// v30 — …`.
- **Single mutable `state`:** mutate `state` then call `render()`. No store abstraction, no events for state changes.
- **Undo allow-list:** any new undoable `state` key MUST be added to `snapshot()` in `src/state/history.js` or it is not tracked.
- **Serialize allow-list:** design-defining fields that must persist with a project go in `PROJECT_FIELDS` (full fidelity) in `src/state/serialize.js`. Large/non-portable fields (`image`, `logo`) are deliberately kept OUT of `SERIALIZED_FIELDS` (the small collab/gallery payload). `state.brand` carries a logo dataURL, so it goes in `PROJECT_FIELDS` only, mirroring `logo`.
- **Schema migrations:** when `PROJECT_FIELDS` changes, bump `SCHEMA_VERSION` and add a migration wired into `normalizeProject()`. Current `SCHEMA_VERSION` is **18**; this plan bumps it to **19**.
- **Sidebar sections** carry an explicit `data-group="import|adjust|background|frame|markup|ai|export|project"`. Brand Brain uses `data-group="background"`.
- **Cross-module calls** go through `window.__*` globals (`window.__updateUIFromState`, etc.) to avoid import cycles.
- **Never hardcode an unverified AI model id.** Reuse the model ids already in `ai-cloud.js` (`claude-sonnet-4-6`, `gpt-4o-mini`).
- **Commit message trailers** (every commit):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc
  ```
- **Branch:** all work on `claude/v30-feature-brainstorm-qidm1d`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/features/ai-cloud.js` | Provider abstraction. Add structured-JSON vision. | Modify |
| `src/render/render.js` | Render pipeline. Add `renderAtSize` wrapper. | Modify |
| `src/state/state.js` | Single source of truth. Add `state.brand` defaults. | Modify |
| `src/state/history.js` | Undo snapshot allow-list. Add `brand`. | Modify |
| `src/state/serialize.js` | Project field list + schema migration. Add `brand`, bump to 19. | Modify |
| `src/features/palette-extract.js` | Palette extractor. Export reusable `extractPalette`. | Modify |
| `api/brand-extract.js` | Vercel function: fetch a URL's HTML + render, return for vision. | Create |
| `src/features/brand-brain.js` | The feature: extract → `state.brand` → `applyBrand()` + UI. | Create |
| `editor/index.html` | Brand Brain sidebar section markup. | Modify |
| `src/main.js` | Import + call `bindBrandBrain()`. | Modify |
| `src/features/pages.js` | Enforce hook on `addPage`. | Modify |
| `src/features/projects.js` | Enforce hook on `newProject`. | Modify |
| `src/features/palette.js` | Cmd-K command for Brand Brain. | Modify |

---

## Task 1: Structured-JSON vision primitive (`runVisionJson`)

**Files:**
- Modify: `src/features/ai-cloud.js` (add after `parseJsonLoose`, ~line 217)

**Interfaces:**
- Consumes: existing internals `chooseProvider`, `callHostedVision`, `dataUrlToBase64`, `parseJsonLoose`, `setAiStatus`, `promptForKey`, `showNotification`, `state.image`, `imageToDataUrl` (all already in this file).
- Produces:
  - `runVisionJsonOnDataUrl(prompt: string, dataUrl: string) => Promise<object|null>`
  - `runVisionJson(prompt: string) => Promise<object|null>` (uses `state.image`)

Both return a parsed JSON object, or `null` when no provider is configured or parsing fails.

- [ ] **Step 1: Add the JSON vision helpers**

In `src/features/ai-cloud.js`, immediately after the `parseJsonLoose` function (ends at line 217), add:

```js
// v30 — structured-vision sibling of runVisionPrompt. Asks the model for a JSON
// object and returns it parsed (or null). Reused by Brand Brain (URL→system),
// the AI Screenshot Editor (locate regions), and the Producer (goal→plan).
// OpenAI's json_object mode requires the literal word "JSON" in the prompt, so
// callers MUST include it (the wrappers below append a reminder defensively).
async function callAnthropicVisionJson(key, prompt, dataUrl) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: 'Respond with ONLY valid minified JSON — no markdown fences, no commentary.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: dataUrlToBase64(dataUrl) } },
        { type: 'text', text: prompt }
      ]
    }]
  });
  return res.content?.[0]?.text || '';
}

async function callOpenAIVisionJson(key, prompt, dataUrl) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt + '\n\nRespond with a single JSON object.' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }]
  });
  return res.choices?.[0]?.message?.content || '';
}

// Run a vision prompt against an explicit dataURL and parse the JSON reply.
export async function runVisionJsonOnDataUrl(prompt, dataUrl) {
  if (!dataUrl) return null;
  // Hosted proxy first (text response carrying JSON), then BYO-key.
  setAiStatus('Checking hosted AI…');
  try {
    const hosted = await callHostedVision(prompt + '\n\nRespond with a single JSON object.', dataUrl);
    if (hosted?.text) {
      const parsed = parseJsonLoose(hosted.text);
      if (parsed) { setAiStatus(`Done via hosted ${hosted.provider || 'AI'}.`); return parsed; }
    }
  } catch (e) {
    console.warn('Hosted vision (json) failed; falling back to browser key.', e);
  }
  const choice = await chooseProvider(true);
  if (!choice) {
    showNotification('Add a Claude or OpenAI key below to use this feature.', 'error');
    promptForKey();
    return null;
  }
  setAiStatus(`Calling ${choice.provider}…`);
  try {
    const raw = choice.provider === 'anthropic'
      ? await callAnthropicVisionJson(choice.key, prompt, dataUrl)
      : await callOpenAIVisionJson(choice.key, prompt, dataUrl);
    setAiStatus(`Done via ${choice.provider}.`);
    return parseJsonLoose(raw);
  } catch (e) {
    console.error(e);
    setAiStatus('Failed.');
    showNotification(`AI call failed: ${e.message || e}`, 'error');
    return null;
  }
}

// Convenience: run against the currently loaded screenshot.
export async function runVisionJson(prompt) {
  if (!state.image) { showNotification('Load an image first.', 'error'); return null; }
  return runVisionJsonOnDataUrl(prompt, imageToDataUrl(state.image));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no "is not defined" errors (confirms `state`, `imageToDataUrl`, `callHostedVision`, `chooseProvider`, `dataUrlToBase64`, `setAiStatus`, `promptForKey`, `showNotification`, `parseJsonLoose` are all in scope — they are, all defined earlier in this same module).

- [ ] **Step 3: Smoke-test in the browser console**

Run `npm run dev`, load any screenshot, open devtools console, and run:
```js
const m = await import('/src/features/ai-cloud.js');
console.log(await m.runVisionJson('Return JSON {"ok": true, "wide": <true if the image is wider than tall>}.'));
```
Expected (with a key configured): an object like `{ ok: true, wide: true }`. Without a key: the key prompt appears and it returns `null` — also acceptable (graceful).

- [ ] **Step 4: Commit**

```bash
git add src/features/ai-cloud.js
git commit -m "feat(v30): add runVisionJson structured-vision primitive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 2: Multi-size render helper (`renderAtSize`)

**Files:**
- Modify: `src/render/render.js` (add an exported helper after `renderInto`)

**Interfaces:**
- Consumes: existing `renderInto(canvas, forExport)` and `state.canvas` (`{ width, height }`).
- Produces: `renderAtSize(canvas: HTMLCanvasElement, size: {width:number, height:number}) => void` — renders the current design into `canvas` at the given pixel size (export-quality, preview chrome suppressed), restoring `state.canvas` afterward.

`renderInto` already sets `canvas.width = state.canvas.width`, so the wrapper only needs to swap `state.canvas` around the call.

- [ ] **Step 1: Add the helper**

In `src/render/render.js`, immediately after the `renderInto` function body (the function starting at line 49), add:

```js
// v30 — render the current design into an arbitrary canvas at an arbitrary
// pixel size, then restore the working canvas size. Used by the Campaign
// Generator and the Producer to emit the same design at many target sizes.
// forExport=true so preview-only chrome (minimap/CSS-transform sync) is skipped.
export function renderAtSize(canvas, { width, height }) {
  const prev = state.canvas;
  try {
    state.canvas = { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
    renderInto(canvas, true);
  } finally {
    state.canvas = prev;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke-test in the browser console**

Run `npm run dev`, load a screenshot, then in the console:
```js
const r = await import('/src/render/render.js');
const c = document.createElement('canvas');
r.renderAtSize(c, { width: 1080, height: 1080 });
console.log(c.width, c.height); // 1080 1080
document.body.appendChild(c);   // visually confirm the design rendered square
```
Expected: `1080 1080` logged; a square render appears; the on-screen preview canvas is unchanged (its size restored).

- [ ] **Step 4: Commit**

```bash
git add src/render/render.js
git commit -m "feat(v30): add renderAtSize multi-size render helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 3: `state.brand` defaults + undo + serialize plumbing

**Files:**
- Modify: `src/state/state.js` (add `brand` default after `logo`, ~line 208)
- Modify: `src/state/history.js` (add `brand` to `snapshot()`)
- Modify: `src/state/serialize.js` (add `brand` to `PROJECT_FIELDS`; bump `SCHEMA_VERSION` 18→19; add + wire `migrateBrandV19`)

**Interfaces:**
- Produces: `state.brand` object (shape below) that all later Brand Brain tasks read/write; persisted in projects; tracked by undo.

The shape:
```js
state.brand = {
  enabled: false, name: '', sourceUrl: '',
  palette: [],                                        // ["#hex", ...]
  background: { mode: 'gradient', gradient: { colors: [], type: 'linear', angle: 135 } },
  frame: { type: null, color: 'dark' },
  typography: { headlineFont: 'Arial', captionFont: 'Arial' },
  colorMap: { mode: 'off', intensity: 100, steps: 6 },
  filter: 'none',
  logo: { dataUrl: null, position: 'bottom-right', scale: 0.12, opacity: 90 },
  watermark: { text: '', color: '#ffffff', position: 'bottom-right', size: 16, opacity: 50 },
  enforce: false
};
```

- [ ] **Step 1: Add the default to `state.js`**

In `src/state/state.js`, directly after the `logo:` line (line 208), add:

```js
  // v30 — Brand Brain: an extracted, enforceable brand system. Applied via
  // brand-brain.js applyBrand() which routes through applySpec() + state setters.
  // Carries a logo dataUrl, so it rides PROJECT_FIELDS (full fidelity), not the
  // lean SERIALIZED_FIELDS — mirroring how `logo` is handled.
  brand: {
    enabled: false, name: '', sourceUrl: '',
    palette: [],
    background: { mode: 'gradient', gradient: { colors: [], type: 'linear', angle: 135 } },
    frame: { type: null, color: 'dark' },
    typography: { headlineFont: 'Arial', captionFont: 'Arial' },
    colorMap: { mode: 'off', intensity: 100, steps: 6 },
    filter: 'none',
    logo: { dataUrl: null, position: 'bottom-right', scale: 0.12, opacity: 90 },
    watermark: { text: '', color: '#ffffff', position: 'bottom-right', size: 16, opacity: 50 },
    enforce: false
  },
```

- [ ] **Step 2: Add `brand` to the undo snapshot**

In `src/state/history.js`, inside the object returned by `snapshot()` (lines 11–77), add a line after `surface: state.surface` (line 76), turning it into:

```js
    // v27 — Surface Studio (physical & print mockup) settings are undoable.
    surface: state.surface,
    // v30 — Brand Brain system is undoable (Apply / Extract are one undo step).
    brand: state.brand
```

(Note: add the trailing comma after `state.surface` and the new `brand` line with no trailing comma, since it becomes the last property.)

- [ ] **Step 3: Add `brand` to `PROJECT_FIELDS` and bump the schema**

In `src/state/serialize.js`:

(a) Change `SCHEMA_VERSION` (line 77) from:
```js
export const SCHEMA_VERSION = 18;
```
to:
```js
export const SCHEMA_VERSION = 19;
```

(b) In the `PROJECT_FIELDS` array (lines 81–94), add `'brand'` after `'tour'`:
```js
  // v25 — Interactive Tour. Per-step hotspots/callouts ride the page payload, so
  // a tour's steps persist with the project (each page is a tour step).
  'tour',
  // v30 — Brand Brain system (carries logo dataUrl; full-fidelity project field
  // only, deliberately not in the lean SERIALIZED_FIELDS, mirroring `logo`).
  'brand'
```

(c) Add the migration function after `migrateTimelineV18` (after line 166):
```js
// v30 — schema 19 migration: guarantee every applied design carries a default
// `brand` block so pre-v30 projects open without an undefined brand (and so
// Object.assign-based applyPayload never leaks a previous page's brand). Mutates
// + returns the design. Mirrors ensureTourDefaults.
export function ensureBrandDefaults(design) {
  if (design && !design.brand) {
    design.brand = {
      enabled: false, name: '', sourceUrl: '', palette: [],
      background: { mode: 'gradient', gradient: { colors: [], type: 'linear', angle: 135 } },
      frame: { type: null, color: 'dark' },
      typography: { headlineFont: 'Arial', captionFont: 'Arial' },
      colorMap: { mode: 'off', intensity: 100, steps: 6 },
      filter: 'none',
      logo: { dataUrl: null, position: 'bottom-right', scale: 0.12, opacity: 90 },
      watermark: { text: '', color: '#ffffff', position: 'bottom-right', size: 16, opacity: 50 },
      enforce: false
    };
  }
  return design;
}
```

(d) Wire it into `normalizeProject` (lines 171–185) — wrap both `migrateTimelineV18(...)` calls with `ensureBrandDefaults(...)`:
```js
  if (payload.design) {
    return {
      schemaVersion: payload.schemaVersion || SCHEMA_VERSION,
      design: ensureBrandDefaults(migrateTimelineV18(ensureTourDefaults(sanitizeMotionRuntime(payload.design)))),
      image: payload.image || null,
      svgCode: payload.svgCode || null
    };
  }
  // Legacy flat design payload (pre-v12): the whole object is the design.
  return { schemaVersion: 11, design: ensureBrandDefaults(migrateTimelineV18(ensureTourDefaults(sanitizeMotionRuntime(payload)))), image: null, svgCode: payload.svgCode || null };
```

- [ ] **Step 4: Verify build + state shape**

Run: `npm run build` → expected: succeeds.
Run `npm run dev`, console:
```js
const s = (await import('/src/state/state.js')).state;
console.log(s.brand.enabled, Array.isArray(s.brand.palette)); // false true
```
Expected: `false true`.

- [ ] **Step 5: Verify migration on an old project**

In the console, simulate a pre-v30 payload through the normalizer:
```js
const z = await import('/src/state/serialize.js');
const norm = z.normalizeProject({ schemaVersion: 18, design: { padding: 40 }, image: null });
console.log(norm.schemaVersion, !!norm.design.brand, norm.design.brand.enabled); // 18 true false
```
Expected: `18 true false` (schema preserved from payload; default brand injected).

- [ ] **Step 6: Commit**

```bash
git add src/state/state.js src/state/history.js src/state/serialize.js
git commit -m "feat(v30): add state.brand with undo + project persistence (schema 19)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 4: Export a reusable palette extractor

**Files:**
- Modify: `src/features/palette-extract.js` (export the existing internal pipeline as `extractPalette`)

**Interfaces:**
- Consumes: existing internal `sampleImagePixels(img)`, `kmeans(points, k, iters)`, `rgbToHex(r,g,b)` (all already in this file, lines 12–~150).
- Produces: `extractPalette(img: CanvasImageSource, k = 5) => string[]` — returns up to `k` dominant hex colors, sorted by cluster size (largest first). Pure: no state mutation, no DOM side effects beyond an offscreen canvas.

This refactor is DRY: the existing `extract()` UI handler should call the new exported function instead of duplicating the pipeline.

- [ ] **Step 1: Add the exported function**

In `src/features/palette-extract.js`, add near the top-level functions (after `kmeans`, before `bindPaletteExtractor`):

```js
// v30 — reusable palette extraction for Brand Brain (and anything needing
// dominant colors from an image). Mirrors what the in-panel extract() does:
// sample the image small, k-means cluster, return hex sorted by cluster weight.
export function extractPalette(img, k = K) {
  if (!img || !img.width || !img.height) return [];
  const pts = sampleImagePixels(img);
  const centers = kmeans(pts, k);
  return centers.map(c => rgbToHex(c[0], c[1], c[2]));
}
```

> Note: `kmeans` returns cluster centers already sorted by size in this module (per its existing implementation that sorts clusters descending). If, on reading the code, `kmeans` returns `{center, size}` objects instead of raw triples, adapt the `.map` accordingly — read lines 34–100 to confirm the exact return shape before writing this, and match it. The verification step below will catch a mismatch.

- [ ] **Step 2: Verify build + output**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a colorful screenshot, console:
```js
const p = await import('/src/features/palette-extract.js');
const s = (await import('/src/state/state.js')).state;
console.log(p.extractPalette(s.image, 5)); // ["#...", "#...", ...] length up to 5
```
Expected: an array of up to 5 hex strings.

- [ ] **Step 3: Commit**

```bash
git add src/features/palette-extract.js
git commit -m "refactor(v30): export reusable extractPalette() from palette-extract

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 5: `api/brand-extract.js` Vercel function

**Files:**
- Create: `api/brand-extract.js`
- Reference (do not modify): `api/fetch-url.js`, `api/_shared.js` (follow their CORS + handler conventions)

**Interfaces:**
- Produces an HTTP endpoint `POST /api/brand-extract` with body `{ url: string }`, returning JSON:
  ```json
  { "html": "<title>...</title>... (truncated)", "iconUrl": "https://.../favicon", "themeColor": "#hex|null", "ogImage": "https://...|null" }
  ```
  Returns `501` when the function can't run (mirroring the existing proxy fall-through contract so the client degrades to asset/manual entry). The client (Task 6) combines this with `runVisionJsonOnDataUrl` (on `ogImage`/icon) + `extractPalette`.

This function does NOT call OpenAI — it only fetches and lightly parses the page, keeping the AI call client-side through the existing `runVisionJson` path (so BYO-key users work too).

- [ ] **Step 1: Read the existing pattern**

Read `api/fetch-url.js` and `api/_shared.js` fully. Note: the exact `export default function handler(req, res)` signature, how CORS headers are set, how JSON body is read, and how errors are returned. Match them exactly.

- [ ] **Step 2: Write the function**

Create `api/brand-extract.js`:

```js
// v30 — Brand Brain URL extraction. Fetches a page server-side (no CORS limits)
// and returns lightweight brand signals: <title>, a theme-color, an OG image,
// and a best-guess icon URL. Deliberately does NOT call any AI provider — the
// client runs vision on the returned image via the existing runVisionJson path,
// so BYO-key visitors work identically. Mirrors api/fetch-url.js conventions.

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function abs(base, href) {
  if (!href) return null;
  try { return new URL(href, base).href; } catch (_) { return null; }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let url = '';
  try { url = (req.body && req.body.url) || ''; } catch (_) {}
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid http(s) url is required.' });

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'SnapShotPro-BrandBrain/1.0' }, redirect: 'follow' });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const full = await r.text();
    const html = full.slice(0, 200000); // cap parse work

    const pick = (re) => { const m = html.match(re); return m ? m[1] : null; };
    const themeColor = pick(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
    const ogImage = abs(url, pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i));
    const iconHref = pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    const iconUrl = abs(url, iconHref) || abs(url, '/favicon.ico');
    const title = pick(/<title[^>]*>([^<]*)<\/title>/i);

    return res.status(200).json({
      html: html.slice(0, 20000),
      title: title || null,
      themeColor: themeColor || null,
      ogImage: ogImage || null,
      iconUrl: iconUrl || null
    });
  } catch (e) {
    // Fall-through contract: 501 → client degrades to asset/manual entry.
    return res.status(501).json({ error: 'Brand extraction unavailable', detail: String(e && e.message || e) });
  }
}
```

- [ ] **Step 3: Verify build is unaffected**

Run: `npm run build`
Expected: succeeds (the `api/` functions are not part of the Vite client bundle, but confirm nothing broke).

- [ ] **Step 4: Smoke-test the parser logic locally (pure function)**

The handler needs a server to run, which `npm run dev` does not provide for `api/`. Instead, unit-check the regex logic in the console (no server needed):
```js
const html = `<title>Acme</title><meta name="theme-color" content="#0a84ff"><meta property="og:image" content="/og.png"><link rel="icon" href="/fav.png">`;
console.log(html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)[1]); // #0a84ff
console.log(html.match(/<title[^>]*>([^<]*)<\/title>/i)[1]); // Acme
```
Expected: `#0a84ff` then `Acme`. (Full endpoint integration is verified in Task 6's end-to-end run when deployed, or via `vercel dev` if available; the client gracefully degrades on 501/network error regardless.)

- [ ] **Step 5: Commit**

```bash
git add api/brand-extract.js
git commit -m "feat(v30): add api/brand-extract page-signal fetcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 6: Brand Brain extraction core (`brand-brain.js`)

**Files:**
- Create: `src/features/brand-brain.js` (extraction half; UI + bind added in Task 8)

**Interfaces:**
- Consumes: `runVisionJsonOnDataUrl` (Task 1), `extractPalette` (Task 4), `generateHarmony` (`src/utils/color.js`, `generateHarmony(baseHex, type)`), `state` (`src/state/state.js`), `showNotification` (`src/ui/notification.js`), `/api/brand-extract` (Task 5), `loadImage` (`src/features/ai-shared.js` — confirm export; if absent, use a local `new Image()` loader as shown).
- Produces (exports used by Tasks 7–9):
  - `extractBrandFromUrl(url: string) => Promise<boolean>` — fills `state.brand` from a URL; returns success.
  - `extractBrandFromImage(img: CanvasImageSource, name?: string) => Promise<boolean>` — fills `state.brand` from an uploaded asset; returns success.

- [ ] **Step 1: Create the module with the extraction logic**

Create `src/features/brand-brain.js`:

```js
// v30 — Brand Brain. Extract a brand system once (from a URL or an uploaded
// asset) into state.brand, then apply/enforce it app-wide via applyBrand()
// (Task 7). Extraction reuses extractPalette() (k-means) + generateHarmony()
// and, when available, structured vision over the page's OG image/icon.

import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';
import { extractPalette } from './palette-extract.js';
import { generateHarmony } from '../utils/color.js';
import { runVisionJsonOnDataUrl } from './ai-cloud.js';

// Load an http(s) image into an HTMLImageElement (CORS-anonymous so we can read
// pixels for palette extraction). Resolves null on failure rather than throwing.
function loadCrossOrigin(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function imgToDataUrl(img) {
  try {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  } catch (_) { return null; }
}

// Ensure at least `min` palette colors by completing with a tetradic harmony off
// the first color, so downstream gradients always have ≥2 stops.
function ensurePalette(colors, min = 4) {
  let out = (colors || []).filter(Boolean);
  if (out.length === 0) out = ['#4f46e5'];
  if (out.length < min) {
    const extra = generateHarmony(out[0], 'tetradic');
    for (const c of extra) { if (out.length >= min) break; if (!out.includes(c)) out.push(c); }
  }
  return out.slice(0, 6);
}

// Map a normalized palette + signals into the state.brand schema fields. Does
// NOT apply to the design — that's applyBrand() in Task 7.
function writeBrand({ name, sourceUrl, palette, logoDataUrl, headlineFont }) {
  const pal = ensurePalette(palette);
  state.brand.enabled = true;
  state.brand.name = name || state.brand.name || 'Brand';
  state.brand.sourceUrl = sourceUrl || '';
  state.brand.palette = pal;
  state.brand.background = {
    mode: 'gradient',
    gradient: { colors: pal.slice(0, 3), type: 'linear', angle: 135 }
  };
  state.brand.colorMap = { mode: 'off', intensity: 100, steps: 6 };
  state.brand.filter = 'none';
  if (headlineFont) state.brand.typography.headlineFont = headlineFont;
  if (logoDataUrl) {
    state.brand.logo = { dataUrl: logoDataUrl, position: 'bottom-right', scale: 0.12, opacity: 90 };
    state.brand.watermark = { ...state.brand.watermark, color: pal[0] };
  }
}

// Extract from an uploaded asset (logo/screenshot/brand image).
export async function extractBrandFromImage(img, name) {
  if (!img || !img.width) { showNotification('Could not read that image.', 'error'); return false; }
  const palette = extractPalette(img, 5);
  const logoDataUrl = imgToDataUrl(img);
  writeBrand({ name, sourceUrl: '', palette, logoDataUrl });
  showNotification('Brand system extracted from asset.', 'success');
  return true;
}

// Extract from a URL: fetch page signals server-side, run vision on the OG image
// when available, and refine the palette with extractPalette over that image.
// Degrades gracefully (theme-color / vision-only / nothing) on partial failure.
export async function extractBrandFromUrl(url) {
  if (!/^https?:\/\//i.test(url || '')) { showNotification('Enter a full http(s) URL.', 'error'); return false; }
  let signals = {};
  try {
    const r = await fetch('/api/brand-extract', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (r.ok) signals = await r.json();
  } catch (_) { /* network/501 → degrade below */ }

  // Gather candidate colors: theme-color + palette from the OG/icon image.
  let palette = [];
  let headlineFont = null;
  const imageUrl = signals.ogImage || signals.iconUrl;
  const brandImg = await loadCrossOrigin(imageUrl);
  if (brandImg) palette = extractPalette(brandImg, 5);
  if (signals.themeColor) palette = [signals.themeColor, ...palette];

  // Optional vision pass to read type feel + a clean accent, when an image and a
  // key are available. Failure is silently tolerated.
  if (brandImg) {
    const dataUrl = imgToDataUrl(brandImg);
    if (dataUrl) {
      const v = await runVisionJsonOnDataUrl(
        'You are a brand analyst. From this brand image, return JSON {"accent":"#hex primary brand color","fontFeel":"sans|serif|mono|display"}.',
        dataUrl
      );
      if (v && typeof v.accent === 'string') palette = [v.accent, ...palette];
      if (v && v.fontFeel) headlineFont = { sans: 'Arial', serif: 'Georgia', mono: 'monospace', display: 'Georgia' }[v.fontFeel] || null;
    }
  }

  if (!palette.length) {
    showNotification('Could not extract brand colors from that URL. Try uploading a logo instead.', 'error');
    return false;
  }
  writeBrand({ name: signals.title || new URL(url).hostname, sourceUrl: url, palette, logoDataUrl: null, headlineFont });
  showNotification('Brand system extracted from URL.', 'success');
  return true;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds (confirms `generateHarmony`, `extractPalette`, `runVisionJsonOnDataUrl`, `state`, `showNotification` all resolve). If `generateHarmony('#xxx','tetradic')` import path is wrong, the build will error — fix the import to match `src/utils/color.js`'s actual export (confirmed at `src/utils/color.js:160`).

- [ ] **Step 3: Smoke-test asset extraction in the console**

Run `npm run dev`, load a screenshot, console:
```js
const b = await import('/src/features/brand-brain.js');
const s = (await import('/src/state/state.js')).state;
await b.extractBrandFromImage(s.image, 'Test');
console.log(s.brand.enabled, s.brand.palette, s.brand.background.gradient.colors);
```
Expected: `true`, a palette array (≥4), and a gradient with 2–3 colors.

- [ ] **Step 4: Commit**

```bash
git add src/features/brand-brain.js
git commit -m "feat(v30): brand-brain extraction core (URL + asset -> state.brand)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 7: `applyBrand()` — route the brand into the design

**Files:**
- Modify: `src/features/brand-brain.js` (add `applyBrand`)
- Reference: `src/state/spec.js` (`applySpec`), `src/features/palettes.js` (`saveSwatchesAsPalette`), `src/features/brand-kit.js` (`loadLogoImage`)

**Interfaces:**
- Consumes: `applySpec(spec)` (`src/state/spec.js`), `saveSwatchesAsPalette(swatches, name) => id` (`src/features/palettes.js`), `loadLogoImage()` (`src/features/brand-kit.js`), `saveStateToHistory()` (`src/state/history.js`), `render()` (`src/render/render.js`).
- Produces: `applyBrand() => void` — applies `state.brand` onto the current design (one undo step) and re-syncs the UI.

**Critical ordering:** `applySpec` only sets `colorPalettes.active` if the `paletteId` already exists in `state.colorPalettes.library`. So we must register the palette via `saveSwatchesAsPalette` FIRST, then pass that id into the spec's `color` block.

- [ ] **Step 1: Add the imports**

At the top of `src/features/brand-brain.js`, extend the import block:

```js
import { applySpec } from '../state/spec.js';
import { saveSwatchesAsPalette } from './palettes.js';
import { loadLogoImage } from './brand-kit.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
```

- [ ] **Step 2: Add `applyBrand`**

Append to `src/features/brand-brain.js`:

```js
// Apply the active brand system onto the current design. One undo step. Routes
// presentation through the validated applySpec(), then sets the brand-specific
// extras (font, logo, watermark) the spec doesn't cover — mirroring how
// brand-kit.js applyKitObject() works, but driven by the extracted system.
export function applyBrand() {
  const b = state.brand;
  if (!b || !b.enabled) { showNotification('Extract a brand first.', 'error'); return; }
  saveStateToHistory();

  // 1) Register the brand palette so the color-map can reference it by id.
  let paletteId = null;
  if (b.palette && b.palette.length >= 2) {
    paletteId = saveSwatchesAsPalette(b.palette.slice(), (b.name || 'Brand') + ' palette');
  }

  // 2) Presentation via the validated spec applier (bg / frame / filter / color).
  applySpec({
    bg: b.background,
    frame: b.frame,
    filter: b.filter,
    color: paletteId ? { mode: b.colorMap.mode, paletteId, intensity: b.colorMap.intensity, steps: b.colorMap.steps } : null
  });

  // 3) Brand extras the spec deliberately doesn't touch.
  if (b.typography?.headlineFont) state.textOverlay.font = b.typography.headlineFont;
  if (b.logo?.dataUrl) {
    state.logo = {
      enabled: true, src: b.logo.dataUrl,
      position: b.logo.position || 'bottom-right',
      scale: b.logo.scale ?? 0.12, opacity: b.logo.opacity ?? 90
    };
    loadLogoImage();
  }
  if (b.watermark?.text) {
    state.watermark = { ...state.watermark, ...b.watermark, enabled: true };
  }

  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  showNotification('Brand applied to design.', 'success');
}
```

- [ ] **Step 3: Verify end-to-end apply in the console**

Run `npm run dev`, load a screenshot, console:
```js
const b = await import('/src/features/brand-brain.js');
const s = (await import('/src/state/state.js')).state;
await b.extractBrandFromImage(s.image, 'Test');
b.applyBrand();
console.log(s.bgMode, s.gradient.colors, s.colorPalettes.active);
```
Expected: `gradient`, the brand gradient colors, and a non-null active palette id. The preview canvas background visibly changes to the brand gradient. Press Cmd/Ctrl+Z → it reverts (one undo step).

- [ ] **Step 4: Commit**

```bash
git add src/features/brand-brain.js
git commit -m "feat(v30): applyBrand() routes brand system through applySpec

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 8: Brand Brain sidebar panel + bind + wiring

**Files:**
- Modify: `editor/index.html` (add the Brand Brain section in the Background group)
- Modify: `src/features/brand-brain.js` (add `bindBrandBrain` + small UI sync)
- Modify: `src/main.js` (import + call `bindBrandBrain()`)

**Interfaces:**
- Consumes: `extractBrandFromUrl`, `extractBrandFromImage`, `applyBrand` (Tasks 6–7).
- Produces: `bindBrandBrain() => void` (called once from `main.js`).

- [ ] **Step 1: Add the sidebar markup**

In `editor/index.html`, find an existing `data-group="background"` section (e.g. the Brand Kit section, which has `id="brand-list"` controls). Add a new section immediately after it:

```html
<div class="sidebar-section" data-group="background">
  <div class="section-title">Brand Brain <span class="badge-ai">AI</span></div>
  <div class="section-body">
    <p class="hint">Extract a full brand system once, then apply or enforce it everywhere.</p>

    <label class="field-label">From a website URL</label>
    <div class="row">
      <input type="url" id="brand-brain-url" placeholder="https://yourbrand.com" />
      <button id="brand-brain-extract-url" class="btn">Extract</button>
    </div>

    <label class="field-label">…or from a logo / brand image</label>
    <div class="row">
      <button id="brand-brain-asset-btn" class="btn">Upload asset</button>
      <input type="file" id="brand-brain-asset-input" accept="image/*" hidden />
    </div>

    <div id="brand-brain-preview" class="brand-brain-preview" style="display:none;">
      <div id="brand-brain-swatches" class="palette-row"></div>
      <div id="brand-brain-name" class="hint"></div>
    </div>

    <div class="row">
      <button id="brand-brain-apply" class="btn btn-primary">Apply to design</button>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="brand-brain-enforce" />
      Enforce on new pages &amp; projects
    </label>
  </div>
</div>
```

> Match the existing sections' class names (`sidebar-section`, `section-title`, `section-body`, `field-label`, `row`, `btn`, `btn-primary`, `hint`, `palette-row`/`palette-swatch`). If a class used above doesn't exist in `editor/index.html`/CSS, substitute the nearest existing one used by the Brand Kit section directly above (read it first). Do NOT add a per-feature version badge to the title (CLAUDE.md v20.1 tidy rule).

- [ ] **Step 2: Add the bind + UI sync to `brand-brain.js`**

Append to `src/features/brand-brain.js`:

```js
const $ = (id) => document.getElementById(id);

function fileToImage(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = r.result; };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

// Reflect state.brand into the panel preview (swatches + name + enforce check).
export function refreshBrandBrainUI() {
  const wrap = $('brand-brain-preview');
  const sw = $('brand-brain-swatches');
  const nm = $('brand-brain-name');
  const enf = $('brand-brain-enforce');
  if (enf) enf.checked = !!state.brand.enforce;
  if (!state.brand.enabled) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = 'block';
  if (sw) sw.innerHTML = (state.brand.palette || [])
    .map(c => `<div class="palette-swatch" style="background:${c};" title="${c}"></div>`).join('');
  if (nm) nm.textContent = state.brand.name ? `“${state.brand.name}”` : '';
}

export function bindBrandBrain() {
  $('brand-brain-extract-url')?.addEventListener('click', async () => {
    const url = $('brand-brain-url')?.value?.trim();
    const ok = await extractBrandFromUrl(url);
    if (ok) refreshBrandBrainUI();
  });

  const assetInput = $('brand-brain-asset-input');
  $('brand-brain-asset-btn')?.addEventListener('click', () => assetInput?.click());
  assetInput?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (f) { const img = await fileToImage(f); if (img) { await extractBrandFromImage(img, f.name.replace(/\.[^.]+$/, '')); refreshBrandBrainUI(); } }
    assetInput.value = '';
  });

  $('brand-brain-apply')?.addEventListener('click', () => applyBrand());

  $('brand-brain-enforce')?.addEventListener('change', (e) => {
    state.brand.enforce = e.target.checked;
  });

  refreshBrandBrainUI();
}
```

- [ ] **Step 3: Wire into `main.js`**

In `src/main.js`, add the import next to the other feature imports (near line 40, beside `import { bindBrandKit } ...`):
```js
import { bindBrandBrain } from './features/brand-brain.js';
```
And call it inside `init()` next to `bindBrandKit();` (near line 135):
```js
  bindBrandKit();
  bindBrandBrain();
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`:
1. Open the **Background** group in the sidebar → the "Brand Brain" section appears.
2. Load a screenshot, click **Upload asset**, pick a logo/image → swatches + name appear in the preview.
3. Click **Apply to design** → the background becomes the brand gradient; undo reverts it.
4. Toggle **Enforce** → no error (the hook itself is Task 9).
Run `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add editor/index.html src/features/brand-brain.js src/main.js
git commit -m "feat(v30): Brand Brain sidebar panel + bindBrandBrain wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 9: Enforce hook + Cmd-K command + final verification

**Files:**
- Modify: `src/features/pages.js` (apply brand on `addPage` when enforced)
- Modify: `src/features/projects.js` (apply brand on `newProject` when enforced)
- Modify: `src/features/palette.js` (Cmd-K command)

**Interfaces:**
- Consumes: `applyBrand` (Task 7), `state.brand.enforce`.

- [ ] **Step 1: Enforce on new page**

In `src/features/pages.js`, read `addPage(...)` to find where a new page becomes active. At the END of that function (after the new page is active and `applyPayload` has run), add:
```js
  // v30 — Brand Brain enforcement: a freshly added page inherits the brand.
  if (state.brand && state.brand.enforce && state.brand.enabled) {
    import('./brand-brain.js').then(m => m.applyBrand());
  }
```
Add `import { state } from '../state/state.js';` only if `pages.js` doesn't already import `state` (it does — confirm and skip if so). The dynamic `import()` avoids an import cycle (pages ↔ brand-brain via render/history).

- [ ] **Step 2: Enforce on new project**

In `src/features/projects.js`, read `newProject(name)` to find where the blank project is initialized and applied. After that (before the function returns), add the same guard:
```js
  // v30 — Brand Brain enforcement: a new project starts on-brand.
  if (state.brand && state.brand.enforce && state.brand.enabled) {
    import('./brand-brain.js').then(m => m.applyBrand());
  }
```

- [ ] **Step 3: Add the Cmd-K command**

In `src/features/palette.js`, find `registerCommands()` and add an entry to the `commands` list (match the existing entry shape — read a neighbor first):
```js
    { id: 'brand-brain-apply', label: 'Apply Brand', icon: '🎨', group: groupFor('brand-brain-apply'),
      run: () => import('./brand-brain.js').then(m => m.applyBrand()),
      when: () => !!state.brand?.enabled },
```
If `groupFor` doesn't recognize the id, it falls back to a default group — acceptable; optionally add `'brand-brain-apply'` to whatever map `groupFor` uses under a "Background"/"AI" group for tidiness.

- [ ] **Step 4: Full end-to-end verification**

Run `npm run dev`:
1. **Asset extract + apply:** load a screenshot → Brand Brain → Upload asset → Apply → background is the brand gradient; **Cmd/Ctrl+Z** reverts.
2. **URL extract** (requires the deployed `/api/brand-extract`, or `vercel dev`): paste a URL → Extract → swatches appear. If the endpoint is unavailable, confirm it degrades with the "try uploading a logo" notice (no crash).
3. **Enforce:** toggle Enforce on → add a new page (Pages panel) → the new page opens already on-brand. Toggle a new project → it starts on-brand.
4. **Cmd-K:** open the command palette → "Apply Brand" appears (only when a brand is enabled) and applies it.
5. **Persistence:** save the project, reload, reopen it → `state.brand` is restored (check `state.brand.enabled` in console).
6. **Migration:** open a project saved before this branch → it loads with a default disabled brand, no errors.
7. `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/features/pages.js src/features/projects.js src/features/palette.js
git commit -m "feat(v30): Brand Brain enforcement hooks + Cmd-K command

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

- [ ] **Step 6: Push the branch**

```bash
git push -u origin claude/v30-feature-brainstorm-qidm1d
```

---

## Self-Review (completed against the spec)

**Spec coverage (Brand Brain + foundations sections):**
- `runVisionJson` foundation → Task 1. ✓
- `renderAtSize` foundation → Task 2. ✓
- `state.brand` + snapshot + serialize + `SCHEMA_VERSION` 18→19 + migration → Task 3. ✓ (Refinement vs spec: `brand` lives in `PROJECT_FIELDS`, not `SERIALIZED_FIELDS`, because it carries a logo dataURL — same rationale the codebase already applies to `logo`. Noted in Global Constraints.)
- URL extraction (`api/brand-extract` + vision + k-means palette) → Tasks 5–6. ✓
- Asset extraction (k-means palette, logo dataURL like `brand-kit.js`) → Task 6. ✓
- `applyBrand()` via `applySpec` + palette registration + font/logo/watermark → Task 7. ✓
- Sidebar panel in Background group, Apply + Enforce → Task 8. ✓
- Enforce on new page/project → Task 9. ✓
- Cmd-K entry → Task 9. ✓
- Reuse of `extractPalette`/`generateHarmony`/`brand-kit` patterns (DRY) → Tasks 4, 6, 7. ✓

**Deferred (correctly out of this plan, per spec):** multiple saved brands, web-font auto-download/matching, voice/tone copy.

**Placeholder scan:** No "TBD/TODO/handle edge cases" — every step has concrete code or concrete commands. The two "read the neighbor first" notes (Task 4 `kmeans` return shape, Task 8 CSS class names, Task 9 `addPage`/`newProject`/`registerCommands` insertion points) are explicit verification instructions, not placeholders, because the exact local shape must be confirmed at the insertion site.

**Type consistency:** `state.brand` shape is identical across Task 3 (state default), Task 3 (`ensureBrandDefaults`), and Task 6 (`writeBrand`). `applyBrand` (Task 7) reads exactly the fields Task 6 writes. `extractBrandFromUrl/Image` and `applyBrand` signatures match their call sites in Tasks 8–9.

---

## Next plans in the V30 series

- **Plan 02 — AI Screenshot Editor** (independent; uses `runVisionJson` + OCR boxes + existing `edit()` inpaint).
- **Plan 03 — Campaign Generator + Campaign folder** (uses `renderAtSize` + `state.brand` + `renderSetPanels` + `exportTimeline` + `downloadZip`).
- **Plan 04 — Producer** (orchestrates 01–03 via the agent runtime).
- **Plan 05 — Marketing page + Changelog + What's-New** (taste-skill).
