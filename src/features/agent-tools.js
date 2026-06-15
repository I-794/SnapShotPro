// v20 — Agent toolbox: JSON-schema tool definitions + executors that drive the
// existing design primitives. Each executor returns a SHORT text result the
// agent receives. Mutations are followed by render() at the loop level.

import { state } from '../state/state.js';
import { render, renderInto } from '../render/render.js';
import { applySpec } from '../state/spec.js';
import { generateBackgroundImage, runVisionOnDataUrl } from './ai-cloud.js';
import { cutSubject } from './bg-remove.js';
import { generateHarmony } from '../utils/color.js';
import { saveSwatchesAsPalette } from './palettes.js';
import { addMemory } from './agent-memory.js';

// Suggestion chips buffer: suggest_next writes here; the panel reads + clears.
let pendingChips = [];
export function consumeChips() { const c = pendingChips; pendingChips = []; return c; }

function genSize() {
  const w = state.canvas.width, h = state.canvas.height;
  if (w > h * 1.15) return '1536x1024';
  if (h > w * 1.15) return '1024x1536';
  return '1024x1024';
}
function clampNum(v, lo, hi) { const n = Number(v); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; }

export const TOOLS = [
  {
    name: 'apply_design',
    description: 'Set the presentation: background, device/browser frame, layout (padding/scale/borderRadius), shadow preset, art filter, and color map. Use this for most look changes. Omit fields you do not want to change.',
    input_schema: {
      type: 'object',
      properties: {
        bg: { type: 'object', description: 'Background. mode is one of gradient|mesh|solid|pattern. Provide the matching sub-object: gradient{colors[],type,angle}, mesh[hex...], solid"#hex", pattern{type,fg,bg,size,angle}.' },
        frame: { type: 'object', description: 'Device/browser frame. {type, color}. type null for none; e.g. iphone16pro, macbookpro, chrome, safari. color e.g. dark, silver, titanium.' },
        layout: { type: 'object', description: '{padding 0-300, scale 20-200, borderRadius 0-80}' },
        shadow: { type: 'string', description: 'Shadow preset: soft|medium|hard|none' },
        filter: { type: 'string', description: 'Art filter preset: none|noir|vintage|vivid|faded|tealorange|moody|bleach|golden' },
        color: { type: 'object', description: 'Color map {mode off|gradient|recolor|transfer, paletteId, intensity 0-100, steps 0-16}' }
      }
    },
    async run(args) { applySpec(args || {}); return 'Applied the design changes.'; }
  },
  {
    name: 'generate_background',
    description: 'Generate an AI background image from a description and set it as the background. Use when the user wants imagery/photographic/scene backgrounds.',
    input_schema: { type: 'object', properties: { prompt: { type: 'string' }, style: { type: 'string', description: 'photographic|abstract|studio|gradient' } }, required: ['prompt'] },
    async run(args) {
      const style = ({ photographic: 'a high-quality photographic background', abstract: 'a clean abstract background', studio: 'a soft studio backdrop', gradient: 'a smooth gradient background' })[args.style] || 'a high-quality background';
      const prompt = `${style}. ${args.prompt}. No text, no logos, no watermarks. Behind a product screenshot.`;
      const img = await generateBackgroundImage(prompt, genSize());
      state.bgImage = img; state.bgMode = 'image';
      return 'Generated and applied an AI background.';
    }
  },
  {
    name: 'isolate_subject',
    description: 'Remove the screenshot\'s own background so the subject sits on the current background. Use for product-shot composites.',
    input_schema: { type: 'object', properties: {} },
    async run() {
      if (!state.image) return 'No image is loaded to isolate.';
      const cut = await cutSubject();
      if (cut) { state.image = cut; return 'Isolated the subject onto the background.'; }
      return 'Could not isolate the subject.';
    }
  },
  {
    name: 'set_palette',
    description: 'Create a color palette (from a base color + harmony type, or explicit swatches) and optionally map it onto the image.',
    input_schema: {
      type: 'object',
      properties: {
        baseColor: { type: 'string', description: '#hex base color' },
        harmony: { type: 'string', description: 'complementary|analogous|triadic|split-complementary|tetradic' },
        swatches: { type: 'array', items: { type: 'string' }, description: 'explicit #hex list (overrides base/harmony)' },
        map: { type: 'string', description: 'optional color-map mode to apply: gradient|recolor|transfer' }
      }
    },
    async run(args) {
      let swatches = Array.isArray(args.swatches) && args.swatches.length ? args.swatches
        : (args.baseColor ? generateHarmony(args.baseColor, args.harmony || 'analogous') : null);
      if (!swatches || !swatches.length) return 'Provide a baseColor or swatches.';
      const id = saveSwatchesAsPalette(swatches, 'Agent');
      if (args.map && id) applySpec({ color: { mode: args.map, paletteId: id, intensity: 100 } });
      return `Set a ${swatches.length}-color palette${args.map ? ' and mapped it onto the image' : ''}.`;
    }
  },
  {
    name: 'set_text',
    description: 'Add or update the headline text overlay.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        size: { type: 'number', description: '12-120' },
        color: { type: 'string', description: '#hex' },
        bold: { type: 'boolean' }, italic: { type: 'boolean' },
        x: { type: 'number', description: '0-1' }, y: { type: 'number', description: '0-1' }
      },
      required: ['content']
    },
    async run(args) {
      const t = state.textOverlay;
      t.enabled = true;
      t.content = String(args.content);
      if (clampNum(args.size, 12, 120) !== null) t.size = clampNum(args.size, 12, 120);
      if (typeof args.color === 'string') t.color = args.color;
      if (typeof args.bold === 'boolean') t.bold = args.bold;
      if (typeof args.italic === 'boolean') t.italic = args.italic;
      if (clampNum(args.x, 0, 1) !== null) t.x = clampNum(args.x, 0, 1);
      if (clampNum(args.y, 0, 1) !== null) t.y = clampNum(args.y, 0, 1);
      return `Set the headline to "${t.content}".`;
    }
  },
  {
    name: 'set_filters',
    description: 'Adjust image filters. Percent fields default 100; temperature/tint are -100..100, 0 neutral.',
    input_schema: {
      type: 'object',
      properties: {
        brightness: { type: 'number' }, contrast: { type: 'number' }, saturation: { type: 'number' },
        blur: { type: 'number' }, grayscale: { type: 'number' }, sepia: { type: 'number' },
        temperature: { type: 'number' }, tint: { type: 'number' }
      }
    },
    async run(args) {
      const f = state.imageFilters;
      const ranges = { brightness: [0, 200], contrast: [0, 200], saturation: [0, 200], blur: [0, 20], grayscale: [0, 100], sepia: [0, 100], temperature: [-100, 100], tint: [-100, 100] };
      for (const k of Object.keys(ranges)) {
        if (args[k] != null) { const v = clampNum(args[k], ranges[k][0], ranges[k][1]); if (v !== null) f[k] = v; }
      }
      return 'Adjusted the image filters.';
    }
  },
  {
    name: 'look_at_canvas',
    description: 'See the current design and get a critique. Call this when you are unsure whether the result looks good (contrast, balance, readability).',
    input_schema: { type: 'object', properties: {} },
    async run() {
      try {
        const off = document.createElement('canvas');
        renderInto(off, true);
        const max = 768, r = Math.min(1, max / Math.max(off.width, off.height));
        const small = document.createElement('canvas');
        small.width = Math.round(off.width * r); small.height = Math.round(off.height * r);
        small.getContext('2d').drawImage(off, 0, 0, small.width, small.height);
        const dataUrl = small.toDataURL('image/png');
        return await runVisionOnDataUrl('Critique this design for contrast, readability, balance, and overall polish. Be concise and specific with concrete fixes.', dataUrl);
      } catch (e) { return 'I could not render the canvas to look at it.'; }
    }
  },
  {
    name: 'remember',
    description: 'Save a durable preference about this user for future sessions (e.g. "prefers warm, minimal designs", "brand color #2348ff"). Use sparingly for lasting facts.',
    input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
    async run(args) { addMemory(args.note); return 'Noted for next time.'; }
  },
  {
    name: 'suggest_next',
    description: 'ALWAYS call this as your final action each turn: propose 2-4 short next-step prompts the user might want (e.g. "Make it bolder", "Try dark mode").',
    input_schema: { type: 'object', properties: { chips: { type: 'array', items: { type: 'string' } } }, required: ['chips'] },
    async run(args) { pendingChips = (args.chips || []).slice(0, 4).map(String); return 'ok'; }
  }
];

export async function runTool(name, args) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return `Unknown tool: ${name}`;
  try { return await tool.run(args || {}); }
  catch (e) { return `Tool ${name} failed: ${e?.message || e}`; }
}
