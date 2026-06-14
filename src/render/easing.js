// v15.2 — Easing library.
//
// Named easing curves shared by element entrance animations (animation.js) and
// Ken Burns (ken-burns.js). Each is a pure (t: 0..1) => number. `easeInOut` is
// the same quadratic the codebase already used (animation.js / auto-zoom.js), so
// existing animations are unchanged. `EASING_OPTIONS` mirrors the BLEND_MODES
// pattern in blend.js for building <select> menus.

export const EASINGS = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  // Identical to the prior easeInOut: 1 - (-2t+2)²/2 === -1 + (4-2t)t.
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Slight overshoot past the target before settling.
  backOut: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Springy settle.
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  // Ported from the previous easeBounce in animation.js.
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  }
};

// Safe lookup — unknown / missing names fall back to easeInOut (the prior default).
export function getEasing(name) {
  return EASINGS[name] || EASINGS.easeInOut;
}

// Ordered list for UI <select> population.
export const EASING_OPTIONS = [
  { id: 'easeInOut', name: 'Ease in-out' },
  { id: 'linear', name: 'Linear' },
  { id: 'easeIn', name: 'Ease in' },
  { id: 'easeOut', name: 'Ease out' },
  { id: 'easeInOutCubic', name: 'Ease in-out (strong)' },
  { id: 'backOut', name: 'Overshoot' },
  { id: 'elasticOut', name: 'Elastic' },
  { id: 'bounce', name: 'Bounce' }
];
