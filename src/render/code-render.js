// v24 — Code Snippet Studio rasterizer.
//
// Turns source code into a plain offscreen <canvas> image. highlight.js is used
// only as a *tokenizer* (lazy-loaded into its own chunk); the tokens are then
// painted with ctx.fillText onto a canvas we fully control. This deliberately
// avoids the <svg><foreignObject> route, which taints the canvas on toDataURL()
// (Safari/older Chromium) and would silently break project save / PNG export in
// this "canvas bakes everything" codebase. The returned canvas is assigned to
// state.image, so it flows through the normal background / shadow / radius /
// window-frame / export pipeline with no renderer changes.

// ── Lazy highlight.js (core + a curated language set) ────────────────────────
let hljsPromise = null;
function ensureHljs() {
  if (!hljsPromise) {
    hljsPromise = (async () => {
      const [core, ...mods] = await Promise.all([
        import('highlight.js/lib/core'),
        import('highlight.js/lib/languages/javascript'),
        import('highlight.js/lib/languages/typescript'),
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/json'),
        import('highlight.js/lib/languages/xml'),
        import('highlight.js/lib/languages/css'),
        import('highlight.js/lib/languages/bash'),
        import('highlight.js/lib/languages/go'),
        import('highlight.js/lib/languages/rust'),
        import('highlight.js/lib/languages/java'),
        import('highlight.js/lib/languages/sql'),
        import('highlight.js/lib/languages/markdown')
      ]);
      const hljs = core.default;
      const names = ['javascript', 'typescript', 'python', 'json', 'xml', 'css',
        'bash', 'go', 'rust', 'java', 'sql', 'markdown'];
      mods.forEach((m, i) => hljs.registerLanguage(names[i], m.default));
      // Friendly aliases so the language picker maps cleanly.
      hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
      hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
      hljs.registerAliases(['html'], { languageName: 'xml' });
      hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' });
      hljs.registerAliases(['py'], { languageName: 'python' });
      hljs.registerAliases(['golang'], { languageName: 'go' });
      hljs.registerAliases(['md'], { languageName: 'markdown' });
      return hljs;
    })();
  }
  return hljsPromise;
}

export const CODE_LANGUAGES = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML / XML' },
  { id: 'css', label: 'CSS' },
  { id: 'bash', label: 'Shell / Bash' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' }
];

// ── Themes ───────────────────────────────────────────────────────────────────
// Each theme names a small palette of roles; SCOPE_TO_ROLE maps highlight.js
// scopes onto those roles so every theme stays compact. Anything unmapped falls
// back to `fg`.
const SCOPE_TO_ROLE = {
  comment: 'comment', quote: 'comment', doctag: 'comment',
  keyword: 'keyword', literal: 'keyword', selector_tag: 'keyword',
  'selector-tag': 'keyword',
  built_in: 'builtin', class: 'type', type: 'type', title: 'func',
  section: 'func', name: 'tag', tag: 'tag',
  string: 'string', regexp: 'string', char: 'string', link: 'string',
  meta: 'meta', 'meta-keyword': 'meta', 'meta-string': 'string',
  number: 'number', symbol: 'number', bullet: 'number',
  attr: 'attr', attribute: 'attr', property: 'attr', params: 'fg',
  variable: 'variable', 'template-variable': 'variable',
  'selector-id': 'tag', 'selector-class': 'attr', 'selector-attr': 'attr',
  operator: 'operator', punctuation: 'fg', addition: 'string', deletion: 'keyword',
  'function': 'func', subst: 'fg'
};

