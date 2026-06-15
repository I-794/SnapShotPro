# v20 Launch Page ("Largest Update Ever") — Design Spec

**Status:** Approved direction (not yet implemented)
**Date:** 2026-06-15
**Companion to:** `2026-06-15-v20-ai-design-agent-design.md` (the feature)

> A dedicated marketing/launch page that presents v20 — the AI Design Agent — as
> the biggest release in SnapShot-Pro history. Built with the
> `design-taste-frontend` skill. Separate sub-project from the agent feature: its
> own spec → plan → build, shipped alongside v20.

## Goal

One standout page that makes a visitor instantly get "you describe it, the agent
designs it," feel that this is a landmark release, and click through to the
studio. It should be the most ambitious page on the site, with its own visual
identity, while staying cohesive with the existing site tokens (`site.css`,
shared nav/footer partials).

## Audience & read

Design-conscious devs/makers and prospective users. **Design read:** premium
product-launch landing for a creative AI tool — dark, cinematic, confident.
Dials (per the taste skill): VARIANCE 8, MOTION 7, DENSITY 3. Honor
`prefers-reduced-motion` and dark/light parity where the site supports it (the
page locks to a dark launch theme; one theme, no mid-page inversion).

## Distinct aesthetic (must not repeat existing motifs)

The site already uses: v16 glassmorphism, v17 spectrum band, v18 variant grid,
v19 prompt→image (changelog spotlights). The launch page's signature is the
**"living conversation → design"** motif: a faux agent chat on one side whose
messages drive a canvas/mockup result that visibly assembles (background appears,
frame snaps in, palette applies) on the other — the product's core loop,
dramatized. Paired with an aurora/spectrum backdrop already in the site's
language. No new design system; native CSS + the site's tokens + tasteful
scroll/reveal motion (Motion-style is N/A here — this is the vanilla multi-page
site, so use CSS scroll-driven animation / IntersectionObserver, matching the
existing site.js reveal pattern).

## Page structure (sections)

1. **Hero** — a launch eyebrow ("The biggest update yet" / "v20"), a tight
   headline ("Describe it. The agent designs it."), ≤20-word subtext, one primary
   CTA ("Open the studio") + one secondary ("See it work"). Visual: the
   conversation→design demo (animated, reduced-motion-safe static fallback).
   Fits the viewport; no overflow.
2. **How it works** — 3 steps (Describe → It designs → Refine by chatting),
   shown as a horizontal flow, NOT three identical cards (vary the layout).
3. **What it can do** — a bento grid of the agent's powers: composes full
   designs, generates on-brand backgrounds, isolates the subject, sets palettes
   & harmonies, writes headlines, sees & critiques the canvas, remembers your
   style. Real visual variation per cell (not text-only tiles).
4. **The conversation, for real** — a longer scripted transcript showing a
   multi-turn refine ("make it warmer", "bigger headline") with the result
   updating. Demonstrates streaming + suggestion chips + memory.
5. **Built on the arc** — a compact note that v20 stands on v18 Design
   Variations + v19 AI Assets (links to changelog), framing the release as a
   culmination.
6. **CTA band** — single clear CTA to the studio (one intent, one label reused
   across the page).
7. Shared **footer** partial.

## Tech integration

- New page `v20/index.html` (or `agent/index.html`) added to
  `vite.config.js` `rollupOptions.input`. Uses `<!--PARTIAL:nav-->` /
  `<!--PARTIAL:footer-->` / `<!--PARTIAL:mark-->` and `{{VERSION}}` like other
  pages; `__OG_BASE__` for OG. Linked from the main nav and/or home + changelog.
- Styling inline in a `<style>` block (matching `changelog/index.html`'s pattern)
  using site CSS variables; scoped classes prefixed (e.g. `.v20-*`).
- Assets: prefer generated/real imagery for any product shots; the
  conversation→design demo is CSS/markup (faux chat + mock canvas), explicitly
  NOT a div-fake of the real app UI passed off as a screenshot — it's a stylized
  dramatization, clearly decorative. A real studio screenshot/export may be used
  for the "result".

## Content rules (from the taste skill)

- Zero user-visible em-dashes (— / –) anywhere.
- One accent family, one corner-radius system, one theme (dark launch).
- No AI tells: no "Quietly trusted by", no fake version stamps, no decorative
  scroll cues / locale strips, no eyebrow on every section (≤1 per 3 sections),
  no three-identical-cards. Real CTAs, single intent.
- Copy: concrete, confident, no filler verbs ("Elevate/Seamless/Unleash").

## SEO / OG

- `<title>`, meta description, and OG image/title/description for the launch.
- Linked into nav so it's discoverable; consider it the new "hero" destination
  during launch.

## Verification (manual)

- `npm run build` includes the new page; it renders with shared nav/footer +
  correct version.
- Hero fits viewport; section layouts vary (≥4 families); bento cells have visual
  variation; reduced-motion disables the animated demo gracefully.
- No visible em-dashes; one accent/radius/theme; CTAs single-intent and readable
  (WCAG AA).
- Mobile: every section collapses to a clean single column.

## Out of scope

- A/B testing, analytics events beyond what the site already wires.
- Interactive *real* agent embedded in the page (the demo is a dramatization; the
  real agent lives in the studio).
- Pricing/checkout changes.
