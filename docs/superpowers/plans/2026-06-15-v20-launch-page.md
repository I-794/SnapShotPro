# v20 Launch Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the creative page (Task 1) is authored with the `design-taste-frontend` skill by the controller (a single large hand-crafted HTML/CSS artifact, like the changelog spotlights). Wiring (Task 2) + verification (Task 3) are mechanical. Steps use `- [ ]`.

**Goal:** Ship a dedicated "largest update ever" launch page for the v20 AI Design Agent at route `/agent/`, built with the frontend taste skill, cohesive with the site but with its own "conversation → design" identity.

**Architecture:** A new self-contained multi-page entry `agent/index.html` (same pattern as `changelog/index.html`: shared `<!--PARTIAL:-->` nav/footer/mark, `/site.css` tokens, page-scoped `<style>`), added to the Vite multi-page inputs and linked from the shared nav.

**Tech Stack:** Vanilla HTML/CSS (no framework; this is the static marketing site, not the editor). Reuse `site.css` variables + existing classes (`wrap`, `page-head`, `btn`, `glass-card`, `cards3`, `eyebrow`, `grad-text`). Scroll-reveal via the existing `site.js` `.reveal` pattern. Spec: `docs/superpowers/specs/2026-06-15-v20-launch-page-design.md`.

> **No test runner:** verification = `npm run build` + manual browser check + an em-dash scan.

---

## File Structure
- **Create `agent/index.html`** — the launch page (the deliverable).
- **Modify `vite.config.js`** — add `agent` to `rollupOptions.input`.
- **Modify `site/partials/nav.html`** — add an "Agent" nav link.

---

## Task 1: Author the launch page (`agent/index.html`)

**Files:**
- Create: `agent/index.html`

- [ ] **Step 1: Invoke the taste skill**

Use `design-taste-frontend`. Design read (from the spec): premium product-launch landing for a creative AI tool — dark launch theme, cinematic, confident; VARIANCE 8 / MOTION 7 / DENSITY 3. Distinct motif = **"living conversation → design"** (a faux agent chat whose messages drive a canvas/mockup result that assembles), with an aurora/spectrum backdrop in the site's language. Distinct from v16 glass, v17 spectrum, v18 variant grid, v19 prompt→image, and the v20 changelog chat-thread spotlight (this is the full page, richer). Rules: ZERO user-visible em-dashes; one accent + one radius + one theme; ≤1 eyebrow per 3 sections; no three-identical-cards; CTAs single-intent ("Open the studio"); no AI tells; real/generated imagery or a clearly-decorative dramatization (no div-fake passed off as a real screenshot).

- [ ] **Step 2: Create the file with this exact head + partials boilerplate, then author the body**

Boilerplate (head/open/close — matches `changelog/index.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="description" content="Meet the SnapShotPro AI Design Agent: describe what you want and it designs it, generates backgrounds, sees the canvas, and remembers your style. The biggest update yet.">
    <title>The AI Design Agent · SnapShotPro</title>
    <meta property="og:type" content="website">
    <meta property="og:title" content="SnapShotPro · The AI Design Agent">
    <meta property="og:description" content="Describe it. The agent designs it. The biggest SnapShotPro update yet.">
    <meta property="og:image" content="__OG_BASE__/og.png">
    <meta name="theme-color" content="#0b0d14">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/site.css">
    <style>
      /* page-scoped, prefix .v20-*  — dark launch theme, "conversation → design"
         motif, aurora/spectrum backdrop. Honor prefers-reduced-motion. */
    </style>
</head>
<body>

<!--PARTIAL:mark-->
<!--PARTIAL:nav-->

<!-- sections authored here -->

<!--PARTIAL:footer-->
<script src="/site.js"></script>
</body>
</html>
```

Author the body sections per the spec (controller, taste skill):
1. **Hero** — launch eyebrow ("The biggest update yet" / v20), tight headline ("Describe it. The agent designs it."), ≤20-word subtext, primary CTA "Open the studio" (`/editor/`) + secondary "See it work" (anchor). Visual: the conversation→design dramatization (animated; reduced-motion static fallback).
2. **How it works** — 3 steps (Describe → It designs → Refine by chatting), as a horizontal flow (not 3 identical cards).
3. **What it can do** — bento grid (composes designs, generates backgrounds, isolates subject, palettes & harmonies, writes headlines, sees & critiques, remembers your style); real visual variation per cell.
4. **The conversation, for real** — a longer scripted multi-turn transcript ("make it warmer", "bigger headline") with the result updating; shows streaming + chips + memory.
5. **Built on the arc** — compact note that v20 stands on v18 Design Variations + v19 AI Assets (link `/changelog/`).
6. **CTA band** — single "Open the studio" CTA.

- [ ] **Step 3: Verify the page builds standalone-ish**

It can't be a Vite input until Task 2 adds it, but you can sanity-check the HTML is well-formed by eye. Defer the real build to Task 2.

- [ ] **Step 4: Commit**

```bash
git add agent/index.html
git commit -m "feat(v20): AI Design Agent launch page (conversation-to-design motif)"
```

---

## Task 2: Wire it into the build + nav

**Files:**
- Modify: `vite.config.js`
- Modify: `site/partials/nav.html`

- [ ] **Step 1: Add the Vite input**

In `vite.config.js`, inside `rollupOptions.input`, add this line (after the `pricing:` entry):

```javascript
        agent: resolve(__dirname, 'agent/index.html'),
```

- [ ] **Step 2: Add the nav link**

In `site/partials/nav.html`, add this link inside `.nav-right`, directly before the `<a href="/guide/" ...>Guide</a>` line:

```html
            <a href="/agent/" class="nav-link">Agent</a>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built`; `dist/agent/index.html` exists and contains the shared nav/footer (partials injected) and `{{VERSION}}` replaced in the footer.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js site/partials/nav.html
git commit -m "feat(v20): wire launch page into build + nav"
```

---

## Task 3: Verify

- [ ] **Step 1: Build + em-dash scan**

Run: `npm run build` → `✓ built`.
Scan `agent/index.html` for user-visible em/en dashes (— / –) outside `<style>`/comments; confirm none in headings/body/CTAs.

- [ ] **Step 2: Manual pass (`npm run dev`)**

Open `/agent/`:
- Hero fits the viewport; one primary CTA; the conversation→design visual animates (and is static under reduced-motion).
- Section layouts vary (≥4 families); bento cells have real visual variation; no three-identical-cards.
- One accent / one radius / one (dark) theme; CTAs single-intent and readable (WCAG AA).
- Mobile: every section collapses to a clean single column.
- Nav shows "Agent" and links correctly; footer + version render.

- [ ] **Step 3: Final commit (if cleanup)**

```bash
git add -A
git commit -m "chore(v20): launch page verification pass"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** route `/agent/` new page (Task 1) with all 6 sections + distinct motif + dark theme + taste rules; Vite input + nav link (Task 2); verification incl. em-dash scan + responsive (Task 3). All spec sections map to a task.
- **Placeholder scan:** the page body is authored with the taste skill (judgment task), not pre-written line-for-line — consistent with how the changelog spotlights were built this project. All MECHANICAL steps (head boilerplate, vite input line, nav link) have exact code.
- **Consistency:** route `/agent/`, input key `agent`, nav href `/agent/`, file `agent/index.html` match across all tasks.
- **Note:** file must exist (Task 1) before it's added as a Vite input (Task 2), else Rollup errors on a missing input — task order respects this.
