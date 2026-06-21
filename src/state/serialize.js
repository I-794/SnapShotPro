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
  'redactions', 'spotlight', 'meshGradient', 'tilt3d', 'scene', 'autoLayout',
  // v15.2 — animation tracks (entrance + easing) and Ken Burns are design-
  // defining and lightweight, so shared/gallery designs animate too.
  'animation', 'kenBurns',
  // v16.1 — Studio Effects overlays (liquid glass + film grain).
  'glass', 'grain',
  // v16.2 — pattern background (active only when bgMode === 'pattern').
  'pattern',
  // v21 — 3D / isometric device mockup (orbit/zoom/scene/material/spin).
  'mockup3d'
];

// v21 — strip the runtime-only orbitProgress so a saved/shared/restored design
// never arrives mid-spin (mirrors sanitizeAnimationRuntime).
export function sanitizeMockup3dRuntime(design) {
  if (design && design.mockup3d) {
    design.mockup3d = { ...design.mockup3d, orbitProgress: 0 };
  }
  return design;
}

// v15.2 — strip the animation playback runtime so a saved, shared, or restored
// design never arrives mid-frame (mid-playback or at a non-zero currentTime).
// Mutates the passed design's animation in place and returns it.
export function sanitizeAnimationRuntime(design) {
  if (design && design.animation) {
    design.animation = { ...design.animation, playing: false, currentTime: 0 };
  }
  return design;
}

export function snapshotProject() {
  const out = {};
  for (const k of SERIALIZED_FIELDS) out[k] = state[k];
  return sanitizeMockup3dRuntime(sanitizeAnimationRuntime(JSON.parse(JSON.stringify(out))));
}

// ── v12 — Projects & Version History ──────────────────────────────────────
// A *full* project is self-contained: every design field that defines the look
// PLUS the source image (as a dataURL) so reloading a saved project actually
// restores the artwork — unlike snapshotProject(), which stays deliberately
// lean for realtime collab/gallery payloads. Bump SCHEMA_VERSION whenever the
// field set changes so normalizeProject() can migrate older saves.
export const SCHEMA_VERSION = 17;

// SERIALIZED_FIELDS + the rest of the design-defining state. Kept separate from
// SERIALIZED_FIELDS so collab/gallery stay small; projects want full fidelity.
export const PROJECT_FIELDS = [
  ...SERIALIZED_FIELDS,
  'windowOverlay', 'annotationColor', 'annotationStrokeWidth', 'nextNumber',
  'redactType', 'redactIntensity', 'logo', 'exportSettings', 'exportMotion',
  // v16.0 — shape-tool defaults (per-shape fill/sides/points already ride along
  // inside each `annotations` record, which is serialized above).
  'annotationFill', 'polygonSides', 'starPoints',
  // v24 — Code Snippet Studio settings. The baked image travels in the envelope
  // too (getImageDataURL); on load, applyPayload re-rasterizes for crispness.
  'codeSnippet'
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
    design: sanitizeMockup3dRuntime(sanitizeAnimationRuntime(JSON.parse(JSON.stringify(design)))),
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
      design: sanitizeMockup3dRuntime(sanitizeAnimationRuntime(payload.design)),
      image: payload.image || null,
      svgCode: payload.svgCode || null
    };
  }
  // Legacy flat design payload (pre-v12): the whole object is the design.
  return { schemaVersion: 11, design: sanitizeMockup3dRuntime(sanitizeAnimationRuntime(payload)), image: null, svgCode: payload.svgCode || null };
}
