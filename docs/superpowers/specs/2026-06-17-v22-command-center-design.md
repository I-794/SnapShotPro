# V22 — Command Center (design spec)

Date: 2026-06-17
Status: Approved design → ready for implementation plan
Release type: **Polish** (not a new flagship). Headline: "Command Center".

## Summary

SnapShotPro has grown to 60+ feature modules. A Cmd-K command palette already
exists (`src/features/palette.js`, ~70 commands, fuzzy match, full keyboard
nav), but it is a static, hand-maintained list with no awareness of context,
no memory of what you use, no categories, and no keyboard-shortcut hints.
Separately, keyboard shortcuts are defined imperatively in
`src/features/keyboard.js`, while the `?` help overlay lists them as
hand-written HTML in `editor/index.html` — the two have **already drifted**
(the overlay omits the arrow-key nudge and the timeline `,` `.` `[` `]`
shortcuts).

V22 turns the existing palette into a real **Command Center** and makes the
shortcut list a single generated source of truth. This is a polish release that
builds on existing code — it does **not** introduce a new palette or a new
rendering path.

### Goals

1. One declarative registry of global keyboard shortcuts; the `?` overlay is
   generated from it so it can never drift from the dispatcher again.
2. The palette only offers commands that apply right now (context-aware).
3. The palette remembers what you use (recents/frequents) and surfaces it on an
   empty query.
4. The palette is organized (categories) and shows keyboard-shortcut hints.

### Non-goals (YAGNI)

- No render-pipeline performance work (separate future release).
- No new commands beyond what's needed to demonstrate the categories; the
  existing ~70 commands are re-used.
- No remapping/customizing of shortcuts by the user.
- No fuzzy-search library; the existing `fuzzyMatch` stays.

## Architecture

Three files change and one is added. The mutable-`state` + `render()` model and
the `bind*` startup convention are unchanged. The new module follows the
existing feature conventions (top-of-file version tag, exported `bind*` if it
owns DOM listeners).

```
src/features/shortcuts.js   (NEW)  — declarative shortcut registry +
                                     overlay generator + event matcher
src/features/keyboard.js    (EDIT) — dispatch simple globals via the registry;
                                     keep bespoke interactive handlers
src/features/palette.js     (EDIT) — command metadata (group/keys/when),
                                     context filtering, recents, grouped UI
src/features/command-usage.js (NEW)— localStorage recents/frequents store
editor/index.html           (EDIT) — `?` overlay becomes a generated container;
                                     palette result-row markup gains hint/tag
```

### Unit 1 — Shortcut registry (`src/features/shortcuts.js`)

Single source of truth for keyboard shortcuts shown to users.

- Exports `SHORTCUTS`: an ordered array of
  `{ keys, label, group, cmdId?, dispatch?, displayOnly? }`.
  - `keys` — a normalized descriptor, e.g. `'mod+s'`, `'mod+shift+c'`, `'?'`,
    `'mod+k'`, `'delete'`, `'escape'`, `'arrows'`, `', / .'`, `'[ / ]'`.
    `mod` renders as `Cmd/Ctrl`.
  - `group` — `'File' | 'Edit' | 'View' | 'Tools' | 'Timeline'`.
  - `cmdId` — optional link to a palette command id (so the palette can show
    the same key hint, and so the registry can dispatch by calling that
    command's `run`).
  - `dispatch` — optional handler for shortcuts that are NOT plain command runs
    but are still simple, declarative globals.
  - `displayOnly: true` — listed for the `?` overlay but dispatched by
    `keyboard.js`'s bespoke logic (escape cascade, arrow nudge, timeline scrub,
    delete). Keeps one display source without forcing those handlers through
    the registry.
- Exports `formatKeys(keys)` → an array of `<kbd>`-ready strings.
- Exports `renderShortcutsOverlay(containerEl)` → builds the overlay grid from
  `SHORTCUTS`, grouped by `group` with a subheading per group. Called once at
  init (and idempotent).
- Exports `matchEvent(e)` → returns the matching non-`displayOnly` `SHORTCUTS`
  entry, or null. Used by `keyboard.js`.

Dependencies: imports the command list lookup from `palette.js` only via a
small accessor (`getCommandById`) to avoid an import cycle; or, simpler, the
registry stores `dispatch`/`cmdId` and `keyboard.js` resolves `cmdId` against
the palette. The chosen direction: `keyboard.js` owns the wiring (it already
imports both), so `shortcuts.js` stays dependency-light (no import of
`palette.js`).

### Unit 2 — `keyboard.js` (edit)

- The simple global shortcuts currently hardcoded (export `mod+s`, undo `mod+z`,
  redo `mod+y`/`mod+shift+z`, copy `mod+shift+c`, palette `mod+k`, `?` overlay)
  are dispatched by consulting `matchEvent(e)` first and running the linked
  command/`dispatch`. The literal key handling is removed in favor of the
  registry entry, so the registry is the truth for both behavior and display.
- The **bespoke, context-sensitive** handlers stay exactly as they are: the
  Escape cascade (overlay → sticker drawer → tool reset → deselect), the
  arrow-key nudge with `e.repeat` history handling, the timeline frame
  stepping/in-out, and delete/backspace. These are marked `displayOnly` in the
  registry purely so the `?` overlay can show them.
- `showShortcuts()` continues to toggle the overlay; the overlay's content is
  now produced by `renderShortcutsOverlay()` at init instead of static HTML.
- The typing-target guard and palette-open early-return are unchanged.

### Unit 3 — Command-usage store (`src/features/command-usage.js`)

