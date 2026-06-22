# Product

## Register

product

> This is the **editor / studio** surface (`/editor/`, entry `editor/index.html` →
> `src/main.js`). Register is **product**: design serves the task. The repo's root
> `PRODUCT.md` is the **brand** counterpart for the marketing site. Because this isn't a
> monorepo, impeccable loads the root (brand) context by default — for editor work, point
> the skill at an editor surface and have it read these `editor/` files directly (see the
> loading note in `editor/DESIGN.md`).

## Users

Someone mid-task with an image already in hand: an indie developer assembling an App
Store screenshot set, a founder dressing up a product shot for a launch, a designer or
marketer producing social and landing imagery, a creator turning a capture into a GIF
or MP4. They are *working*, not browsing — they dropped in a screenshot and want to get
to a finished, on-brand asset fast, often without formal design training. Many are
repeat users who know roughly what they want and value speed, reversibility (undo), and
keeping their images on their own machine. They move between import, adjust, background,
frame, markup, AI, and export many times per session.

## Product Purpose

The studio is the workspace where a raw screenshot becomes a finished asset. One
mutable scene drives a single canvas; every feature — backgrounds, device frames (2D
and WebGL 3D mockups), filters, reflections, effects, annotations, text/watermark/logo,
liquid glass, code snippets, interactive tours — bakes into that one render and exports
to PNG, social sizes, App Store sets, GIF, or MP4. Success on any given screen is the
user completing the next step of their edit with minimal friction and full confidence:
controls are discoverable, the canvas always reflects truth, nothing is lost (undo/redo
+ history), and the result that previews is exactly the result that exports.

## Brand Personality

Same family as the brand voice — **assured, editorial, trustworthy** — expressed as a
tool rather than a pitch: calm, precise, and quietly powerful. The UI should feel like a
professional instrument that respects the user's focus: dense where density helps,
never noisy; opinionated defaults that look good immediately; depth available without
clutter. It earns trust by being predictable and reversible, and by rendering locally.

## Anti-references

- **Generic AI/SaaS template.** No purple-gradient chrome or stock dashboard kit; the
  studio has its own deliberate dark, glass, cobalt identity — keep it.
- **Cluttered pro-tool density (Photoshop / pro-video editors).** The single biggest
  risk for an editor. Resist wall-to-wall toolbars, nested inscrutable panels, and
  tiny-target control soup. Progressive disclosure (the icon-rail + one contextual
  panel, collapsible sections) over everything-at-once.
- **Childish / cartoonish consumer cuteness.** No toy-like rounded blobs, sticker piles,
  or emoji-driven UI. Refined and instrumental.

## Design Principles

1. **The canvas is the truth.** Every visual feature bakes into one render; preview must
   equal export. Don't add preview-only chrome that misleads about the final result
   (the deliberate exceptions — minimap, tour hotspot authoring — stay clearly chrome).
2. **Progressive disclosure over density.** Surface the common path; tuck depth behind
   the rail, collapsible sections, and the command palette. Approachable first, powerful
   on demand — never Photoshop-on-load.
3. **Beautiful by default.** Sensible padding, framing, and color the moment an image
   lands; good output should not require fiddling.
4. **Reversible and forgiving.** Undo/redo, history timeline, and non-destructive edits
   are load-bearing. New mutating state must be undoable; never trap the user.
5. **Fast and local.** Rendering happens in the browser; keep interactions snappy and
   privacy intact. Speed and ownership are part of the product feel.

## Accessibility & Inclusion

No formal conformance target specified. Practical priorities for a dense editor:
keyboard reachability for primary actions (the app already has a shortcuts system and
command palette — keep them complete and discoverable via `?`), visible focus states on
controls, sufficient contrast for the small `11–13px` UI type and tertiary labels on the
dark surfaces, and honoring `prefers-reduced-motion` for the staggered section reveals
and timeline/animation playback.
