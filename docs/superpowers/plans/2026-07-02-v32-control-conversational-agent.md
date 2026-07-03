# v32 Control (conversational board agent) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the existing Design Agent board-aware: add tools that arrange, group, add, and export board cards, so the user can drive the board by conversation ("arrange these in a 2×3 grid, group the first three, export").

**Architecture:** Add board tools to the existing `TOOLS` registry in `src/features/agent-tools.js`. Each tool ensures board mode, mutates `state.board`/pages through the same functions a human uses (new exported helpers in `board.js`), and returns a short string. The agent loop already calls `render()` (→ `renderBoard` in board mode) + `window.__updateUIFromState()` after each tool batch, so no new loop code. The system prompt gains board context when `state.mode === 'board'`. The "primary interface" rewrite of Cmd-K (spec §5) is deferred — v32 ships board tools reachable from the existing agent panel.

**Tech Stack:** Vanilla JS + Vite. Reuses `agent-tools.js` (`TOOLS`/`runTool`), `ai-agent.js` (the loop, `systemPrompt`), `board.js` (`enterBoardMode`/`renderBoard`/`exportBoard` + new helpers), `pages.js` (`addPage`/`indexOfPage`), `seed.js` (a new `seedFromUrlCore`), `palette.js`.

**Scope:** 6 tools ship (`add_page_from_url`, `add_page`, `arrange_cards`, `group_cards`, `ungroup`, `export_board`). `style_cards` (per-page `applySpec` + offscreen thumb refresh) is **deferred** to v32.2 — it's the riskiest tool and "arrange/group/export" is the core conversational magic.

## Global Constraints

- **No test runner, no linter.** Verify by `npm run build` + code reading + in-browser exercise (dev server live). The agent needs an OpenAI/Claude key to run a turn; the TOOLS themselves are plain functions testable by calling them (but with no test runner, verify via build + reading + manual).
- **Use Opus for all work, including subagents.**
- **Windows/PowerShell host, bash shell.** Forward slashes; single `-m` for commits; end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Don't commit `dist/`.
- **Do not touch** `renderInto`, the four composition paths, `zoom-pan.js`, `selection.js` (scene), `history.snapshot()` membership, `serialize.js`'s `SCHEMA_VERSION`. `DOC_VERSION` stays 14. Don't change the agent's existing 9 tools' behavior.
- **Commit per task.**

---

## File Structure

**Modify:**
- `src/features/seed.js` — extract `seedFromUrlCore(url)` (returns `{added, ids}`); `seedFromUrl` (UI) wraps it with notifications.
- `src/features/board.js` — add exported `groupCards(ids)`, `ungroupCards(id)`, `arrangeCards(layout, ids?)` helpers; `exportBoard` already exported.
- `src/features/agent-tools.js` — add 6 board tools to `TOOLS`.
- `src/features/ai-agent.js` — board context in `systemPrompt()` when `state.mode === 'board'`.
- `src/features/palette.js` — a `askAgentBoard` command that opens the agent panel + ensures board mode.

---

## Task 1: Extract `seedFromUrlCore` + add board helpers (`groupCards`/`ungroupCards`/`arrangeCards`)

**Files:**
- Modify: `src/features/seed.js`
- Modify: `src/features/board.js`

**Interfaces:**
- Produces: `seed.js` exports `seedFromUrlCore(rawUrl)` → `Promise<{added:number, ids:string[]}>` (no notifications). `board.js` exports `groupCards(ids)`, `ungroupCards(id)`, `arrangeCards(layout, ids?)`.
- Consumes: `seed.js` uses `loadImageEl`, `addPageWithImage`. `board.js` uses `state.board`, `getPageMeta`, `nextId`, `renderBoard`, `groupBounds`, `resolveBoardRef`.

- [ ] **Step 1: Extract `seedFromUrlCore` from `seed.js`**

In `src/features/seed.js`, refactor `seedFromUrl` so the core (fetch + load + addPageWithImage loop) is a separate export returning `{added, ids}`, and the UI `seedFromUrl` wraps it with notifications. Read the current `seedFromUrl` first. Replace it with:

