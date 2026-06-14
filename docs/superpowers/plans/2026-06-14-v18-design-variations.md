# v18 "Design Variations" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Design Variations" generator that produces ~4 styled presentations of the loaded screenshot as preview cards; clicking one applies it to the canvas undoably. Deterministic only (no AI) — it is the reusable foundation for the v19/v20 AI arc.

**Architecture:** A new `src/state/spec.js` defines a presentation-only **Design Spec** and a validated `applySpec(spec)` that maps it to `state`. A new `src/features/compose.js` generates candidate specs from curated **recipes**, renders each to a thumbnail by the snapshot→applySpec→`renderInto`(offscreen)→`toDataURL`→restore technique, and applies the chosen spec. UI is a new dark-studio sidebar section with a "Generative" spectrum-gradient signature.

**Tech Stack:** Vanilla JS + Vite (no framework, no test runner). Verification is `npm run build` + manual in-browser via `npm run dev`. Reuses `renderInto` (`src/render/render.js:47`), presets (`src/state/presets.js`), history (`src/state/history.js`), notifications (`src/ui/notification.js`).

> **Project note — no test runner:** This repo has no test framework (CLAUDE.md). "Tests" here are `npm run build` (must succeed) plus the explicit manual checks in each task. Do not add a test framework.

> **Spec note — colorMap deferred in recipes:** The spec mentioned a "Duotone" recipe using the v17 color-map. The v17 color-map requires a saved palette in the user's library, which most users won't have, and writing a transient palette would pollute their library. So v18 recipes do NOT emit `spec.color`; the cinematic/graded look is achieved with art-filter presets (incl. v17 temperature/tint) instead. `applySpec` still fully supports `spec.color` for the v19/v20 path. The "Duotone" family is replaced by a "Cinematic" family.

---

## File Structure

- **Create `src/state/spec.js`** — Design Spec schema docs + `applySpec(spec)` (validated, presentation-only state applier). The backbone reused by v19 AI + v20 agent.
- **Create `src/features/compose.js`** — `bindCompose()`: recipes, deterministic spec generation, offscreen thumbnail rendering, variant gallery, undoable apply.
- **Modify `editor/index.html`** — new "Design Variations" sidebar section.
- **Modify `src/styles.css`** — scoped "Generative" CSS (gradient button, variant grid, animated card border).
- **Modify `src/ui/elements.js`** — register the new control ids.
- **Modify `src/main.js`** — import + call `bindCompose()`.
- **Modify `package.json`, `src/features/whats-new.js`** — version bump + what's-new.
- **Modify `changelog/index.html`** — v18 entry via the frontend taste skill (own motif).

---

## Task 1: Design Spec applier (`src/state/spec.js`)

**Files:**
- Create: `src/state/spec.js`

- [ ] **Step 1: Create the file with the full applier**

