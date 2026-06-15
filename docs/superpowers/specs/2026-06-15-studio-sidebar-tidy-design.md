# Studio Sidebar Tidy — Design Spec

**Status:** Approved design (not yet implemented)
**Date:** 2026-06-15
**Type:** Housekeeping / tidy — **NOT a release.** No major version bump, no
what's-new toast, no changelog entry. Optional quiet patch (`20.0.1`) only.

## Goal

Make the editor's left sidebar cleaner and more organized: remove the version
badges that clutter feature names, let sections collapse so busy tabs aren't one
long scroll, and put each section in the right tab via explicit grouping. Keep the
existing 8-tab rail and the dark studio look. No feature behavior changes.

## Background (current state)

The sidebar (`editor/index.html`) has ~33 `<div class="sidebar-section">` blocks,
shown/hidden by an 8-tab rail in `src/features/studio-nav.js`. Today:
- **16 version badges** (`vNN`) sit next to section titles and a few sub-labels.
- Grouping is by **fragile substring matching** of the title text
  (`TITLE_GROUPS` in `studio-nav.js`), which mis-files sections.
- Sections are not collapsible; a tab is one long scroll. Separator is a single
  bottom border. Sections animate in with a staggered reveal.
- The AI and Frame tabs are overcrowded; Liquid Glass / Film Grain / Brand Kit
  are mis-filed under AI.

## Locked decisions (from brainstorm)

1. **Remove ALL version badges** (titles and sub-labels).
2. **Collapsible sections**, default **all expanded**, open/closed state
   remembered per section (localStorage).
3. **Explicit, robust grouping** via a `data-group` attribute on each section
   (replace title-substring matching).
4. **Rebalance** mis-filed sections (regroup map below).
5. Keep the 8-tab rail and the current dark theme. Just tidying.

## Regroup map (the `data-group` value per section)

- **import**: Image Upload, Auto Layout
- **adjust**: Image Editing, Color, Smart Palette, Design Variations, Image Settings
- **background**: Background, Mockup Scenes
- **frame**: Device & Window Frame, Mockup Presets, Shadow Settings, Reflection, 3D Tilt, Canvas Settings
- **markup**: Text & Annotations, Animation, Spotlight Effect, Privacy Tools, Watermark, Liquid Glass, Film Grain
- **ai**: Design Agent, AI Tools
- **export**: Video / Clip, App Store Sets, Export Settings, Share
- **project**: Projects, Pages & Deck, Templates, Brand Kit, Community Gallery

(Moves vs today: Liquid Glass + Film Grain → markup; Brand Kit → project; Color +
Design Variations consolidated under adjust. Exact current-section-to-tab audit
happens during implementation against the live file.)

## Architecture / changes

### `editor/index.html`
- Delete every version-badge `<span>` (the 16 occurrences) from titles and
  sub-labels. The sub-labels keep their text minus the badge (e.g. "AI Assets",
  "Generative AI", "Text Effects").
- Add `data-group="<group>"` to every `<div class="sidebar-section">` per the map.
- Convert each `<h3 class="section-title">` into a collapse toggle: a `<button>`
  (or the h3 made interactive) carrying the title + a chevron, with
  `aria-expanded`, controlling the section body. The section body is wrapped so it
  can be hidden when collapsed. Keep the accent-dot marker.

### `src/features/studio-nav.js`
- Read `el.dataset.group` directly instead of `groupForTitle()` substring
  matching. Remove `TITLE_GROUPS` (or keep only as a dev fallback for any section
  missing `data-group`). Show/hide by group unchanged.
- Keep the "hide the redundant section title on wide screens (panel header already
  names the group)" behavior. With collapsible headers, on wide screens the title
  row still acts as the collapse control; when hidden-as-redundant it should not
  break collapse (decide: keep the collapse control visible even when the group
  label is shown, OR keep current redundancy-hide — implementation picks the
  cleaner of the two and documents it).

### Collapse handler (in `studio-nav.js` or a small `sidebar-collapse.js`)
- On title-row click: toggle a `collapsed` class on the section, flip
  `aria-expanded`, persist to localStorage under a key derived from the section
  (e.g. `data-group` + title slug). Default expanded when no stored value.
- Hydrate stored collapsed state on load.

### `src/styles.css`
- Collapsible header styling: the title row as a full-width clickable control
  (pointer cursor, hover feedback), a chevron that rotates on collapse, body
  hidden via `.collapsed` (e.g. `max-height`/`display`), calmer section spacing.
- No theme/color changes; reuse existing variables.

## Data flow

Rail click → `studio-nav` shows sections whose `data-group` matches → user clicks
a section header → collapse handler toggles + persists. On load, grouping + stored
collapse states are applied.

## Error handling / edge cases

- Section missing `data-group` → falls back to showing in all groups (or a dev
  fallback via the old title map) so nothing disappears.
- localStorage unavailable/full → collapse still works in-session (try/catch;
  default expanded).
- Narrow screens (≤860px): rail/grouping already disabled (single scroll);
  collapsing still works and is a real win there.
- `updateUIFromState` and all feature bindings are unaffected (only markup
  wrappers + a class change; ids preserved).

## Undo / state / persistence

- No `state`/history changes. Collapse state is UI-only in localStorage (not part
  of design state). No feature logic touched; all element ids preserved so every
  existing `bind*` keeps working.

## Testing / verification (no test runner — manual in `npm run dev`)

- No version badges remain anywhere in the sidebar.
- Each tab shows exactly its mapped sections; nothing missing or duplicated.
- Liquid Glass / Film Grain appear under Markup; Brand Kit under Project; AI tab
  shows only Design Agent + AI Tools.
- Section headers collapse/expand on click; chevron rotates; state persists across
  reload and across tab switches.
- Default is all-expanded on first load (cleared localStorage).
- Every feature still works (spot-check sliders/toggles in moved sections) since
  ids are unchanged.
- Narrow screen: single scroll, collapsing works.
- `npm run build` succeeds.

## Out of scope

- Any version bump beyond an optional patch; no what's-new, no changelog.
- New tabs, renaming the 8 groups, or a search/jump box (that was the larger IA
  option, declined).
- Theme/color restyle, new feature behavior, or touching feature logic/state.