```js
// v32 — core Seed flow with no UI side effects. Returns {added, ids}. Used by
// the UI seedFromUrl (notifications) and the agent's add_page_from_url tool.
export async function seedFromUrlCore(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return { added: 0, ids: [] };
  let manifest;
  try {
    const res = await fetch(`/api/scrape-page?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      let msg = `Scrape failed (${res.status})`;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
      return { added: 0, ids: [], error: msg };
    }
    manifest = await res.json();
  } catch (e) {
    return { added: 0, ids: [], error: 'Could not reach the scraper.' };
  }
  const imgs = (manifest && manifest.images) || [];
  const ids = [];
  for (let i = 0; i < imgs.length; i++) {
    try {
      const img = await loadImageEl(imgs[i].url);
      const id = addPageWithImage(img);
      if (id) ids.push(id);
    } catch (e) { /* skip one bad image */ }
    await new Promise(r => setTimeout(r, 0));
  }
  return { added: ids.length, ids };
}

export async function seedFromUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return;
  showNotification('Scraping page…', 'success');
  const r = await seedFromUrlCore(url);
  if (r.error) { showNotification(r.error, 'error'); return; }
  if (!r.added) { showNotification('No images loaded from that page.', 'error'); return; }
  showNotification(`Added ${r.added} card${r.added === 1 ? '' : 's'} from ${url2host(url)}.`, 'success');
}
```

(Keep `url2host`, `ensureBar`, `bindSeed` unchanged. The UI `seedFromUrl` now delegates to `seedFromUrlCore`.)

- [ ] **Step 2: Add `groupCards`/`ungroupCards`/`arrangeCards` to `board.js`**

In `src/features/board.js`, add these exported helpers (near `groupSelected`/`addBoardText`). They mutate `state.board` and call `renderBoard()`. (`nextId`, `groupBounds`, `getPageMeta`, `state.board`, `renderBoard` are all in scope.)

```js
// v32 — board helpers shared by the toolbar and the conversational agent. Each
// mutates state.board and re-renders.

// Group an explicit set of object ids (cards/text) under one group. Returns the
// group id, or null if fewer than 2 ids / ids not found.
export function groupCards(ids) {
  const set = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (set.length < 2) return null;
  const g = { id: nextId(), kind: 'group', children: set.slice(), x: 0, y: 0, w: 0, h: 0, z: state.board.objects.length };
  state.board.objects.push(g);
  renderBoard();
  return g.id;
}

// Remove the group object with this id (children stay). Returns true if removed.
export function ungroupCards(id) {
  const i = state.board.objects.findIndex(o => o.id === id && o.kind === 'group');
  if (i < 0) return false;
  state.board.objects.splice(i, 1);
  renderBoard();
  return true;
}

