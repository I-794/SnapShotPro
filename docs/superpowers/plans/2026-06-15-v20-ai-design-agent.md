# v20 "AI Design Agent" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conversational, tool-calling AI Design Agent — a copilot that designs and refines the screenshot's presentation by calling the existing design primitives as tools, with streaming, suggestion chips, and persistent per-project chat + learned-preferences memory.

**Architecture:** A neutral message history drives a tool-use loop. `runAgentTurn` (in `ai-cloud.js`) makes one normalized, streaming tool-calling call against whichever provider has a key (OpenAI or Anthropic). `agent-tools.js` exposes the toolbox (schemas + executors that call `applySpec`, `generateBackgroundImage`, `cutSubject`, palette/text/filter setters, a vision critique, `remember`, `suggest_next`). `ai-agent.js` owns the loop, the copilot panel, and persistence (`agent-memory.js`).

**Tech Stack:** Vanilla JS + Vite (no framework, NO test runner). Verify with `npm run build` (`✓ built`) + manual checks. Uses the installed `openai` and `@anthropic-ai/sdk` (already dynamic-imported in `ai-cloud.js`, `dangerouslyAllowBrowser:true`). Reuses `applySpec` (`src/state/spec.js`), `generateBackgroundImage` (`src/features/ai-cloud.js`), `cutSubject` (`src/features/bg-remove.js`), `generateHarmony` (`src/utils/color.js`), `saveSwatchesAsPalette` (`src/features/palettes.js`), `render`/`renderInto` (`src/render/render.js`), `saveStateToHistory` (`src/state/history.js`), `window.__updateUIFromState`.

> **No test runner:** verification is `npm run build` + the manual checks in each task. Do not add a test framework.
> **Spec:** `docs/superpowers/specs/2026-06-15-v20-ai-design-agent-design.md`. The launch page is a SEPARATE plan.

---

## File Structure

- **Modify `src/features/ai-cloud.js`** — add `AGENT_MODELS`, `runAgentTurn(messages, tools, opts)` (dual-provider, streaming, normalized), and `runVisionOnDataUrl(prompt, dataUrl)`.
- **Create `src/features/agent-memory.js`** — localStorage: per-project chat + global learned preferences.
- **Create `src/features/agent-tools.js`** — the toolbox (schemas + executors) + chip buffer.
- **Create `src/features/ai-agent.js`** — `bindAiAgent()`: panel, conversation loop, persistence, chips, stop.
- **Modify `editor/index.html`** — Design Agent copilot panel.
- **Modify `src/styles.css`** — chat log / bubbles / chips CSS.
- **Modify `src/ui/elements.js`** (optional) + **`src/main.js`** — wire `bindAiAgent()`.
- **Modify `package.json`, `src/features/whats-new.js`, `editor/index.html`** — release chores.
- **Modify `changelog/index.html`** — v20 entry via the frontend taste skill.

Neutral message shape used everywhere:
- `{ role:'user', content:string }`
- `{ role:'assistant', content:string, toolCalls?:[{id,name,args(object)}] }`
- `{ role:'tool', toolCallId:string, name:string, content:string }`

---

## Task 1: Provider layer — `runAgentTurn` + vision (`src/features/ai-cloud.js`)

**Files:**
- Modify: `src/features/ai-cloud.js`

- [ ] **Step 1: Append the agent provider layer**

Add at the END of `src/features/ai-cloud.js`:

