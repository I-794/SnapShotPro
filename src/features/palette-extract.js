import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { syncFromGradientState } from './gradient-editor.js';
import { saveSwatchesAsPalette } from './palettes.js';

const K = 5;
const SAMPLE = 80;

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function sampleImagePixels(img) {
  const c = document.createElement('canvas');
  const aspect = img.width / img.height;
  let w = SAMPLE, h = SAMPLE;
  if (aspect > 1) h = Math.round(SAMPLE / aspect);
  else w = Math.round(SAMPLE * aspect);
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 64) continue; // skip transparent
    pts.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pts;
}

function kmeans(points, k, iters = 12) {
  if (points.length === 0) return [];
  // Initialize: pick k spread-out points
  const centers = [points[Math.floor(Math.random() * points.length)]];
  while (centers.length < k) {
    let best = null, bestDist = -1;
    for (let i = 0; i < 200; i++) {
      const cand = points[Math.floor(Math.random() * points.length)];
      let minD = Infinity;
      for (const c of centers) {
        const d = (cand[0] - c[0]) ** 2 + (cand[1] - c[1]) ** 2 + (cand[2] - c[2]) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) { bestDist = minD; best = cand; }
    }
    centers.push(best);
  }
  let assignments = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    // Assign
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (points[i][0] - centers[c][0]) ** 2 + (points[i][1] - centers[c][1]) ** 2 + (points[i][2] - centers[c][2]) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
      }
      assignments[i] = best;
    }
    // Update
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const a = assignments[i];
      sums[a][0] += points[i][0];
      sums[a][1] += points[i][1];
      sums[a][2] += points[i][2];
      sums[a][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }
  // Sort by cluster size desc
  const counts = new Array(k).fill(0);
  assignments.forEach(a => counts[a]++);
  return centers
    .map((c, i) => ({ color: rgbToHex(c[0], c[1], c[2]), count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(x => x.color);
}

// v30 — reusable palette extraction for Brand Brain (and anything needing
// dominant colors from an image). Mirrors what the in-panel extract() does:
// sample the image small, k-means cluster, return hex sorted by cluster weight.
// kmeans() already returns string[] of hex colors (sorted by cluster size desc),
// so we return its result directly — no secondary .map needed.
export function extractPalette(img, k = K) {
  if (!img || !img.width || !img.height) return [];
  const pts = sampleImagePixels(img);
  return kmeans(pts, k);
}

let lastPalette = [];

function renderSwatches() {
  const container = document.getElementById('palette-swatches');
  if (!container) return;
  if (lastPalette.length === 0) {
    container.innerHTML = '<p class="info-text">Load an image and click Extract.</p>';
    return;
  }
  container.innerHTML = lastPalette.map(c =>
    `<div class="palette-swatch" data-color="${c}" style="background:${c};" title="${c}"><span class="palette-swatch-label">${c}</span></div>`
  ).join('');
  container.querySelectorAll('.palette-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      navigator.clipboard?.writeText(sw.dataset.color).catch(() => {});
      showNotification(`Copied ${sw.dataset.color}`, 'success');
    });
  });
}

function extract() {
  if (!state.image) { showNotification('Load an image first.', 'error'); return; }
  const pixels = sampleImagePixels(state.image);
  lastPalette = kmeans(pixels, K);
  renderSwatches();
}

function applyAsGradient() {
  if (lastPalette.length < 2) return;
  saveStateToHistory();
  state.gradient.colors = lastPalette.slice(0, Math.min(4, lastPalette.length));
  state.gradient.positions = state.gradient.colors.map((_, i, arr) =>
    Math.round((i / (arr.length - 1)) * 100)
  );
  state.bgMode = 'gradient';
  syncFromGradientState();
  render();
  showNotification('Applied palette as gradient.', 'success');
}

function applyAsMesh() {
  if (lastPalette.length < 1) return;
  saveStateToHistory();
  const positions = [
    { x: 0.20, y: 0.25 },
    { x: 0.80, y: 0.30 },
    { x: 0.30, y: 0.80 },
    { x: 0.85, y: 0.85 }
  ];
  state.meshGradient.points = positions.map((p, i) => ({
    x: p.x, y: p.y,
    color: lastPalette[i % lastPalette.length],
    radius: 0.55
  }));
  state.bgMode = 'mesh';
  render();
  showNotification('Applied palette as mesh.', 'success');
}

function applyTextColor() {
  if (lastPalette.length === 0) return;
  saveStateToHistory();
  state.textOverlay.color = lastPalette[0];
  if (el.textColor) el.textColor.value = lastPalette[0];
  if (el.textColorText) el.textColorText.value = lastPalette[0];
  render();
}

// v17 — save the extracted colors into the Color palette library.
function saveAsPalette() {
  if (lastPalette.length === 0) { showNotification('Extract a palette first.', 'error'); return; }
  saveSwatchesAsPalette(lastPalette, 'Extracted');
}

export function bindPaletteExtractor() {
  const btn = document.getElementById('palette-extract-btn');
  const gradBtn = document.getElementById('palette-as-gradient');
  const meshBtn = document.getElementById('palette-as-mesh');
  const textBtn = document.getElementById('palette-as-text');
  const saveBtn = document.getElementById('palette-as-saved');
  if (btn) btn.addEventListener('click', extract);
  if (gradBtn) gradBtn.addEventListener('click', applyAsGradient);
  if (meshBtn) meshBtn.addEventListener('click', applyAsMesh);
  if (textBtn) textBtn.addEventListener('click', applyTextColor);
  if (saveBtn) saveBtn.addEventListener('click', saveAsPalette);
  renderSwatches();
}
