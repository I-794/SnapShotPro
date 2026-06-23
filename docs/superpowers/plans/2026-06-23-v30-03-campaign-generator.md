# V30 Studio Intelligence — Plan 03: Campaign Generator + Campaign Folder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Part of the V30 plan series:** 01 Foundations + Brand Brain → 02 AI Screenshot Editor → **03 (this file)** → 04 Producer → 05 Marketing. **Depends on Plan 01** (`renderAtSize`, `state.brand`, `applyBrand`).

**Goal:** Turn one design (current screenshot + optional prompt + active brand) into a *coordinated set* of finished, correctly-sized assets — hero, social variants, an App Store set, and a teaser video — saved into a persistent, revisitable **Campaign folder** and downloadable as a labeled ZIP.

**Architecture:** A new `campaign-generator.js` produces the base design (optionally `applyBrand()` + an art-director prompt pass), then renders each target via `renderAtSize()` (Plan 01), the App Store set via the existing `renderSetPanels()`, and the teaser via a blob-returning refactor of the timeline exporter. A new `campaigns.js` owns a localStorage store (mirroring `projects.js`) holding each campaign's **recipe + thumbnails** (quota-safe); full-res assets are cached in-session and **regenerated from the saved design payload** on re-download. A "Campaigns" panel (Project group) renders the folder grid. ZIP bundling reuses `downloadZip()`.

**Tech Stack:** Vanilla JS + Vite. No test runner — verify in `npm run dev` + `npm run build`. ZIP via `fflate` (lazy). Video via `encodeMp4` (WebCodecs). Persistence: `localStorage` (+ optional Supabase `campaigns` table mirroring `gallery.js`).

## Global Constraints

- **No test runner / linter.** Only `dev`, `build`, `preview`. Each task's "test" = in-browser + `npm run build`. No test framework.
- **Feature pattern:** export `bind<Feature>()`, call once in `src/main.js` `init()`. Tag new files `// v30 — …`.
- **Single mutable `state`:** the generator temporarily mutates `state` (image/canvas/design) to render each target, then **always restores** the prior values in a `finally` block — mirroring how `batch-export.js`/`screenshot-set.js` save `savedImg`/`savedCanvas` and restore them.
- **Quota safety:** localStorage holds only the campaign recipe + small thumbnails (≤ ~256px JPEG). NEVER store full-res PNG/MP4 bytes in localStorage. Mirror `projects.js` `writeStore()`'s try/catch quota guard.
- **Render sizing:** set `state.canvas = {width,height}` (or use `renderAtSize`) then `renderInto(canvas, true)`; `forExport=true` suppresses preview chrome.
- **Canvas→bytes:** `await new Promise(res => canvas.toBlob(res,'image/png'))` then `new Uint8Array(await blob.arrayBuffer())`.
- **Sidebar group:** Campaigns panel uses `data-group="project"`.
- **Commit trailers** (every commit):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc
  ```
- **Branch:** `claude/v30-feature-brainstorm-qidm1d`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/features/campaign-targets.js` | The fixed target table + `renderTargetsToFiles()` (multi-size render → bytes). | Create |
| `src/features/timeline-export.js` | Refactor: expose `renderTimelineBlob(format)` returning a Blob. | Modify |
| `src/features/campaigns.js` | localStorage store + Campaign folder UI panel. | Create |
| `src/features/campaign-generator.js` | The generation flow (base design → assets → save). | Create |
| `editor/index.html` | Campaign Generator + Campaigns sections (Project group). | Modify |
| `src/main.js` | Import + call `bindCampaignGenerator()` and `bindCampaigns()`. | Modify |
| `src/features/palette.js` | Cmd-K command to generate a campaign. | Modify |

---

## Task 16: Target table + multi-size render-to-files

**Files:**
- Create: `src/features/campaign-targets.js`

**Interfaces:**
- Consumes: `renderAtSize` (`src/render/render.js`, Plan 01 Task 2), `state` (`src/state/state.js`).
- Produces:
  - `CAMPAIGN_TARGETS: Array<{ role, dir, width, height }>` — the MVP output set.
  - `renderTargetsToFiles(onProgress?) => Promise<{ files: Record<string, Uint8Array>, thumbs: Array<{ role, dataUrl }> }>` — renders the current design at every target size, returns a name→bytes map (for ZIP) plus small thumbnails (for the folder UI).

