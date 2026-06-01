// v11.2 — AI Art Director.
//
// One prompt → a full design composition. We ask the model (JSON mode) for a
// spec whose keys map directly onto existing state, then validate/clamp every
// field against the renderers' known enums/ranges before applying via the
// canonical path (saveStateToHistory → mutate → render → __updateUIFromState),
// so the result is always renderable and fully undoable.

import { state } from '../state/state.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { runTextPrompt, parseJsonLoose } from './ai-cloud.js';
import { DEVICE_TYPES } from '../render/mockups.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n, lo, hi, fb) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fb;
};
const hex = (v, fb) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fb);

function buildPrompt(brief) {
  return [
    'You are an art director for product screenshots. Given a creative brief,',
    'return ONLY a JSON object describing a design. Use these keys and allowed values:',
    '{',
    '  "bgMode": "gradient" | "mesh" | "solid",',
    '  "gradient": { "type": "linear"|"radial", "angle": 0-360, "colors": ["#rrggbb","#rrggbb"] },',
    '  "mesh": { "colors": ["#rrggbb","#rrggbb","#rrggbb","#rrggbb"] },',
    '  "bgColor": "#rrggbb",',
    '  "deviceFrame": "iphone16pro"|"ipadpro"|"macbookpro"|"pixel"|"winlaptop"|"studiodisplay"|"none",',
    '  "headline": "short marketing headline (<= 6 words) or empty string",',
    '  "headlineColor": "#rrggbb",',
    '  "shadow": { "blur": 0-120, "opacity": 0-100 }',
    '}',
    'Pick a tasteful, cohesive palette that matches the brief. Return JSON only.',
    '',
    `Brief: ${brief}`
  ].join('\n');
}

// Map a validated spec onto state. Only ever sets known fields.
function applySpec(spec) {
  saveStateToHistory();

  const mode = ['gradient', 'mesh', 'solid'].includes(spec.bgMode) ? spec.bgMode : state.bgMode;
  state.bgMode = mode;

  if (spec.gradient && Array.isArray(spec.gradient.colors)) {
    const c0 = hex(spec.gradient.colors[0], state.gradient.colors[0]);
    const c1 = hex(spec.gradient.colors[1], state.gradient.colors[1]);
    state.gradient = {
      type: spec.gradient.type === 'radial' ? 'radial' : 'linear',
      angle: clamp(spec.gradient.angle, 0, 360, state.gradient.angle),
      colors: [c0, c1],
      positions: [0, 100]
    };
  }

  if (spec.mesh && Array.isArray(spec.mesh.colors) && state.meshGradient.points.length) {
    state.meshGradient.points.forEach((p, i) => {
      if (spec.mesh.colors[i]) p.color = hex(spec.mesh.colors[i], p.color);
    });
  }

  if (spec.bgColor) state.bgColor = hex(spec.bgColor, state.bgColor);

  if (typeof spec.deviceFrame === 'string') {
    state.deviceFrame.type = DEVICE_TYPES.has(spec.deviceFrame) ? spec.deviceFrame : null;
  }

  if (typeof spec.headline === 'string') {
    const txt = spec.headline.trim();
    state.textOverlay.enabled = txt.length > 0;
    state.textOverlay.content = txt;
    if (spec.headlineColor) state.textOverlay.color = hex(spec.headlineColor, state.textOverlay.color);
  }

  if (spec.shadow) {
    state.shadow.blur = clamp(spec.shadow.blur, 0, 120, state.shadow.blur);
    state.shadow.opacity = clamp(spec.shadow.opacity, 0, 100, state.shadow.opacity);
  }

  render();
  if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
}

async function generate() {
  const inp = document.getElementById('art-director-prompt');
  const brief = inp ? inp.value.trim() : '';
  if (!brief) { showNotification('Describe the look you want first.', 'error'); return; }

  const raw = await runTextPrompt(buildPrompt(brief), { json: true });
  if (!raw) return; // key prompt / error already surfaced
  const spec = parseJsonLoose(raw);
  if (!spec || typeof spec !== 'object') {
    showNotification('The AI returned an unexpected response. Try rephrasing.', 'error');
    return;
  }
  applySpec(spec);
  showNotification('Design applied. Undo if it’s not your vibe.', 'success');
}

export function bindAiArtDirector() {
  const btn = document.getElementById('art-director-btn');
  const inp = document.getElementById('art-director-prompt');
  if (btn) btn.addEventListener('click', generate);
  if (inp) inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); generate(); }
  });
}

// Exposed for the command palette.
export { generate as runArtDirector };
