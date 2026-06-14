// Color utilities. hexToRgba/isValidHex pre-date v17; everything below the line
// is v17 — pure color math (no DOM, no state) shared by the Color release:
// palette harmonies, the gradient-map / recolor / transfer passes in
// render/color-grade.js, and the palette + color-map features.

export function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

export function isValidHex(s) {
  return /^#[0-9A-F]{6}$/i.test(s);
}

// ---- v17 — conversions ----------------------------------------------------

// Accepts '#rgb' or '#rrggbb' (with or without leading #). Returns {r,g,b} 0-255
// or null when unparseable, so callers can guard.
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('');
}

// Perceived luminance (0-255), Rec. 601 weights. Used to order gradient-map
// swatches and to index the ramp LUT.
export function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

// sRGB → CIE L*a*b* (D65). Used for perceptual nearest-swatch and color transfer.
export function rgbToLab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return { L: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function labToRgb(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
  x = 0.95047 * f(x); y = 1.0 * f(y); z = 1.08883 * f(z);
  let R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let B = x * 0.0557 + y * -0.2040 + z * 1.0570;
  const g = c => c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  return {
    r: Math.max(0, Math.min(255, Math.round(g(R) * 255))),
    g: Math.max(0, Math.min(255, Math.round(g(G) * 255))),
    b: Math.max(0, Math.min(255, Math.round(g(B) * 255)))
  };
}

// ---- v17 — palette helpers ------------------------------------------------

// Build a 256-entry LUT (one rgb per luminance level) by interpolating across
// the swatches sorted dark→light. Drives the gradient-map / duotone pass.
export function buildGradientRamp(swatches) {
  const stops = swatches
    .map(hexToRgb)
    .filter(Boolean)
    .sort((p, q) => luminance(p.r, p.g, p.b) - luminance(q.r, q.g, q.b));
  const lut = new Array(256);
  if (stops.length === 0) { for (let i = 0; i < 256; i++) lut[i] = { r: i, g: i, b: i }; return lut; }
  if (stops.length === 1) { for (let i = 0; i < 256; i++) lut[i] = stops[0]; return lut; }
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const lo = Math.floor(t), hi = Math.min(stops.length - 1, lo + 1);
    const f = t - lo;
    lut[i] = {
      r: stops[lo].r + (stops[hi].r - stops[lo].r) * f,
      g: stops[lo].g + (stops[hi].g - stops[lo].g) * f,
      b: stops[lo].b + (stops[hi].b - stops[lo].b) * f
    };
  }
  return lut;
}

// Nearest swatch by perceptual (LAB) distance. `swatchLabs` is a precomputed
// array of {hex/rgb, lab} so the per-pixel loop doesn't re-convert.
export function nearestSwatch(lab, swatchLabs) {
  let best = swatchLabs[0], bestD = Infinity;
  for (const s of swatchLabs) {
    const dL = lab.L - s.lab.L, da = lab.a - s.lab.a, db = lab.b - s.lab.b;
    const d = dL * dL + da * da + db * db;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Mean + std-dev of a palette in LAB. Target stats for color transfer.
export function paletteLabStats(swatches) {
  const labs = swatches.map(hexToRgb).filter(Boolean).map(c => rgbToLab(c.r, c.g, c.b));
  const n = labs.length || 1;
  const mean = { L: 0, a: 0, b: 0 };
  for (const l of labs) { mean.L += l.L; mean.a += l.a; mean.b += l.b; }
  mean.L /= n; mean.a /= n; mean.b /= n;
  const std = { L: 0, a: 0, b: 0 };
  for (const l of labs) { std.L += (l.L - mean.L) ** 2; std.a += (l.a - mean.a) ** 2; std.b += (l.b - mean.b) ** 2; }
  std.L = Math.sqrt(std.L / n) || 1; std.a = Math.sqrt(std.a / n) || 1; std.b = Math.sqrt(std.b / n) || 1;
  return { mean, std };
}

// Auto-generate a harmony from a base hex. Returns hex[]. Hue rotations in HSL,
// preserving the base saturation/lightness.
export function generateHarmony(baseHex, type) {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return [baseHex];
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const at = deg => { const c = hslToRgb(h + deg, s, l); return rgbToHex(c.r, c.g, c.b); };
  switch (type) {
    case 'complementary':       return [baseHex, at(180)];
    case 'analogous':           return [at(-30), baseHex, at(30)];
    case 'triadic':             return [baseHex, at(120), at(240)];
    case 'split-complementary': return [baseHex, at(150), at(210)];
    case 'tetradic':            return [baseHex, at(90), at(180), at(270)];
    default:                    return [baseHex];
  }
}
