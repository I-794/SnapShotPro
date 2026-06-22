# Design

Visual system for SnapShotPro, captured from the live codebase. The **marketing site**
(`public/site.css`) is the primary brand surface; the **editor** (`src/styles.css`)
shares the same language with its own token names and a light-mode variant. Both are
**dark by default**, deep-navy, glass-and-cobalt.

## Theme / Vibe

Dark, editorial, technical-premium. A near-black navy canvas, frosted-glass surfaces
with subtle white hairlines, electric-cobalt accent, and restrained motion (slow
ambient aurora, soft reveals, snappy hover lifts). Feels like a serious creative tool —
confident and crafted, never templated or toy-like.

## Color

OKLCH/hex values are taken verbatim from the source. **Marketing site is canonical for
brand work.**

### Marketing site — `public/site.css` (canonical brand palette)

| Role | Token | Value |
|---|---|---|
| Background | `--bg` | `#080b14` |
| Background raised | `--bg-2` / `--bg-raise` | `#0c1020` / `#121829` |
| Background sunken | `--bg-sunken` | `#0b0f1c` |
| Ink (primary text) | `--ink` | `#eef1f8` |
| Ink secondary | `--ink-2` | `#aab2c8` |
| Ink tertiary | `--ink-3` | `#6f7794` |
| Accent | `--accent` | `#4f7cff` |
| Accent deep (primary buttons) | `--accent-deep` | `#2348ff` |
| Accent press | `--accent-press` | `#6d91ff` |
| Accent soft (tint) | `--accent-soft` | `rgba(79,124,255,0.14)` |
| Accent line | `--accent-line` | `rgba(79,124,255,0.40)` |
| Hairline | `--line` / `--line-strong` | `rgba(255,255,255,0.10)` / `0.18` |
| Glass fill | `--glass` / `--glass-2` | `rgba(255,255,255,0.05)` / `0.08` |
| Glass hairline | `--glass-line` / `--glass-hi` | `rgba(255,255,255,0.12)` / `0.55` |

### Editor — `src/styles.css` (product surface, dark default)

Backgrounds step `#0b0c0f` → `#131419` → `#1b1d24` → `#23252e` (elevated). Text
`#ecedf1` / `#9a9ca8` / `#63656f`. Accent ("electric cobalt") `--accent-primary
#5470ff`, `--accent-secondary #7d92ff`, `--accent-hover #6d86ff`, glow
`rgba(84,112,255,0.22)`. Glass `rgba(17,19,24,0.72)` + `blur(24px) saturate(160%)`.
A **light theme** (`[data-theme="light"]`) shifts bg to `#f1f1ee`/`#fbfbf9`/`#fff`,
ink to `#15161a`, accent to the deeper `#2348ff` for contrast.

### Status

`--success #34d399` (success button text on it: `#042f2e`), `--error #f87171`. Used
sparingly for toasts and destructive actions only.

## Typography

- **Sans / UI & display:** `Geist` (Google Fonts, weights 300–800), fallback
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Mono:** `JetBrains Mono` (400/500) for code, numeric values, eyebrow labels.

**Marketing scale (fluid):** H1 `clamp(44px, 6.6vw, 84px)` / 700 / `-0.035em`;
H2 `clamp(28px, 3.8vw, 46px)` / 700 / `-0.03em`; H3 `18px` / 600; body `16.5–17px` /
`1.6` line-height in `--ink-2`; eyebrow `11px` / 500 / `0.14em` / uppercase in `--accent`.

**Editor scale (compact UI):** section titles `11px` / 600 / `1.2px` / uppercase;
control labels `11px` / 500 / uppercase; body & inputs `13px`; numeric values `11px`
mono. Tight, dense, functional — distinct from the expansive marketing type.

## Spacing, Radius & Elevation

- **Radius:** marketing `--r-sm 12px`, `--r-card 22px`, `--r-pill 999px`; editor
  `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`, `--radius-pill 999px`.
  Marketing rounds larger and softer; editor rounds tighter.