```javascript
// v20 — AI Design Agent provider layer. Configurable model per provider (bump
// these as stronger models ship; defaults are known-good ids in this codebase).
export const AGENT_MODELS = { openai: 'gpt-4o', anthropic: 'claude-sonnet-4-6' };
const AGENT_MAX_TOKENS = 1500;

// Convert neutral history → OpenAI chat messages.
function toOpenAIMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || '' };
      if (m.toolCalls && m.toolCalls.length) {
        msg.content = m.content || null;
        msg.tool_calls = m.toolCalls.map(t => ({ id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args || {}) } }));
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

// Convert neutral history → Anthropic messages (tool_result blocks must ride in a
// user turn; consecutive tool messages are merged into one user message).
function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const t of (m.toolCalls || [])) content.push({ type: 'tool_use', id: t.id, name: t.name, input: t.args || {} });
      out.push({ role: 'assistant', content });
    } else if (m.role === 'tool') {
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    }
  }
  return out;
}

async function openAIAgentTurn(key, system, messages, tools, onText) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  const stream = await client.chat.completions.create({
    model: AGENT_MODELS.openai,
    max_tokens: AGENT_MAX_TOKENS,
    messages: toOpenAIMessages(system, messages),
    tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
    stream: true
  });
  let text = '';
  const acc = [];
  for await (const chunk of stream) {
    const d = chunk.choices?.[0]?.delta || {};
    if (d.content) { text += d.content; onText && onText(d.content); }
    for (const tc of (d.tool_calls || [])) {
      const i = tc.index;
      acc[i] = acc[i] || { id: '', name: '', args: '' };
      if (tc.id) acc[i].id = tc.id;
      if (tc.function?.name) acc[i].name += tc.function.name;
      if (tc.function?.arguments) acc[i].args += tc.function.arguments;
    }
  }
  const toolCalls = acc.filter(Boolean).map(t => ({ id: t.id, name: t.name, args: safeJson(t.args) }));
  return { text, toolCalls };
}

async function anthropicAgentTurn(key, system, messages, tools, onText) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const stream = client.messages.stream({
    model: AGENT_MODELS.anthropic,
    max_tokens: AGENT_MAX_TOKENS,
    system,
    messages: toAnthropicMessages(messages),
    tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
  });
  if (onText) stream.on('text', (t) => onText(t));
  const final = await stream.finalMessage();
  let text = '';
  const toolCalls = [];
  for (const block of (final.content || [])) {
    if (block.type === 'text') text += block.text;
    else if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, args: block.input || {} });
  }
  return { text, toolCalls };
}

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } }

// One normalized, streaming tool-calling turn. Returns { text, toolCalls:[{id,name,args}] }.
// Throws { code:'NO_KEY' } when no provider configured.
export async function runAgentTurn(messages, tools, { system = '', onText = null } = {}) {
  const choice = await chooseProvider(false);
  if (!choice) { const e = new Error('No AI key'); e.code = 'NO_KEY'; throw e; }
  return choice.provider === 'anthropic'
    ? anthropicAgentTurn(choice.key, system, messages, tools, onText)
    : openAIAgentTurn(choice.key, system, messages, tools, onText);
}

// Vision critique of an arbitrary rendered dataURL (the agent's look_at_canvas).
// Reuses the existing hosted/BYO vision paths. Returns text or a graceful note.
export async function runVisionOnDataUrl(prompt, dataUrl) {
  try {
    const hosted = await callHostedVision(prompt, dataUrl);
    if (hosted?.text) return hosted.text;
  } catch (_) {}
  const choice = await chooseProvider(true);
  if (!choice) return 'I could not see the canvas (no vision-capable key configured).';
  try {
    return choice.provider === 'anthropic'
      ? await callAnthropicVision(choice.key, prompt, dataUrl)
      : await callOpenAIVision(choice.key, prompt, dataUrl);
  } catch (e) { return 'I could not analyze the canvas right now.'; }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`. (`chooseProvider`, `callHostedVision`, `callAnthropicVision`, `callOpenAIVision` already exist in this file.)

- [ ] **Step 3: Commit**

```bash
git add src/features/ai-cloud.js
git commit -m "feat(v20): runAgentTurn (dual-provider streaming tool-calling) + vision-on-dataurl"
```

---

## Task 2: Memory store (`src/features/agent-memory.js`)

**Files:**
- Create: `src/features/agent-memory.js`

- [ ] **Step 1: Create the file**