export const THEMES = {
  snazzy: { label: 'Snazzy', bg: '#282a36', fg: '#eff0eb', lineNo: '#6c6f7e',
    roles: { comment: '#686868', keyword: '#ff6ac1', builtin: '#57c7ff', type: '#9aedfe', func: '#57c7ff', tag: '#ff6ac1', string: '#5af78e', meta: '#9aedfe', number: '#bd93f9', attr: '#f3f99d', variable: '#ff5c57', operator: '#ff6ac1' } },
  dracula: { label: 'Dracula', bg: '#282a36', fg: '#f8f8f2', lineNo: '#6272a4',
    roles: { comment: '#6272a4', keyword: '#ff79c6', builtin: '#8be9fd', type: '#8be9fd', func: '#50fa7b', tag: '#ff79c6', string: '#f1fa8c', meta: '#bd93f9', number: '#bd93f9', attr: '#50fa7b', variable: '#f8f8f2', operator: '#ff79c6' } },
  nord: { label: 'Nord', bg: '#2e3440', fg: '#d8dee9', lineNo: '#4c566a',
    roles: { comment: '#616e88', keyword: '#81a1c1', builtin: '#88c0d0', type: '#8fbcbb', func: '#88c0d0', tag: '#81a1c1', string: '#a3be8c', meta: '#5e81ac', number: '#b48ead', attr: '#8fbcbb', variable: '#d8dee9', operator: '#81a1c1' } },
  'github-dark': { label: 'GitHub Dark', bg: '#0d1117', fg: '#c9d1d9', lineNo: '#484f58',
    roles: { comment: '#8b949e', keyword: '#ff7b72', builtin: '#79c0ff', type: '#ffa657', func: '#d2a8ff', tag: '#7ee787', string: '#a5d6ff', meta: '#79c0ff', number: '#79c0ff', attr: '#79c0ff', variable: '#ffa657', operator: '#ff7b72' } },
  'github-light': { label: 'GitHub Light', bg: '#ffffff', fg: '#24292f', lineNo: '#8c959f',
    roles: { comment: '#6e7781', keyword: '#cf222e', builtin: '#0550ae', type: '#953800', func: '#8250df', tag: '#116329', string: '#0a3069', meta: '#0550ae', number: '#0550ae', attr: '#0550ae', variable: '#953800', operator: '#cf222e' } },
  'one-dark': { label: 'One Dark', bg: '#282c34', fg: '#abb2bf', lineNo: '#4b5263',
    roles: { comment: '#5c6370', keyword: '#c678dd', builtin: '#56b6c2', type: '#e5c07b', func: '#61afef', tag: '#e06c75', string: '#98c379', meta: '#56b6c2', number: '#d19a66', attr: '#d19a66', variable: '#e06c75', operator: '#c678dd' } },
  monokai: { label: 'Monokai', bg: '#272822', fg: '#f8f8f2', lineNo: '#75715e',
    roles: { comment: '#75715e', keyword: '#f92672', builtin: '#66d9ef', type: '#66d9ef', func: '#a6e22e', tag: '#f92672', string: '#e6db74', meta: '#ae81ff', number: '#ae81ff', attr: '#a6e22e', variable: '#f8f8f2', operator: '#f92672' } },
  'solarized-light': { label: 'Solarized Light', bg: '#fdf6e3', fg: '#657b83', lineNo: '#93a1a1',
    roles: { comment: '#93a1a1', keyword: '#859900', builtin: '#268bd2', type: '#b58900', func: '#268bd2', tag: '#268bd2', string: '#2aa198', meta: '#cb4b16', number: '#d33682', attr: '#268bd2', variable: '#cb4b16', operator: '#859900' } }
};

function roleColor(theme, scope) {
  const role = SCOPE_TO_ROLE[scope];
  return (role && theme.roles[role]) || theme.fg;
}

// ── Font loading ─────────────────────────────────────────────────────────────
const FONT_STACKS = {
  jetbrains: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
  fira: '"Fira Code", ui-monospace, Menlo, Consolas, monospace',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
};
// Fira Code isn't in the editor's <head>; load it once from the jsDelivr CDN
// (already a runtime-cached origin in the service worker). JetBrains Mono ships
// in the editor head; system mono needs nothing.
const FONT_CDN = {
  fira: 'https://cdn.jsdelivr.net/fontsource/fonts/fira-code@latest/latin-400-normal.woff2'
};
const fontLoaded = {};
async function ensureFont(family, sizePx) {
  if (family === 'fira' && !fontLoaded.fira && typeof FontFace === 'function') {
    fontLoaded.fira = (async () => {
      try {
        const ff = new FontFace('Fira Code', `url(${FONT_CDN.fira})`);
        await ff.load();
        document.fonts.add(ff);
      } catch (_) { /* fall back to monospace */ }
    })();
  }
  if (fontLoaded.fira) { try { await fontLoaded.fira; } catch (_) {} }
  // Make sure the chosen family is actually ready before we measure glyph width.
  try { await document.fonts.load(`${sizePx}px ${FONT_STACKS[family] || FONT_STACKS.mono}`); } catch (_) {}
}

// ── Tokenize highlight.js HTML into per-line [{text,color}] runs ──────────────
function tokenizeToLines(html, theme) {
  const root = document.createElement('div');
  root.innerHTML = html;
  const lines = [[]];
  const push = (text, color) => {
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      if (parts[i]) lines[lines.length - 1].push({ text: parts[i], color });
    }
  };
  const walk = (node, color) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) push(child.nodeValue, color);
      else if (child.nodeType === 1) {
        const cls = Array.from(child.classList).find((c) => c.startsWith('hljs-'));
        const scope = cls ? cls.slice(5) : null;
        walk(child, scope ? roleColor(theme, scope) : color);
      }
    });
  };
  walk(root, theme.fg);
  return lines;
}