- [ ] **Step 1: Create the module**

Create `src/features/campaign-targets.js`:
```js
// v30 — Campaign Generator target sizes + multi-size renderer. Renders the
// CURRENT design (already framed/branded by the generator) at each target via
// renderAtSize(), returning ZIP-ready bytes + small thumbnails. Pure w.r.t.
// state: renderAtSize restores state.canvas itself; we never touch state.image.

import { renderAtSize } from '../render/render.js';

// MVP coordinated set: hero + 3 social + (App Store set handled separately by
// the generator via renderSetPanels). dir groups files into ZIP subfolders.
export const CAMPAIGN_TARGETS = [
  { role: 'hero',      dir: 'hero',   width: 1200, height: 675 },
  { role: 'instagram', dir: 'social', width: 1080, height: 1080 },
  { role: 'twitter',   dir: 'social', width: 1200, height: 630 },
  { role: 'linkedin',  dir: 'social', width: 1200, height: 627 }
];

function canvasToU8(canvas) {
  return new Promise((resolve) => canvas.toBlob(b => b.arrayBuffer().then(ab => resolve(new Uint8Array(ab))), 'image/png'));
}

function thumbDataUrl(canvas, max = 256) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(canvas.width * scale));
  t.height = Math.max(1, Math.round(canvas.height * scale));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.8);
}

// Render every target at full size. Returns ZIP files keyed by `dir/role.png`
// plus a thumbnail per role for the Campaign folder UI.
export async function renderTargetsToFiles(onProgress) {
  const off = document.createElement('canvas');
  const files = {};
  const thumbs = [];
  for (let i = 0; i < CAMPAIGN_TARGETS.length; i++) {
    const t = CAMPAIGN_TARGETS[i];
    renderAtSize(off, { width: t.width, height: t.height });
    files[`${t.dir}/${t.role}-${t.width}x${t.height}.png`] = await canvasToU8(off);
    thumbs.push({ role: t.role, dataUrl: thumbDataUrl(off) });
    if (onProgress) onProgress(i + 1, CAMPAIGN_TARGETS.length);
    await new Promise(r => setTimeout(r, 0)); // yield so the UI can paint
  }
  return { files, thumbs };
}
```

- [ ] **Step 2: Verify build + render**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a screenshot, console:
```js
const t = await import('/src/features/campaign-targets.js');
const { files, thumbs } = await t.renderTargetsToFiles();
console.log(Object.keys(files), thumbs.length); // 4 file keys, 4 thumbs
const s = (await import('/src/state/state.js')).state;
console.log(s.canvas); // unchanged (renderAtSize restores it)
```
Expected: 4 file keys (hero + 3 social), 4 thumbs; `state.canvas` unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaign-targets.js
git commit -m "feat(v30): campaign target table + multi-size render-to-files

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 17: Expose a blob-returning timeline render

**Files:**
- Modify: `src/features/timeline-export.js` (extract the encode core into an exported `renderTimelineBlob`)

**Interfaces:**
- Produces: `renderTimelineBlob(format: 'mp4'|'gif') => Promise<Blob|null>` — renders the active timeline and returns the encoded blob (instead of triggering a download). Returns `null` when there's no motion / the format is unsupported.
- Existing `exportTimeline(format)` is refactored to call `renderTimelineBlob` then `download()` — behavior unchanged for current callers.

**Read `src/features/timeline-export.js` fully first.** It already builds `frameProvider`, computes `durationMs`/`fps`/`total`/`width`/`height`, warms the turntable, and calls `encodeMp4`/`encodeGif` with an `onCaptured: restore`. Extract everything from the guard checks through the `encode` call into `renderTimelineBlob`, returning the blob; keep the download + notifications in `exportTimeline`.

- [ ] **Step 1: Refactor**

