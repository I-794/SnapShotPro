# SnapShot-Pro Design Audit Agent Brief

Use this packet when you want subagents to audit SnapShot-Pro without editing the product. The goal is to collect evidence, produce focused findings, merge duplicates, and leave the implementation decision for a later pass.

## Audit Goal

Run a design, UX, and accessibility audit of the current SnapShot-Pro website and editor.

The audit should answer:

- Does the product feel premium, modern, and coherent?
- Is the main screenshot-to-export workflow easy to understand?
- Are the landing page and editor aligned around the same brand promise?
- Are there visual defects, cramped controls, broken responsive states, or branding drift?
- Are there accessibility risks that should be fixed before shipping?

## Product Context

- Product: SnapShot-Pro
- Current package version: `30.0.0`
- Repo: `C:\Users\14148\Documents\GitHub\SnapShotPro`
- Landing surface: `/`
- Editor surface: `/editor/`
- Primary brand direction: bright editorial premium with electric cobalt
- Original brand mark: `public/favicon.svg`
- Important files to inspect when needed:
  - `index.html`
  - `editor/index.html`
  - `src/styles.css`
  - `src/main.js`
  - `src/state/state.js`
  - `src/render/render.js`
  - `vite.config.js`

## Non-Negotiable Rules

- Do not edit code.
- Do not stage, commit, or push anything.
- Capture current evidence before making claims.
- Use only screenshots, DOM observations, source inspection, or behavior observed during this audit run.
- Do not reuse old screenshots or old chat notes as audit evidence.
- Do not claim full WCAG compliance from screenshots alone.
- Every major finding must point to a screenshot, observed behavior, or exact file evidence.
- Keep findings specific enough that a later implementation agent can act on them.

## Brand Constraints

- Preserve the OG SnapShot-Pro logo/name.
- Watch for drift between `SnapShotPro`, `SnapShot-Pro`, and other spellings.
- Stay on the bright editorial premium and electric cobalt direction unless the user explicitly changes it.
- Inspect showcase frames, browser frames, 3D tilt cards, mockups, and gallery cards for pale borders, white slivers, broken crops, or placeholder-looking imagery.
- Treat premium visual quality as part of the product promise, not optional polish.

## Evidence Folder

Recommended local output:

```text
outputs/design-audits/YYYY-MM-DD-snapshotpro/
  screenshots/
  subagent-reports/
  findings.json
  final-audit.md
```

Screenshot naming:

```text
01-landing-desktop-hero.png
02-landing-mobile-hero.png
03-editor-empty-desktop.png
04-editor-upload-state.png
05-editor-export-panel.png
```

If a screenshot cannot be captured, write a blocker in the report instead of inventing evidence.

## Severity Scale

- `P0`: Broken or blocking. The user cannot complete a core task, or the page visibly fails.
- `P1`: Major UX or trust issue. The product works, but the workflow, hierarchy, or visual quality could seriously hurt adoption.
- `P2`: Polish issue. The experience is usable, but visual quality, consistency, or clarity is below the intended premium bar.
- `P3`: Idea or enhancement. Useful, but not required before shipping.

## Finding Schema

Each subagent must return findings in this shape:

```json
{
  "id": "editor-export-01",
  "surface": "editor",
  "lane": "export-share",
  "viewport": "desktop",
  "severity": "P1",
  "finding": "The export path is split across multiple panels and buttons, making the final step feel harder than it should.",
  "evidence": "screenshots/05-editor-export-panel.png",
  "why_it_matters": "Export is the payoff moment. If the user cannot confidently finish, the studio feels powerful but hard to trust.",
  "recommended_fix": "Create a clearer export hierarchy: primary export action, secondary format controls, and advanced export tools below.",
  "confidence": "medium",
  "suggested_file_area": "editor/index.html, src/styles.css"
}
```

Confidence values:

- `high`: directly visible or reproducible.
- `medium`: likely from visible evidence, but should be checked during implementation.
- `low`: plausible risk that needs more testing.

## Coordinator Prompt

Use this prompt for the coordinating agent.