- **Spacing:** comfortable gaps `6/8/14–20px` in the editor; generous section padding
  and `clamp()`-driven rhythm on marketing (`clamp(32px,5vw,72px)` grid gaps,
  `clamp(36px,6vw,72px)` vertical padding).
- **Shadows:** layered and deep. Marketing `--shadow-lift`, `--shadow-product`
  (`0 50px 100px -30px rgba(0,0,0,0.6)` for hero product shots), `--shadow-glass`
  (inset top highlight + big drop), `--shadow-accent` (`0 10px 30px rgba(35,72,255,0.45)`
  cobalt glow on primary CTAs). Editor `--shadow-sm/md/lg` scale from subtle to modal.

## Components

- **Glass surfaces** are the signature: header, sidebar, panels, modals, cards use
  `linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))` +
  `backdrop-filter: blur(20–24px) saturate(140–160%)` + a `rgba(255,255,255,0.05–0.12)`
  hairline + inset top highlight.
- **Glass card** (`public/site.css .glass-card`): radius `22px`, padding `26px`, lifts
  `translateY(-4px)` and brightens its border on hover.
- **Buttons:** primary = filled cobalt (`--accent-deep`/`--accent-primary`), white text,
  pill on marketing (`999px`, `600`, `--shadow-accent` glow) / `6px` radius in editor;
  hover lifts `-1px` and intensifies glow, active presses to `scale(0.97)`. Secondary =
  `--bg-tertiary` fill with hairline border.
- **Editor controls:** inputs `9px 12px` / `6px` radius with a focus ring
  `0 0 0 3px var(--accent-light)`; 4px range sliders with 14px cobalt thumbs; 40×22px
  toggle switches that fill with the cobalt gradient when on; 36px color swatches.
- **Overlays:** modal `14px` radius on `rgba(0,0,0,0.65) + blur(8px)` scrim; command
  palette `min(600px,90vw)` glass sheet; toasts top-right glass with success/error glow.

## Layout

- **Editor:** fixed `52px` glass header → left **icon rail + 360px contextual panel**
  (one group visible at a time) → center **canvas on a dot-grid** (`radial-gradient`
  1px dots at `22px`) → fixed `260px` right **layers panel** → `36px` bottom **history
  timeline**. Collapses to a drawer + bottom dock below 1024/mobile.
- **Marketing:** sticky `66px` nav → asymmetric hero grid (`1.05fr 1fr`,
  `min-height: calc(100dvh - 66px)`) → alternating 2-col feature bands, 3-col tri-grids
  and galleries, 4-col use-case chips → columned footer. Collapses to single column at
  900/560px.

## Motion

- **Easing tokens:** `--transition-fast 0.15s`, `--transition-smooth 0.25s`, and a
  springy `--transition-spring 0.4s cubic-bezier(0.34,1.56,0.64,1)`. Site shares
  `--ease: cubic-bezier(0.22,1,0.36,1)`.
- **Signatures:** ambient **aurora drift** (34s, infinite alternate) and **gradient-text
  shift** (8s) on marketing; **section reveal** (`translateY(8px)`→0, staggered 0.02s)
  in the editor sidebar; `modalIn` / `paletteSlide` entrances; hover lift `-1px`, press
  `scale(0.97)`, focus glow. Tour hotspots pulse (2s).
- **Reduced motion:** honor `prefers-reduced-motion` — the aurora, gradient shift, and
  scroll-driven reveals should be the first things to disable.

## Notes & opportunities

- Two parallel token systems (`site.css` vs `styles.css`) describe one brand. They're
  intentionally separate (marketing vs app density) but the cobalt accent and glass
  language unify them — keep them in sync when the accent or surface treatment evolves.
- Watch contrast on `--ink-3 #6f7794` / `--text-tertiary #63656f` over the darkest
  backgrounds for body-length copy.
