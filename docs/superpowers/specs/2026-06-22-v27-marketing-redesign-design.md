# Marketing Site Redesign (PARKED OPTION): Dual-Mode (Elevate Dark-Glass + Add "Gallery" Light)

> Status: **PARKED as a design option, not shipped.** Explored under the V27 slot, then deliberately
> not released (the version number stays open). Saved for a future version. The full build lives on
> branch `claude/snapshotpro-v27-brainstorm-rtnt9i` with a Vercel preview (draft PR #13). Reviving it
> = bring in real, varied product imagery for the frames (the main thing that made it feel flat), then
> run the Impeccable bolder/delight/overdrive/polish gates.
> Impeccable installed in-repo and driving the workflow. Implementation plan: `docs/superpowers/plans/2026-06-22-v27-marketing-redesign.md`.
> Reference prototype (light mode): `docs/superpowers/specs/assets/v27-prototype.html` (+ `v27-refined.png`).

## Context

SnapShotPro has shipped 26 versions of features; the marketing site's complaint was that the
dark-glassmorphism look "doesn't pop" — frosted glass on every surface mutes contrast, and the
product (whose output is colorful screenshots) is quieter than its own chrome.

**Direction pivot (stakeholder feedback):** the team likes the current dark-glass design. So V27 is
**not** a replacement. It is **dual-mode**:

1. **Keep dark-glass as the default brand** (identity preservation — committed navy + cobalt + glass)
   and **elevate it so it pops**: glass becomes purposeful instead of all-over, contrast goes up,
   real product screenshots become the hero ("The Frame"), the gradient-text headline becomes solid,
   and type/spacing tighten. This directly answers "it doesn't pop" without changing what people like.
2. **Add the "Gallery" editorial-light** look as the **light mode** of a new theme toggle — an
   additive, opt-in alternative, not the default.

The editor studio UI remains deferred to **V30** (noted in `CLAUDE.md`).

Impeccable (`pbakaus/impeccable`, Apache-2.0) is installed in-repo (`.claude/skills/impeccable`,
plus generated `PRODUCT.md` / `DESIGN.md`) and **drives the work**: its commands are baked into the
plan as quality gates. Impeccable's own absolute bans independently justify the elevation
(glassmorphism-as-default, gradient-text, eyebrow-on-every-section, identical card grids,
hero-metric template) and its register guidance says **identity-preservation wins** when committed
brand colors exist — exactly this case.

## Design read (Impeccable + taste-skill)

> *Reading this as: a brand/marketing surface (register = brand) for design-conscious creators and
> developers, established dark-glass identity, elevated for contrast and product-forward impact, with
> an opt-in editorial-light alternative.*

Redesign mode: **preserve + evolve** (NOT overhaul). Per `PRODUCT.md`: assured, editorial,
trustworthy; quiet confidence; show-don't-tell; "practice what you preach."

## Locked decisions (updated for dual-mode)

| Decision | Choice |
|---|---|
| Default theme | **Dark-glass (current), elevated.** `:root` keeps the navy/cobalt/glass tokens. |
| Second theme | **Gallery editorial-light**, opt-in via toggle (`html[data-theme="light"]`). |
| Theme default behavior | Dark is the hard default; light only when the user toggles (persisted). |
| Accent | **Cobalt** — dark `#4f7cff`/`#2348ff` (unchanged), light `#2348FF`. Reduce glow. |
| Logo mark | **Keep the existing mark** (identity preservation). No redraw. |
| Display typeface | **Keep Geist** for display (preserve identity); tighten weight/tracking. Schibsted Grotesk is OPTIONAL for the light mode only, deferred unless desired. |
| Body / mono | Geist (body) + JetBrains Mono (eyebrows, captions) — unchanged. |

## Elevation of the dark default (what makes it pop, per Impeccable)

All within the existing identity — these are elevations, not a rebrand:

1. **The Frame (biggest lever):** real exported product screenshots presented as framed art (matte
   padding + deep cast shadow) become the hero and gallery centerpieces. Show, don't tell. Works on
   the dark canvas. NO `<div>`-fake screenshots.
2. **Purposeful glass:** glass stays only where something floats over imagery (nav, overlays, hero
   chips). Decorative `.glass-card`/`.stat` glass becomes solid raised surfaces (`--bg-raise`) with a
   hairline — higher contrast, less mush. (Impeccable: glassmorphism-as-default is banned.)
3. **Kill gradient-text:** the `.grad-text` animated-gradient headline becomes solid ink with
   same-family italic emphasis. (Impeccable absolute ban: gradient text.)
4. **Contrast pass:** raise body text off `--ink-3` where it carries copy; verify WCAG AA
   (the `DESIGN.md` notes flag `--ink-3 #6f7794` on the darkest bg).
5. **Solid accent:** reduce CTA glow to a restrained shadow; cobalt stays the single accent.
6. **De-scaffold:** remove eyebrow-on-every-section and any numbered-section markers that are not a
   real sequence; tighten display tracking to the ≥ -0.04em floor; `text-wrap: balance` on headings.
7. **Keep the aurora** (a liked signature) but subtle + `prefers-reduced-motion` honored.

## Gallery light mode (the additive alternative)

The signed-off editorial-light system, scoped to `html[data-theme="light"]`: warm paper `#F6F5F1`,
ink `#111`, solid cobalt, light "liquid glass" used only on nav/chips, the same `.frame` component,
`--shadow-art` cast shadow. Tokens reuse the same NAMES so components work in both modes.

## Theme system

- `:root` = dark-glass (default). `html[data-theme="light"]` = Gallery light. `html[data-theme="dark"]`
  is redundant but supported for explicit choice.
- Toggle button in nav; choice persists in `localStorage['snapshotpro_theme']`; a tiny pre-paint
  inline `<head>` script sets `data-theme` before first paint (no FOUC). Dark is the default when no
  choice is stored.
- Every glass surface degrades to a solid fill under `prefers-reduced-transparency: reduce`, in both
  modes.

## Scope — pages

One token system drives all **24 marketing pages** (editor excluded, V30): home, the 4 nav hubs
(`features`, `tools`, `ai`, `gallery`), `agent`, `pricing`, `guide`, `changelog`, `about`,
`alternatives`, `faq`, `roadmap`, `extension`, `privacy`, `terms`, and the 8 SEO tool pages.

## Impeccable workflow (baked into the plan)

- `node .claude/skills/impeccable/scripts/context.mjs` to load `PRODUCT.md`/`DESIGN.md`; read
  `reference/brand.md` (register = brand).
- `/impeccable critique` + `/impeccable audit` to baseline the current site (scored P0–P3) and target
  the real "doesn't pop" weaknesses.
- `/impeccable bolder` + `/impeccable polish` to drive the dark-mode elevation.
- `npx impeccable` anti-pattern **detector** during the page sweep.
- `/impeccable document` to rewrite `DESIGN.md` for the dual-mode system at the end.

## Verification

- `npm run dev` → QA home + a hub + an SEO tool page at desktop and mobile, in **both** dark (default)
  and light. Toggle persists, no FOUC, dark is default with no stored choice.
- Glass degrades to solid under `prefers-reduced-transparency`; WCAG AA passes for CTA + body in both
  modes; `:focus-visible` rings visible.
- `npm run build && npm run preview` → footer `{{VERSION}}` = 27.0.0; partials on all pages; no
  console errors.
- Impeccable: `npx impeccable` detector clean (or triaged P0/P1 fixed); `/impeccable audit` score
  improved vs the baseline; zero gradient-text, no glassmorphism-as-default, single accent.
