# Design

Visual system for the SnapShotPro **editor / studio** surface, captured from
`src/styles.css`. This is the **product** register (dense, functional UI). The repo root
`DESIGN.md` covers the broader system including the marketing site; this file is the
focused editor reference.

> **Loading this context:** the repo is a single package (not a monorepo), so impeccable
> always resolves the **root** `PRODUCT.md`/`DESIGN.md` (the brand surface) by default —
> `--target editor/…` and `IMPECCABLE_CONTEXT_DIR=editor` do **not** override it while the
> root files exist. So for editor work, treat these two files as the reference: point the
> skill at an editor surface (e.g. `/impeccable polish editor sidebar`) — it picks the
> **product** register from the task/surface cue — and have it read `editor/PRODUCT.md` +
> `editor/DESIGN.md` directly. The root brand context still applies to everything outside
> `/editor/`.

## Theme / Vibe

Dark-first professional instrument. Near-black canvas, frosted-glass chrome with fine
white hairlines, electric-cobalt accent, dot-grid work surface. Compact, precise, and
calm — depth without clutter. A light theme exists as a first-class variant.

## Color

Tokens are verbatim from `src/styles.css`. **Dark is the default** (`data-theme="dark"`
on `<html>`).

### Dark (default)

| Role | Token | Value |
|---|---|---|
| Background | `--bg-primary` | `#0b0c0f` |
| Surface (header/glass) | `--bg-secondary` | `#131419` |
| Control / input fill | `--bg-tertiary` | `#1b1d24` |
| Elevated (modals) | `--bg-elevated` | `#23252e` |
| Text primary | `--text-primary` | `#ecedf1` |
| Text secondary | `--text-secondary` | `#9a9ca8` |
| Text tertiary / disabled | `--text-tertiary` | `#63656f` |
| Accent (electric cobalt) | `--accent-primary` | `#5470ff` |
| Accent secondary | `--accent-secondary` | `#7d92ff` |
| Accent hover | `--accent-hover` | `#6d86ff` |
| Accent tint | `--accent-light` | `rgba(84,112,255,0.10)` |
| Accent glow | `--accent-glow` | `rgba(84,112,255,0.22)` |
| Border | `--border-color` | `rgba(255,255,255,0.07)` |
| Border (accent) | `--border-glow` | `rgba(84,112,255,0.16)` |
| Glass fill | `--glass-bg` | `rgba(17,19,24,0.72)` |
| Glass blur | `--glass-blur` | `blur(24px) saturate(160%)` |
| Success | `--success` | `#34d399` (text on it `#042f2e`) |
| Error | `--error` | `#f87171` |

### Light (`[data-theme="light"]`)

Backgrounds `#f1f1ee` / `#fbfbf9` / `#ecece8` / `#ffffff`; text `#15161a` / `#55565e` /
`#8a8b92`; accent shifts deeper for contrast (`--accent-primary #2348ff`); borders
`rgba(21,22,26,0.08)`; glass `rgba(255,255,255,0.78)`. Shadows soften dramatically
(opacities ~0.04–0.1 vs 0.3–0.6 in dark).

## Typography

- **UI / sans:** `Geist` (300–800), fallback `-apple-system, BlinkMacSystemFont,
  'Segoe UI', sans-serif`.
- **Mono:** `JetBrains Mono` (400/500) for numeric values, status, code snippets.

Compact scale tuned for control density:

| Use | Size / weight | Detail |
|---|---|---|
| Section title | `11px` / 600 | uppercase, `1.2px` tracking, leading accent dot |
| Control label | `11px` / 500 | uppercase, `0.3px` tracking |
| Body / inputs / buttons | `13px` | default control text |
| Numeric value / status | `11px` mono / 500 | — |
| Upload zone heading | `17px` / 600 | the one large moment in-app |

## Spacing, Radius & Elevation

- **Radius:** `--radius-sm 6px` (controls, buttons), `--radius-md 10px` (cards,
  toolbars), `--radius-lg 14px` (modals, palette), `--radius-pill 999px` (toggles).
- **Spacing:** control padding `9px 12px`; tight/comfortable/generous gaps `6 / 8 /
  14–20px`; sidebar section padding `20px`; modal padding `24px`; canvas inset
  `16px 28px 52px`.
- **Shadows:** `--shadow-sm` `0 1px 3px rgba(0,0,0,.4)…`, `--shadow-md` `0 4px 16px
  rgba(0,0,0,.5)…`, `--shadow-lg` `0 12px 40px rgba(0,0,0,.6)…`. Accent focus rings use
  `--accent-light`/`--accent-glow` rather than drop shadows.

## Components

- **Glass chrome:** header (`52px`), `360px` sidebar, layers panel, modals, palette, and
  toasts all use `--glass-bg` + `--glass-blur` with a `--glass-border` hairline and an
  accent under-line (`--border-glow`).
- **Buttons:** `.btn-primary` filled cobalt, white text, `6px` radius, `8px 16px`, lifts
  `-1px` + glow on hover, `scale(0.97)` active. `.btn-secondary` `--bg-tertiary` +
  hairline. `.btn-success` filled `--success` with dark-teal text.
- **Inputs / controls:** `9px 12px`, `6px` radius, focus ring `0 0 0 3px
  var(--accent-light)` + `--bg-elevated` fill. 4px range sliders with 14px cobalt thumbs
  (scale on hover/active). 40×22px toggles that fill with the cobalt gradient when on.
  36px color swatches; `44px` preset-color grid tiles; tab rows on a `--bg-tertiary`
  track.
- **Panels & overlays:** left **icon rail + one contextual `360px` panel** (groups:
  import / adjust / background / frame / markup / ai / export / project), collapsible
  sections (persisted). Right **layers panel** (`260px`, collapses to a `36px` edge).
  Bottom **history timeline** (`36px`) with scrubbable dots. **Command palette**
  `min(600px,90vw)` glass sheet. Modals on a `rgba(0,0,0,0.65)+blur(8px)` scrim, `14px`
  radius, `modalIn` entrance.

## Layout

Full-viewport flex: fixed `52px` header → left icon rail + contextual panel → center
**canvas viewport on a dot-grid** (`radial-gradient` 1px dots at `22px`,
`rgba(255,255,255,0.045)` dark / `rgba(0,0,0,0.05)` light) → fixed `260px` right layers
panel → fixed `36px` bottom history timeline. Below `1024px` the panel narrows to
`320px`; on mobile the sidebar becomes a slide-in drawer with a backdrop and a `58px`
bottom dock.

## Motion

- **Easing:** `--transition-fast 0.15s`, `--transition-smooth 0.25s`, springy
  `--transition-spring 0.4s cubic-bezier(0.34,1.56,0.64,1)` — all on
  `cubic-bezier(0.22,1,0.36,1)` family.
- **Signatures:** staggered **section reveal** (`translateY(8px)`→0, `0.02s` per
  section), `modalIn` and `paletteSlide` entrances, hover lift `-1px`, press
  `scale(0.97)`, focus glow, slider/toggle thumb scaling, tour-hotspot pulse (2s).
- **Reduced motion:** disable the staggered reveals and any continuous/animation-playback
  motion under `prefers-reduced-motion`.

## Notes

- Shares the cobalt + glass language with the marketing `site.css`, but with its own
  token names and a much denser type/spacing scale — changes to the shared accent or
  glass treatment should stay coordinated across both.
- The editor's job is fidelity: anything that changes the look must draw inside
  `renderInto` (see repo `CLAUDE.md`) so it bakes into exports — DESIGN choices that
  only touch preview CSS will not export.