```md
You are the coordinator for a SnapShot-Pro design audit.

Do not edit code. Your job is to assign focused audit lanes to subagents, collect their evidence-backed findings, remove duplicates, rank the most important issues, and write the final audit.

Product:
- SnapShot-Pro
- Repo: C:\Users\14148\Documents\GitHub\SnapShotPro
- Landing: /
- Editor: /editor/
- Version: 30.0.0

Brand constraints:
- Preserve the OG SnapShot-Pro logo/name.
- Stay on the bright editorial premium + electric cobalt direction.
- Watch for pale borders, white slivers, broken tilt/showcase frames, cramped controls, placeholder imagery, or branding drift.

Audit rules:
- Do not edit files.
- Do not stage, commit, or push.
- Use evidence from this audit run only.
- Every major finding needs a screenshot, exact observed behavior, or file evidence.
- Accessibility findings should be framed as risks unless tested with the right assistive technology.

Recommended lanes:
1. Landing page audit
2. Editor first-run and upload workflow audit
3. Editor tool hierarchy and visual editing audit
4. Export and share workflow audit
5. Visual system and brand consistency audit
6. Accessibility and keyboard audit
7. Mobile responsive audit

After subagents report back:
- Merge duplicate findings.
- Keep the highest severity when duplicates overlap.
- Preserve evidence paths.
- Rank the top 10 issues.
- Separate must-fix items from polish and ideas.
- Write `final-audit.md` and `findings.json`.

Final output format:

# SnapShot-Pro Design Audit

## Audit Scope
Describe audited surfaces, viewports, tools, and limits.

## Executive Summary
Write 3-5 plain-language bullets about the overall product health.

## Top Fixes
List the top 10 findings by severity and impact.

## Surface Notes
Group observations by Landing, Editor, Export/Share, Mobile, Accessibility, and Brand.

## Evidence Limits
State what could not be tested from screenshots alone.

## Recommended Implementation Order
Give a practical order for a later fix pass.
```

## Shared Base Prompt For Every Subagent

Paste this at the top of every subagent prompt, then add the lane-specific assignment below.

```md
You are running a design audit for SnapShot-Pro.

Do not edit code. Capture current evidence, inspect the rendered product, and return findings only.

Product context:
- Product: SnapShot-Pro
- Repo: C:\Users\14148\Documents\GitHub\SnapShotPro
- Landing: /
- Editor: /editor/
- Version: 30.0.0
- Brand direction: bright editorial premium with electric cobalt

Brand constraints:
- Preserve the OG SnapShot-Pro logo/name.
- Watch for drift between SnapShotPro and SnapShot-Pro.
- Stay on the bright editorial premium + electric cobalt direction.
- Watch for pale borders, white slivers, broken tilt/showcase frames, cramped controls, placeholder imagery, or branding drift.

Audit rules:
- Do not edit files.
- Do not stage, commit, or push.
- Use evidence from this audit run only.
- Capture screenshots when possible.
- Inspect screenshots before accepting them.
- Reject blank, loading, cropped, or wrong-state screenshots.
- Do not claim full accessibility compliance from screenshots alone.

For every finding, include:
- Surface
- Lane
- Viewport
- Severity: P0 broken, P1 major UX issue, P2 polish issue, P3 idea
- Screenshot or exact evidence
- Why it matters
- Recommended fix
- Confidence
- Suggested file area if obvious

Return 5-10 findings max. Favor high-signal issues over long lists.
```

## Subagent 1: Landing Page Audit

```md
Your lane: Landing page audit.

Audit only the public landing page at `/`.

Viewports:
- Desktop: 1440 x 900
- Mobile: 390 x 844

Check:
- First impression and premium feel
- Brand/name consistency
- Hero hierarchy and CTA clarity
- Whether the page makes the product promise obvious
- Whether imagery feels real, relevant, and polished
- Feature section clarity
- Trust and reassurance
- Responsive text fit and spacing
- Any placeholder-looking assets or broken crops
- Discord/social metadata only if visible in source

Important evidence targets:
- Hero first viewport
- CTA area
- Browser/showcase frame
- Feature cards or galleries
- Footer or final CTA

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Subagent 2: Editor First-Run And Upload Workflow Audit

```md
Your lane: Editor first-run and upload workflow.

