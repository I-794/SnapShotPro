# V30 Studio Intelligence — Plan 05: Marketing Page + Changelog + What's-New

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Part of the V30 plan series:** 01 → 02 → 03 → 04 → **05 (this file)**. Independent of the feature code (visuals can use placeholders), but this is the **release-closing** plan: it also bumps the version. Run it last.

**Goal:** Ship a dedicated, high-craft marketing page for the V30 suite, announce V30 on the changelog page and via the in-app what's-new toast, and bump the version to 30.0.0 — all using the `taste-skill` for visual design.

**Architecture:** The marketing page is a new static Vite input (`studio-intelligence/index.html`) built exactly like the existing marketing pages: shared `<!--PARTIAL:…-->` nav/footer from `site/partials/`, `__OG_BASE__` OG tags, `{{VERSION}}` footer. The `taste-skill` drives layout/type/spacing decisions, expressed as **vanilla HTML/CSS** (the repo is not React/Tailwind). The changelog gets a new `.entry.latest` (the prior latest demoted), and `whats-new.js` gets the V30 entry with `CURRENT_VERSION='30.0'`.

**Tech Stack:** Static HTML/CSS, Vite multi-page build. Design via `taste-skill`. No JS framework.

## Global Constraints

- **No test runner / linter.** Verify with `npm run build` (all inputs build) + visual check in `npm run dev`/`npm run preview`.
- **Vanilla HTML/CSS only.** Per CLAUDE.md the repo's vendored React/Tailwind design skills do NOT apply. Take the `taste-skill`'s design decisions and express them in plain HTML/CSS matching the existing marketing pages (`/product-mockups/`, `/ai/`).
- **Marketing page mechanics (verbatim, from `vite.config.js`):** the `htmlPartials()` plugin replaces `<!--PARTIAL:mark-->`, `<!--PARTIAL:nav-->`, `<!--PARTIAL:footer-->` (footer also gets `{{VERSION}}` → `package.json` version); the `ogBase()` plugin replaces `__OG_BASE__` → the site URL. A page must be registered in `rollupOptions.input` to build.
- **Partials live in** `site/partials/`: `mark.html`, `nav.html`, `footer.html`.
- **Tagline (locked):** "One screenshot in. A whole campaign out." Sub: "The AI studio that learns your brand, edits your pixels, and ships the rest — on autopilot."
- **Version is the single source:** `package.json` `version` drives the footer and the what's-new toast trigger. Bump it last (Task 31).
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
| `studio-intelligence/index.html` | The V30 marketing page. | Create |
| `vite.config.js` | Register the new input `studioIntelligence`. | Modify |
| `site/partials/nav.html` | Add a nav link (AI umbrella). | Modify |
| `site/partials/footer.html` | Add a footer link. | Modify |
| `ai/index.html` | Link the new page from the AI-suite hub. | Modify |
| `changelog/index.html` | Demote prior latest; add the v30 entry. | Modify |
| `src/features/whats-new.js` | V30 toast content + `CURRENT_VERSION='30.0'`. | Modify |
| `package.json` | `version` → `30.0.0`. | Modify |

---

## Task 28: Marketing page (`studio-intelligence/index.html`) with taste-skill

**Files:**
- Create: `studio-intelligence/index.html`
- Modify: `vite.config.js` (add the input)

**Interfaces:**
- Produces a static page at `/studio-intelligence/` with hero (tagline + CTA to `/editor/`) and four feature sections (Brand Brain, AI Screenshot Editor, Campaign Generator, Producer).

- [ ] **Step 1: Invoke the `taste-skill` for the page design**

Use the `taste-skill` to produce the design direction (layout system, type scale, spacing rhythm, section composition, color accents) for a premium feature-launch landing page with one hero + four feature blocks. **Translate its output into vanilla HTML/CSS** consistent with the existing marketing pages — do NOT introduce React/Tailwind. Keep the existing site's font stack (Geist + JetBrains Mono) and `/site.css` base; add page-scoped `<style>` for the new layout, as `product-mockups/index.html` does.

