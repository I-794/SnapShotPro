// v11.3 — Shared project serializer.
//
// Extracted from cloud-sync.js so the cloud sync, the community gallery
// (v11.3), and live collaboration (v11.4) all serialize a design the same way.
// These are the JSON-safe, design-defining fields — deliberately NOT including
// `image`/`logo`/`screenshotSet`/`batch` (large or non-portable). Keep this list
// the single source of truth for "what travels with a saved/shared design".

import { state } from './state.js';

export const SERIALIZED_FIELDS = [
  'imageTransform', 'imageFilters', 'imageLayer', 'textOverlay', 'watermark', 'gradient',
  'padding', 'scale', 'borderRadius', 'showBorder', 'borderWidth', 'borderColor',
  'shadow', 'reflection', 'canvas', 'bgMode', 'bgColor', 'deviceFrame', 'annotations',
  'redactions', 'spotlight', 'meshGradient', 'tilt3d', 'scene', 'autoLayout'
];

export function snapshotProject() {
  const out = {};
  for (const k of SERIALIZED_FIELDS) out[k] = state[k];
  return JSON.parse(JSON.stringify(out));
}

// ── v12 — Projects & Version History ──────────────────────────────────────
// A *full* project is self-contained: every design field that defines the look
// PLUS the source image (as a dataURL) so reloading a saved project actually
// restores the artwork — unlike snapshotProject(), which stays deliberately
// lean for realtime collab/gallery payloads. Bump SCHEMA_VERSION whenever the
// field set changes so normalizeProject() can migrate older saves.
export const SCHEMA_VERSION = 12;

// SERIALIZED_FIELDS + the rest of the design-defining state. Kept separate from
// SERIALIZED_FIELDS so collab/gallery stay small; projects want full fidelity.
export const PROJECT_FIELDS = [
  ...SERIALIZED_FIELDS,
  'windowOverlay', 'annotationColor', 'annotationStrokeWidth', 'nextNumber',
  'redactType', 'redactIntensity', 'logo', 'exportSettings', 'exportMotion'
];

// Re-encode the loaded screenshot to a bounded dataURL so it travels with the
// project. Capped at 2000px on the long edge + JPEG to keep localStorage/jsonb
// payloads sane. Returns null if there's no image or the canvas is tainted
// (cross-origin source) — the project still saves, just without baked artwork.
export function getImageDataURL() {
  const img = state.image;
  if (!img || !img.width || !img.height) return null;
  try {
    const MAX = 2000;
    let w = img.width, h = img.height;
    const longEdge = Math.max(w, h);
    if (longEdge > MAX) { const s = MAX / longEdge; w = Math.round(w * s); h = Math.round(h * s); }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.9);
  } catch (e) { return null; }
}

export function serializeFull() {
  const design = {};
  for (const k of PROJECT_FIELDS) design[k] = state[k];
  return {
    schemaVersion: SCHEMA_VERSION,
    design: JSON.parse(JSON.stringify(design)),
    image: getImageDataURL(),
    svgCode: state.svgCode || null
  };
}

// Accept both the v12 envelope ({schemaVersion, design, image, svgCode}) and
// the legacy flat payload written by the old cloud-sync saveProject() (raw
// design fields, no image), returning a normalized v12 envelope either way.
export function normalizeProject(payload) {
  if (!payload || typeof payload !== 'object') {
    return { schemaVersion: SCHEMA_VERSION, design: {}, image: null, svgCode: null };
  }
  if (payload.design) {
    return {
      schemaVersion: payload.schemaVersion || SCHEMA_VERSION,
      design: payload.design,
      image: payload.image || null,
      svgCode: payload.svgCode || null
    };
  }
  // Legacy flat design payload (pre-v12): the whole object is the design.
  return { schemaVersion: 11, design: payload, image: null, svgCode: payload.svgCode || null };
}
