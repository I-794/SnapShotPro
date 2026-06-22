# V27 Marketing Site Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin all 24 SnapShotPro marketing pages from dark glassmorphism to the "Gallery" editorial-light aesthetic with a refined liquid-glass accent, dual light/dark theming, and a redrawn brand mark.

**Architecture:** Token-first. `public/site.css` reuses the same CSS custom-property *names* on every page, so rewriting `:root` (light) + a `[data-theme="dark"]` block + the shared component classes cascades the new look to all pages at once. The home page is then recomposed section-by-section to the Gallery layout (reference: the signed-off prototype at `docs/superpowers/specs/assets/v27-prototype.html`). Per-page work is mostly verification that the cascade landed, plus spot-fixes for any page-local dark assumptions.

**Tech Stack:** Vanilla JS + Vite (no framework). Shared `public/site.css`, `public/site.js`, HTML partials in `site/partials/` injected by the `html-partials` plugin in `vite.config.js`. Self-hosted fonts.

## Global Constraints

- **Version:** bump `package.json` `version` to `27.0.0` (drives footer `{{VERSION}}` + what's-new toast). Verbatim: `"version": "27.0.0"`.
- **No test runner / linter exists.** Verify every task with `npm run dev` (visual, in-browser) and `npm run build` (must succeed, no console errors). There are no unit tests to write.
- **Single accent, locked:** light `--accent:#2348FF`, dark `--accent:#5B82FF`. No second accent anywhere, no glow.
- **Zero em-dashes (`—`) or en-dash separators (`–`)** in any visible copy added or edited. Use periods, commas, or `-`.
- **Dual theme:** every surface must work in light (default) and dark via tokens. No section flips theme mid-page.
- **Preserve for SEO / muscle memory / analytics (redesign-protocol 11.F):** URL slugs, nav link labels + hrefs, section anchor IDs, the `#mark` symbol id, the `.scrolled` / `.reveal` / `--mx`/`--my` / `[data-tilt]` hooks consumed by `public/site.js`.
- **a11y:** `:focus-visible` rings on interactive elements; WCAG AA contrast in both modes; glass degrades to solid under `prefers-reduced-transparency: reduce`.

## File structure (what changes)

- `public/site.css` — token block (light + dark), component reskin, new `.frame`/`.art`, theme-toggle + focus styles, retire aurora/grad-text glow. (largest change)
- `public/site.js` — add theme-toggle module; keep existing hooks.
- `site/partials/mark.html` — redraw mark (solid cobalt).
- `site/partials/nav.html` — add theme-toggle button + `aria-current` active-link support.
- `site/partials/footer.html` — re-theme only (markup mostly unchanged).
- `index.html` — full home recomposition to Gallery layout.
- Per-page `*/index.html` (23 pages) — verify cascade, spot-fix dark-local CSS, swap any em-dashes, ensure framed visuals use real screenshots.
- `public/favicon.svg`, `public/pwa-192.svg`, `public/pwa-512.svg`, `public/pwa-512-maskable.svg`, `public/og.png` — rebrand.
- `<head>` `theme-color` meta across pages.
- `package.json` — version bump.
- `CLAUDE.md` — note reserving editor rebrand for V30.

---

### Task 1: Design tokens — light defaults, dark variant, retire aurora

**Files:**
- Modify: `public/site.css:9-46` (the `:root` block), `:54-62` (`body::before` aurora), `:154-158` (reduced-transparency block), `:160-181` (aurora keyframes + grad-text).

**Interfaces:**
- Produces: the full token vocabulary every other task and page consumes — names unchanged (`--bg`, `--bg-2`, `--bg-raise`, `--bg-sunken`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--line-strong`, `--glass`, `--glass-2`, `--glass-line`, `--glass-hi`, `--accent`, `--accent-deep`, `--accent-press`, `--accent-soft`, `--accent-line`, `--on-accent`, radii, shadows, fonts, `--ease`), plus new `--shadow-art`.

- [ ] **Step 1: Replace the `:root` token values (light theme)**

In `public/site.css`, replace the `:root { ... }` block (lines 9-46) with:

```css
:root {
    /* Editorial light — warm paper, never pure white */
    --bg: #F6F5F1;
    --bg-2: #FFFFFF;
    --bg-raise: #FFFFFF;       /* raised card surface (name kept for page CSS) */
    --bg-sunken: #EFEDE7;
    --ink: #111111;
    --ink-2: #4B4B4B;
    --ink-3: #8A8A85;
    --line: rgba(17, 17, 17, 0.10);
    --line-strong: rgba(17, 17, 17, 0.18);
    /* Frosted surfaces — light glass, used as a rare accent only */
    --glass: rgba(255, 255, 255, 0.55);
    --glass-2: rgba(255, 255, 255, 0.72);
    --glass-line: rgba(255, 255, 255, 0.75);
    --glass-hi: rgba(17, 17, 17, 0.20);
    /* Cobalt — the one and only accent, solid (no glow) */
    --accent: #2348ff;
    --accent-deep: #2348ff;
    --accent-press: #1a37cc;
    --accent-soft: rgba(35, 72, 255, 0.10);
    --accent-line: rgba(35, 72, 255, 0.30);
    --on-accent: #ffffff;

    --r-card: 14px;
    --r-sm: 10px;
    --r-pill: 999px;

    --shadow-sm: 0 1px 2px rgba(17,17,17,0.05), 0 8px 24px rgba(17,17,17,0.08);
    --shadow-lift: 0 2px 6px rgba(17,17,17,0.07), 0 24px 50px -16px rgba(17,17,17,0.18);
    --shadow-product: 0 2px 6px rgba(17,17,17,0.08), 0 50px 100px -34px rgba(17,17,17,0.28);
    --shadow-glass: inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 40px rgba(17,17,17,0.12);
    --shadow-accent: 0 8px 24px rgba(35,72,255,0.22);
    /* The "framed artwork" cast shadow — signature elevation of the site */
    --shadow-art: 0 2px 4px rgba(17,17,17,0.06), 0 30px 60px -20px rgba(17,17,17,0.22);

    --font: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-display: 'Schibsted Grotesk', 'Geist', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
    --ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: Add the dark-theme token override**

Immediately after the `:root` block, add:

```css
/* Dark theme — brand-faithful parity, no pure black. Applied when the user picks
   dark OR when the OS prefers dark and the user has not chosen. site.js sets
   data-theme on <html>; the media query covers the pre-JS / no-JS case. */
html[data-theme="dark"] {
    --bg: #0E1014; --bg-2: #15181F; --bg-raise: #15181F; --bg-sunken: #0A0C10;
    --ink: #F2F3F7; --ink-2: #AEB4C2; --ink-3: #727A8C;
    --line: rgba(255,255,255,0.10); --line-strong: rgba(255,255,255,0.18);
    --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10);
    --glass-line: rgba(255,255,255,0.14); --glass-hi: rgba(255,255,255,0.45);
    --accent: #5B82FF; --accent-deep: #5B82FF; --accent-press: #7c9bff;
    --accent-soft: rgba(91,130,255,0.16); --accent-line: rgba(91,130,255,0.42);
    --shadow-art: 0 2px 6px rgba(0,0,0,0.45), 0 30px 60px -20px rgba(0,0,0,0.6);
    --shadow-glass: inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 50px rgba(0,0,0,0.5);
}
@media (prefers-color-scheme: dark) {
    html:not([data-theme="light"]) {
        --bg: #0E1014; --bg-2: #15181F; --bg-raise: #15181F; --bg-sunken: #0A0C10;
        --ink: #F2F3F7; --ink-2: #AEB4C2; --ink-3: #727A8C;
        --line: rgba(255,255,255,0.10); --line-strong: rgba(255,255,255,0.18);
        --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10);
        --glass-line: rgba(255,255,255,0.14); --glass-hi: rgba(255,255,255,0.45);
        --accent: #5B82FF; --accent-deep: #5B82FF; --accent-press: #7c9bff;
        --accent-soft: rgba(91,130,255,0.16); --accent-line: rgba(91,130,255,0.42);
        --shadow-art: 0 2px 6px rgba(0,0,0,0.45), 0 30px 60px -20px rgba(0,0,0,0.6);
        --shadow-glass: inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 50px rgba(0,0,0,0.5);
    }
}
```

- [ ] **Step 3: Retire the aurora background**

Replace the `body::before` aurora rule (lines ~55-62) with a quiet paper tint, and delete the `auroraDrift` keyframes + its `body::before { animation: ... }` line (~163-164):

```css
body::before {
    content: ''; position: fixed; inset: 0; z-index: -2; pointer-events: none;
    background:
        radial-gradient(60% 50% at 12% 0%, var(--accent-soft), transparent 60%),
        var(--bg);
}
```

Delete lines defining `@keyframes auroraDrift` and `body::before { animation: auroraDrift ... }`.

- [ ] **Step 4: Neutralize the gradient headline**

Replace the `.grad-text` rule (~180-181) and remove `@keyframes gradShift` so the home hero emphasis word renders as solid ink (the home rebuild in Task 6 uses same-family italic instead):

```css
.grad-text { color: var(--ink); font-style: italic; }
```

- [ ] **Step 5: Verify the cascade**

Run: `npm run dev`
Open `http://localhost:5173/` and 2-3 other pages (`/guide/`, `/pricing/`). Expected: pages are now light/warm, text dark, no aurora drift, no console errors. Toggle OS dark mode: pages flip to the dark palette (theme button comes in Task 5). Some component surfaces will still look "off" until Task 3 — that is expected.

- [ ] **Step 6: Commit**

```bash
git add public/site.css
git commit -m "feat(v27): light/dark design tokens, retire aurora"
```

---

### Task 2: Self-host the Schibsted Grotesk display face

**Files:**
- Create: `public/fonts/schibsted-grotesk-700.woff2`, `public/fonts/schibsted-grotesk-800.woff2`
- Modify: `public/site.css` (add `@font-face` near top, after the `*` reset, before `:root` or right after it).

**Interfaces:**
- Produces: the `--font-display` family (`'Schibsted Grotesk'`) referenced by Task 1's token and used by Task 3/6 headline rules.

- [ ] **Step 1: Confirm how existing fonts load (informs the approach)**

Run: `grep -rn "Geist\|fonts.googleapis\|@font-face\|/fonts/" index.html site/partials/*.html public/site.css | head`
Expected: shows whether Geist is loaded via a `<link>` or `@font-face`. Match that mechanism for consistency. (If Geist is `@font-face` self-hosted, self-host Schibsted the same way; if it is a Google `<link>`, you may instead add Schibsted to that link — but self-host is preferred per spec.)

- [ ] **Step 2: Fetch the woff2 files (OFL-licensed)**

```bash
mkdir -p public/fonts
# Schibsted Grotesk is OFL on Google Fonts. Download the 700 + 800 weights as woff2.
# Example (resolve the actual woff2 URLs from the Google Fonts CSS API):
curl -s "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@700;800&display=swap" \
  -H "User-Agent: Mozilla/5.0" -o /tmp/sg.css
grep -oE "https://[^)]+\.woff2" /tmp/sg.css
# then curl each URL to public/fonts/schibsted-grotesk-700.woff2 and -800.woff2
```
Expected: two `.woff2` files in `public/fonts/`. If network is blocked in the environment, fall back to adding `Schibsted+Grotesk:wght@700;800` to the existing Google Fonts `<link>` found in Step 1 and skip the `@font-face`; note the fallback in the commit.

- [ ] **Step 3: Add `@font-face`**

In `public/site.css`, after the `*` reset (line 7), add:

```css
@font-face {
    font-family: 'Schibsted Grotesk'; font-style: normal; font-weight: 700;
    font-display: swap; src: url('/fonts/schibsted-grotesk-700.woff2') format('woff2');
}
@font-face {
    font-family: 'Schibsted Grotesk'; font-style: normal; font-weight: 800;
    font-display: swap; src: url('/fonts/schibsted-grotesk-800.woff2') format('woff2');
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/`. Expected: once Task 3/6 apply `--font-display` to headings, they render in Schibsted Grotesk (inspect computed `font-family`). No 404s for the woff2 in the network panel.

- [ ] **Step 5: Commit**

```bash
git add public/fonts public/site.css
git commit -m "feat(v27): self-host Schibsted Grotesk display face"
```

---

### Task 3: Reskin shared components (light glass, frames, focus, type)

**Files:**
- Modify: `public/site.css` — `.glass` (72-76), `nav`/`.brand`/`.nav-*` (79-91), `.btn*` (94-109), `.page-head` (112-117), `.section-head`/`.head-block` (122-124, 185-187), `.glass-card` (190-195), `.stat*` (198-201), `.feature-cat`/`.fc-visual` (204-207), `.cta-band` (210-214), `.lp-frame`/`.lp-shots` (236-242), `.steps`/`.step` (245-249), `.faq-item`/`.compare`/`.road*`/`.related`/`.prose` (theme-dependent rgba whites), and the `prefers-reduced-transparency` block (154-158).
- Add: new `.frame` / `.art` classes; global `:focus-visible`; `text-wrap: balance` on headings.

**Interfaces:**
- Consumes: tokens from Task 1, `--font-display` from Task 2.
- Produces: `.frame` (artwork wrapper) + `.art` (image holder) classes consumed by Task 6 + the page sweep.

- [ ] **Step 1: Audit hardcoded light-on-dark values**

Run: `grep -n "rgba(255,255,255" public/site.css`
Expected: a list of rules that assume a dark background (e.g. `.lp-frame .bar background: rgba(255,255,255,0.03)`, `.compare thead th`, `.cta-band`). These need tokenized or light-appropriate values in the steps below. Work through each.

- [ ] **Step 2: Reskin nav, brand, buttons, glass utility**

Replace rules so glass reads on light and the primary button is solid cobalt without glow:

```css
.glass {
    background: var(--glass);
    backdrop-filter: blur(var(--glass-blur, 18px)) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    border: 1px solid var(--glass-line); box-shadow: var(--shadow-glass);
}
nav {
    position: sticky; top: 0; z-index: 100; height: 66px; display: flex; align-items: center;
    background: var(--glass); backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border-bottom: 1px solid transparent; transition: border-color .3s, background .3s;
}
nav.scrolled { border-bottom-color: var(--line); }
.nav-link[aria-current="page"] { color: var(--ink); }
.btn-primary { background: var(--accent); color: var(--on-accent); border-radius: var(--r-pill); padding: 11px 22px; font-size: 14.5px; box-shadow: none; }
.btn-primary:hover { background: var(--accent-press); transform: translateY(-1px); box-shadow: var(--shadow-accent); }
.btn-ghost {
    background: transparent; color: var(--ink); border: 1px solid var(--line-strong);
    backdrop-filter: none; -webkit-backdrop-filter: none;
    border-radius: var(--r-pill); padding: 10px 21px; font-size: 14.5px;
}
.btn-ghost:hover { border-color: var(--ink); background: transparent; transform: translateY(-1px); }
```

- [ ] **Step 3: Apply the display face + balance + focus globally**

Add (near the top-level element rules):

```css
h1, h2, h3, .page-head h1, .section-head h2, .head-block h2 { font-family: var(--font-display); text-wrap: balance; letter-spacing: -0.03em; }
a:focus-visible, .btn:focus-visible, summary:focus-visible, button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 3px; border-radius: var(--r-sm);
}
```

- [ ] **Step 4: Add the `.frame` / `.art` signature components**

```css
/* The Frame — every product screenshot hangs as framed art */
.frame { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-card); padding: 12px; box-shadow: var(--shadow-art); }
.frame .art { display: block; border-radius: 8px; overflow: hidden; aspect-ratio: 4 / 3; }
.frame .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Liquid-glass chip — only floats over imagery */
.chip { position: absolute; background: var(--glass); border: 1px solid var(--glass-line); box-shadow: var(--shadow-glass); border-radius: 12px; padding: 10px 13px; font-size: 13px; font-weight: 600; backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }
```

- [ ] **Step 5: Re-theme remaining surfaces and the reduced-transparency fallback**

Tokenize the page-local whites found in Step 1. Examples: `.lp-frame .bar { background: var(--bg-sunken); }`, `.compare thead th { background: var(--bg-sunken); }`, `.lp-shots .shot { background: var(--bg-sunken); }`. Re-theme `.cta-band` to a light-on-cobalt panel:

```css
.cta-band { position: relative; overflow: hidden; border-radius: 24px; padding: clamp(44px,7vw,84px) clamp(28px,6vw,72px); text-align: center; color: var(--ink); background: var(--bg-2); border: 1px solid var(--line); box-shadow: var(--shadow-art); }
.cta-band p { color: var(--ink-2); max-width: 44ch; margin: 0 auto 28px; }
.cta-band .btn-primary { background: var(--accent); color: var(--on-accent); }
.cta-band .btn-primary:hover { background: var(--accent-press); }
```

Update the reduced-transparency block to fall back to solid light surfaces:

```css
@media (prefers-reduced-transparency: reduce) {
    nav, .btn-ghost, .glass, .glass-card, .stat, .glass-interactive, .chip { backdrop-filter: none; -webkit-backdrop-filter: none; }
    nav, .chip { background: var(--bg-2); }
    .glass-card, .stat { background: var(--bg-2); }
}
```

- [ ] **Step 6: Verify across pages**

Run: `npm run dev`. Walk `/`, `/features/`, `/pricing/`, `/guide/`, `/alternatives/` (table), `/faq/` (accordion), `/roadmap/`. Expected in both light and OS-dark: readable text (WCAG AA), solid cobalt CTAs, glass only on nav/chips, no leftover dark-only panels, focus rings visible on tab. Run `npm run build` — must succeed.

- [ ] **Step 7: Commit**

```bash
git add public/site.css
git commit -m "feat(v27): reskin shared components for editorial-light + frames"
```

---

### Task 4: Redraw the brand mark + app icons

**Files:**
- Modify: `site/partials/mark.html`, `public/favicon.svg`, `public/pwa-192.svg`, `public/pwa-512.svg`, `public/pwa-512-maskable.svg`.

**Interfaces:**
- Consumes: nothing. Produces: the `#mark` symbol (id unchanged) used by nav + footer; standalone favicon/PWA SVGs.

- [ ] **Step 1: Redraw the shared symbol (keep `id="mark"` and viewBox)**

Replace the inner SVG of `site/partials/mark.html` with a solid-cobalt aperture mark:

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="mark" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#2348ff"/>
        <rect x="10" y="20" width="44" height="32" rx="5" fill="#fff" opacity="0.16"/>
        <circle cx="32" cy="36" r="10" fill="none" stroke="#fff" stroke-width="3"/>
        <circle cx="32" cy="36" r="4.5" fill="#fff"/>
        <rect x="24" y="13" width="16" height="9" rx="2" fill="#2348ff"/>
    </symbol>
</svg>
```

- [ ] **Step 2: Mirror it into the standalone icons**

Update `public/favicon.svg` and the three `pwa-*.svg` files to the same solid-cobalt mark (scale the geometry to each viewBox; maskable keeps safe padding). Remove the `#667eea→#764ba2` gradient and the red flash dot.

- [ ] **Step 3: Verify**

Run: `npm run dev`. Expected: nav + footer marks render solid cobalt on light; browser tab favicon updated (hard-refresh). `npm run build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add site/partials/mark.html public/favicon.svg public/pwa-192.svg public/pwa-512.svg public/pwa-512-maskable.svg
git commit -m "feat(v27): redraw brand mark + app icons in solid cobalt"
```

---

### Task 5: Theme toggle (partials + JS, no FOUC)

**Files:**
- Modify: `site/partials/nav.html` (toggle button), `public/site.js` (toggle logic), and add a tiny pre-paint inline script to the shared `<head>` (see Step 3 for placement strategy).
- Modify: `site/partials/footer.html` (re-theme note only; markup unchanged — verify it reads on light).

**Interfaces:**
- Consumes: `data-theme` tokens from Task 1. Produces: persisted theme in `localStorage['snapshotpro_theme']` (`'light'`|`'dark'`), `data-theme` on `<html>`.

- [ ] **Step 1: Add the toggle button to the nav**

In `site/partials/nav.html`, before the `Open the studio` button, add:

```html
<button id="theme-toggle" class="nav-link" type="button" aria-label="Toggle dark mode" title="Toggle theme">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path class="t-moon" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
</button>
```

- [ ] **Step 2: Add toggle logic to `public/site.js`**

Append:

```js
// V27 theme toggle. data-theme is set pre-paint by the inline head script; this
// wires the button and persists the choice.
(function () {
  const KEY = 'snapshotpro_theme';
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
```

- [ ] **Step 3: Add the pre-paint inline script (avoid FOUC)**

The site has no shared `<head>` partial today. Add this one-liner inside `<head>` (before the `site.css` link) on the home page first, then to every page during the sweep (Task 7). It must be inline and synchronous so it runs before first paint:

```html
<script>try{var t=localStorage.getItem('snapshotpro_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/`. Expected: clicking the toggle flips light/dark instantly, choice persists across reload with no flash of the wrong theme. With no stored choice, the OS preference wins.

- [ ] **Step 5: Commit**

```bash
git add site/partials/nav.html public/site.js index.html
git commit -m "feat(v27): light/dark theme toggle with no-FOUC pre-paint"
```

---

### Task 6: Recompose the home page (Gallery layout)

**Files:**
- Modify: `index.html` (hero, stats, gallery wall, how-it-works, closing CTA). Reference layout + classes: `docs/superpowers/specs/assets/v27-prototype.html`.

**Interfaces:**
- Consumes: `.frame`/`.art`/`.chip` (Task 3), `--font-display`, tokens, `.reveal`/`[data-tilt]` hooks (site.js), the theme inline script (Task 5 Step 3).

- [ ] **Step 1: Rebuild the hero**

Replace the current hero markup with a left-aligned asymmetric split. Eyebrow (mono) + Schibsted headline (≤2 lines, italic emphasis on `weight` using `<em>`, NO gradient) + ≤20-word subtext + one `.btn-primary` (`Open the studio`) + one ghost text link. Right: a single `.frame` holding a **real exported SnapShotPro PNG** (place under `public/` and reference it) plus one `.chip`. Keep `[data-tilt]` on the frame if the tilt is wanted. No em-dashes in copy.

- [ ] **Step 2: Stats strip + gallery wall + how-it-works + closing CTA**

Recompose the remaining sections to match the prototype: 4-up `.stat-row`; a "One canvas, every output." `.section-head` followed by an asymmetric framed-art wall (reuse `.frame`/`.art`, real screenshots, plain captions, no section numbers / fake specs); the existing `.steps` how-it-works; a `.cta-band` closing card. Ensure ≥4 distinct section layout families and ≤1 eyebrow per 3 sections.

- [ ] **Step 3: Update home meta**

Set `<meta name="theme-color" content="#F6F5F1">` (and a dark variant via `media`); keep `og:*` / `canonical` and the `__OG_BASE__` token intact. Ensure the Task 5 Step 3 inline theme script is present in `<head>`.

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/`. Expected: hero fits the viewport, screenshots read as framed art on a warm-white wall, glass only on nav + hero chip, works in light + dark, reveals animate, no em-dashes, no console errors. Run `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add index.html public/*.png
git commit -m "feat(v27): recompose home page to Gallery layout"
```

---

### Task 7: Page sweep — hubs, SEO tool pages, remaining (23 pages)

**Files:**
- Modify each `*/index.html`: `features`, `tools`, `ai`, `gallery`, `agent`, `pricing`, `guide`, `changelog`, `about`, `alternatives`, `faq`, `roadmap`, `extension`, `privacy`, `terms`, `use-cases`, `app-store-screenshots`, `device-mockup-generator`, `og-image-generator`, `drop-shadow-generator`, `social-media-mockups`, `github-readme-screenshots`, `code-screenshots`.

**Interfaces:** consumes everything from Tasks 1-5.

- [ ] **Step 1: Add the pre-paint theme script + light theme-color to every page**

For each page, add the inline theme script (Task 5 Step 3) to `<head>` and set `theme-color` to `#F6F5F1`. Set `aria-current="page"` on the matching nav link if the page hardcodes nav (most use the partial, so this is just the partial — verify).

- [ ] **Step 2: Find and fix page-local dark assumptions + em-dashes**

Run per page (or globally):
```bash
grep -rn "rgba(255, *255, *255\|#fff\b\|—\|–" --include=index.html . | grep -v node_modules
```
Fix any page-local CSS that assumes a dark background (tokenize it), and replace every `—`/`–` in visible copy with `.`/`,`/`-`. The `gallery` page specifically: lean into the Gallery aesthetic (framed thumbnails using `.frame`).

- [ ] **Step 3: Ensure framed visuals use real screenshots**

Any `.lp-frame` / `.fc-visual` / new `.frame` must hold a real image (existing assets under `public/` or generated), not a `<div>` fake. Reuse existing screenshot assets already shipped for these pages.

- [ ] **Step 4: Verify**

Run: `npm run dev` and click through all 23 pages in light + dark. Expected: consistent editorial-light look, one cobalt accent, readable contrast, glass only on nav/chips, no em-dashes. Run `npm run build` — all inputs build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(v27): apply Gallery theme across all marketing pages"
```

---

### Task 8: OG image, version bump, CLAUDE.md note, final pre-flight

**Files:**
- Modify: `public/og.png` (rebrand), `package.json` (version), `CLAUDE.md` (V30 note).

- [ ] **Step 1: Regenerate the social card**

Recreate `public/og.png` (1200×630) in the editorial-light brand (warm paper, Schibsted headline, cobalt accent, one framed screenshot). Bump its cache-bust query where referenced (`og.png?v=3`) across pages if present.

- [ ] **Step 2: Bump the version**

In `package.json`, set `"version": "27.0.0"`.

- [ ] **Step 3: Reserve the editor rebrand for V30 in CLAUDE.md**

Add to the "Net-new standalone feature backlog" (or a nearby notes area):

```markdown
- **Editor studio UI rebrand — reserved for V30.** V27 rebranded only the marketing
  site (the "Gallery" editorial-light system in `public/site.css`). The editor at
  `/editor/` still uses its own dark studio chrome; aligning it to the V27 brand is a
  deliberate V30 slot, not a V27 task.
```

- [ ] **Step 4: Final pre-flight (taste-skill §14)**

Run `npm run build && npm run preview`. Verify on the built site: footer shows `v27.0.0`; partials present on all pages; zero em-dashes (`grep -rn "—\|–" --include=index.html . | grep -v node_modules` returns nothing visible); one accent; hero fits viewport; glass degrades under `prefers-reduced-transparency`; light + dark both pass; no console errors; favicon/OG updated.

- [ ] **Step 5: Commit**

```bash
git add public/og.png package.json CLAUDE.md
git commit -m "feat(v27): rebrand OG card, bump to 27.0.0, reserve editor rebrand for V30"
```

---

## Self-review

- **Spec coverage:** tokens+dark (T1), Schibsted Grotesk (T2), components+frames+a11y (T3), mark+icons (T4), theme toggle (T5), home Gallery layout (T6), all-24-pages sweep + em-dash/contrast checks (T7), OG+version+CLAUDE.md+pre-flight (T8). All spec sections mapped.
- **Placeholder scan:** every code step shows real CSS/HTML/JS; font-download step gives a real resolution path + an explicit fallback. No "TBD"/"handle edge cases".
- **Type/name consistency:** token names match Task 1 throughout; `.frame`/`.art`/`.chip` defined in T3 and consumed in T6/T7; `snapshotpro_theme` + `data-theme` consistent across T1/T5; `#mark` id preserved (T4) for nav/footer consumers.