```javascript
// v20 — Agent memory. Per-project conversation + global learned preferences,
// in localStorage. Not part of undo/state (these are agent features).

import { state } from '../state/state.js';

const CHAT_PREFIX = 'snapshotpro_agent_chat_';
const MEM_KEY = 'snapshotpro_agent_memory';
const MAX_TURNS = 20;     // keep last N messages (lossy by design)
const MAX_MEMORY = 20;    // keep last N learned-preference notes

function projectId() {
  // Use the active project id when available, else a global bucket.
  return (state.project && state.project.id) ? state.project.id : 'global';
}

export function loadChat() {
  try { return JSON.parse(localStorage.getItem(CHAT_PREFIX + projectId())) || []; }
  catch (_) { return []; }
}
export function saveChat(messages) {
  try {
    const trimmed = messages.slice(-MAX_TURNS);
    localStorage.setItem(CHAT_PREFIX + projectId(), JSON.stringify(trimmed));
  } catch (_) {}
}
export function clearChat() {
  try { localStorage.removeItem(CHAT_PREFIX + projectId()); } catch (_) {}
}

export function loadMemory() {
  try { return JSON.parse(localStorage.getItem(MEM_KEY)) || []; }
  catch (_) { return []; }
}
export function addMemory(note) {
  if (!note || typeof note !== 'string') return;
  const n = note.trim().slice(0, 200);
  if (!n) return;
  let mem = loadMemory();
  if (mem.some(x => x.toLowerCase() === n.toLowerCase())) return; // dedupe
  mem.push(n);
  mem = mem.slice(-MAX_MEMORY);
  try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch (_) {}
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`. (`state.project` may be undefined; the guard handles it → 'global'.)

- [ ] **Step 3: Commit**

```bash
git add src/features/agent-memory.js
git commit -m "feat(v20): agent memory store (per-project chat + learned prefs)"
```

---

## Task 3: Toolbox (`src/features/agent-tools.js`)

**Files:**
- Create: `src/features/agent-tools.js`

- [ ] **Step 1: Create the file**

```javascript
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`. (Confirm `saveSwatchesAsPalette` and `generateHarmony` are exported from their modules — they are, per v17.)

- [ ] **Step 3: Commit**

```bash
git add src/features/agent-tools.js
git commit -m "feat(v20): agent toolbox (design primitives as tools + vision/memory/chips)"
```

---

## Task 4: Agent loop + panel (`src/features/ai-agent.js`)

**Files:**
- Create: `src/features/ai-agent.js`

- [ ] **Step 1: Create the file**