- [ ] **Step 2: Read the structural template**

Read `product-mockups/index.html` (head block, `<!--PARTIAL:mark-->`/`<!--PARTIAL:nav-->` usage, `<!--PARTIAL:footer-->`, the `__OG_BASE__` meta tags, the JSON-LD block) and mirror its skeleton exactly.

- [ ] **Step 3: Create the page**

Create `studio-intelligence/index.html` following this skeleton (fill the section bodies with the taste-skill-directed markup/visuals):
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="description" content="SnapShotPro Studio Intelligence: extract a brand system from any URL, edit screenshot content with AI, and generate a whole campaign of assets — on autopilot. Free, in your browser.">
    <title>Studio Intelligence · SnapShotPro</title>
    <link rel="canonical" href="__OG_BASE__/studio-intelligence/">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Studio Intelligence · SnapShotPro">
    <meta property="og:description" content="One screenshot in. A whole campaign out. The AI studio that learns your brand, edits your pixels, and ships the rest — on autopilot.">
    <meta property="og:image" content="__OG_BASE__/og.png?v=2">
    <meta name="theme-color" content="#080b14">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/site.css">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SnapShotPro Studio Intelligence",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "Web browser",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    }
    </script>
    <style>
      /* taste-skill-directed, page-scoped layout. Vanilla CSS only. */
    </style>
</head>
<body>

<!--PARTIAL:mark-->
<!--PARTIAL:nav-->

<header class="page-head">
  <h1>One screenshot in. A whole campaign out.</h1>
  <p class="lede">The AI studio that learns your brand, edits your pixels, and ships the rest — on autopilot.</p>
  <a class="btn btn-primary" href="/editor/">Open the studio</a>
</header>

<main>
  <section id="brand-brain"><!-- Brand Brain: URL/asset → enforceable brand system --></section>
  <section id="screenshot-editor"><!-- AI Screenshot Editor: fix text, recolor, redact, de-clutter --></section>
  <section id="campaign-generator"><!-- Campaign Generator: one design → hero + social + App Store + teaser --></section>
  <section id="producer"><!-- Producer: pick a goal, walk away, get a deliverable folder --></section>
</main>

<!--PARTIAL:footer-->
</body>
</html>
```
Each `<section>` should be a real feature block (heading, 1–2 sentence benefit, a visual or output grid) per the taste-skill direction. Placeholder imagery (`/og.png` or simple CSS mock cards) is acceptable until real captures exist.

- [ ] **Step 4: Register the Vite input**

In `vite.config.js`, inside the `rollupOptions.input` map, add (alongside `productMockups`):
```js
  studioIntelligence: resolve(__dirname, 'studio-intelligence/index.html'),
```

- [ ] **Step 5: Verify build + preview**

Run: `npm run build`
Expected: succeeds and emits `dist/studio-intelligence/index.html`.
Run `npm run preview`, open `/studio-intelligence/` → the page renders with nav + footer injected, the tagline hero, and four feature sections; `__OG_BASE__` is replaced (view source: canonical/OG URLs are absolute).

- [ ] **Step 6: Commit**

```bash
git add studio-intelligence/index.html vite.config.js
git commit -m "feat(v30): Studio Intelligence marketing page (taste-skill)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 29: Wire the page into nav, footer, and the AI hub

**Files:**
- Modify: `site/partials/nav.html`, `site/partials/footer.html`
- Modify: `ai/index.html` (link from the AI-suite hub)

**Interfaces:**
- Produces navigation entry points to `/studio-intelligence/` consistent with how existing pages are linked.

- [ ] **Step 1: Read the partials**

Read `site/partials/nav.html` and `site/partials/footer.html` to see the existing link markup (the AI umbrella `/ai/` link, the footer link groups).

- [ ] **Step 2: Add a nav link**

In `site/partials/nav.html`, add a link to `/studio-intelligence/` within the AI umbrella grouping (next to the existing `/ai/` link), matching the surrounding markup exactly (class names, structure).

