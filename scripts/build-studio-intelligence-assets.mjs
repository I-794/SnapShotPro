import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Resvg } from '@resvg/resvg-js';

const outDir = resolve('public');
mkdirSync(outDir, { recursive: true });

const palette = {
  ink: '#070a12',
  panel: '#101829',
  panel2: '#0d1323',
  line: '#2b3854',
  blue: '#4f7cff',
  blue2: '#1e5bff',
  violet: '#7a5cff',
  teal: '#2ec4b6',
  white: '#f7f9ff',
  muted: '#8f9ab7'
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function shell({ w, h, body, defs = '', pad = 0 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow" cx="74%" cy="18%" r="82%">
      <stop offset="0" stop-color="${palette.blue}" stop-opacity=".42"/>
      <stop offset=".45" stop-color="${palette.violet}" stop-opacity=".14"/>
      <stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#172238"/>
      <stop offset="1" stop-color="#07101f"/>
    </linearGradient>
    <linearGradient id="blueLine" x1="0" x2="1">
      <stop offset="0" stop-color="${palette.blue}"/>
      <stop offset="1" stop-color="${palette.teal}"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#001134" flood-opacity=".55"/>
    </filter>
    ${defs}
  </defs>
  <rect width="${w}" height="${h}" fill="${palette.ink}"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <g opacity=".16" stroke="${palette.blue}" stroke-width="1">
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${w * 0.55 + i * 18} ${h} C${w * 0.7 + i * 12} ${h * 0.62}, ${w * 0.78 + i * 9} ${h * 0.22}, ${w + i * 16} ${h * 0.04}" fill="none"/>`).join('')}
  </g>
  <g transform="translate(${pad} ${pad})">${body}</g>
</svg>`;
}

function rect(x, y, w, h, fill, r = 18, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
}

function bars(x, y, widths, color = palette.muted) {
  return widths.map((width, i) => rect(x, y + i * 30, width, 8, color, 4, `opacity="${i === 0 ? .8 : .45}"`)).join('');
}

function render(name, svg) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: true }
  }).render().asPng();
  writeFileSync(resolve(outDir, name), png);
}

function magicEdit() {
  const w = 1200, h = 850;
  const body = `
    <rect x="140" y="100" width="890" height="600" rx="34" fill="#0c1425" stroke="#56627e" stroke-opacity=".55" filter="url(#softShadow)"/>
    <rect x="170" y="140" width="830" height="520" rx="20" fill="#070d18"/>
    <rect x="170" y="140" width="415" height="520" rx="20" fill="#f5f7fb"/>
    <path d="M585 140v520" stroke="${palette.blue}" stroke-width="3"/>
    ${rect(205, 185, 110, 10, '#aeb8cc', 5, 'opacity=".75"')}
    ${rect(205, 230, 74, 10, palette.blue, 5, 'opacity=".65"')}
    ${rect(350, 185, 190, 92, '#ffffff', 16, 'opacity=".95"')}
    ${bars(380, 218, [82, 142, 92], '#69758e')}
    ${rect(350, 310, 190, 175, '#ffffff', 16, 'opacity=".95"')}
    <polyline points="380,430 435,400 488,418 535,365" fill="none" stroke="#8c96aa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${rect(635, 188, 185, 90, '#121d31', 15)}
    ${rect(850, 188, 120, 90, '#121d31', 15)}
    ${bars(662, 222, [86, 136, 72], '#dce5ff')}
    <polyline points="650,480 720,430 790,455 865,355 950,390" fill="none" stroke="${palette.blue}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M650 480 L720 430 L790 455 L865 355 L950 390 L950 585 L650 585Z" fill="${palette.blue}" opacity=".2"/>
    ${rect(635, 535, 150, 90, '#101a2c', 16)}
    ${rect(815, 535, 155, 90, '#101a2c', 16)}
    <circle cx="905" cy="580" r="40" fill="none" stroke="${palette.blue}" stroke-width="18" opacity=".9"/>
    <circle cx="585" cy="400" r="33" fill="${palette.blue}" filter="url(#softShadow)"/>
    <path d="M574 400l-10-10m10 10l-10 10m22-10l10-10m-10 10l10 10" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${rect(78, 255, 72, 335, '#111a2a', 20, 'stroke="#4e5b78" stroke-opacity=".65"')}
    <circle cx="114" cy="320" r="18" fill="${palette.blue}"/>
    <circle cx="114" cy="390" r="18" fill="none" stroke="#edf3ff" stroke-width="5"/>
    <circle cx="114" cy="463" r="18" fill="none" stroke="#edf3ff" stroke-width="5" opacity=".8"/>
    ${rect(945, 285, 170, 260, '#101829', 24, 'stroke="#54617b" stroke-opacity=".75" filter="url(#softShadow)"')}
    ${bars(982, 334, [72, 102], '#dce5ff')}
    ${rect(982, 405, 102, 8, 'url(#blueLine)', 4)}
    <circle cx="1000" cy="480" r="18" fill="${palette.blue}"/><circle cx="1050" cy="480" r="18" fill="${palette.violet}"/><circle cx="1100" cy="480" r="18" fill="${palette.teal}"/>
  `;
  render('si-magic-edit.png', shell({ w, h, body }));
}

function heroBanner() {
  const w = 900, h = 1120;
  const body = `
    <rect x="78" y="78" width="744" height="964" rx="48" fill="url(#panel)" stroke="#52607a" stroke-opacity=".55" filter="url(#softShadow)"/>
    <rect x="126" y="140" width="648" height="330" rx="32" fill="#eef3ff"/>
    <circle cx="250" cy="278" r="86" fill="${palette.blue}" opacity=".16"/>
    <circle cx="622" cy="254" r="72" fill="${palette.teal}" opacity=".16"/>
    ${rect(184, 544, 280, 18, '#f3f6ff', 9)}
    ${rect(184, 590, 430, 12, '#8190ae', 6)}
    ${rect(184, 620, 360, 12, '#8190ae', 6, 'opacity=".7"')}
    ${rect(184, 684, 190, 50, 'url(#blueLine)', 25)}
    <g transform="translate(144 800)">
      ${rect(0, 0, 178, 142, '#111d31', 22, 'stroke="#43506b"')}
      ${rect(224, 0, 178, 142, '#111d31', 22, 'stroke="#43506b"')}
      ${rect(448, 0, 178, 142, '#111d31', 22, 'stroke="#43506b"')}
      ${bars(32, 42, [82, 110], '#c4cee3')}
      ${bars(256, 42, [74, 92], '#c4cee3')}
      ${bars(480, 42, [90, 72], '#c4cee3')}
    </g>
  `;
  render('si-hero-banner.png', shell({ w, h, body }));
}

function socialPost() {
  const w = 1080, h = 1080;
  const body = `
    <rect x="96" y="96" width="888" height="888" rx="64" fill="#0d1628" stroke="#52617c" stroke-opacity=".5" filter="url(#softShadow)"/>
    <circle cx="790" cy="250" r="130" fill="${palette.blue}" opacity=".22"/>
    <circle cx="260" cy="800" r="180" fill="${palette.violet}" opacity=".14"/>
    <rect x="174" y="190" width="732" height="442" rx="42" fill="#f5f8ff"/>
    <rect x="222" y="246" width="182" height="18" rx="9" fill="#6f7d99"/>
    <rect x="222" y="296" width="410" height="14" rx="7" fill="#a7b1c4"/>
    <rect x="222" y="326" width="338" height="14" rx="7" fill="#a7b1c4" opacity=".7"/>
    <rect x="222" y="412" width="224" height="76" rx="38" fill="${palette.blue}"/>
    <rect x="542" y="390" width="258" height="160" rx="28" fill="#dce7ff"/>
    <polyline points="582,500 632,460 684,480 748,426" fill="none" stroke="${palette.blue}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="174" y="694" width="340" height="190" rx="32" fill="#111d31"/>
    <rect x="568" y="694" width="338" height="190" rx="32" fill="#111d31"/>
    ${bars(224, 760, [122, 210, 152], '#d7e0f4')}
    ${bars(620, 760, [140, 188, 110], '#d7e0f4')}
  `;
  render('si-social-post.png', shell({ w, h, body }));
}

function appStoreShot() {
  const w = 900, h = 1500;
  const body = `
    <rect x="164" y="70" width="572" height="1360" rx="82" fill="#101929" stroke="#63708c" stroke-opacity=".6" filter="url(#softShadow)"/>
    <rect x="196" y="126" width="508" height="1248" rx="48" fill="#f6f8ff"/>
    <rect x="246" y="210" width="210" height="22" rx="11" fill="#52617b"/>
    <rect x="246" y="270" width="330" height="14" rx="7" fill="#9ca8bf"/>
    <rect x="246" y="304" width="270" height="14" rx="7" fill="#9ca8bf" opacity=".75"/>
    <rect x="246" y="380" width="408" height="520" rx="40" fill="#dfe8ff"/>
    <circle cx="448" cy="620" r="124" fill="${palette.blue}" opacity=".18"/>
    <rect x="318" y="528" width="260" height="180" rx="32" fill="#fff"/>
    <polyline points="350,658 402,620 456,640 532,574" fill="none" stroke="${palette.blue}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="246" y="980" width="172" height="56" rx="28" fill="${palette.blue}"/>
    <rect x="246" y="1090" width="408" height="96" rx="24" fill="#eef2fb"/>
    <rect x="246" y="1214" width="408" height="96" rx="24" fill="#eef2fb"/>
  `;
  render('si-app-store-shot.png', shell({ w, h, body }));
}

function launchTeaser() {
  const w = 1400, h = 560;
  const body = `
    <rect x="78" y="68" width="1244" height="424" rx="42" fill="#0d1628" stroke="#52617c" stroke-opacity=".55" filter="url(#softShadow)"/>
    <rect x="126" y="122" width="450" height="316" rx="32" fill="#f7f9ff"/>
    <rect x="172" y="180" width="186" height="18" rx="9" fill="#5f6e89"/>
    <rect x="172" y="232" width="300" height="12" rx="6" fill="#9aa6bc"/>
    <rect x="172" y="260" width="252" height="12" rx="6" fill="#9aa6bc" opacity=".7"/>
    <rect x="172" y="328" width="180" height="52" rx="26" fill="${palette.blue}"/>
    <g transform="translate(650 120)">
      <rect x="0" y="0" width="580" height="318" rx="30" fill="#101d31"/>
      <circle cx="484" cy="86" r="42" fill="${palette.blue}" opacity=".35"/>
      <polyline points="70,230 150,176 234,198 332,116 460,152" fill="none" stroke="${palette.blue}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M70 230 L150 176 L234 198 L332 116 L460 152 L460 270 L70 270Z" fill="${palette.blue}" opacity=".18"/>
      ${rect(70, 58, 150, 12, '#d7e2ff', 6)}
      ${rect(70, 90, 230, 10, '#7f8ba6', 5)}
    </g>
    <circle cx="700" cy="466" r="14" fill="${palette.blue}"/>
    <rect x="730" y="461" width="240" height="10" rx="5" fill="#34435f"/>
    <rect x="730" y="461" width="132" height="10" rx="5" fill="url(#blueLine)"/>
  `;
  render('si-launch-teaser.png', shell({ w, h, body }));
}

magicEdit();
heroBanner();
socialPost();
appStoreShot();
launchTeaser();

for (const name of ['si-magic-edit.png', 'si-hero-banner.png', 'si-social-post.png', 'si-app-store-shot.png', 'si-launch-teaser.png']) {
  console.log(`wrote public/${esc(name)}`);
}