Restructure `src/features/timeline-export.js` so the core returns a blob:
```js
// v30 — render the active timeline to an encoded blob (no download). Extracted
// from exportTimeline so the Campaign Generator can embed a teaser video.
export async function renderTimelineBlob(format) {
  if (!timelineActive()) return null;
  if (format === 'mp4' && !mp4Supported()) return null;

  const durationMs = Math.min(deriveDuration(), MAX_DURATION_MS);
  const fps = format === 'gif' ? Math.min(20, state.timeline.fps || 20) : (state.timeline.fps || 30);
  const total = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const { resolution, quality, loop } = motionOpts();
  const width = state.canvas.width * resolution;
  const height = state.canvas.height * resolution;
  const renderCanvas = document.createElement('canvas');

  const frameProvider = async (i) => {
    const ms = (i / fps) * 1000;
    await sampleAtForExport(ms);
    renderInto(renderCanvas, true);
    return renderCanvas;
  };
  const restore = () => { /* keep the existing restore body from exportTimeline */ };

  return format === 'mp4'
    ? await encodeMp4(frameProvider, { width, height, fps, count: total, quality, onCaptured: restore })
    : await encodeGif(frameProvider, { width, height, fps, count: total, quality, loop, onCaptured: restore });
}
```
Then rewrite `exportTimeline(format)` to use it:
```js
export async function exportTimeline(format) {
  if (!timelineActive()) { showNotification('Add some motion to the timeline first.', 'error'); return; }
  if (format === 'mp4' && !mp4Supported()) { showNotification('MP4 export needs WebCodecs (Chrome/Edge). Try GIF instead.', 'error'); return; }
  setProgress('Preparing…');
  showNotification(`Generating ${format.toUpperCase()}…`, 'success');
  try {
    const blob = await renderTimelineBlob(format);
    if (!blob) { showNotification('Nothing to export.', 'error'); return; }
    download(blob, `motion-${Date.now()}.${format}`);
  } catch (err) {
    console.error(err);
    showNotification(`Export failed: ${err.message || err}`, 'error');
  }
}
```
> Preserve the EXACT body of the existing `restore` closure and any progress callbacks from the original `exportTimeline` — copy them verbatim from the file into `renderTimelineBlob` (the snippet above abbreviates `restore` for brevity; do not lose the original turntable/runtime restoration logic).

- [ ] **Step 2: Verify the existing export still works**

Run: `npm run build` → succeeds.
Run `npm run dev`, add some motion (e.g. an entrance animation), open the Video/Motion export, click Export MP4 → a `motion-*.mp4` downloads as before (regression check).

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline-export.js
git commit -m "refactor(v30): expose renderTimelineBlob() from timeline-export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 18: Campaigns store (localStorage)

**Files:**
- Create: `src/features/campaigns.js` (store half; UI added in Task 20)

**Interfaces:**
- Produces:
  - `loadCampaigns() => Record<string, Campaign>`
  - `saveCampaign(record) => boolean`
  - `getCampaign(id) => Campaign|null`
  - `deleteCampaign(id) => void`
  - `Campaign` shape: `{ id, name, createdAt, brandName, payload, targets: [{role,dir,width,height}], appStore: boolean, hasTeaser: boolean, thumbs: [{role,dataUrl}] }` — `payload` is the design envelope (`serializeFull()`-style) used to regenerate full-res assets on download.

- [ ] **Step 1: Create the store**

Create `src/features/campaigns.js`:
```js
// v30 — Campaign folder store. Mirrors projects.js: a localStorage map keyed by
// id. Stores each campaign's RECIPE (design payload + target list) plus small
// thumbnails — NOT full-res bytes (quota-safe). Full assets are regenerated from
// `payload` on download (deterministic), and cached in-session by the generator.

import { showNotification } from '../ui/notification.js';

const KEY = 'snapshotpro_campaigns_v1';

export function loadCampaigns() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch (e) { return {}; }
}

function writeAll(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch (e) {
    showNotification('Storage full — could not save the campaign.', 'error');
    return false;
  }
}

export function saveCampaign(record) {
  const store = loadCampaigns();
  store[record.id] = record;
  return writeAll(store);
}

export function getCampaign(id) {
  return loadCampaigns()[id] || null;
}

export function deleteCampaign(id) {
  const store = loadCampaigns();
  delete store[id];
  writeAll(store);
}
```