// Re-lay out cards into a taste-curated arrangement. layout is one of
// 'grid'|'row'|'hero'|'bento'. If ids is omitted, lay out ALL cards. Non-card
// objects (text/arrows/groups) are left in place.
export function arrangeCards(layout, ids) {
  const cards = state.board.objects.filter(o => o.kind === 'card' && (!ids || ids.includes(o.pageId)));
  if (!cards.length) return;
  const colW = 280, gap = 24;
  const place = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; };
  if (layout === 'row') {
    let x = 60;
    for (const o of cards) { const ar = o.h / o.w || 0.625; const w = colW, h = Math.round(w * ar); place(o, x, 60, w, h); x += w + gap; }
  } else if (layout === 'hero') {
    // One big card on the left, the rest stacked in a column on the right.
    const [hero, ...rest] = cards;
    if (hero) { const ar = hero.h / hero.w || 0.625; const w = colW * 1.6, h = Math.round(w * ar); place(hero, 60, 60, w, h); }
    let y = 60;
    for (const o of rest) { const ar = o.h / o.w || 0.625; const w = colW, h = Math.round(w * ar); place(o, 60 + colW * 1.6 + gap, y, w, h); y += h + gap; }
  } else if (layout === 'bento') {
    // Asymmetric: first card large (2x2), next two medium (1x1 each top-right),
    // the rest in a flowing grid below.
    const big = cards[0];
    if (big) { const ar = big.h / big.w || 0.625; const w = colW * 2 + gap, h = Math.round(w * ar); place(big, 60, 60, w, h); }
    const rest = cards.slice(1);
    let x = 60 + colW * 2 + gap * 2, y = 60;
    for (let i = 0; i < rest.length; i++) {
      const o = rest[i];
      const ar = o.h / o.w || 0.625; const w = colW, h = Math.round(w * ar);
      if (y + h > 60 + (big ? Math.round((colW * 2 + gap) * (big.h / big.w || 0.625)) : 0) + gap) { y = 60; x = 60; } // wrap to a new row under the big card
      place(o, x, y, w, h); y += h + gap;
    }
  } else {
    // 'grid' (default): 4-column grid.
    let row = 0, col = 0; const cols = 4;
    for (const o of cards) {
      const ar = o.h / o.w || 0.625; const w = colW, h = Math.round(w * ar);
      place(o, 60 + col * (colW + gap), 60 + row * (h + gap + 28), w, h);
      col = (col + 1) % cols; if (col === 0) row++;
    }
  }
  renderBoard();
}
```

(The `bento` branch's wrap logic is approximate but produces a reasonable asymmetric layout; exact pixel-perfection isn't required — the user can drag afterwards. Keep it simple and non-crashing.)

- [ ] **Step 3: Verify**

Run `npm run build`; confirm success. Re-read: `seedFromUrlCore` returns `{added, ids}` and sets `error` on failure; the UI `seedFromUrl` delegates. `groupCards`/`ungroupCards`/`arrangeCards` mutate `state.board` + `renderBoard`; `arrangeCards` handles `grid`/`row`/`hero`/`bento` and an `ids` filter; all are no-ops on empty input (no crash).

- [ ] **Step 4: Commit**

```bash
git add src/features/seed.js src/features/board.js
git commit -m "feat(v32): seedFromUrlCore + board group/ungroup/arrange helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add the 6 board tools to `agent-tools.js`

**Files:**
- Modify: `src/features/agent-tools.js`

**Interfaces:**
- Produces: 6 new entries in `TOOLS`: `add_page_from_url`, `add_page`, `arrange_cards`, `group_cards`, `ungroup`, `export_board`.
- Consumes: `board.js` (`enterBoardMode`, `arrangeCards`, `groupCards`, `ungroupCards`, `exportBoard`), `pages.js` (`addPage`, `getPageMeta`), `seed.js` (`seedFromUrlCore`).

- [ ] **Step 1: Add imports**

At the top of `src/features/agent-tools.js`, add imports for the board helpers (dynamic to avoid an import cycle — `board.js` imports `render` from `render.js`, and `agent-tools.js` already imports `render`/`renderInto` from `render.js`; a static `board.js` import would pull `board.js`→`pages.js`→`render.js`, which is fine, but `board.js` also imports from `board-tools.js`. To be safe and match `board.js`'s own dynamic-import style, use dynamic imports inside each tool's `run`). So NO new static imports — each tool dynamically imports what it needs.

- [ ] **Step 2: Add the 6 tools to the `TOOLS` array**

Append these entries to the `TOOLS` array in `agent-tools.js` (before the closing `];` of `TOOLS`, after `suggest_next`):