```javascript
// v18 — Design Spec: a presentation-only description of how the screenshot is
// styled, plus a validated applier. This is the backbone of the AI arc — v18's
// recipes, v19's AI, and the v20 agent all emit specs and call applySpec().
//
// A Design Spec (all fields optional):
//   {
//     bg:     { mode:'gradient'|'mesh'|'solid'|'pattern',
//               gradient:{colors:[...], type, angle}, mesh:[...hex],
//               solid:'#hex', pattern:{type,fg,bg,size,angle} },
//     frame:  { type:<deviceFrame.type>|null, color:<finish> },
//     layout: { padding, scale, borderRadius },
//     shadow: <shadowPresets key>,
//     filter: <artFilterPresets key>,            // includes v17 temperature/tint
//     color:  { mode, paletteId, intensity, steps } | null   // v17 colorMap (v19+)
//   }
// Presentation only: never touches state.image, canvas size, annotations, text,
// or motion. Every field is validated; invalid values fall back to a safe
// default so a malformed spec can never corrupt state.

import { state } from './state.js';
import { gradientPresets, meshPresets, shadowPresets, artFilterPresets } from './presets.js';

const BG_MODES = ['gradient', 'mesh', 'solid', 'pattern'];
const PATTERN_TYPES = ['dots', 'grid', 'lines', 'checker', 'diagonal'];
const FRAME_TYPES = [null, 'iphone', 'iphone16pro', 'ipadpro', 'macbookpro', 'watch', 'studiodisplay', 'pixel', 'winlaptop', 'chrome', 'safari', 'firefox', 'macos', 'windows'];
const FRAME_COLORS = ['dark', 'graphite', 'light', 'silver', 'titanium', 'gold'];
const COLOR_MODES = ['off', 'gradient', 'recolor', 'transfer'];

function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
function oneOf(v, list, dflt) { return list.includes(v) ? v : dflt; }

export function applySpec(spec) {
  if (!spec || typeof spec !== 'object') return;

  // ---- Background ----
  if (spec.bg && typeof spec.bg === 'object') {
    const mode = oneOf(spec.bg.mode, BG_MODES, 'gradient');
    state.bgMode = mode;
    if (mode === 'gradient' && spec.bg.gradient) {
      const g = spec.bg.gradient;
      if (Array.isArray(g.colors) && g.colors.length >= 2) {
        state.gradient.colors = g.colors.slice(0, 4);
        state.gradient.positions = state.gradient.colors.map((_, i, a) => Math.round(i / (a.length - 1) * 100));
      }
      state.gradient.type = oneOf(g.type, ['linear', 'radial'], state.gradient.type);
      state.gradient.angle = clamp(g.angle, 0, 360, state.gradient.angle);
    } else if (mode === 'mesh' && Array.isArray(spec.bg.mesh) && spec.bg.mesh.length >= 1) {
      const positions = [{ x: 0.20, y: 0.25 }, { x: 0.80, y: 0.30 }, { x: 0.30, y: 0.80 }, { x: 0.85, y: 0.85 }];
      state.meshGradient.points = positions.map((p, i) => ({ x: p.x, y: p.y, color: spec.bg.mesh[i % spec.bg.mesh.length], radius: 0.55 }));
    } else if (mode === 'solid' && typeof spec.bg.solid === 'string') {
      state.bgColor = spec.bg.solid;
    } else if (mode === 'pattern' && spec.bg.pattern) {
      const p = spec.bg.pattern;
      state.pattern.type = oneOf(p.type, PATTERN_TYPES, state.pattern.type);
      if (typeof p.fg === 'string') state.pattern.fg = p.fg;
      if (typeof p.bg === 'string') state.pattern.bg = p.bg;
      state.pattern.size = clamp(p.size, 4, 200, state.pattern.size);
      state.pattern.angle = clamp(p.angle, 0, 360, state.pattern.angle);
    }
  }

  // ---- Frame ----
  if (spec.frame && typeof spec.frame === 'object') {
    state.deviceFrame.type = oneOf(spec.frame.type, FRAME_TYPES, null);
    state.deviceFrame.color = oneOf(spec.frame.color, FRAME_COLORS, state.deviceFrame.color);
  }

  // ---- Layout ----
  if (spec.layout && typeof spec.layout === 'object') {
    state.padding = clamp(spec.layout.padding, 0, 300, state.padding);
    state.scale = clamp(spec.layout.scale, 20, 200, state.scale);
    state.borderRadius = clamp(spec.layout.borderRadius, 0, 80, state.borderRadius);
  }

  // ---- Shadow preset ----
  if (typeof spec.shadow === 'string' && shadowPresets[spec.shadow]) {
    Object.assign(state.shadow, shadowPresets[spec.shadow]);
  }

  // ---- Filter preset (art filter, incl. v17 temperature/tint) ----
  if (typeof spec.filter === 'string' && artFilterPresets[spec.filter]) {
    state.imageFilters = { ...artFilterPresets[spec.filter] };
  }

  // ---- Color map (v17), optional — used by v19+ ----
  if (spec.color && typeof spec.color === 'object') {
    state.colorMap.mode = oneOf(spec.color.mode, COLOR_MODES, 'off');
    if (spec.color.paletteId && state.colorPalettes.library[spec.color.paletteId]) {
      state.colorPalettes.active = spec.color.paletteId;
    }
    state.colorMap.intensity = clamp(spec.color.intensity, 0, 100, state.colorMap.intensity);
    state.colorMap.steps = clamp(spec.color.steps, 0, 16, state.colorMap.steps);
  } else {
    state.colorMap.mode = 'off';
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: `✓ built` with no errors (the module imports resolve; `applySpec` is unused so far, which is fine).

- [ ] **Step 3: Commit**

```bash
git add src/state/spec.js
git commit -m "feat(v18): Design Spec applier (applySpec) — AI-arc backbone"
```

---

## Task 2: Composer feature (`src/features/compose.js`)

**Files:**
- Create: `src/features/compose.js`

- [ ] **Step 1: Create the file with recipes, generation, gallery, and apply**

```javascript
// v18 — Design Variations (Composer foundation).
//
// One-click generator: builds N candidate Design Specs from curated recipes,
// renders each to a thumbnail off-screen, and shows them as a pick-one gallery.
// Deterministic (no AI). Recipes draw tasteful, coherent combos from the
// existing preset/palette library so results look designed, not random. The
// spec applier (state/spec.js) and this gallery are reused by the v19 AI and
// the v20 agent.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render, renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { applySpec } from '../state/spec.js';
import { gradientPresets, meshPresets } from '../state/presets.js';

