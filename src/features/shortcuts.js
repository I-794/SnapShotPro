// v22 — Command Center: single source of truth for global keyboard shortcuts.
// keyboard.js dispatches the non-displayOnly entries via matchEvent(); the "?"
// help overlay is generated from this same list so the two can never drift.

const k = (e) => (e.key || '').toLowerCase();

export const SHORTCUTS = [
  { id: 'palette',  keys: 'mod+k',       label: 'Command palette',               group: 'General',  displayOnly: true },
  { id: 'help',     keys: '?',           label: 'Toggle shortcuts help',          group: 'General',  match: (e) => e.key === '?' },
  { id: 'export',   keys: 'mod+s',       label: 'Export image',                   group: 'File',     match: (e, mod) => mod && k(e) === 's' && !e.shiftKey },
  { id: 'copy',     keys: 'mod+shift+c', label: 'Copy to clipboard',              group: 'File',     match: (e, mod) => mod && e.shiftKey && k(e) === 'c' },
  { id: 'undo',     keys: 'mod+z',       label: 'Undo',                           group: 'Edit',     match: (e, mod) => mod && k(e) === 'z' && !e.shiftKey },
  { id: 'redo',     keys: 'mod+shift+z', label: 'Redo',                           group: 'Edit',     match: (e, mod) => mod && (k(e) === 'y' || (k(e) === 'z' && e.shiftKey)) },
  { id: 'delete',   keys: 'Delete',      label: 'Delete selected',                group: 'Edit',     displayOnly: true },
  { id: 'deselect', keys: 'Escape',      label: 'Deselect / Select tool',         group: 'Edit',     displayOnly: true },
  { id: 'nudge',    keys: 'arrows',      label: 'Nudge selected (Shift = 10px)',  group: 'Edit',     displayOnly: true },
  { id: 'tl-step',  keys: ', / .',       label: 'Timeline: step frame (clip loaded)', group: 'Timeline', displayOnly: true },
  { id: 'tl-inout', keys: '[ / ]',       label: 'Timeline: set in / out point',   group: 'Timeline', displayOnly: true },
];

const GROUP_ORDER = ['General', 'File', 'Edit', 'Timeline'];

// 'mod+shift+c' -> ['Cmd/Ctrl','Shift','C']; 'arrows' -> ['↑ ↓ ← →']; ', / .' -> [', / .'].
export function formatKeys(keys) {
  if (!keys.includes('+')) {
    if (keys === 'arrows') return ['↑ ↓ ← →'];
    return [keys.length === 1 ? keys.toUpperCase() : keys];
  }
  return keys.split('+').map((p) => {
    if (p === 'mod') return 'Cmd/Ctrl';
    if (p === 'shift') return 'Shift';
    return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
  });
}

export function matchEvent(e) {
  const mod = e.ctrlKey || e.metaKey;
  for (const s of SHORTCUTS) {
    if (s.displayOnly || !s.match) continue;
    if (s.match(e, mod)) return s.id;
  }
  return null;
}

export function renderShortcutsOverlay(container) {
  if (!container) return;
  const groups = {};
  for (const s of SHORTCUTS) (groups[s.group] = groups[s.group] || []).push(s);
  const order = [...GROUP_ORDER, ...Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))];
  container.innerHTML = order
    .filter((g) => groups[g])
    .map((g) => `
      <div class="shortcuts-group">
        <h4 class="shortcuts-group-title">${g}</h4>
        ${groups[g].map((s) => `
          <div class="shortcut-item">
            <kbd>${formatKeys(s.keys).join(' + ')}</kbd><span>${s.label}</span>
          </div>`).join('')}
      </div>`).join('');
}
