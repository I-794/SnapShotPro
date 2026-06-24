// v30 — Autonomous Operator ("Producer"). A SEPARATE autopilot surface (not the
// Design Agent): pick a goal, walk away, get a finished Campaign folder. The
// plan is a bounded, deterministic step list; only goal→config planning uses AI.

import { state } from '../state/state.js';
import { runTextPrompt } from './ai-cloud.js';
import { applyBrand } from './brand-brain.js';
import { generateCampaign } from './campaign-generator.js';
import { showNotification } from '../ui/notification.js';

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

let aborted = false;
export function stopProducer() { aborted = true; }

// Execute a bounded plan from a goal, streaming progress to onLog. Each step is
// a known call; the abort flag is checked between steps. Returns { id } of the
// produced campaign, or null on abort/failure.
export async function runProducer(goal, onLog) {
  aborted = false;
  const log = (s) => { try { onLog && onLog(s); } catch (_) {} };

  if (!state.image) { log('✗ Load a screenshot first.'); showNotification('Load a screenshot first.', 'error'); return null; }

  log(`▸ Planning “${goal}”…`);
  let cfg;
  try { cfg = await planFromGoal(goal); }
  catch (e) { log('✗ Planning failed: ' + (e.message || e)); return null; }
  if (aborted) { log('■ Stopped.'); return null; }
  log(`✓ Plan: brand=${cfg.applyBrand} redact=${cfg.redact} appStore=${cfg.includeAppStore} teaser=${cfg.includeTeaser}`);

  // Step: apply brand.
  if (cfg.applyBrand) {
    if (state.brand?.enabled) {
      log('▸ Applying brand system…');
      try { applyBrand(); log('✓ Brand applied.'); }
      catch (e) { log('• Brand step skipped: ' + (e.message || e)); }
    }
    else log('• No brand extracted — skipping brand step.');
  }
  if (aborted) { log('■ Stopped.'); return null; }

  // Step: redact PII (no AI key needed for the OCR pass).
  if (cfg.redact) {
    log('▸ Redacting PII…');
    try { const { redact } = await import('./ai-screenshot-editor.js'); await redact({ autoPII: true }); log('✓ Redaction pass done.'); }
    catch (e) { log('• Redaction skipped: ' + (e.message || e)); }
  }
  if (aborted) { log('■ Stopped.'); return null; }

  // Step: generate the campaign (the heavy step).
  log('▸ Generating campaign assets…');
  let res;
  try {
    res = await generateCampaign({
      name: cfg.name, prompt: '',
      includeAppStore: cfg.includeAppStore, includeTeaser: cfg.includeTeaser
    });
  } catch (e) { log('✗ Campaign generation failed: ' + (e.message || e)); return null; }
  if (!res) { log('✗ Campaign generation failed.'); return null; }
  log(`✓ Done — campaign “${cfg.name}” is in the Campaigns folder.`);
  return res;
}