// Reflow logical lines into visual rows (identity when wrap is off).
function layoutRows(lines, { wrap, maxChars, lineStart }) {
  const rows = [];
  lines.forEach((line, idx) => {
    const num = lineStart + idx;
    if (!wrap || maxChars < 4) { rows.push({ num, tokens: line }); return; }
    let cur = [], curLen = 0, first = true;
    const flush = () => { rows.push({ num: first ? num : null, tokens: cur }); cur = []; curLen = 0; first = false; };
    for (const t of line) {
      let text = t.text;
      while (curLen + text.length > maxChars) {
        const take = maxChars - curLen;
        if (take > 0) cur.push({ text: text.slice(0, take), color: t.color });
        text = text.slice(take);
        flush();
      }
      if (text) { cur.push({ text, color: t.color }); curLen += text.length; }
    }
    flush();
  });
  return rows;
}

const SUPERSAMPLE = 2;   // render at 2× so the text stays crisp after the pipeline fits it

// rasterizeCode(cfg) → Promise<HTMLCanvasElement>. The canvas carries _logicalW /
// _logicalH (CSS-px dimensions before supersampling) so the caller can size the
// editor canvas to hug the card.
export async function rasterizeCode(cfg) {
  const hljs = await ensureHljs();
  const theme = THEMES[cfg.theme] || THEMES.snazzy;
  const fontSize = cfg.fontSize || 15;
  await ensureFont(cfg.fontFamily, fontSize);

  // Expand tabs up front so monospace width math holds everywhere.
  const code = String(cfg.code || '').replace(/\t/g, ' '.repeat(cfg.tabSize || 2));

  let html;
  try {
    if (cfg.language && cfg.language !== 'auto') {
      html = hljs.highlight(code, { language: cfg.language, ignoreIllegals: true }).value;
    } else {
      html = hljs.highlightAuto(code).value;
    }
  } catch (_) {
    // Last resort: render unhighlighted (escape so innerHTML is safe).
    const div = document.createElement('div'); div.textContent = code; html = div.innerHTML;
  }

  const lines = tokenizeToLines(html, theme);

  // Measure with a throwaway context (measureText ignores transforms).
  const meas = document.createElement('canvas').getContext('2d');
  const fontStack = FONT_STACKS[cfg.fontFamily] || FONT_STACKS.mono;
  meas.font = `${fontSize}px ${fontStack}`;
  const charW = meas.measureText('M').width || fontSize * 0.6;
  const lineH = Math.round(fontSize * (cfg.lineHeight || 1.6));
  const pad = cfg.pad || 28;

  const digits = String((cfg.lineNumberStart || 1) + Math.max(0, lines.length - 1)).length;
  const gutterW = cfg.showLineNumbers ? charW * (digits + 2) : 0;

  const wrap = !!cfg.wrap;
  const maxContentChars = wrap
    ? Math.max(8, Math.floor(((cfg.maxWidth || 720) - pad * 2 - gutterW) / charW))
    : 0;

  const rows = layoutRows(lines, {
    wrap, maxChars: maxContentChars, lineStart: cfg.lineNumberStart || 1
  });

  let contentW;
  if (wrap) {
    contentW = maxContentChars * charW;
  } else {
    let longest = 0;
    for (const line of lines) {
      let w = 0; for (const t of line) w += t.text.length * charW;
      if (w > longest) longest = w;
    }
    contentW = longest;
  }

  const W = Math.ceil(pad * 2 + gutterW + contentW);
  const H = Math.ceil(pad * 2 + Math.max(1, rows.length) * lineH);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, W * SUPERSAMPLE);
  canvas.height = Math.max(1, H * SUPERSAMPLE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  ctx.textBaseline = 'top';
  ctx.font = `${fontSize}px ${fontStack}`;

  // Card background.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  const x0 = pad + gutterW;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const y = pad + i * lineH;
    if (cfg.showLineNumbers && row.num != null) {
      ctx.fillStyle = theme.lineNo;
      ctx.textAlign = 'right';
      ctx.fillText(String(row.num), pad + gutterW - charW, y);
      ctx.textAlign = 'left';
    }
    let x = x0;
    for (const t of row.tokens) {
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
      x += t.text.length * charW;
    }
  }

  canvas._logicalW = W;
  canvas._logicalH = H;
  return canvas;
}
