# v20 "AI Design Agent" — Design Spec

**Status:** Approved design (not yet implemented)
**Date:** 2026-06-15
**Target version:** 20.0.0 (current: 19.0.0)

> The flagship — the biggest release in SnapShotPro history. The conversational
> co-designer that orchestrates the v18 compose engine and v19 asset generation
> as tools, with multi-turn refinement and memory. All prompt-driven *composing*
> and refinement lives here (deliberately deferred from v18/v19 to make v20 the
> headline). Ships alongside a dedicated "largest update ever" landing page,
> which is brainstormed and specced separately.

## Goal

A conversational copilot in the editor. The user says "design me a calm fintech
hero," and the agent generates a background, sets a palette, picks a frame and
layout, writes a headline — narrating each step — then refines on request ("make
it warmer, bigger headline"). It can look at the canvas to critique its own work,
and it remembers the conversation and the user's recurring preferences.

## Locked decisions (from brainstorm)

1. **Engine = real tool-calling agent loop.** The model is given the design
   primitives as tools and decides which to call, in what order, across turns; we
   execute each and feed results back until it finishes. Full toolbox.
2. **Brain = most-capable available, provider-agnostic.** Reuse the existing
   hosted/BYO-key selection; use a strong tool-capable model per provider from a
   small **configurable** `AGENT_MODELS` map (known-good default ids, easy to
   bump — never a guessed/unverified model name).
3. **Vision = on-demand.** A `look_at_canvas` tool renders the current canvas and
   returns a **text critique** (provider-agnostic; tool results stay text).
4. **UX = prominent copilot panel.** A dedicated "Design Agent" studio section
   with chat history, narrated actions, Send/Stop, and the v18 generative
   spectrum signature.
5. **Memory = persistent chat + learned preferences.** Conversation persists
   (localStorage, per project) and resumes across reloads. A global "design
   memory" of recurring preferences + brand is accumulated and injected into the
   system prompt each session. (No editable memory panel in v1.)
6. **Add-ons folded in (from add-on brainstorm) = streaming + suggestion chips.**
   The agent narrates live as it works (streamed assistant text + per-step action
   lines as each tool resolves), and after each turn surfaces 2-4 clickable
   next-step prompt chips. Other add-ons (voice input, design-critique mode,
   editable memory panel, multi-variant proposals, App Store set) are parked for
   v20.1.

## Architecture

### New: `src/features/agent-tools.js` — the toolbox
Each tool = `{ name, description, input_schema, run(args) }`. `run` calls an
existing primitive, mutates state as needed, and returns a SHORT text result the
agent receives (e.g. "Applied. Background is now a teal gradient with an iPhone
frame."). Tools:

1. `apply_design(spec)` → `applySpec(spec)` (v18 schema: bg / frame / layout /
   shadow / filter / color).
2. `generate_background({ prompt, style })` → `generateBackgroundImage(prompt,
   size)` (size from canvas aspect, on-brand prompt) → set `state.bgImage`,
   `bgMode:'image'`.
3. `isolate_subject()` → `cutSubject()` → set `state.image`.
4. `set_palette({ baseColor?, harmony?, swatches? })` → `generateHarmony` /
   `saveSwatchesAsPalette`; optionally enable a colorMap via `applySpec`.
5. `set_text({ content, size?, color?, x?, y?, bold?, italic? })` → mutate
   `state.textOverlay`.
6. `set_filters({ brightness?, contrast?, saturation?, temperature?, tint?, … })`
   → mutate `state.imageFilters` (clamped).
7. `look_at_canvas()` → render offscreen (`renderInto(off, true)`) → call the
   vision model with a fixed critique prompt → return the textual critique.
8. `remember({ note })` → append a concise durable preference to the global
   design-memory store (capped + deduped).
9. `suggest_next({ chips })` → store 2-4 short next-step prompt strings; the panel
   renders them as clickable chips. The system prompt instructs the agent to call
   this as its final action each turn (provider-agnostic; no fragile parsing).

All design mutations are followed by `render()`; UI re-sync (`render()` +
`window.__updateUIFromState()`) happens at the end of each user turn.

### New: `src/features/ai-agent.js` — `bindAiAgent()`
Owns conversation state, the tool-use loop, memory, and the panel.

- **Conversation state:** an in-memory `messages` array (provider-neutral shape),
  hydrated from localStorage per project on load.
- **The loop** (per user message):
  1. `saveStateToHistory()` once (whole turn = one undo step).
  2. Push the user message; call `runAgentTurn(messages, TOOLS)`.
  3. If the result has tool calls: execute each via `agent-tools`, `render()`
     after mutations, append tool results, loop. Cap at ~8 iterations.
  4. When the model returns text: show it in the chat; stop.
  5. `render()` + `updateUIFromState()`; persist conversation; persist any new
     learned preferences.
- **Stop button:** sets an abort flag the loop checks between iterations.
- **System prompt:** tool docs + a compact design-spec schema summary + a summary
  of the current design state + the learned-preferences memory + guidance (be
  tasteful, stay on-brand, use `look_at_canvas` when unsure, prefer `apply_design`
  for presentation changes).

### Extend: `src/features/ai-cloud.js` — `runAgentTurn(messages, tools, { onText })`
One normalized tool-calling chat call across both providers:
- Picks provider via `chooseProvider(false)`; model from `AGENT_MODELS[provider]`.
- **OpenAI:** `chat.completions.create({ model, messages, tools, stream: true })`;
  accumulates streamed content deltas (calls `onText(delta)` for live display) and
  assembles `tool_calls`.
- **Anthropic:** `messages.stream({ model, system, messages, tools })`; streams
  `text` deltas to `onText`, assembles `tool_use` content blocks.
- Returns a normalized `{ text, toolCalls: [{ id, name, args }], stop }` and
  helpers to append tool results in each provider's format. Throws `{code:'NO_KEY'}`
  when no provider is configured.

### Streaming + suggestion chips
- **Streaming:** `runAgentTurn` streams assistant text deltas via `onText`, which
  the panel appends into the active assistant bubble in real time. Tool actions
  are narrated as separate lines the moment each tool resolves (already per-step),
  so the user watches the agent work rather than waiting for the whole turn.
- **Suggestion chips:** the agent's final `suggest_next({ chips })` call populates
  a row of clickable chips below the input. Clicking a chip fills the input and
  sends it as the next user message. If the agent omits `suggest_next`, the chip
  row is simply empty (graceful).

### Memory store
- **Conversation:** localStorage key `snapshotpro_agent_chat_<projectId>` (per
  project; global fallback key when no project id). Capped to the last ~20 turns
  to bound tokens (older turns dropped; note this is lossy by design).
- **Learned preferences:** localStorage key `snapshotpro_agent_memory` (global,
  about the user). A short list of concise notes, capped (~20 entries), updated
  via the `remember` tool. Injected verbatim into the system prompt each session.

## UI & aesthetic

New **"Design Agent"** studio section (its own collapsible section in the editor
sidebar, in/near the AI group): a scrollable chat log (user / agent / narrated
tool-action lines) with **streamed** assistant text, a row of **suggestion
chips** below the input, a text input with **Send** and **Stop**, a per-turn
status line, and the v18 spectrum-gradient signature on the Send affordance.
Honors `prefers-reduced-motion`. New element ids registered; `bindAiAgent()`
called from `main.js`. Reuses existing control/styles; minimal new CSS (chat
bubbles + log + chips).

## Data flow

user message → `bindAiAgent` → save history → loop[ `runAgentTurn` → tool calls →
`agent-tools.run` (applySpec / generate / isolate / palette / text / filters /
vision / remember) → `render()` → append results ] → assistant text → chat +
`updateUIFromState` → persist chat + memory. Everything bakes into export via the
normal render path.

## Error handling / edge cases

- **No key / hosted AI:** the agent panel's Send shows guidance and opens the
  API-keys panel (reuse the existing NO_KEY pattern).
- **Tool error** (e.g. generation failure, no image for isolate): the executor
  returns an error string as the tool result so the agent can recover or tell the
  user; never throws out of the loop.
- **Iteration cap reached:** stop gracefully with a message ("I made several
  changes; tell me what to adjust.").
- **Malformed tool args:** `applySpec` and the setters already validate/clamp;
  unknown tool name → error result.
- **Vision with no key for vision / tainted canvas:** `look_at_canvas` returns a
  note that it couldn't see the canvas; the agent proceeds without it.
- **Stop pressed mid-loop:** abort after the current tool resolves; leave applied
  changes (already a single undo step).
- **localStorage full / parse error:** try/catch; memory/chat silently degrade to
  in-memory only.

## Undo / state / persistence

- One `saveStateToHistory()` per user turn → undo reverts the whole turn's design
  changes. Consistent with v19: generated `bgImage` pixels are not snapshotted
  (mode reverts).
- Conversation + learned preferences live in localStorage (NOT in `state` /
  history) — they're agent features, not undoable design state.

## Testing / verification (no test runner — manual in `npm run dev`)

- With a valid key: "design me a calm fintech hero" → agent calls multiple tools,
  narrates them, canvas updates, exports correctly.
- Refinement: "make it warmer and add a bold headline" → agent adjusts filters +
  text without redoing everything.
- `look_at_canvas`: ask "is the text readable?" → agent critiques and fixes.
- Memory: state a preference ("I always want minimal, cobalt brand"), reload →
  agent still honors it; the ongoing chat resumes.
- Undo reverts a whole agent turn.
- Stop aborts a long run.
- No key → guidance + key panel; tool failure → agent reports gracefully.
- Provider-agnostic: works on the OpenAI key; works on an Anthropic key if added.
- Streaming: assistant text appears progressively; tool actions narrate as they run.
- Suggestion chips appear after a turn; clicking one sends it as the next message.
- `npm run build` succeeds.

## Release chores

- Bump `package.json` to `20.0.0`; what's-new toast (`CURRENT_VERSION='20.0'`);
  editor header/title → v20.0.
- **Changelog** (`changelog/index.html`): demote v19 `.entry.latest` → `.entry`;
  add a v20 entry + refresh the spotlight. Build with the **frontend taste
  skill**, with its own **"conversation / agent"** motif — distinct from v16
  glass, v17 spectrum, v18 variant-grid, v19 prompt-to-image.
- **Landing page:** a dedicated "largest update ever" page is a SEPARATE spec +
  plan (brainstormed after this), not part of this spec.

## Out of scope (v1)

- Editable/visible memory-management panel (chat + learned prefs exist, but no
  user-facing editor for them).
- Editing screenshot *content* beyond isolate / background (no inpainting via the
  agent in v1; the existing magic-eraser/extend tools stay manual).
- Deck / multi-page orchestration by the agent.
- Voice input, design-critique mode, editable memory panel, multi-variant
  proposals, and "design a whole App Store set" (all parked for v20.1).
- Cross-device memory sync (localStorage only; cloud-sync is future work).
