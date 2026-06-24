// v30 — Autonomous Operator ("Producer"). A SEPARATE autopilot surface (not the
// Design Agent): pick a goal, walk away, get a finished Campaign folder. The
// plan is a bounded, deterministic step list; only goal→config planning uses AI.

import { state } from '../state/state.js';
import { runTextPrompt } from './ai-cloud.js';

// A ProducerConfig drives the deterministic executor in Task 24.
export const PRESET_GOALS = {
  'Launch kit':    { name: 'Launch kit',    applyBrand: true,  redact: true,  includeAppStore: true,  includeTeaser: true },
  'App Store pack':{ name: 'App Store pack', applyBrand: true,  redact: false, includeAppStore: true,  includeTeaser: false },
  'Social pack':   { name: 'Social pack',   applyBrand: true,  redact: false, includeAppStore: false, includeTeaser: false }
};

function defaultConfig(name) {
  return { name: name || 'Campaign', applyBrand: !!state.brand?.enabled, redact: false, includeAppStore: true, includeTeaser: false };
}

// Resolve a goal to a config. Presets are exact-match; free text asks the model
// once for booleans, falling back to a sensible default on any failure.
export async function planFromGoal(goal) {
  if (PRESET_GOALS[goal]) return { ...PRESET_GOALS[goal] };
  const g = (goal || '').trim();
  if (!g) return defaultConfig();
  const prompt =
    `You are planning a marketing asset campaign. The user's goal is: "${g}". ` +
    `Return JSON {"name":string,"applyBrand":bool,"redact":bool,"includeAppStore":bool,"includeTeaser":bool} ` +
    `choosing what to include. redact=true only if the goal mentions privacy/PII. ` +
    `includeTeaser=true only if it mentions video/motion/animation.`;
  try {
    const raw = await runTextPrompt(prompt, { json: true });
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return {
        name: parsed.name || g.slice(0, 40),
        applyBrand: parsed.applyBrand !== false,
        redact: !!parsed.redact,
        includeAppStore: parsed.includeAppStore !== false,
        includeTeaser: !!parsed.includeTeaser
      };
    }
  } catch (_) { /* fall through */ }
  return defaultConfig(g.slice(0, 40));
}