Audit only `/editor/`, focused on the empty editor state and the path to getting the first screenshot onto the canvas.

Viewports:
- Desktop: 1440 x 900
- Laptop: 1280 x 800

Check:
- Empty state clarity
- Upload affordance
- Drag/drop, choose image, paste, URL, SVG/code entry if visible
- Whether the first action is obvious
- Whether the editor feels approachable or overwhelming
- Left rail/sidebar discoverability
- Header actions
- Initial canvas framing
- Loading, error, and unsupported-file hints if encountered

Important evidence targets:
- Editor initial state
- Upload zone
- Image upload controls
- Sidebar/rail default group
- First successful image-on-canvas state if reachable

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Subagent 3: Editor Tool Hierarchy And Visual Editing Audit

```md
Your lane: Editor tool hierarchy and visual editing.

Audit `/editor/` after an image is present, focused on the editing controls rather than export.

Viewports:
- Desktop: 1440 x 900

Check:
- Tool grouping and information architecture
- Whether common controls are easy to find
- Visual hierarchy inside sidebars and panels
- Control density, labels, icon clarity, and spacing
- Range controls, toggles, menus, segmented states, tabs, and panels
- Canvas-to-control relationship
- Feedback after changing styles
- Whether advanced features crowd out the main workflow
- Any controls with text overflow or cramped layout

Important evidence targets:
- Active image/canvas state
- Main style controls
- Device/mockup controls
- Brand kit or AI-related controls if visible
- Any dense panel that feels hard to scan

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Subagent 4: Export And Share Workflow Audit

```md
Your lane: Export and share workflow.

Audit `/editor/`, focused on finishing work: download, export, share, App Store sets, batch export, video/GIF/MP4, HTML card, and cloud share if visible.

Viewports:
- Desktop: 1440 x 900

Check:
- Whether the primary export action is obvious
- Whether export settings are grouped clearly
- Format, quality, size, preset, GIF, MP4, PDF, ZIP, HTML, and share controls
- Whether advanced export options compete with the main export action
- Progress, success, and error messaging
- Cloud share setup clarity
- Whether the payoff moment feels trustworthy

Important evidence targets:
- Header export button
- Export rail/panel
- Export size grid
- Export settings
- Share panel
- App Store set or batch export panel if visible
- Success/error notification if reachable

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Subagent 5: Visual System And Brand Consistency Audit

```md
Your lane: Visual system and brand consistency.

Audit the landing page and editor together. Focus on visual quality, brand consistency, and polish.

Viewports:
- Desktop landing: 1440 x 900
- Desktop editor: 1440 x 900
- Mobile landing: 390 x 844
- Mobile editor: 390 x 844 if usable

Check:
- Logo and name consistency
- Cobalt brand color usage
- Typography hierarchy
- Spacing rhythm
- Card radius and borders
- Shadows, glows, gradients, and contrast
- Placeholder-looking imagery
- Showcase/browser frames
- White slivers, pale edges, awkward crops, or broken 3D tilt frames
- Consistency between landing and editor
- Whether the product feels premium rather than template-like

Important evidence targets:
- Landing hero
- Landing showcase/gallery cards
- Editor header/logo
- Editor sidebar and panels
- Canvas/upload state
- Mobile top section

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Subagent 6: Accessibility And Keyboard Audit

```md
Your lane: Accessibility and keyboard risks.

Audit landing and editor for visible and testable accessibility risks.

Viewports:
- Desktop: 1440 x 900
- Mobile: 390 x 844

Check:
- Keyboard navigation for major controls
- Focus visibility
- Logical tab order
- Button and input labels
- Color contrast risks
- Text size and readability
- Target size and touch affordances
- Error/status announcements where visible
- Motion or animation risks
- Responsive reflow
- Whether icon-only controls have accessible names when inspectable

Important evidence targets:
- Focus states
- Header actions
- Rail buttons
- Upload controls
- Export controls
- Modals or popovers if reachable
- Mobile controls