- [ ] **Step 2: Verify build + round-trip**

Run: `npm run build` → succeeds.
Run `npm run dev`, console:
```js
const c = await import('/src/features/campaigns.js');
c.saveCampaign({ id: 't1', name: 'Test', createdAt: 1, brandName: '', payload: {}, targets: [], appStore: false, hasTeaser: false, thumbs: [] });
console.log(c.getCampaign('t1').name); // Test
c.deleteCampaign('t1'); console.log(c.getCampaign('t1')); // null
```
Expected: `Test` then `null`.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns.js
git commit -m "feat(v30): campaigns localStorage store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 19: Campaign generation flow

**Files:**
- Create: `src/features/campaign-generator.js`

**Interfaces:**
- Consumes: `renderTargetsToFiles`, `CAMPAIGN_TARGETS` (Task 16), `renderSetPanels` (`src/features/screenshot-set.js`), `renderTimelineBlob` (Task 17), `saveCampaign` (Task 18), `applyBrand` (Plan 01), `serializeFull`/`applyPayload` (`src/state/serialize.js` + `pages.js`), `state`, `saveStateToHistory`, `render`, `showNotification`.
- Produces:
  - `generateCampaign({ name, prompt, includeAppStore, includeTeaser }) => Promise<{ id }|null>` — builds the base design, renders all assets, caches full bytes in-session, saves the campaign record, returns its id.
  - `getSessionAssets(id) => Record<string, Uint8Array>|null` — the in-session full-res byte cache (used by Task 20's download before regeneration is needed).

- [ ] **Step 1: Create the generator**

Create `src/features/campaign-generator.js`:
```js
// v30 — Campaign Generator. One design → a coordinated asset set saved as a
// Campaign folder. Reuses the current framed screenshot as the base, applies the
// active brand, optionally runs an art-director prompt pass, then renders every
// target (renderTargetsToFiles), the App Store set (renderSetPanels), and a
// teaser (renderTimelineBlob). Full bytes are cached for this session; the saved
// record stores the design payload + thumbnails so assets regenerate later.

import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { serializeFull } from '../state/serialize.js';
import { renderTargetsToFiles, CAMPAIGN_TARGETS } from './campaign-targets.js';
import { renderSetPanels } from './screenshot-set.js';
import { renderTimelineBlob } from './timeline-export.js';
import { applyBrand } from './brand-brain.js';
import { saveCampaign } from './campaigns.js';

const sessionAssets = new Map(); // id -> { name: Uint8Array }

export function getSessionAssets(id) {
  return sessionAssets.get(id) || null;
}

function uid() { return 'cmp_' + Math.random().toString(36).slice(2, 10); }

async function blobToU8(blob) { return new Uint8Array(await blob.arrayBuffer()); }

export async function generateCampaign({ name, prompt, includeAppStore = true, includeTeaser = false }) {
  if (!state.image) { showNotification('Load a screenshot first.', 'error'); return null; }
  saveStateToHistory(); // the base-design mutation is one undo step

  // 1) Base design: apply the active brand, then an optional art-director pass.
  if (state.brand && state.brand.enabled) applyBrand();
  if (prompt && prompt.trim()) {
    try {
      const ad = await import('./ai-art-director.js');
      // Reuse whatever single-prompt entry the module exposes. Read the file to
      // confirm the export name; call it with the prompt. Tolerate absence.
      if (typeof ad.applyFromPrompt === 'function') await ad.applyFromPrompt(prompt);
      else if (typeof ad.generate === 'function') await ad.generate(prompt);
    } catch (e) { console.warn('Art-director pass skipped:', e); }
  }
  render();

  const id = uid();
  const files = {};
  const thumbs = [];

  // 2) Hero + social targets.
  showNotification('Rendering social & hero…', 'success');
  const t = await renderTargetsToFiles();
  Object.assign(files, t.files);
  thumbs.push(...t.thumbs);

  // 3) App Store set (each panel already device-framed + captioned).
  let appStore = false;
  if (includeAppStore && state.screenshotSet && state.screenshotSet.panels.length) {
    showNotification('Rendering App Store set…', 'success');
    const panels = await renderSetPanels();
    for (const p of panels) files[`appstore/${p.name}`] = await blobToU8(p.blob);
    appStore = panels.length > 0;
  }

  // 4) Teaser video (only when the timeline has motion).
  let hasTeaser = false;
  if (includeTeaser) {
    showNotification('Rendering teaser…', 'success');
    const blob = await renderTimelineBlob('mp4');
    if (blob) { files['teaser/teaser.mp4'] = await blobToU8(blob); hasTeaser = true; }
  }

  // 5) Cache full bytes for this session; persist the recipe + thumbnails.
  sessionAssets.set(id, files);
  const ok = saveCampaign({
    id, name: name || 'Campaign', createdAt: Date.now(),
    brandName: state.brand?.name || '',
    payload: serializeFull(),
    targets: CAMPAIGN_TARGETS.slice(),
    appStore, hasTeaser, thumbs
  });
  if (!ok) return null;
  showNotification(`Campaign “${name || 'Campaign'}” ready.`, 'success');
  if (typeof window.__refreshCampaigns === 'function') window.__refreshCampaigns();
  return { id };
}
```
> Read `ai-art-director.js` to confirm its single-prompt export name and adjust the two `typeof ad.*` checks to match (the fallbacks already degrade gracefully if neither exists).

- [ ] **Step 2: Verify build + a no-prompt generation**

Run: `npm run build` → succeeds.
Run `npm run dev`, load a screenshot, console:
```js
const g = await import('/src/features/campaign-generator.js');
const r = await g.generateCampaign({ name: 'Smoke', includeAppStore: true, includeTeaser: false });
console.log(r.id, Object.keys(g.getSessionAssets(r.id))); // id + file keys (hero/social[/appstore])
const c = await import('/src/features/campaigns.js');
console.log(c.getCampaign(r.id).thumbs.length); // ≥4
```
Expected: an id, a list of file keys, ≥4 thumbnails.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaign-generator.js
git commit -m "feat(v30): campaign generation flow (base design -> assets -> save)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 20: Campaign folder UI + ZIP download + reopen

**Files:**
- Modify: `src/features/campaigns.js` (add the folder UI + download + reopen + `bindCampaigns`)
- Modify: `editor/index.html` (Campaigns section, Project group)

**Interfaces:**
- Consumes: `loadCampaigns`, `getCampaign` (Task 18), `getSessionAssets`, generation re-render via the stored `payload`, `renderTargetsToFiles`/`renderSetPanels` for regeneration, `downloadZip` (`src/features/batch-export.js`), `applyPayload` (the page payload applier — confirm its export in `pages.js`/`serialize.js`).
- Produces: `bindCampaigns()`, `refreshCampaigns()` (also exposed as `window.__refreshCampaigns`).

- [ ] **Step 1: Add the markup**

In `editor/index.html`, in a `data-group="project"` area (near the Projects/Pages sections), add:
```html
<div class="sidebar-section" data-group="project">
  <div class="section-title">Campaigns</div>
  <div class="section-body">
    <p class="hint">One design → a full set of assets. Generate, revisit, re-download.</p>
    <div class="row">
      <input type="text" id="campaign-name" placeholder="Campaign name" />
    </div>
    <div class="row">
      <input type="text" id="campaign-prompt" placeholder="Art direction (optional)" />
    </div>
    <label class="checkbox-row"><input type="checkbox" id="campaign-appstore" checked /> Include App Store set</label>
    <label class="checkbox-row"><input type="checkbox" id="campaign-teaser" /> Include teaser video (needs motion)</label>
    <div class="row"><button id="campaign-generate" class="btn btn-primary">Generate campaign</button></div>
    <div id="campaign-list" class="campaign-list"></div>
  </div>
</div>
```

- [ ] **Step 2: Add the UI logic + download + reopen**

Append to `src/features/campaigns.js`:
```js
import { downloadZip } from './batch-export.js';

const $ = (id) => document.getElementById(id);

// Re-render every asset for a saved campaign from its stored design payload.
// Used when the in-session byte cache is gone (e.g. after a reload).
async function regenerateFiles(record) {
  const { applyPayload } = await import('./pages.js'); // confirm export name
  const { renderTargetsToFiles } = await import('./campaign-targets.js');
  const { renderSetPanels } = await import('./screenshot-set.js');
  const { state } = await import('../state/state.js');
  const { render } = await import('../render/render.js');
  const { saveStateToHistory } = await import('../state/history.js');

  saveStateToHistory();
  applyPayload(record.payload); // restores image + design from the saved envelope
  render();

  const files = {};
  const t = await renderTargetsToFiles();
  Object.assign(files, t.files);
  if (record.appStore && state.screenshotSet?.panels.length) {
    const panels = await renderSetPanels();
    for (const p of panels) files[`appstore/${p.name}`] = new Uint8Array(await p.blob.arrayBuffer());
  }
  return files;
}

async function downloadCampaign(id) {
  const { getSessionAssets } = await import('./campaign-generator.js');
  const record = getCampaign(id);
  if (!record) return;
  let files = getSessionAssets(id);
  if (!files) {
    showNotification('Regenerating assets from the saved design…', 'success');
    files = await regenerateFiles(record);
  }
  await downloadZip(files, `${(record.name || 'campaign').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.zip`);
}

export function refreshCampaigns() {
  const list = $('campaign-list');
  if (!list) return;
  const all = Object.values(loadCampaigns()).sort((a, b) => b.createdAt - a.createdAt);
  if (!all.length) { list.innerHTML = '<p class="info-text">No campaigns yet.</p>'; return; }
  list.innerHTML = all.map(c => `
    <div class="campaign-card" data-id="${c.id}">
      <div class="campaign-card-head">
        <strong>${c.name}</strong>
        <span class="info-text">${c.thumbs.length} assets${c.hasTeaser ? ' + video' : ''}</span>
      </div>
      <div class="campaign-thumbs">
        ${c.thumbs.map(t => `<img src="${t.dataUrl}" title="${t.role}" class="campaign-thumb" />`).join('')}
      </div>
      <div class="row">
        <button class="btn btn-sm campaign-download">Download ZIP</button>
        <button class="btn btn-sm campaign-delete">Delete</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.campaign-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('.campaign-download')?.addEventListener('click', () => downloadCampaign(id));
    card.querySelector('.campaign-delete')?.addEventListener('click', () => {
      if (confirm('Delete this campaign?')) { deleteCampaign(id); refreshCampaigns(); }
    });
  });
}