```js
  {
    name: 'add_page_from_url',
    description: 'Seed the board from a web page: scrape the page at the URL and drop its images as cards. Returns how many cards were added. Use when the user wants to pull images from a link.',
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    async run(args) {
      const { enterBoardMode } = await import('./board.js');
      const { seedFromUrlCore } = await import('./seed.js');
      if (state.mode !== 'board') enterBoardMode();
      const r = await seedFromUrlCore(args.url);
      if (r.error) return `Could not seed from that URL: ${r.error}`;
      return `Seeded ${r.added} card${r.added === 1 ? '' : 's'} from the page.`;
    }
  },
  {
    name: 'add_page',
    description: 'Add a new blank page (a new card on the board), or duplicate the current one. Use when the user wants more cards.',
    input_schema: { type: 'object', properties: { duplicate: { type: 'boolean', description: 'true to duplicate the active page instead of adding a blank one' } } },
    async run(args) {
      const { enterBoardMode } = await import('./board.js');
      const { addPage } = await import('./pages.js');
      if (state.mode !== 'board') enterBoardMode();
      addPage({ duplicate: !!args.duplicate });
      return args.duplicate ? 'Duplicated the active page as a new card.' : 'Added a new blank card.';
    }
  },
  {
    name: 'arrange_cards',
    description: 'Re-arrange cards on the board into a tidy layout: grid (4-col), row (single horizontal row), hero (one big card plus the rest stacked), or bento (asymmetric). By default arranges ALL cards; pass ids (page ids) to arrange a subset.',
    input_schema: {
      type: 'object',
      properties: {
        layout: { type: 'string', description: 'grid|row|hero|bento' },
        ids: { type: 'array', items: { type: 'string' }, description: 'optional page ids to arrange; omit for all' }
      },
      required: ['layout']
    },
    async run(args) {
      const { enterBoardMode, arrangeCards } = await import('./board.js');
      if (state.mode !== 'board') enterBoardMode();
      const layout = ['grid', 'row', 'hero', 'bento'].includes(args.layout) ? args.layout : 'grid';
      arrangeCards(layout, Array.isArray(args.ids) ? args.ids : undefined);
      return `Re-arranged the cards into a ${layout} layout.`;
    }
  },
  {
    name: 'group_cards',
    description: 'Group a set of cards under one dashed bounding box so they move together. Pass the page ids of the cards to group (at least 2).',
    input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
    async run(args) {
      const { enterBoardMode, groupCards } = await import('./board.js');
      if (state.mode !== 'board') enterBoardMode();
      const ids = Array.isArray(args.ids) ? args.ids : [];
      const gid = groupCards(ids);
      if (!gid) return 'Need at least 2 card ids to group.';
      return `Grouped ${ids.length} cards (group ${gid}).`;
    }
  },
  {
    name: 'ungroup',
    description: 'Remove a group (the cards stay on the board, just no longer grouped). Pass the group object id.',
    input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
    async run(args) {
      const { enterBoardMode, ungroupCards } = await import('./board.js');
      if (state.mode !== 'board') enterBoardMode();
      const ok = ungroupCards(args.id);
      return ok ? 'Ungrouped.' : 'No group with that id.';
    }
  },
  {
    name: 'export_board',
    description: 'Export the whole board as a single composite PNG (every card re-rendered at full resolution, plus text and arrows). Use when the user wants to save or share the board.',
    input_schema: { type: 'object', properties: {} },
    async run(args) {
      const { enterBoardMode, exportBoard } = await import('./board.js');
      if (state.mode !== 'board') enterBoardMode();
      try { await exportBoard(); return 'Exported the board as board.png.'; }
      catch (e) { return `Export failed: ${e?.message || e}`; }
    }
  }
```

- [ ] **Step 3: Verify**

Run `npm run build`; confirm success. Re-read: each tool dynamically imports `board.js`/`pages.js`/`seed.js`, ensures board mode, mutates, returns a short string. `arrange_cards` validates `layout`. `group_cards` handles `<2 ids`. `ungroup` handles a missing group. `export_board` catches errors. No tool touches `state.board.camera` or scene `state` destructively.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-tools.js
git commit -m "feat(v32): board-aware agent tools (seed/add/arrange/group/ungroup/export)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Board context in the system prompt + palette command

**Files:**
- Modify: `src/features/ai-agent.js` (`systemPrompt`)
- Modify: `src/features/palette.js` (`askAgentBoard` command)

**Interfaces:**
- Produces: `systemPrompt()` adds a board-context block when `state.mode === 'board'` (card count + available board tools). A palette `askAgentBoard` command opens the agent panel + ensures board mode.

- [ ] **Step 1: Add board context to `systemPrompt`**

In `src/features/ai-agent.js`, the `systemPrompt()` function builds an array of lines and `.join('\n')`s them. Add a static import at the top of the file (no cycle — `pages.js` does not import `ai-agent.js`):

```js
import { getPageMeta } from './pages.js';
```