const N = 4;                    // variants per generation
const THUMB_MAX_EDGE = 400;     // thumbnail long-edge px

const GRAD_KEYS = Object.keys(gradientPresets);
const MESH_KEYS = Object.keys(meshPresets);
const FRAMES = ['iphone16pro', 'macbookpro', 'pixel', 'winlaptop', 'chrome', 'safari'];
const PATTERNS = ['dots', 'grid', 'lines', 'checker', 'diagonal'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Each recipe returns a Design Spec with a human name. Bounded randomization
// keeps variety while staying tasteful.
const RECIPES = {
  'Soft Gradient': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Soft Gradient', bg: { mode: 'gradient', gradient: { colors: [...g.colors], type: 'linear', angle: pick([120, 135, 160, 200]) } }, frame: { type: null }, layout: { padding: pick([60, 80, 100]), scale: 100, borderRadius: pick([12, 16, 20]) }, shadow: pick(['soft', 'medium']), filter: 'none' };
  },
  'Bold Mesh': () => {
    const m = meshPresets[pick(MESH_KEYS)];
    return { name: 'Bold Mesh', bg: { mode: 'mesh', mesh: [...m] }, frame: { type: null }, layout: { padding: pick([70, 90]), scale: 100, borderRadius: pick([14, 18, 24]) }, shadow: 'medium', filter: pick(['none', 'vivid']) };
  },
  'Clean Solid': () => {
    const solids = ['#0b0d14', '#11131c', '#1a1a2e', '#f4f4f6', '#e7e7ea', '#101317'];
    return { name: 'Clean Solid', bg: { mode: 'solid', solid: pick(solids) }, frame: { type: null }, layout: { padding: pick([80, 100, 120]), scale: 100, borderRadius: pick([10, 14]) }, shadow: pick(['soft', 'hard']), filter: 'none' };
  },
  'Device Hero': () => {
    const bg = pick([
      { mode: 'gradient', gradient: { colors: [...gradientPresets[pick(GRAD_KEYS)].colors], type: 'linear', angle: 135 } },
      { mode: 'mesh', mesh: [...meshPresets[pick(MESH_KEYS)]] }
    ]);
    return { name: 'Device Hero', bg, frame: { type: pick(FRAMES), color: pick(['dark', 'graphite', 'silver', 'titanium']) }, layout: { padding: pick([50, 70]), scale: 100, borderRadius: 0 }, shadow: 'medium', filter: 'none' };
  },
  'Pattern Pop': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Pattern Pop', bg: { mode: 'pattern', pattern: { type: pick(PATTERNS), fg: g.colors[0], bg: g.colors[1], size: pick([20, 28, 36]), angle: pick([0, 45]) } }, frame: { type: null }, layout: { padding: pick([70, 90]), scale: 100, borderRadius: pick([12, 18]) }, shadow: 'soft', filter: 'none' };
  },
  'Cinematic': () => {
    const g = gradientPresets[pick(GRAD_KEYS)];
    return { name: 'Cinematic', bg: { mode: 'gradient', gradient: { colors: [...g.colors], type: pick(['linear', 'radial']), angle: pick([135, 180, 200]) } }, frame: { type: null }, layout: { padding: pick([60, 80]), scale: 100, borderRadius: pick([14, 20]) }, shadow: 'medium', filter: pick(['tealorange', 'moody', 'golden', 'bleach', 'vintage']) };
  }
};
const RECIPE_NAMES = Object.keys(RECIPES);