export function bindCampaigns() {
  $('campaign-generate')?.addEventListener('click', async () => {
    const { generateCampaign } = await import('./campaign-generator.js');
    await generateCampaign({
      name: $('campaign-name')?.value?.trim() || 'Campaign',
      prompt: $('campaign-prompt')?.value?.trim() || '',
      includeAppStore: !!$('campaign-appstore')?.checked,
      includeTeaser: !!$('campaign-teaser')?.checked
    });
    refreshCampaigns();
  });
  window.__refreshCampaigns = refreshCampaigns;
  refreshCampaigns();
}
```
> Confirm the page-payload applier's export name in `pages.js` (the function that does `Object.assign(state, payload.design)` + restores the image — referenced in CLAUDE.md as `applyPayload`). If it's named differently, update the dynamic import in `regenerateFiles`.

- [ ] **Step 3: Wire into `main.js`**

Add imports near the other Project-group binds (around line 51, by `bindProjects`):
```js
import { bindCampaigns } from './features/campaigns.js';
import { bindCampaignGenerator } from './features/campaign-generator.js';
```
> `campaign-generator.js` has no standalone bind (its button is wired by `bindCampaigns`). Add a no-op `export function bindCampaignGenerator() {}` to it for symmetry, OR skip this import and only call `bindCampaigns()`. Simpler: only import + call `bindCampaigns()`.

Call in `init()` near `bindProjects();`:
```js
  bindProjects();
  bindCampaigns();