- localStorage key `snapshotpro_cmd_usage` → `{ [commandId]: { count, last } }`.
- Exports `recordUse(id)`, `getRecent(limit)` (by `last` desc),
  `getFrequencyBoost(id)` (small, capped score for ranking).
- Bounded: prune to the most recent ~50 ids on write so the store can't grow
  unbounded. Corrupt/missing JSON is treated as empty (try/catch), matching how
  other features read their `snapshotpro_*` keys.

### Unit 4 — `palette.js` (edit)

- **Command metadata.** Each entry in `registerCommands()` gains:
  - `group` — same vocabulary as the shortcut registry, used for headers/tags.
  - `keys` (optional) — the shortcut descriptor when one exists, so the row can
    render a hint chip. (Derived from / kept consistent with `SHORTCUTS` by
    sharing the same string; a dev-time console.warn flags a command whose
    `keys` has no matching `SHORTCUTS` entry.)
  - `when` (optional) — a predicate `() => boolean`; default true. Examples:
    - `video-play|video-mp4|video-gif` → only when a video clip is loaded.
    - timeline-related → only when `timelineActive()`.
    - `export-set` → only when `state.mode === 'set'`; `export-batch` → batch.
    - `clear-annotations` → only when `state.annotations.length`.
    - `clear-redactions` → only when `state.redactions.length`.
    - `anim-play` → only when an animation is configured.
    (Implementer verifies exact `state` keys against `src/state/state.js`; where
    a command currently proxies a DOM button via `getElementById(...).click()`,
    the predicate may instead test for that element's presence/enabled state.)
- **Filtering & ranking** in `renderPaletteResults()`:
  - Commands whose `when()` is false are excluded from results entirely.
  - Empty query → grouped view: a **Recent** section first
    (`getRecent` ∩ currently-applicable commands, deduped), then each `group`
    under a subheading in a fixed group order.
  - Non-empty query → flat ranked list (current behavior) using `fuzzyMatch`,
    with a small additive `getFrequencyBoost` so often-used commands edge up.
    Result cap stays at 40.
- **Usage recording.** `runPaletteIndex()` calls `recordUse(cmd.id)` before
  running.
- Keyboard nav (`activeIdx`, arrows, Enter, Esc) is unchanged but must skip
  non-selectable section-header rows.

### Unit 5 — Palette UI / markup & CSS

- `editor/index.html`: the `?` overlay's `.shortcuts-grid` becomes an empty
  container populated by `renderShortcutsOverlay()`. The palette result-row
  template (built in JS) gains an optional right-aligned **hint chip**
  (`<kbd>`) and a subtle **group tag**.
- New CSS (in the existing palette stylesheet block): `.palette-section-header`,
  `.palette-item .palette-keys` (kbd chips), `.palette-item .palette-group`
  (muted right-aligned tag). Styling matches the current `.palette-item` look;
  no new color tokens.

## Data flow

```
init():
  registerCommands()            // palette.js — builds command list w/ metadata
  renderShortcutsOverlay(el)     // shortcuts.js — generates ? overlay from SHORTCUTS
  bindPalette(); bindKeyboard()  // existing

keydown:
  keyboard.js → matchEvent(e)?  yes → run linked command/dispatch
              → else bespoke handler (escape/nudge/timeline/delete)

Cmd-K open palette:
  empty query  → Recent (filtered by when ∩ usage) + grouped categories
  typed query  → fuzzy(when-filtered commands) + frequency boost
  run          → recordUse(id) → cmd.run()
```

## Error handling

- `command-usage.js` and any localStorage read are wrapped in try/catch and
  fall back to empty, consistent with existing `snapshotpro_*` consumers.
- `cmd.run()` keeps the existing try/catch in `runPaletteIndex`.
- A `keys`/`SHORTCUTS` mismatch is a dev-time `console.warn` only — never a
  user-facing error.
- Context predicates that throw are treated as `false` (command hidden) rather
  than breaking the whole result render.

## Undo/redo

No new undoable `state` is introduced. Command usage and the palette's open
state are runtime/persisted-UI concerns, not part of the `snapshot()`
allow-list. `state.ui.paletteOpen` already exists and stays out of history.

## Testing / verification

No test runner exists; verify in `npm run dev`:
1. `?` overlay lists every shortcut `keyboard.js` actually handles (nudge +
   timeline keys now appear) and nothing it doesn't.
2. Cmd-K with empty input shows a Recent section after using a few commands;
   recents persist across reload.
3. Context: with no video clip, the three Video commands are absent; load a
   clip → they appear. In Single mode, "Export App Store set" is absent.
4. Commands with shortcuts show the correct hint chip; running via the chip's
   key and via the palette both work and both record usage.
5. Existing behavior (export, undo/redo, copy, tool/scene/bg/AI commands) is
   unchanged.

## Release chores (per CLAUDE.md)

- Bump `package.json` to `22.0.0` (drives footer + returning-user toast).
- Add a "what's new" entry in `src/features/whats-new.js`.
- Add a `v22 · …` entry to `changelog/index.html` with its own motif
  (a command-line / palette motif), consistent with prior release spotlights.

## Files touched (recap)

| File | Change |
| --- | --- |
| `src/features/shortcuts.js` | NEW — registry, overlay generator, `matchEvent` |
| `src/features/command-usage.js` | NEW — recents/frequents store |
| `src/features/palette.js` | metadata, context filter, recents, grouped UI |
| `src/features/keyboard.js` | dispatch globals via registry; keep bespoke handlers |
| `src/main.js` | call `renderShortcutsOverlay()` at init |
| `editor/index.html` | overlay container; palette row markup; CSS |
| `package.json`, `whats-new.js`, `changelog/index.html` | release chores |
