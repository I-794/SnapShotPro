# V27 — Marketing Site Redesign: "Gallery" (Editorial Light + Liquid Glass)

> Status: design approved. Prototype signed off. Implementation plan to follow.
> Reference prototype: `docs/superpowers/specs/assets/v27-prototype.html` (+ `v27-refined.png`).

## Context

SnapShotPro has shipped 26 versions of *features*, but the marketing site has drifted into the
default premium-SaaS look of 2022-23: dark glassmorphism (`#080b14` navy base, frosted blur on
everything, an electric-cobalt *glow* accent, a 34s drifting aurora). It is cohesive but it does not
**pop**, and frosted glass actively *mutes* contrast. That is the wrong choice for a product whose
entire output is **colorful screenshots**: the chrome is currently louder than the work it should
showcase.

V27 is a **marketing-site-only visual rebrand**. The editor studio UI is explicitly deferred to
**V30** (noted in `CLAUDE.md`). The direction is **"Gallery" — Editorial Light, with a refined
liquid-glass accent**: a calm warm-white "museum wall" where the colorful product screenshots become
the only color and the visual hero, and glass is used sparingly as an accent (nav, floating chips)
rather than as the wallpaper.

Outcome: a higher-contrast, higher-taste site that reads as a design tool worth using, drives the
"Open the studio" CTA, and propagates across all 24 marketing pages from one token system.

## Design read (taste-skill)

> *Reading this as: a design-conscious creator/developer landing for people who care about visual
> craft, with an editorial / gallery language, leaning toward a grotesque display + mono captions on
> warm white, dual-mode, with restrained motion and one locked accent.*

Dials: **VARIANCE 7 · MOTION 4 · DENSITY 3.** Redesign mode: **overhaul** (new visual language,
content + IA preserved).

## Locked decisions

| Decision | Choice |
|---|---|
| Accent (single, locked) | **Cobalt `#2348FF`**, used solid — no glow |
| Theme | **Light default + dark toggle** via shared CSS tokens (`prefers-color-scheme` + manual toggle) |
| Display typeface | **Schibsted Grotesk** (OFL, self-hosted) for headlines |
| Body / mono | Keep **Geist** (body) + **JetBrains Mono** (eyebrows, captions) |
| Logo mark | **Redraw** as a simple solid-cobalt mark (retire the `#667eea→#764ba2` purple-gradient camera) |

## Design system — tokens (`public/site.css` `:root`)

Re-skin is **token-first**; most change lives in `:root` + a few component classes, so all 24 pages
update together. Light values below; dark values swap under `[data-theme="dark"]` /
`@media (prefers-color-scheme: dark)`.

**Light:**
- `--bg:#F6F5F1` (warm paper) · `--bg-2:#FFFFFF` (raised) · `--bg-sunken:#EFEDE7`
- `--ink:#111111` · `--ink-2:#4B4B4B` · `--ink-3:#8A8A85`
- `--line:rgba(17,17,17,.10)` · `--line-strong:rgba(17,17,17,.18)`
- `--accent:#2348FF` · `--accent-press:#1a37cc` · `--on-accent:#fff`

**Dark (parity, brand-faithful, no pure black):**
- `--bg:#0E1014` · `--bg-2:#15181F` · `--bg-sunken:#0A0C10`
- `--ink:#F2F3F7` · `--ink-2:#AEB4C2` · `--ink-3:#727A8C`
- `--accent:#5B82FF` (lifted cobalt for dark legibility) · `--on-accent:#fff`

**Liquid glass (accent-only, both modes):** `--glass`, `--glass-line`, `--glass-blur:18px`,
`--shadow-glass: inset 0 1px 0 rgba(255,255,255,.9), 0 12px 40px rgba(17,17,17,.12)`. Every glass
surface degrades to a solid `--bg-2` fill under `@media (prefers-reduced-transparency: reduce)`.

**Signature shadow (tinted, never pure black on light):**
`--shadow-art: 0 2px 4px rgba(17,17,17,.06), 0 30px 60px -20px rgba(17,17,17,.22)` — the "framed
artwork" cast shadow, the load-bearing elevation of the whole site.

**Shape lock:** `--r-card:14px` (cards/frames) · `--r-sm:10px` (controls) · `--r-pill:999px`.
**Type:** display tracking `-0.02em`, body max ~65ch.

## Signature components

1. **The Frame** — reusable "artwork" wrapper for every product screenshot: matte border + tiny
   rotation + `--shadow-art`, optional scroll parallax. Replaces today's tilted browser-chrome
   showpiece. The frames MUST hold **real exported SnapShotPro screenshots** (or generated assets),
   never CSS/`<div>` fakes (taste-skill 9.E).