```javascript
// v20 — AI Design Agent: conversational copilot. Owns the message history, the
// tool-use loop, the panel, and persistence. Renders streamed assistant text,
// narrates tool actions live, and surfaces suggestion chips.

import { state } from '../state/state.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { runAgentTurn } from './ai-cloud.js';
import { TOOLS, runTool, consumeChips } from './agent-tools.js';
import { loadChat, saveChat, loadMemory } from './agent-memory.js';

const MAX_ITERS = 8;
let messages = [];          // neutral history
let running = false;
let stopFlag = false;

function systemPrompt() {
  const mem = loadMemory();
  const memBlock = mem.length ? `\nThings you remember about this user:\n- ${mem.join('\n- ')}` : '';
  const c = state.canvas;
  return [
    'You are the SnapShot-Pro Design Agent. You design and refine the PRESENTATION of a screenshot by calling tools.',
    'Prefer apply_design for background/frame/layout/shadow/filter/color changes. Use generate_background for AI imagery, isolate_subject for product-shot composites, set_palette for color schemes, set_text for headlines, set_filters for tone, look_at_canvas when unsure about visual quality.',
    'Be tasteful and on-brand. Keep replies short. After acting, ALWAYS call suggest_next with 2-4 short follow-up prompts.',
    `Canvas is ${c.width}x${c.height}. Do not edit the screenshot content beyond isolate/background.`,
    memBlock
  ].join('\n');
}

function el(id) { return document.getElementById(id); }

function addLine(role, text) {
  const log = el('agent-log');
  if (!log) return null;
  const div = document.createElement('div');
  div.className = 'agent-msg agent-' + role;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function renderChips(chips) {
  const row = el('agent-chips');
  if (!row) return;
  row.innerHTML = '';
  for (const c of chips) {
    const b = document.createElement('button');
    b.className = 'agent-chip'; b.type = 'button'; b.textContent = c;
    b.addEventListener('click', () => { const inp = el('agent-input'); if (inp) inp.value = c; send(); });
    row.appendChild(b);
  }
}

function renderHistory() {
  const log = el('agent-log');
  if (!log) return;
  log.innerHTML = '';
  for (const m of messages) {
    if (m.role === 'user') addLine('user', m.content);
    else if (m.role === 'assistant' && m.content) addLine('assistant', m.content);
  }
}

function setStatus(s) { const e = el('agent-status'); if (e) e.textContent = s || ''; }

async function send() {
  if (running) return;
  const inp = el('agent-input');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;
  inp.value = '';
  renderChips([]);
  messages.push({ role: 'user', content: text });
  addLine('user', text);
  running = true; stopFlag = false;
  const stopBtn = el('agent-stop'); if (stopBtn) stopBtn.style.display = 'inline-block';
  saveStateToHistory();   // whole turn = one undo step

  try {
    let iters = 0;
    while (iters++ < MAX_ITERS) {
      if (stopFlag) { addLine('assistant', 'Stopped.'); break; }
      setStatus('Thinking…');
      let bubble = null;
      const onText = (delta) => {
        if (!bubble) bubble = addLine('assistant', '');
        bubble.textContent += delta;
        const log = el('agent-log'); if (log) log.scrollTop = log.scrollHeight;
      };
      const turn = await runAgentTurn(messages, TOOLS, { system: systemPrompt(), onText });
      messages.push({ role: 'assistant', content: turn.text || '', toolCalls: turn.toolCalls });

      if (!turn.toolCalls || !turn.toolCalls.length) break;   // model is done talking

      for (const call of turn.toolCalls) {
        if (call.name !== 'suggest_next') setStatus(`Running ${call.name}…`);
        const result = await runTool(call.name, call.args);
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result });
        if (call.name !== 'suggest_next') addLine('action', `• ${result}`);
      }
      render();
      if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
    }
  } catch (e) {
    if (e && e.code === 'NO_KEY') {
      addLine('assistant', 'Add an OpenAI or Claude key in AI settings to use the Design Agent.');
      const d = el('api-keys-details'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else {
      console.error(e);
      addLine('assistant', `Something went wrong: ${e.message || e}`);
    }
  } finally {
    running = false;
    setStatus('');
    if (stopBtn) stopBtn.style.display = 'none';
    render();
    if (typeof window.__updateUIFromState === 'function') window.__updateUIFromState();
    renderChips(consumeChips());
    saveChat(messages);
  }
}

export function bindAiAgent() {
  messages = loadChat();
  renderHistory();
  el('agent-send')?.addEventListener('click', send);
  el('agent-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  el('agent-stop')?.addEventListener('click', () => { stopFlag = true; });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/features/ai-agent.js
git commit -m "feat(v20): agent loop + copilot panel logic (streaming, chips, stop, persistence)"
```

---

## Task 5: Copilot panel UI (`editor/index.html`)

**Files:**
- Modify: `editor/index.html`

- [ ] **Step 1: Add the Design Agent section**

In the AI Tools area of the sidebar, add this as a new `<div class="sidebar-section">` (place it at the TOP of the AI Tools group, just after the `<h3 ...>AI Tools…</h3>` heading if there is one, or as the first AI-related section). Use exactly:

```html
        <!-- v20 — AI Design Agent copilot -->
        <div class="sidebar-section">
            <h3 class="section-title">Design Agent <span style="font-size:11px;color:var(--text-secondary);font-weight:400;">v20</span></h3>
            <p class="info-text" style="margin-bottom:8px;">Describe what you want, then refine by chatting. The agent designs, generates, and remembers your style.</p>
            <div id="agent-log" class="agent-log"></div>
            <div id="agent-chips" class="agent-chips"></div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <input type="text" id="agent-input" class="control-input" placeholder="e.g. design a calm fintech hero" style="flex:1;">
                <button class="vary-generate" id="agent-send" style="width:auto;margin:0;padding:9px 14px;">Send</button>
                <button class="btn btn-secondary" id="agent-stop" style="display:none;padding:9px 12px;">Stop</button>
            </div>
            <p class="info-text" id="agent-status" style="margin-top:6px;min-height:14px;"></p>
        </div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`; `dist/editor/index.html` contains `id="agent-send"`.

- [ ] **Step 3: Commit**

```bash
git add editor/index.html
git commit -m "feat(v20): Design Agent copilot panel UI"
```

---