Write accessibility issues as risks unless tested with assistive technology.

Return:
- 5-10 findings
- 2-4 confirmed strengths
- Evidence limits and verification gaps
- Any blockers
```

## Subagent 7: Mobile Responsive Audit

```md
Your lane: Mobile responsive audit.

Audit landing and editor on small screens.

Viewports:
- 390 x 844
- 360 x 740 if time allows

Check:
- First viewport fit
- Text wrapping and overflow
- CTA visibility
- Navigation behavior
- Editor header fit
- Upload state usability
- Sidebar/rail behavior
- Touch target sizing
- Export access
- Horizontal scroll or clipped controls
- Whether mobile feels intentionally designed rather than squeezed

Important evidence targets:
- Landing hero mobile
- Landing feature section mobile
- Editor empty state mobile
- Editor controls mobile
- Export access mobile

Return:
- 5-10 findings
- 2-4 strengths
- Any blockers
```

## Optional Subagent 8: Source Consistency Audit

```md
Your lane: source consistency audit.

Do not judge visual quality unless you have rendered evidence. Inspect source for naming, metadata, file organization, and likely visual-risk areas.

Check:
- Product naming in `index.html`, `editor/index.html`, metadata, title tags, alt text, visible headers
- Version labels
- Open Graph and Twitter card metadata
- Favicon/logo references
- Asset references that look temporary, placeholder, or remote
- Inline styles that may cause inconsistent UI
- Hard-coded labels that conflict with brand or release version

Important files:
- index.html
- editor/index.html
- src/styles.css
- public/favicon.svg
- scripts/build-og.mjs if metadata appears relevant

Return:
- 5-10 findings
- Exact file evidence with line numbers where possible
- Suggested file area
```

## Final Audit Report Template

Use this for `final-audit.md`.

```md
# SnapShot-Pro Design Audit

Date: YYYY-MM-DD
Product version: 30.0.0
Audited surfaces: landing `/`, editor `/editor/`
Evidence folder: outputs/design-audits/YYYY-MM-DD-snapshotpro/

## Audit Scope

Describe what was captured, which viewports were used, which workflows were attempted, and what could not be tested.

## Overall Health

Write 3-5 bullets:
- What feels strong
- What feels risky
- What should be fixed first

## Top 10 Findings

| Rank | Severity | Surface | Finding | Evidence | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| 1 | P1 | Editor | ... | screenshots/...png | ... |

## Must Fix Before Shipping

List P0 and high-impact P1 items.

## Important Polish

List P2 items that matter for premium quality.

## Ideas

List P3 items.

## Landing Page Notes

Strengths, risks, recommendations.

## Editor Workflow Notes

Strengths, risks, recommendations.

## Export And Share Notes

Strengths, risks, recommendations.

## Mobile Notes

Strengths, risks, recommendations.

## Accessibility Risks

Confirmed strengths, likely issues, WCAG-relevant considerations, and verification gaps.

## Brand Consistency Notes

Logo, naming, color, typography, imagery, and visual polish notes.

## Evidence Limits

State what could not be verified from screenshots or source inspection alone.

## Recommended Fix Order

1. Fix blockers and confusing core workflow issues.
2. Fix brand/name drift and obvious visual defects.
3. Tighten export/share hierarchy.
4. Improve mobile and accessibility risks.
5. Polish premium visuals and copy.
```

## Merge Rules For Coordinator

- Merge duplicate findings when they describe the same user-facing issue.
- Keep the clearest evidence path.
- Keep the highest severity if two agents disagree.
- If severity differs by more than one level, mention the disagreement in the note.
- Do not bury accessibility findings inside visual polish.
- Do not let source-only findings override rendered evidence.
- Prefer fewer, sharper findings over a long unactionable list.

## Acceptance Checklist

The audit is complete when:

- Each assigned lane returned a report or a clear blocker.
- Every major finding has evidence.
- Screenshots are saved in order and named clearly.
- Findings are deduplicated.
- P0/P1 issues are ranked above polish.
- Accessibility risks include evidence limits.
- The final report gives a clear implementation order.
- No product files were edited.

