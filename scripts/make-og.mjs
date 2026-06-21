// Generates public/og.png (1200x630) — the social-card image used for
// Discord / X / Slack / iMessage link embeds. Run: node scripts/make-og.mjs
// Requires @resvg/resvg-js (rasterizes SVG -> PNG with system-font text).
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dir, '../public/og.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="86%" cy="6%" r="62%">
      <stop offset="0%" stop-color="#2348ff" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#2348ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4f7cff"/>
      <stop offset="45%" stop-color="#2348ff"/>
      <stop offset="100%" stop-color="#6a3cff"/>
    </linearGradient>
    <linearGradient id="shot" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8a5c"/>
      <stop offset="55%" stop-color="#ff5e7e"/>
      <stop offset="100%" stop-color="#c5318f"/>
    </linearGradient>
    <linearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#f7f7f4"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- brand lockup -->
  <g transform="translate(64,48)">
    <g transform="scale(0.62)">
      <rect width="64" height="64" rx="14" fill="url(#logo)"/>
      <rect x="10" y="20" width="44" height="32" rx="5" fill="#1a1a2e"/>
      <rect x="22" y="14" width="20" height="10" rx="2" fill="#1a1a2e"/>
      <circle cx="32" cy="36" r="10" fill="none" stroke="#fff" stroke-width="2.5"/>
      <circle cx="32" cy="36" r="5" fill="#fff"/>
      <circle cx="46" cy="26" r="1.6" fill="#ff3b30"/>
    </g>
    <text x="54" y="30" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#15161a">SnapShotPro</text>
  </g>

  <!-- eyebrow -->
  <text x="66" y="212" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="3" fill="#2348ff">FREE SCREENSHOT STUDIO</text>

  <!-- headline -->
  <text x="61" y="292" font-family="Arial, Helvetica, sans-serif" font-size="67" font-weight="800" fill="#15161a">Screenshots that</text>
  <text x="61" y="370" font-family="Arial, Helvetica, sans-serif" font-size="67" font-weight="800" fill="#15161a">carry <tspan fill="#2348ff">weight.</tspan></text>

  <!-- subtitle -->
  <text x="66" y="452" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#55565e">Backgrounds, device frames, annotations,</text>
  <text x="66" y="486" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#55565e">and AI polish, all in your browser.</text>

  <!-- CTA pill -->
  <g transform="translate(66,524)">
    <rect width="214" height="52" rx="26" fill="#2348ff"/>
    <text x="107" y="34" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Open the studio</text>
  </g>

  <!-- product showpiece -->
  <g transform="translate(742,150)">
    <g transform="rotate(3.5 215 165)">
      <rect width="430" height="330" rx="28" fill="url(#card)"/>
      <g transform="translate(44,58) rotate(-3.5)">
        <rect width="342" height="234" rx="14" fill="#ffffff"/>
        <path d="M0 14 A14 14 0 0 1 14 0 H328 A14 14 0 0 1 342 14 V40 H0 Z" fill="#f3f3f1"/>
        <circle cx="22" cy="20" r="5" fill="#ff5f57"/>
        <circle cx="40" cy="20" r="5" fill="#febc2e"/>
        <circle cx="58" cy="20" r="5" fill="#28c840"/>
        <rect x="84" y="12" width="236" height="16" rx="8" fill="#e7e7e3"/>
        <rect x="14" y="54" width="314" height="166" rx="9" fill="url(#shot)"/>
      </g>
    </g>
  </g>
</svg>`;

mkdirSync(resolve(__dir, '../public'), { recursive: true });
const r = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: 1200 } });
writeFileSync(out, r.render().asPng());
console.log('wrote', out);