Then, in `systemPrompt()`, after the existing lines array is built (the `lines` array literal) and before `return lines.join('\n');`, add a board-context block that appends only when `state.mode === 'board'`:

```js
  if (state.mode === 'board') {
    const n = getPageMeta().length;
    lines.push(`\nThe user is on the Open Canvas board, viewing ${n} card${n === 1 ? '' : 's'} (each card is a page). You can drive the board: add_page_from_url to seed cards from a link, add_page to add a blank/duplicate card, arrange_cards to re-lay cards into grid/row/hero/bento, group_cards to group a set (it returns the group id), ungroup to remove a group (pass its id), and export_board to export the whole board as one PNG. Pass page ids (from the board cards) to arrange_cards/group_cards.`);
  }
```

(Read the current `systemPrompt` first to place this correctly — it should be a new `if` block right before the `return lines.join('\n');`. Don't restructure the existing lines. Confirm `getPageMeta` is exported from `pages.js` — it is.)

- [ ] **Step 2: Add the `askAgentBoard` palette command**

In `src/features/palette.js`, the agent panel is opened/focused via `window.__openAgent` (check — `ai-agent.js` may expose it; if not, the command can open the AI sidebar group). Read `palette.js` for how the existing "open agent" command (if any) works, or how sidebar sections are shown. Add a command:

```js
  { id: 'askAgentBoard', label: 'Ask the agent about the board', icon: 'comment', group: 'View',
    run: () => {
      import('./board.js').then(m => { if (state.mode !== 'board') m.enterBoardMode(); });
      if (typeof window.__openAgent === 'function') window.__openAgent();
      else if (typeof window.__setStudioGroup === 'function') window.__setStudioGroup('ai');
      const inp = document.getElementById('agent-input');
      if (inp) { inp.value = ''; inp.focus(); }
    },
    when: () => true },
```

(First read `palette.js` + `ai-agent.js` to find the real way to surface the agent panel — there may already be a `window.__openAgent` or a studio-nav group switch. If `window.__openAgent` exists, use it; otherwise fall back to the studio-nav 'ai' group. Match the existing pattern. Add `askAgentBoard` to `groupFor`'s View branch like `seedFromUrl`.)

- [ ] **Step 3: Verify**

Run `npm run build`; confirm success. Re-read: `systemPrompt` adds the board block only in board mode; the static `getPageMeta` import doesn't cycle; the palette command opens the agent panel and ensures board mode.

- [ ] **Step 4: Commit**

```bash
git add src/features/ai-agent.js src/features/palette.js
git commit -m "feat(v32): board context in agent system prompt + askAgentBoard command" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (run after writing; fix inline)

- **Spec coverage:** 6 of 7 board tools (§5) → Tasks 1-2. Board system-prompt context → Task 3. Palette entry → Task 3. `style_cards` deferred (noted). **Control v1 covered.** The "primary interface" Cmd-K rewrite (§5) is explicitly deferred.
- **Placeholder scan:** none. (Task 3 Step 2 says "read palette.js to find the real way to surface the agent panel" — that's a real instruction, not a placeholder; the implementer must confirm `window.__openAgent`/`__setStudioGroup` exists before using.)
- **Type consistency:** `groupCards(ids)` returns a group id (Number from `nextId`) or null; `ungroupCards(id)` takes the group's Number id (the `ungroup` tool passes `args.id` as a number — the agent gets group ids from... hmm, group ids aren't visible to the user. Note: `ungroup`'s `id` is the group OBJECT id, which the agent would need to know. For v1, the agent can call `ungroup` with an id it learns from a prior `group_cards` return — so `group_cards` should RETURN the group id. Update Task 2's `group_cards` tool to return the group id: `return \`Grouped ${ids.length} cards (group ${gid}).\`;` so the agent can ungroup it later. Fix inline.)
- **Note for implementer:** Task 3 Step 1 — add the `import { getPageMeta } from './pages.js';` to `ai-agent.js` (static, no cycle). Task 3 Step 2 — confirm the agent-panel-open mechanism before wiring (read `palette.js`/`ai-agent.js`).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-v32-control-conversational-agent.md`. Subagent-Driven (recommended) or Inline. (Opus only.)