- [ ] **Step 3: Add a footer link**

In `site/partials/footer.html`, add `/studio-intelligence/` to the appropriate link column (e.g. Product/Features), matching the existing item markup. Do not disturb `{{VERSION}}`.

- [ ] **Step 4: Link from the AI hub**

In `ai/index.html`, add a card/link to `/studio-intelligence/` in the AI-suite hub grid, matching the existing card markup.

- [ ] **Step 5: Verify**

Run: `npm run build` → succeeds.
Run `npm run preview` → the nav and footer (on any page, since partials are shared) show the new link; clicking it lands on `/studio-intelligence/`; the `/ai/` hub shows the new card.

- [ ] **Step 6: Commit**

```bash
git add site/partials/nav.html site/partials/footer.html ai/index.html
git commit -m "feat(v30): link Studio Intelligence from nav, footer, AI hub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 30: Changelog entry + What's-New toast (taste-skill)

**Files:**
- Modify: `changelog/index.html`
- Modify: `src/features/whats-new.js`

**Interfaces:**
- Produces the v30 changelog entry (new `.entry.latest`) and the in-app v30 toast content.

- [ ] **Step 1: Demote the current latest changelog entry**

In `changelog/index.html`, find the current `<li class="entry latest reveal">` (the v29 "Motion Studio" entry) and remove `latest` so it becomes `<li class="entry reveal">`.

- [ ] **Step 2: Add the v30 entry as the new latest**

Immediately above the (now-demoted) v29 entry, add — applying the `taste-skill` to the entry's visual treatment within the page's existing vanilla HTML/CSS idiom (you may add a small page-scoped CSS motif distinct from prior entries):
```html
<li class="entry latest reveal">
    <div class="entry-meta"><span class="ver">v30.0</span><span class="entry-date">June 2026</span></div>
    <div>
        <h2>Studio Intelligence</h2>
        <ul class="changes">
            <li><b>Brand Brain.</b> Paste a URL or drop a logo and SnapShotPro extracts a full brand system — palette, type, frame, logo — then applies and enforces it across every design and export.</li>
            <li><b>AI Screenshot Editor.</b> Edit the content inside a screenshot: fix a typo, recolor a button, auto-redact emails and names, or remove a stray cursor — the pixels change, and it bakes into every export.</li>
            <li><b>Campaign Generator.</b> Turn one screenshot into a coordinated set — hero, Instagram, X, LinkedIn, an App Store set, and a teaser video — saved in a revisitable Campaign folder you can re-download as a ZIP.</li>
            <li><b>Producer.</b> Pick a goal like "Launch kit", walk away, and come back to a finished, brand-consistent folder of assets. Copilot becomes autopilot.</li>
        </ul>
    </div>
</li>
```
Update any "spotlight"/hero area of the changelog page that references the latest release, per the page's existing pattern.

- [ ] **Step 3: Update the What's-New toast**

In `src/features/whats-new.js`:
(a) Change the version constant (line 13) from `const CURRENT_VERSION = '29.0';` to:
```js
const CURRENT_VERSION = '30.0';
```
(b) Replace the `WHATS_NEW` content object (lines ~18–28) with:
```js
const WHATS_NEW = {
  heading: "✨ Studio Intelligence",
  items: [
    { title: 'Brand Brain',
      desc: 'Extract a full brand system from any URL or logo — palette, type, frame, watermark — then enforce it across every design.' },
    { title: 'AI Screenshot Editor',
      desc: 'Edit the content inside a screenshot: fix text, recolor an element, auto-redact PII, or remove clutter. It bakes into export.' },
    { title: 'Campaign Generator',
      desc: 'One screenshot becomes a whole set — hero, social, an App Store set, and a teaser video — saved in a Campaign folder.' },
    { title: 'Producer',
      desc: 'Pick a goal, walk away. The Producer builds a finished, brand-consistent campaign folder on autopilot.' }
  ]
};
```
> Keep the existing `openWhatsNew()` render logic (it maps `WHATS_NEW.items` to `<li><b>${title}.</b> ${desc}</li>` and sets `#whatsnew-heading`/`#whatsnew-list`). Apply `taste-skill` polish to the toast's CSS only if it doesn't change the trigger/markup contract. Watch the apostrophe escaping in any `desc` strings (use straight text without unescaped `'` inside single-quoted JS strings).