## Task 6: Chat + chips CSS (`src/styles.css`)

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append the styles**

Add at the end of `src/styles.css`:

```css
/* v20 — AI Design Agent copilot. */
.agent-log {
  border: 1px solid var(--border-color); border-radius: 10px;
  background: var(--bg-tertiary); padding: 10px; max-height: 320px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; line-height: 1.5;
}
.agent-msg { padding: 7px 10px; border-radius: 10px; max-width: 92%; white-space: pre-wrap; word-break: break-word; }
.agent-user { align-self: flex-end; background: var(--accent-primary); color: #fff; }
.agent-assistant { align-self: flex-start; background: rgba(255,255,255,0.06); color: var(--text-primary); border: 1px solid var(--border-color); }
.agent-action { align-self: flex-start; font-size: 11.5px; color: var(--text-secondary); font-family: var(--font-mono); }
.agent-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.agent-chip {
  border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);
  border-radius: 999px; padding: 5px 11px; font-size: 11.5px; cursor: pointer;
}
.agent-chip:hover { border-color: var(--accent-primary); }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ built`. (Variables `--border-color`, `--bg-tertiary`, `--accent-primary`, `--text-primary`, `--text-secondary`, `--font-mono` already exist in `:root`.)

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(v20): copilot chat + chips styles"
```

---

## Task 7: Wire `bindAiAgent()` (`src/main.js`)

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add the import**

Find `import { bindAiAssets } from './features/ai-assets.js';` and add directly after it:

```javascript
import { bindAiAgent } from './features/ai-agent.js';
```

- [ ] **Step 2: Add the call in `init()`**

Find `bindAiAssets();` in `init()` and add directly after it:

```javascript
  bindAiAgent();       // v20 — AI Design Agent copilot
```

- [ ] **Step 3: Verify build + manual smoke test**

Run: `npm run build` → `✓ built`.
`npm run dev`, open `/editor/`, add an OpenAI key, load an image, open the **Design Agent** panel, send "design a calm fintech hero".
Expected: assistant text streams in; action lines appear ("• Applied the design changes.", "• Generated and applied an AI background."); canvas updates; suggestion chips appear; clicking a chip sends it; **Stop** aborts a run; reload resumes the conversation; Ctrl+Z reverts the last turn.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(v20): wire bindAiAgent into init"
```

---

## Task 8: Release chores — version + what's-new

**Files:**
- Modify: `package.json:4`, `src/features/whats-new.js`, `editor/index.html`

- [ ] **Step 1: Bump version**

In `package.json`, change `"version": "19.0.0",` to `"version": "20.0.0",`.

- [ ] **Step 2: Update what's-new**

In `src/features/whats-new.js`, set `const CURRENT_VERSION = '20.0';` and replace the `WHATS_NEW` object with:

```javascript
const WHATS_NEW = {
  heading: "What's new in v20 — the AI Design Agent",
  items: [
    { title: 'Design by conversation',
      desc: 'Tell the agent what you want and it designs it: background, frame, layout, palette, headline. Then refine by chatting, "make it warmer, bigger headline".' },
    { title: 'It generates, sees, and remembers',
      desc: 'It can generate backgrounds, isolate your subject, look at the canvas to critique itself, and it remembers your style across sessions.' }
  ]
};
```

- [ ] **Step 3: Editor header version**

In `editor/index.html`, change `v19.0` to `v20.0` in the `<title>` (line ~8) and the header `<span>` (line ~32).

- [ ] **Step 4: Verify + commit**

Run: `npm run build` → `✓ built` (shows `snapshot-pro@20.0.0`).

```bash
git add package.json src/features/whats-new.js editor/index.html
git commit -m "chore(v20): bump 20.0.0, whats-new toast"
```

---

## Task 9: Changelog entry (frontend taste skill, own motif)

**Files:**
- Modify: `changelog/index.html`

- [ ] **Step 1: Invoke the taste skill**

Use the `design-taste-frontend` skill. Design read: redesign-preserve of the editorial changelog (vanilla CSS, light page, dark spotlight island). v20's distinct motif = a **"conversation / agent"** treatment (a chat thread whose messages drive a design result), distinct from v16 glass, v17 spectrum, v18 variant-grid, v19 prompt-to-image. Zero user-visible em-dashes; preserve theme/accent/shape locks; add a scoped `.spotlight-agent` class.