2. **Liquid-glass chip / nav** — frosted overlay used ONLY where something floats over an image
   (sticky nav, the 2 hero feature chips, gallery labels). Everywhere else = solid surfaces.
3. **Hero** — left-aligned asymmetric split: mono eyebrow → big Schibsted Grotesk headline (≤2 lines,
   italic emphasis on *weight* in the same family) → ≤20-word subtext → 1 primary CTA
   (`Open the studio`) + 1 ghost link. Right: one Framed screenshot with one glass chip. `min-h:100dvh`.

## Skill audit applied (taste-skill + redesign-skill)

The prototype was run through the redesign-skill audit and the taste-skill 60-point pre-flight.
Direction passes (light theme lock, single accent, asymmetric hero, framed-art over fake UI, tinted
shadows, glass with inner highlight + reduced-transparency fallback). Fixes folded into this spec:

- **Em-dash ban (9.G, non-negotiable):** zero `—`/`–` anywhere visible. Use periods, commas, or `-`.
- **No decorative status dots** on chips/nav/badges (9.F).
- **No section-number / fake-precise-spec captions** (e.g. `01 — Gradient backdrop · 1600×1200`);
  plain functional captions only.
- **a11y:** `:focus-visible` rings on all interactive elements; `text-wrap: balance` on headings;
  WCAG AA contrast verified for CTA text and `--ink-2` body in **both** modes.
- **Footer version stamp** (`v{{VERSION}}`) is normally a 9.F tell, but is an **intentional kept
  exception** here: it is an established, functional pattern for this OSS project (drives the
  what's-new toast) and is preserved per redesign-protocol 11.C.

## Scope — pages & work order

One token system drives all **24 marketing pages** (editor excluded, deferred to V30):
home, the 4 nav hubs (`features`, `tools`, `ai`, `gallery`), `agent`, `pricing`, `guide`,
`changelog`, `about`, `alternatives`, `faq`, `roadmap`, `extension`, `privacy`, `terms`, and the 8
SEO tool pages (`app-store-screenshots`, `device-mockup-generator`, `og-image-generator`,
`drop-shadow-generator`, `social-media-mockups`, `github-readme-screenshots`, `code-screenshots`,
`use-cases`).

1. **Tokens + fonts + partials first** — `public/site.css` `:root` (light + dark), self-host
   Schibsted Grotesk via `@font-face`, `site/partials/nav.html` (+ theme toggle + active-link
   state), `footer.html`, `mark.html` (new solid-cobalt mark). This alone reskins every page.
2. **Home** (`index.html`) — rebuild to the Gallery layout (hero, stats strip, "one canvas, every
   output" framed-art wall, how-it-works, closing CTA). The showcase page.
3. **Hub pages** (`features`, `tools`, `ai`, `gallery`, `agent`, `pricing`, `guide`) — apply new
   components; `gallery` becomes the literal centerpiece of the aesthetic.
4. **Remaining** pages inherit tokens; light per-page polish.
5. **OG/social + favicon** — regenerate `public/og.png`, `favicon.svg`, PWA icons, and `theme-color`
   meta (currently `#2348ff` / `#080b14`) to match the light brand.

## Implementation approach

- Bump `package.json` version → `27.0.0` (drives footer `{{VERSION}}` + the what's-new toast).
- Edits concentrate in `public/site.css` (token block + `.btn`, `.nav`, glass utilities, new
  `.frame`/`.art` classes, theme-toggle styles) and the three `site/partials/*.html`.
- Per-page HTML edits follow existing structure; reuse the partial-injection + `__OG_BASE__` /
  `{{VERSION}}` build mechanics already in `vite.config.js` (no build-system changes).
- Add a note to `CLAUDE.md` reserving the **editor studio UI rebrand for V30**.
- Theme toggle: small inline script persisting choice to `localStorage` (`snapshotpro_theme`),
  defaulting to `prefers-color-scheme`; set `data-theme` on `<html>` before paint to avoid FOUC.

## Verification

- `npm run dev` → QA home + 2-3 representative pages (a hub + an SEO tool page) at desktop **and**
  mobile (`<768px` per-section collapse), in **both** light and dark.
- Confirm glass degrades to solid under `prefers-reduced-transparency: reduce`; WCAG AA contrast
  passes for CTA-on-cobalt and `--ink-2`-on-`--bg` in both modes; `:focus-visible` rings visible.
- `npm run build && npm run preview` → footer `{{VERSION}}` = 27.0.0, partials inject on all pages,
  OG/favicon updated, no console errors, no FOUC on theme.
- Taste-skill pre-flight: zero em-dashes, ≤1 eyebrow per 3 sections, one accent locked across all
  pages, ≥4 distinct section layout families on home, hero fits viewport, no div-fake screenshots in
  frames (real exported images).