- [ ] **Step 4: Verify**

Run: `npm run build` → succeeds.
Run `npm run preview`, open `/changelog/` → the v30 "Studio Intelligence" entry is the highlighted latest; v29 is a normal entry.
For the toast: temporarily set `localStorage.removeItem('snapshotpro_whatsnew_seen')` (or the key the module uses — confirm by reading it) and reload the editor → the V30 toast appears with the four items. (Confirm the exact seen-key name in `whats-new.js`.)

- [ ] **Step 5: Commit**

```bash
git add changelog/index.html src/features/whats-new.js
git commit -m "feat(v30): changelog entry + What's-New toast for Studio Intelligence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
```

---

## Task 31: Version bump + release close-out

**Files:**
- Modify: `package.json` (`version` → `30.0.0`)
- Modify: `editor/index.html` (any header/title version string, if present)

**Interfaces:**
- Produces the version bump that drives the footer `{{VERSION}}` and the what's-new toast trigger (which fires when `CURRENT_VERSION` from Task 30 differs from the user's last-seen version).

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "29.0.0"` to:
```json
  "version": "30.0.0",
```

- [ ] **Step 2: Update the editor title/header if it carries a version**

Read `editor/index.html` for any `v29`/`29.0` header or `<title>` version string; if present, update to v30.0. (If there is none, skip — the footer pulls `{{VERSION}}` automatically.)

- [ ] **Step 3: Final full-suite verification**

Run: `npm run build`
Expected: succeeds; `dist/` includes `studio-intelligence/index.html`; footers across pages show `30.0.0`.
Run `npm run preview` and spot-check: home/footer shows v30.0.0; `/studio-intelligence/` renders; `/changelog/` shows v30 latest.

- [ ] **Step 4: Commit + push**

```bash
git add package.json editor/index.html
git commit -m "chore(v30): bump version to 30.0.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F4eXWYRXAyzymounjdJDCc"
git push -u origin claude/v30-feature-brainstorm-qidm1d
```

---

## Self-Review (against the spec — Pillars 5 & 6)

**Spec coverage:**
- Marketing page as a new Vite input, partials/OG/version reuse, taste-skill design → Task 28. ✓
- Tagline + four feature sections → Task 28. ✓
- Nav/footer/AI-hub wiring → Task 29. ✓
- Changelog v30 entry (demote prior latest) with taste-skill → Task 30. ✓
- What's-New toast `CURRENT_VERSION='30.0'` + V30 content, taste-skill polish → Task 30. ✓
- Version bump 30.0.0 (footer + toast trigger) → Task 31. ✓

**Placeholder scan:** the section *bodies* of the marketing page are intentionally directed by the `taste-skill` at build time rather than hard-coded here — this is a design-generation step, not a code placeholder (the skeleton, inputs, partials, OG, tagline, and registration are all concrete). The "confirm the seen-key name" / "update header if present" notes are explicit read-then-act instructions at the integration site.

**Type/contract consistency:** the `WHATS_NEW` object shape (`{heading, items:[{title,desc}]}`) matches the existing `openWhatsNew()` consumer (verified from the current file). `CURRENT_VERSION` is a string matching the `package.json` `major.minor` convention used today (`'29.0'` → `'30.0'`). The Vite input key/value pattern matches every existing entry.
```
```

## V30 plan series — complete

All five plans are written and committed:
1. `2026-06-23-v30-01-foundations-brand-brain.md`
2. `2026-06-23-v30-02-ai-screenshot-editor.md`
3. `2026-06-23-v30-03-campaign-generator.md`
4. `2026-06-23-v30-04-producer.md`
5. `2026-06-23-v30-05-marketing-changelog-whatsnew.md`