function generateSpecs(n) {
  const names = [...RECIPE_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map(name => RECIPES[name]());
}

// Snapshot/restore only the keys applySpec touches, so previewing a candidate
// never disturbs the user's real design.
const SPEC_KEYS = ['bgMode', 'gradient', 'meshGradient', 'bgColor', 'pattern', 'deviceFrame', 'padding', 'scale', 'borderRadius', 'shadow', 'imageFilters', 'colorMap'];
function snapshotKeys() {
  const s = {};
  for (const k of SPEC_KEYS) s[k] = JSON.parse(JSON.stringify(state[k]));
  s.activePalette = state.colorPalettes.active;
  return s;
}
function restoreKeys(s) {
  for (const k of SPEC_KEYS) state[k] = s[k];
  state.colorPalettes.active = s.activePalette;
}

// Render a candidate spec to a thumbnail dataURL via the real render pipeline.
// Returns null if the canvas is tainted (cross-origin image) — caller shows a
// solid fallback tile.
function renderThumb(spec) {
  const snap = snapshotKeys();
  let url = null;
  try {
    applySpec(spec);
    const off = document.createElement('canvas');
    renderInto(off, true);                       // sizes itself to state.canvas
    const r = Math.min(1, THUMB_MAX_EDGE / Math.max(off.width, off.height));
    const tw = Math.max(1, Math.round(off.width * r));
    const th = Math.max(1, Math.round(off.height * r));
    const thumb = document.createElement('canvas');
    thumb.width = tw; thumb.height = th;
    thumb.getContext('2d').drawImage(off, 0, 0, tw, th);
    url = thumb.toDataURL('image/png');
  } catch (e) {
    url = null;
  } finally {
    restoreKeys(snap);
  }
  return url;
}

function fallbackColor(spec) {
  if (spec.bg?.solid) return spec.bg.solid;
  if (spec.bg?.gradient?.colors?.[0]) return spec.bg.gradient.colors[0];
  if (spec.bg?.mesh?.[0]) return spec.bg.mesh[0];
  if (spec.bg?.pattern?.bg) return spec.bg.pattern.bg;
  return '#1a1a2e';
}

function applyVariant(spec, card) {
  saveStateToHistory();
  applySpec(spec);
  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
  el.varyGrid.querySelectorAll('.vary-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  showNotification(`Applied "${spec.name}".`, 'success');
}

function renderGallery(specs) {
  if (!el.varyGrid) return;
  el.varyGrid.innerHTML = '';
  specs.forEach(spec => {
    const url = renderThumb(spec);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vary-card';
    card.innerHTML = url
      ? `<img src="${url}" alt="${spec.name} variation"><span class="vary-card-label">${spec.name}</span>`
      : `<span class="vary-card-fallback" style="background:${fallbackColor(spec)}"></span><span class="vary-card-label">${spec.name}</span>`;
    card.addEventListener('click', () => applyVariant(spec, card));
    el.varyGrid.appendChild(card);
  });
  if (el.varyShuffle) el.varyShuffle.style.display = 'block';
}

function generate() {
  if (!state.image) { showNotification('Load an image first.', 'error'); return; }
  renderGallery(generateSpecs(N));
}

export function bindCompose() {
  el.varyGenerate?.addEventListener('click', generate);
  el.varyShuffle?.addEventListener('click', generate);
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: `✓ built` with no errors. (If the build complains that `renderInto` is not exported, confirm `src/render/render.js:47` has `export function renderInto` — it does in this codebase.)

- [ ] **Step 3: Commit**

```bash
git add src/features/compose.js
git commit -m "feat(v18): Composer — recipes, variant gallery, undoable apply"
```

---

## Task 3: Sidebar UI (`editor/index.html`)

**Files:**
- Modify: `editor/index.html` (insert a new section between the "Image Editing" section and the "Text & Annotations" section)

- [ ] **Step 1: Insert the Design Variations section**

Find the closing `</div>` of the Image Editing section, immediately before `<div class="sidebar-section">` that contains `<h3 class="section-title">Text &amp; Annotations</h3>`. Insert this block between them:

```html
        <!-- v18 — Design Variations: one-click styled looks for the screenshot.
             Foundation of the AI arc (v19 adds prompts, v20 the agent). -->
        <div class="sidebar-section">
            <h3 class="section-title">Design Variations <span style="font-size:11px;color:var(--text-secondary);font-weight:400;">v18</span></h3>
            <p class="info-text" style="margin-bottom:10px;">Generate styled looks for your screenshot, then click one to apply.</p>
            <button class="vary-generate" id="vary-generate">✨ Generate Variations</button>
            <div class="vary-grid" id="vary-grid"></div>
            <button class="btn btn-secondary" id="vary-shuffle" style="width:100%;margin-top:10px;display:none;">🔀 Shuffle again</button>
        </div>
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: `✓ built`. The section appears in `dist/editor/index.html`.

- [ ] **Step 3: Commit**

```bash
git add editor/index.html
git commit -m "feat(v18): Design Variations sidebar section"
```

---

## Task 4: Generative CSS (`src/styles.css`)

**Files:**
- Modify: `src/styles.css` (append the block)

- [ ] **Step 1: Append the scoped styles**

Add this at the end of `src/styles.css`:

```css
/* v18 — Design Variations. "Generative" signature: an animated spectrum
   gradient on the generate button and a moving gradient border on variant
   cards. Honors prefers-reduced-motion. */
.vary-generate {
  width: 100%; border: none; cursor: pointer; color: #fff; font-weight: 600;
  padding: 11px 14px; border-radius: var(--radius-sm); margin-bottom: 12px;
  background: linear-gradient(90deg, #ff5a5a, #ffb14a, #57e39b, #4aa8ff, #8a6bff, #ff5a5a);
  background-size: 220% 100%; animation: vary-sweep 6s linear infinite;
}
.vary-generate:active { transform: translateY(1px); }
@keyframes vary-sweep { to { background-position: 220% 0; } }

.vary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.vary-card {
  position: relative; padding: 0; cursor: pointer; overflow: hidden;
  border: 1px solid var(--border-color); border-radius: 10px;
  background: var(--bg-tertiary); aspect-ratio: 16 / 10;
}
.vary-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
.vary-card-fallback { display: block; width: 100%; height: 100%; }
.vary-card-label {
  position: absolute; left: 6px; bottom: 6px; font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 999px; color: #fff;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.vary-card.active { outline: 2px solid var(--accent-primary); outline-offset: 1px; }
.vary-card::after {
  content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px;
  pointer-events: none; opacity: 0; transition: opacity .25s;
  background: linear-gradient(120deg, #ff5a5a, #4aa8ff, #8a6bff);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.vary-card:hover::after { opacity: 1; }

@media (prefers-reduced-motion: reduce) { .vary-generate { animation: none; } }
```

- [ ] **Step 2: Verify the CSS variables exist**

Run: `npm run build`
Expected: `✓ built`. (The variables `--radius-sm`, `--border-color`, `--bg-tertiary`, `--accent-primary` are already defined in `src/styles.css`; if a build/runtime check shows a missing var, search `src/styles.css` for the `:root` block and use the existing name.)

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(v18): Generative styles for Design Variations"
```

---

## Task 5: Register element ids (`src/ui/elements.js`)

**Files:**
- Modify: `src/ui/elements.js` (add to the `IDS` array)

- [ ] **Step 1: Add the ids**

In `src/ui/elements.js`, find the `IDS` array and add this group (place it near the v17 color block for tidiness):

```javascript
  // v18 — Design Variations
  'vary-generate', 'vary-grid', 'vary-shuffle',
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: `✓ built`. (`initElements()` will map `vary-generate` → `el.varyGenerate`, etc.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/elements.js
git commit -m "feat(v18): register Design Variations element ids"
```

---

## Task 6: Wire `bindCompose()` (`src/main.js`)

**Files:**
- Modify: `src/main.js` (one import + one call)

- [ ] **Step 1: Add the import**

Find `import { bindColorMap } from './features/color-map.js';` and add directly after it:

```javascript
import { bindCompose } from './features/compose.js';
```

- [ ] **Step 2: Add the call in `init()`**

Find the line `bindColorMap();      // v17 — palette-driven color mapping` and add directly after it:

```javascript
  bindCompose();       // v18 — design variations generator
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `http://localhost:<port>/editor/`, load any image, scroll to **Design Variations**, click **Generate Variations**.
Expected: 4 thumbnail cards appear with recipe labels; clicking one restyles the canvas; **Shuffle again** regenerates; Ctrl+Z undoes the apply; sidebar controls (background, padding, etc.) reflect the applied look. With no image loaded, Generate shows a "Load an image first" toast.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat(v18): wire bindCompose into init"
```

---

## Task 7: Release chores — version + what's-new

**Files:**
- Modify: `package.json:4`
- Modify: `src/features/whats-new.js` (CURRENT_VERSION + WHATS_NEW)
- Modify: `editor/index.html` (header version badge + `<title>`)

- [ ] **Step 1: Bump the version**

In `package.json`, change:
```json
  "version": "17.0.0",
```
to:
```json
  "version": "18.0.0",
```

- [ ] **Step 2: Update the what's-new toast**

In `src/features/whats-new.js`, replace the `CURRENT_VERSION` line and the `WHATS_NEW` object with:

```javascript
const CURRENT_VERSION = '18.0';
```

```javascript
const WHATS_NEW = {
  heading: "What's new in v18 — Design Variations",
  items: [
    { title: 'One-click variations',
      desc: 'Generate styled looks for your screenshot, then click a card to apply it. Background, frame, layout, shadow, and color grade, all at once.' },
    { title: 'Shuffle for more',
      desc: 'Not feeling them? Shuffle again for a fresh set. Every variation is fully editable after you apply it, and undoable.' }
  ]
};
```

- [ ] **Step 3: Update the editor header version**

In `editor/index.html`, change `v17.0` to `v18.0` in both the `<title>` (line ~8) and the header `<span>` (line ~32).

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: `✓ built`; footer/version reflect 18.0.0.

- [ ] **Step 5: Commit**

```bash
git add package.json src/features/whats-new.js editor/index.html
git commit -m "chore(v18): bump 18.0.0, whats-new toast"
```

---

## Task 8: Changelog entry (frontend taste skill, own motif)

**Files:**
- Modify: `changelog/index.html`

- [ ] **Step 1: Invoke the taste skill**

Use the `design-taste-frontend` skill. Design read: redesign-preserve of the existing editorial changelog (vanilla CSS, light page, dark spotlight island). v18's distinct motif = a **"generative / variant grid"** look (e.g., a 2×2 grid of mini design tiles in the spotlight, with the spectrum-gradient accent on the generate affordance). It must be distinct from v16 (glass) and v17 (spectrum band). Zero em-dashes; preserve theme/accent/shape locks.

- [ ] **Step 2: Demote the current latest entry**

In `changelog/index.html`, change the current `<li class="entry latest reveal">` (the v17.0 entry) to `<li class="entry reveal">`.

- [ ] **Step 3: Add the v18 entry at the top of `<ul class="log">`**

Insert a new `<li class="entry latest reveal">` for v18.0 with `entry-meta` (`v18.0` + `June 2026`), an `<h2>` like "Design Variations", and a `<ul class="changes">` describing: one-click variations, recipe-driven looks, fully editable + undoable after apply.

- [ ] **Step 4: Refresh the spotlight (SWAP slot)**

Replace the spotlight content (between `<!-- SWAP-START -->` and `<!-- SWAP-END -->`) with a v18 "Design Variations" spotlight using the generative/variant-grid motif from Step 1. Update `.spot-ver` to `v18 · June 2026`. Add scoped CSS (a new `.spotlight-variations` modifier class) rather than editing the v16/v17 spotlight rules.

- [ ] **Step 5: Update meta descriptions**

Update the `<meta name="description">` and `og:description` to mention v18 design variations.

- [ ] **Step 6: Verify it builds**

Run: `npm run build`
Expected: `✓ built`. Open `dist/changelog/index.html` (or `npm run dev` → `/changelog/`) and confirm the v18 spotlight + entry render and read cleanly with no em-dashes.

- [ ] **Step 7: Commit**

```bash
git add changelog/index.html
git commit -m "docs(v18): changelog entry — Design Variations (generative motif)"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: `✓ built` with no errors; PWA precache step completes.

- [ ] **Step 2: Manual pass in `npm run dev`**

Confirm each:
- Generate with a flat-background image AND with a device-frame design → 4 tasteful, non-identical cards.
- Apply a variant → canvas matches the card; export a PNG (Export) → exported image matches the applied look.
- Shuffle again → fresh set; labels correct.
- Undo restores the prior design exactly; redo re-applies.
- After apply, the Background / Image settings / Filters sidebar controls reflect the applied spec.
- No image → Generate toasts "Load an image first."
- Reduced-motion (OS setting) → the Generate button stops animating.

- [ ] **Step 3: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore(v18): final verification pass"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Spec engine (Task 1), recipes + variant gallery + apply (Task 2), UI section (Task 3) + CSS (Task 4) + ids (Task 5) + wiring (Task 6), undo (covered by `saveStateToHistory` in Task 2; no new snapshot keys needed since all touched keys are already in `history.snapshot()`), error handling (no-image toast + tainted-canvas fallback in Task 2), release chores (Task 7), changelog via taste skill (Task 8), verification (Task 9). All spec sections map to a task.
- **Deviation from spec (documented):** recipes use art-filter grades instead of the v17 color-map "Duotone" (palette-dependency / library-pollution); `applySpec` still supports `spec.color` for v19/v20. Noted at top of plan.
- **Type consistency:** `applySpec(spec)` signature and field names (`bg/frame/layout/shadow/filter/color`) are identical across Task 1 (definition), Task 2 (recipes + `renderThumb`/`applyVariant`), and the spec doc. Element ids (`vary-generate`, `vary-grid`, `vary-shuffle`) match across Tasks 2/3/5. `renderInto` import matches `src/render/render.js:47`.
- **No placeholders:** every code step contains complete, runnable code; every command has expected output.
