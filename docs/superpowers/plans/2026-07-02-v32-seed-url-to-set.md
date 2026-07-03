# v32 Seed (URL → set) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a page URL on the board, get that page's discovered images dropped onto the board as cards — the "paste a link, get a set" magic moment.

**Architecture:** A new serverless function `api/scrape-page.js` fetches the page HTML server-side (reusing `api/fetch-url.js`'s SSRF/private-IP guards) and returns a JSON manifest `{title, images}`. A new `src/features/seed.js` fetches that manifest, loads each image CORS-clean through the **existing** `loadImageEl` (which goes via `/api/fetch-url`), and adds each as a page via a new `pages.js` `addPageWithImage(img)` accessor. The board's existing `onDocumentChange` sync then drops a card per new page. No new board-render code; no change to `renderInto`.

**Tech Stack:** Vanilla JS + Vite (client); Vercel serverless function (Node, `api/scrape-page.js`). Reuses `loadImageEl` (`url-load.js`), `loadImage`/`loadImageFromSrc` (`upload.js`), `pages.js`, `board.js`, `palette.js`, `_shared.js`.

**Staging note:** This plan covers the **Seed** pillar only (spec §4.1). The Control pillar is a separate follow-on plan. The deferred v1.1 (headless live-page screenshots via `@sparticuz/chromium`, spec §4.2) is NOT in this plan.

## Global Constraints

- **No test runner, no linter.** Verify each task by `npm run build` (compiles all Vite inputs; fails on import/syntax errors) + careful code reading. Full e2e of the server function requires Vercel (the `/api/*` functions are not served by `npm run dev`); the client must degrade gracefully when the API is absent. This overrides the writing-plans TDD default (per CLAUDE.md).
- **Use Opus for all work, including subagents.** Never fall back to Sonnet/Haiku (CLAUDE.md).
- **Windows/PowerShell host, bash shell.** Forward slashes; single `-m` for commits; end every commit message with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never commit `dist/`.
- **Do not touch** `renderInto`, the four composition paths in `render.js`, `board.js`'s render/selection/camera logic, `selection.js` (scene), `history.snapshot()` membership, or `serialize.js`'s `SCHEMA_VERSION`. `DOC_VERSION` stays 14.
- **Commit per task.** Do not amend across tasks.
- **Feature-module convention:** new files start with a version-tag comment (`// v32 — …`) and export a `bind<Feature>()` called once in `main.js`.

---

## File Structure

**Create:**
- `api/scrape-page.js` — Vercel serverless function: fetch page HTML (SSRF-guarded), parse title + images, return JSON manifest.
- `src/features/seed.js` — `bindSeed()`, `seedFromUrl(url)`, the board-toolbar URL input wiring.

**Modify:**
- `api/_shared.js` — export the SSRF guard helpers (`isPrivateIp`, `assertPublicHost`, `assertHttpUrl`, `fetchPublic`) so `scrape-page.js` and `fetch-url.js` share one source of truth.
- `api/fetch-url.js` — import the guards from `_shared.js` instead of defining them locally (DRY refactor; behavior identical).
- `src/state/serialize.js` — export a parameterized `imageToDataUrl(img, maxEdge, mime, quality)`; refactor `getImageDataURL()` to call it.
- `src/features/pages.js` — add `addPageWithImage(img)` (builds a page payload + thumb off the live editor, pushes, emits change, returns the id).
- `src/features/board.js` — expose `enterBoardMode()`/`seedFromUrl` hook points if needed; the toolbar "Add from URL" button is created in `seed.js` and appended to the board toolbar.
- `src/features/palette.js` — add a `seedFromUrl` command.
- `src/styles.css` — `.board-seed` input bar styles.
- `src/main.js` — import + call `bindSeed()`.

---

## Task 1: Extract the SSRF guard into `api/_shared.js` and refactor `fetch-url.js`

**Files:**
- Modify: `api/_shared.js` (add exports)
- Modify: `api/fetch-url.js` (import instead of define)

**Interfaces:**
- Produces: `_shared.js` exports `isPrivateIp(ip)`, `assertPublicHost(host)`, `assertHttpUrl(url)`, `fetchPublic(startUrl, {maxRedirects, userAgent})` (the manual-redirect fetch). `fetch-url.js` imports these.
- Consumes: `api/_shared.js`'s `ApiError`, `handleApiError` (already there).

- [ ] **Step 1: Move the guard functions into `_shared.js`**

`api/fetch-url.js` currently defines (locally, near the top): `MAX_BYTES`, `MAX_REDIRECTS`, `isPrivateIp`, `assertPublicHost`, `assertHttpUrl`, `fetchPublicMedia`. Move `isPrivateIp`, `assertPublicHost`, `assertHttpUrl`, and the redirect-following fetch (currently `fetchPublicMedia`) into `api/_shared.js` as **exported** functions. In `_shared.js`, add at the top (it already imports `dns/promises`? No — it does not; add `import { lookup } from 'dns/promises';`):

```js
import { lookup } from 'dns/promises';

export const MAX_REDIRECTS = 5;

export function isPrivateIp(ip) {
  // (Copy the EXACT body from fetch-url.js's isPrivateIp — IPv4 ranges,
  // ::ffff: mapped, ::, ::1, fe80-feb/fc/fd/ff prefixes, etc.)
}

export async function assertPublicHost(host) {
  // (Copy the EXACT body from fetch-url.js's assertPublicHost — literal/IP
  // branch, isPrivateIp check, dns lookup, all-records-private check.)
}

export function assertHttpUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError(400, 'Only http(s) URLs are allowed');
  }
}

// Manual-redirect fetch that SSRF-guards every hop. Returns the upstream
// Response (a 2xx after following redirects, or throws on too many redirects /
// private host / non-http).
export async function fetchPublic(startUrl, { maxRedirects = MAX_REDIRECTS, userAgent = 'Mozilla/5.0 SnapShotPro/11' } = {}) {
  let current = startUrl;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    assertHttpUrl(current);
    await assertPublicHost(current.hostname);
    const upstream = await fetch(current.toString(), {
      headers: { 'User-Agent': userAgent },
      redirect: 'manual'
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) throw new ApiError(502, 'Redirect missing location');
      current = new URL(location, current);
      continue;
    }
    return upstream;
  }
  throw new ApiError(508, 'Too many redirects');
}
```

Keep `MAX_BYTES` and the `handler` in `fetch-url.js` (they're route-specific). When copying `isPrivateIp`/`assertPublicHost`, copy them **verbatim** (the IPv4/IPv6 private-range logic is security-critical and must not drift).

- [ ] **Step 2: Refactor `fetch-url.js` to import the guards**

In `api/fetch-url.js`, remove the now-shared local definitions (`isPrivateIp`, `assertPublicHost`, `assertHttpUrl`, `fetchPublicMedia`, `MAX_REDIRECTS`) and import them from `./_shared.js`:

```js
import { ApiError, handleApiError, isPrivateIp, assertPublicHost, assertHttpUrl, fetchPublic } from './_shared.js';
```

Replace the `handler`'s call site `const upstream = await fetchPublicMedia(parsed);` with `const upstream = await fetchPublic(parsed);`. Keep `MAX_BYTES` (25 MB) local. Leave the rest of the handler (content-type guard, size guard, streaming response) unchanged.

- [ ] **Step 3: Verify**

Run `npm run build` and confirm it succeeds (serverless functions aren't compiled by Vite, but the build must still pass). Re-read `fetch-url.js` to confirm: the handler still SSRF-guards (`fetchPublic` → `assertPublicHost`), still enforces `image/`|`video/` content-type, still caps at `MAX_BYTES`, still streams bytes. The refactor must be behavior-identical.

- [ ] **Step 4: Commit**

```bash
git add api/_shared.js api/fetch-url.js
git commit -m "refactor(v32): extract SSRF guard to _shared.js for reuse by scrape-page" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `api/scrape-page.js` — fetch + parse a page into an image manifest

**Files:**
- Create: `api/scrape-page.js`

**Interfaces:**
- Produces: `GET /api/scrape-page?url=<encoded absolute http(s) url>` → `200 { title, images: [{url, w, h, alt}] }` (CORS `*`), or `{ error }` on rejection. `w`/`h` are `null` when unknown (the client measures after decode).
- Consumes: `_shared.js` `ApiError`, `handleApiError`, `assertHttpUrl`, `fetchPublic`.

- [ ] **Step 1: Create the function**

Create `api/scrape-page.js`:

```js
// v32 — Seed (URL -> set). Fetch a page server-side, extract its title and the
// images that best represent it (Open Graph, apple-touch-icon, hero <img>/<picture>,
// favicon), and return a small JSON manifest. The client then loads each image
// CORS-clean through the existing /api/fetch-url media proxy and drops them as
// board cards. Reuses the SSRF guard from _shared.js — never fetches private IPs.

import { ApiError, handleApiError, assertHttpUrl, fetchPublic } from './_shared.js';

const MAX_HTML_BYTES = 5 * 1024 * 1024;   // 5 MB of HTML
const MAX_IMAGES = 12;

// Resolve a possibly-relative URL against the page URL.
function abs(u, base) {
  try { return new URL(u, base).toString(); } catch (_) { return null; }
}

// Only image-looking URLs (skip trackers/scripts by extension).
function looksLikeImage(u) {
  if (!u) return false;
  const path = u.split('?')[0].split('#')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\b|$)/.test(path) ||
    u.startsWith('data:image/');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new ApiError(405, 'Method not allowed');
    const raw = req.query?.url;
    const target = Array.isArray(raw) ? raw[0] : raw;
    if (!target) throw new ApiError(400, 'Missing url parameter');
    let parsed;
    try { parsed = new URL(target); } catch (_) { throw new ApiError(400, 'Invalid URL'); }
    assertHttpUrl(parsed);

    const upstream = await fetchPublic(parsed, { userAgent: 'Mozilla/5.0 SnapShotPro/32 scraper' });
    if (!upstream.ok) throw new ApiError(upstream.status, `Upstream returned ${upstream.status}`);

    const type = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('html') && !type.includes('xml') && !type.includes('text')) {
      throw new ApiError(415, 'URL is not an HTML page');
    }
    const declared = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
      throw new ApiError(413, 'Page is too large');
    }
    const text = await upstream.text();
    if (text.length > MAX_HTML_BYTES) throw new ApiError(413, 'Page is too large');

    const title = (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const base = parsed.toString();
    const seen = new Set();
    const images = [];

    const push = (url, alt) => {
      const a = abs(url, base);
      if (!a || seen.has(a) || !looksLikeImage(a)) return;
      seen.add(a);
      images.push({ url: a, w: null, h: null, alt: alt || '' });
    };

    // Open Graph image(s) — primary signal. og:image can repeat; grab all.
    const og = text.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/ig) || [];
    for (const m of og) {
      const c = (m.match(/content=["']([^"']+)["']/i) || [])[1];
      if (c) push(c, 'Open Graph image');
    }

    // Apple-touch-icon (app icon).
    const ati = text.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    if (ati) push(ati[1], 'App icon');

    // Hero <img> and <picture><source srcset>. srcset first entry only.
    const imgs = text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/ig) || [];
    for (const m of imgs) {
      const src = (m.match(/src=["']([^"']+)["']/i) || [])[1];
      const alt = (m.match(/alt=["']([^"']*)["']/i) || [])[1];
      if (src) push(src, alt);
    }
    const srcsets = text.match(/<source[^>]+srcset=["']([^"'\s]+)/ig) || [];
    for (const m of srcsets) {
      const s = (m.match(/srcset=["']([^"'\s]+)/i) || [])[1];
      if (s) push(s, '');
    }

    // Favicon fallback.
    const fav = text.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (fav) push(fav[1], 'Favicon');

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      title: title.replace(/\s+/g, ' ').trim().slice(0, 200),
      images: images.slice(0, MAX_IMAGES)
    });
  } catch (e) {
    handleApiError(res, e);
  }
}
```

- [ ] **Step 2: Verify**

Run `npm run build` and confirm it succeeds. Re-read the file for SSRF correctness: every fetch goes through `fetchPublic` (which `assertPublicHost`s every hop); relative URLs are resolved against the (already-validated) page URL; no private IP is ever fetched. The `looksLikeImage` filter skips non-image extensions. Output is capped at `MAX_IMAGES`.

- [ ] **Step 3: Commit**

```bash
git add api/scrape-page.js
git commit -m "feat(v32): api/scrape-page — SSRF-guarded page-to-image manifest" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `serialize.js` `imageToDataUrl` + `pages.js` `addPageWithImage`

**Files:**
- Modify: `src/state/serialize.js` (export `imageToDataUrl`, refactor `getImageDataURL`)
- Modify: `src/features/pages.js` (add `addPageWithImage`)

**Interfaces:**
- Produces: `serialize.js` exports `imageToDataUrl(img, maxEdge, mime, quality)` (draws `img` to an offscreen canvas capped on the long edge, returns a dataURL or null). `pages.js` exports `addPageWithImage(img)` → new page id (builds a payload inheriting the current look + the image dataURL + a thumb, off the live editor; pushes to `pages`; emits `onDocumentChange`).
- Consumes: `serialize.js` `serializeFull`, `SCHEMA_VERSION`; `document.js` `uid`; `pages.js`'s private `pages`/`emitChange`.

- [ ] **Step 1: Add `imageToDataUrl` to `serialize.js`**

`serialize.js` already has `getImageDataURL()` (reads `state.image`, caps at 2000px, JPEG 0.9). Extract the cap-and-encode into a reusable export and have `getImageDataURL` call it. Add:

```js
// v32 — cap an <img> to maxEdge on the long edge and encode to a dataURL. Returns
// null if the canvas is tainted (cross-origin source) or the image is empty.
export function imageToDataUrl(img, maxEdge, mime = 'image/jpeg', quality = 0.9) {
  if (!img || !img.width || !img.height) return null;
  try {
    let w = img.width, h = img.height;
    const longEdge = Math.max(w, h);
    if (longEdge > maxEdge) { const s = maxEdge / longEdge; w = Math.round(w * s); h = Math.round(h * s); }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL(mime, quality);
  } catch (e) { return null; }
}
```

Refactor the existing `getImageDataURL()` to call it:

```js
export function getImageDataURL() {
  return imageToDataUrl(state.image, 2000, 'image/jpeg', 0.9);
}
```

(Keep `getImageDataURL`'s doc comment. Behavior identical.)

- [ ] **Step 2: Add `addPageWithImage` to `pages.js`**

In `src/features/pages.js`, add the import of `imageToDataUrl` from `../state/serialize.js` (it already imports `serializeFull`? — check; if not, add). Then add the accessor (near `addPage`):

```js
// v32 — Seed: add a page that carries a given decoded <img>, inheriting the
// current look. Builds the payload + thumb off the live editor (no flicker, no
// re-render of the active page), pushes to pages, and emits change so the board
// sync drops a card. Returns the new page id. The new page is NOT made active.
export function addPageWithImage(img) {
  if (!img || !img.width || !img.height) return null;
  const dataUrl = imageToDataUrl(img, 2000, 'image/jpeg', 0.9);
  const thumb = imageToDataUrl(img, 320, 'image/jpeg', 0.6) || dataUrl;
  // Inherit the current design, but size the canvas to the image's aspect.
  const cur = serializeFull();
  const design = { ...cur.design, canvas: { width: img.width, height: img.height } };
  const payload = { schemaVersion: cur.schemaVersion, design, image: dataUrl, svgCode: null };
  const page = { id: uid(), payload, thumb };
  pages.push(page);
  emitChange();
  return page.id;
}
```

(Confirm `serializeFull`, `uid`, `emitChange` are in scope in `pages.js` — `serializeFull` and `uid` are imported from `./document.js`; `emitChange` is a local function in `pages.js`. Read the file's imports before writing.)

- [ ] **Step 3: Verify**

Run `npm run build`; confirm success. Re-read: `addPageWithImage` does NOT mutate `state` or call `render()` (it builds the payload from `serializeFull()` of the live state, which is a snapshot — safe), does NOT change `active`, and emits change so the board sync (`onDocumentChange`) adds a card. The new page's `canvas` matches the image's aspect so the card isn't letterboxed weirdly.

- [ ] **Step 4: Commit**

```bash
git add src/state/serialize.js src/features/pages.js
git commit -m "feat(v32): imageToDataUrl + addPageWithImage (seed cards inherit current look)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `src/features/seed.js` — the board "Add from URL" flow

**Files:**
- Create: `src/features/seed.js`
- Modify: `src/main.js` (import + call `bindSeed()`)
- Modify: `src/features/board.js` (expose the toolbar element for `seed.js` to append to, or accept the input bar via a getter)

**Interfaces:**
- Produces: `bindSeed()`, `seedFromUrl(url)` (exported; the palette command and the input bar both call it). Creates a `.board-seed` input bar appended to the board toolbar.
- Consumes: `el.canvasViewport`; `board.js`'s `enterBoardMode` (to ensure board mode); `loadImageEl` (`url-load.js`); `addPageWithImage` (`pages.js`); `showNotification` (`ui/notification.js`).

- [ ] **Step 1: Create `seed.js`**

Create `src/features/seed.js`:

```js
// v32 — Seed (URL -> set). A "paste a link, get cards" entry on the board
// toolbar. Fetches /api/scrape-page (SSRF-guarded server scrape), then loads each
// discovered image CORS-clean through the existing loadImageEl (which goes via
// /api/fetch-url) and drops each as a page via pages.addPageWithImage. The board's
// onDocumentChange sync then lays a card per new page. Degrades gracefully when
// the API is unreachable (Vite dev doesn't serve /api) — shows a notification.

import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { loadImageEl } from './url-load.js';
import { addPageWithImage } from './pages.js';

let bar = null;     // .board-seed input row

function ensureBar(toolbar) {
  if (bar || !toolbar) return;
  bar = document.createElement('div');
  bar.className = 'board-seed';
  bar.innerHTML = `
    <input class="board-seed-input" type="url" placeholder="Paste a page URL to drop its images as cards" aria-label="Page URL" />
    <button class="board-seed-go" type="button">Add</button>`;
  const input = bar.querySelector('.board-seed-input');
  const go = () => { const v = input.value.trim(); if (v) seedFromUrl(v); };
  bar.querySelector('.board-seed-go').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  toolbar.appendChild(bar);
}

export async function seedFromUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return;
  showNotification('Scraping page…', 'success');
  let manifest;
  try {
    const res = await fetch(`/api/scrape-page?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      let msg = `Scrape failed (${res.status})`;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
      showNotification(msg, 'error');
      return;
    }
    manifest = await res.json();
  } catch (e) {
    showNotification('Could not reach the scraper (try again on the deployed site).', 'error');
    return;
  }
  const imgs = (manifest && manifest.images) || [];
  if (!imgs.length) { showNotification('No images found on that page.', 'error'); return; }
  showNotification(`Found ${imgs.length} image${imgs.length === 1 ? '' : 's'}. Adding…`, 'success');

  let added = 0;
  for (let i = 0; i < imgs.length; i++) {
    const m = imgs[i];
    try {
      const img = await loadImageEl(m.url);     // CORS-clean via /api/fetch-url
      if (addPageWithImage(img)) added++;
    } catch (e) { /* skip one bad image, continue */ }
    await new Promise(r => setTimeout(r, 0));     // yield between loads
  }
  if (added) showNotification(`Added ${added} card${added === 1 ? '' : 's'} from ${url2host(url)}.`, 'success');
  else showNotification('Could not load any images from that page.', 'error');
}

function url2host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u; } }

export function bindSeed() {
  // The board toolbar is built in board.js ensureSurface(). Append the seed bar
  // once it exists; board.js exposes the toolbar via window.__boardToolbar.
  const attach = (toolbar) => { if (toolbar) ensureBar(toolbar); };
  attach(window.__boardToolbar);
  // If board isn't initialized yet, retry when board mode is entered.
  window.__seedAttach = attach;
}
```

- [ ] **Step 2: Expose the board toolbar for `seed.js` to append to**

In `src/features/board.js` `ensureSurface()`, after `toolbar` is created and appended, expose it:

```js
  window.__boardToolbar = toolbar;
  if (typeof window.__seedAttach === 'function') window.__seedAttach(toolbar);
```

(The `__seedAttach` call covers the case where `bindSeed()` ran before the board was initialized — `main.js` order determines this; both orders work.)

- [ ] **Step 3: Wire `bindSeed()` in `main.js`**

In `src/main.js`, add the import near the other `bind*` imports:

```js
import { bindSeed } from './features/seed.js';
```

In `init()`, add the call after `bindBoard();`:

```js
  bindBoard();
  bindSeed();       // v32 — Seed: URL -> board cards
```

- [ ] **Step 4: Verify**

Run `npm run build`; confirm success. Re-read: `seedFromUrl` fetches `/api/scrape-page`, loops images, `loadImageEl` (CORS proxy) → `addPageWithImage`; the board sync adds cards. On Vite dev (no `/api`), the `catch` shows a graceful "try on the deployed site" notification. On a bad image, it skips and continues. No crash on empty manifest.

- [ ] **Step 5: Commit**

```bash
git add src/features/seed.js src/features/board.js src/main.js
git commit -m "feat(v32): Seed — board Add-from-URL drops page images as cards" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Palette command + styles

**Files:**
- Modify: `src/features/palette.js` (add `seedFromUrl` command)
- Modify: `src/features/board.js` (ensure `enterBoardMode` is reachable; already is)
- Modify: `src/styles.css` (`.board-seed` input bar)

**Interfaces:**
- Produces: a `seedFromUrl` palette command (prompts for a URL, ensures board mode, runs `seedFromUrl`); the `.board-seed` styles.

- [ ] **Step 1: Add the palette command**

In `src/features/palette.js`, add the import:

```js
import { seedFromUrl } from './seed.js';
import { enterBoardMode } from './board.js';
```

In `registerCommands()`, add (alongside `toggleBoard`/`boardAddText`/`exportBoard`):

```js
  { id: 'seedFromUrl', label: 'Board: add from URL', icon: 'link', group: 'View',
    run: () => {
      if (state.mode !== 'board') enterBoardMode();
      const url = window.prompt('Paste a page URL to drop its images as cards');
      if (url) seedFromUrl(url);
    },
    when: () => true },
```

(Use `group: 'View'` and add `|| id === 'seedFromUrl'` to `groupFor()`'s View branch if needed — match how `toggleBoard` was added. `enterBoardMode` is exported from `board.js`.)

- [ ] **Step 2: Add the seed-bar styles**

Append to `src/styles.css`:

```css
/* v32 — Seed: the board toolbar's Add-from-URL input bar. */
.board-seed { display: flex; gap: 6px; align-items: center; }
.board-seed-input {
  width: 280px; max-width: 40vw; padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.10));
  background: rgba(0,0,0,0.25); color: var(--text-primary, #ecedf1);
  font-size: 12px; font-family: inherit;
}
.board-seed-input::placeholder { color: var(--text-secondary, #9a9ca8); }
.board-seed-input:focus { outline: none; border-color: var(--accent-primary, #4f7cff); }
.board-seed-go {
  background: var(--accent-primary, #4f7cff); color: #fff; border: none;
  padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.board-seed-go:hover { filter: brightness(1.08); }
```

(Confirm `--accent-primary`, `--text-primary`, `--text-secondary`, `--border-color` exist in `:root` — they do, per the v32 board CSS. Keep fallbacks.)

- [ ] **Step 3: Verify**

Run `npm run build`; confirm success. (In-browser: on the deployed site or `vercel dev`, board mode → the toolbar has a URL input; paste a page URL → cards drop. On Vite dev, the input is visible but submit shows the graceful "try on the deployed site" notification — confirming the client path works without the server.)

- [ ] **Step 4: Commit**

```bash
git add src/features/palette.js src/styles.css
git commit -m "feat(v32): Seed palette command + Add-from-URL bar styles" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (run after writing; fix inline)

- **Spec coverage:** server scraper (§4.1) → Tasks 1-2. `loadImageEl` CORS-clean load → Task 4. `addPageWithImage` → Task 3. board sync drops cards → existing `onDocumentChange` (no change). Brand-Brain inheritance → covered by payload inheriting current look (note: explicit per-page brand application deferred). Palette + UI → Task 5. **Seed v1 fully covered.** Deferred v1.1 (headless screenshots) is out of scope.
- **Placeholder scan:** none. Tasks give real code. (Task 1's `isPrivateIp`/`assertPublicHost` bodies say "copy verbatim from fetch-url.js" — that's correct because the security logic must not drift; the implementer copies, not rewrites.)
- **Type consistency:** `addPageWithImage(img)` returns a page id (Number from `uid`? — `uid()` returns a string `crypto.randomUUID`; board cards ref `pageId` and `getPageMeta`/`indexOfPage` match by `===` on whatever `uid` returns. Confirm `uid`'s return type matches existing `pages[i].id` type — it does, since `addPage` uses the same `uid()`.) `imageToDataUrl` returns a dataURL string or null. `seedFromUrl` is async, returns void.
- **Note for implementer:** Task 1 copies security-critical guard code verbatim — do NOT "improve" it. Task 3's `addPageWithImage` must not touch `state` or call `render()` (it's off-editor). Task 4's `window.__boardToolbar`/`__seedAttach` handshake handles init order; verify both orders.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-v32-seed-url-to-set.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh Opus subagent per task, review between tasks.
**2. Inline Execution** — batch in this session with checkpoints.

(Per CLAUDE.md, Opus only.)