- [ ] **Step 2: Demote the current latest entry**

Change the current `<li class="entry latest reveal">` (v19.0) to `<li class="entry reveal">`.

- [ ] **Step 3: Add the v20 entry at the top of `<ul class="log">`**

Insert a new `<li class="entry latest reveal">` for v20.0 (`entry-meta` = `v20.0` + `June 2026`), `<h2>The AI Design Agent</h2>`, and a `<ul class="changes">` describing: design-by-conversation with tools, generates/isolates/sees the canvas, streaming + suggestion chips, persistent chat + learned-preferences memory, all undoable and baking into exports.

- [ ] **Step 4: Refresh the spotlight (SWAP slot)**

Replace the spotlight content (between `<!-- SWAP-START -->` and `<!-- SWAP-END -->`) with a v20 "AI Design Agent" spotlight using the conversation→design motif. Update `.spot-ver` to `v20 · June 2026`. Add a scoped `.spotlight-agent` modifier class rather than editing the v16/v17/v18/v19 spotlight rules.

- [ ] **Step 5: Update meta descriptions**

Update `<meta name="description">` and `og:description` to mention v20, the AI Design Agent.

- [ ] **Step 6: Verify (build + em-dash scan)**

Run: `npm run build` → `✓ built`. Scan changed rendered text for em/en dashes (— / –); confirm none in headings/body/labels (CSS/JS comments are fine).

- [ ] **Step 7: Commit**

```bash
git add changelog/index.html
git commit -m "docs(v20): changelog entry — AI Design Agent (conversation motif)"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full build** — `npm run build` → `✓ built`, PWA precache completes.

- [ ] **Step 2: Manual pass in `npm run dev`** (with a valid OpenAI / gpt-image-2 key):
  - "design a calm fintech hero" → multiple tool actions narrated, canvas updates, exports correctly.
  - "make it warmer and add a bold headline" → adjusts filters + text without redoing everything.
  - Ask "is the text readable?" → agent calls look_at_canvas and responds with a critique/fix.
  - Suggestion chips appear; clicking one sends it.
  - State a preference ("I always want minimal, cobalt brand") → reload → ongoing chat resumes; agent honors the preference next turn.
  - Undo reverts a whole agent turn.
  - Stop aborts a long run.
  - No key → guidance + key panel opens; a tool failure is reported in chat without crashing.

- [ ] **Step 3: Final commit (if cleanup)**

```bash
git add -A
git commit -m "chore(v20): final verification pass"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** tool-calling loop (Task 4) with full toolbox (Task 3: apply_design/generate_background/isolate_subject/set_palette/set_text/set_filters/look_at_canvas/remember/suggest_next); provider-agnostic streaming brain + AGENT_MODELS + vision (Task 1); persistent per-project chat + learned preferences (Task 2, used in Tasks 3/4); prominent copilot panel + streaming + chips + stop (Tasks 4/5/6); wiring (Task 7); undo per turn (Task 4 `saveStateToHistory` once per send); error/NO_KEY/iteration-cap handling (Tasks 1/3/4); release chores (Task 8); changelog via taste skill (Task 9); verification (Task 10). All spec sections map to a task.
- **Placeholder scan:** none — every code step is complete; commands have expected output.
- **Type consistency:** neutral message shape (`role`/`content`/`toolCalls{id,name,args}`/`toolCallId`) is identical across `runAgentTurn` (Task 1), `agent-tools` results, and `ai-agent` loop (Task 4). `runAgentTurn(messages, tools, {system,onText})`, `runTool(name,args)`, `consumeChips()`, `TOOLS`, `loadChat/saveChat/loadMemory/addMemory` signatures match between definition and use. Element ids (`agent-log/agent-chips/agent-input/agent-send/agent-stop/agent-status`) match between Task 4 (JS) and Task 5 (HTML). `bindAiAgent` exported (Task 4) and imported/called (Task 7).
- **Note:** `state.project?.id` is used for per-project chat keying with a 'global' fallback; if the projects module exposes the id under a different path, the fallback keeps it working (global bucket) without breaking.
