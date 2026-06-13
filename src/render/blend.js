// v15.0 — per-layer blend mode + opacity.
//
// A single helper that every layer draw site routes through, so the main
// screenshot, annotations, extra images and the text overlay all composite
// the same way. `layer` is whatever object carries the optional `blend` /
// `opacity` fields (state.imageLayer, an annotation, an extra image, the text
// overlay). Missing fields read as the no-op defaults, so pre-v15 designs draw
// identically.

// Curated set (10) — the modes that read cleanly on screenshots. `source-over`
// is canvas-speak for "normal". Kept here as the single source of truth for the
// <select> in the layers panel.
export const BLEND_MODES = [
  { id: 'source-over', name: 'Normal' },
  { id: 'multiply', name: 'Multiply' },
  { id: 'screen', name: 'Screen' },
  { id: 'overlay', name: 'Overlay' },
  { id: 'soft-light', name: 'Soft light' },
  { id: 'hard-light', name: 'Hard light' },
  { id: 'color-dodge', name: 'Color dodge' },
  { id: 'color-burn', name: 'Color burn' },
  { id: 'difference', name: 'Difference' },
  { id: 'luminosity', name: 'Luminosity' }
];

// Run `draw` with the layer's blend mode and opacity applied to `ctx`.
// globalAlpha is *multiplied* (not assigned) so this stacks with any alpha the
// caller already set — e.g. the animation entrance alpha in v15.2.
// Fast-paths the common case (normal + 100%) so untouched layers pay nothing
// and don't take an extra save/restore.
export function withLayer(ctx, layer, draw) {
  const blend = (layer && layer.blend) || 'source-over';
  const opacity = layer && layer.opacity != null ? layer.opacity : 100;
  if (blend === 'source-over' && opacity >= 100) { draw(); return; }
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * Math.max(0, Math.min(1, opacity / 100));
  ctx.globalCompositeOperation = blend;
  draw();
  ctx.restore();
}