```

- [ ] **Step 4: Add Cmd-K command**

In `src/features/palette.js` `registerCommands()`:
```js
    { id: 'campaign-generate', label: 'Generate Campaign', icon: '📦', group: groupFor('campaign-generate'),
      run: () => import('./campaign-generator.js').then(m => m.generateCampaign({ name: 'Campaign', includeAppStore: true })),
      when: () => !!state.image },
```

- [ ] **Step 5: Full end-to-end verification**

Run `npm run dev`:
1. Open **Project** group → "Campaigns" section appears.
2. Load a screenshot, (optionally set up an App Store set + a brand), click **Generate campaign** → a card appears with thumbnails.
3. **Download ZIP** → a ZIP downloads; unzip → `hero/`, `social/` (3 files), and `appstore/` (if a set existed) with correctly-sized PNGs.
4. **Teaser:** add motion, tick "Include teaser video", regenerate → the ZIP includes `teaser/teaser.mp4`.
5. **Persistence:** reload the page → the campaign card is still there; click Download → it regenerates assets from the saved payload and downloads.
6. **Delete** removes the card.
7. **Cmd-K** "Generate Campaign" works.
8. `npm run build` → succeeds.

- [ ] **Step 6: Commit + push**

```bash
git add editor/index.html src/features/campaigns.js src/main.js src/features/palette.js
git commit -m "feat(v30): Campaign folder UI, ZIP download, reopen + Cmd-K

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
git push -u origin claude/v30-feature-brainstorm-qidm1d
```

---

## Task 21 (optional): Supabase campaign mirror

**Files:**
- Modify: `src/features/campaigns.js` (publish/browse, gated behind sign-in)
- Reference: `src/features/gallery.js` (mirror the `from('gallery')` insert/select pattern)

**Interfaces:**
- Produces: `publishCampaign(id)` / `pullCampaigns()` reusing the Supabase client accessor `gallery.js` uses (`getClient()` / `getUser()`), against a `campaigns` table `{ user_id, name, config, preview_url, created_at }`. localStorage remains the offline source of truth; the mirror is additive.

- [ ] **Step 1: Add the optional mirror** (only if a Supabase project is configured)

Mirror `gallery.js`'s publish: upload the hero thumbnail to a Storage bucket, `client.from('campaigns').insert({ user_id, name, config: record, preview_url })`; pull via `client.from('campaigns').select('id,name,config,preview_url,created_at').eq('user_id', user.id)`. Merge pulled records into the local store on sign-in. Guard every call: no client / no user → silently skip (offline-first).

- [ ] **Step 2: Verify build** → `npm run build` succeeds (the code path is inert without Supabase env).

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns.js
git commit -m "feat(v30): optional Supabase campaign mirror (gallery pattern)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Self-Review (against the spec — Pillar 3)

**Spec coverage:**
- MVP output set: hero + 3 social → Task 16; App Store set via `renderSetPanels` → Task 19; teaser MP4 via `renderTimelineBlob` → Tasks 17, 19. ✓
- Multi-size render via `renderAtSize` → Task 16. ✓
- Brand-consistent (applyBrand before render) → Task 19. ✓
- Persistent in-app Campaign folder (localStorage, quota-safe recipe+thumbs) → Tasks 18, 20. ✓
- Re-download as ZIP via `downloadZip`; regenerate from saved payload → Task 20. ✓
- Reopen/regenerate from payload → Task 20. ✓
- Optional Supabase mirror (gallery pattern) → Task 21. ✓
- Cmd-K + Project-group panel → Task 20. ✓

**Deferred (out of scope, per spec):** per-platform copy variants, A/B seeds, scheduled/bulk runs.

**Placeholder scan:** none — concrete code/commands throughout. The "confirm export name" notes (`applyPayload` in `pages.js`, art-director entry, `renderTimelineBlob` restore body) are explicit read-then-match instructions at the integration site, not vague placeholders.

**Type consistency:** `renderTargetsToFiles` returns `{files: Record<string,Uint8Array>, thumbs:[{role,dataUrl}]}` (Task 16), consumed identically in Task 19. `Campaign` record fields written in Task 19 (`saveCampaign`) match those read in Task 20 (`refreshCampaigns`/`downloadCampaign`). `renderSetPanels()` returns `[{name,blob}]` (verified) and is consumed as such. `downloadZip(files, filename)` takes `{name→Uint8Array}` (verified) — matches `files`.
