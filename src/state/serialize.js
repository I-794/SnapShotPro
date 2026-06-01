// v11.3 — Shared project serializer.
//
// Extracted from cloud-sync.js so the cloud sync, the community gallery
// (v11.3), and live collaboration (v11.4) all serialize a design the same way.
// These are the JSON-safe, design-defining fields — deliberately NOT including
// `image`/`logo`/`screenshotSet`/`batch` (large or non-portable). Keep this list
// the single source of truth for "what travels with a saved/shared design".

import { state } from './state.js';

export const SERIALIZED_FIELDS = [
  'imageTransform', 'imageFilters', 'textOverlay', 'watermark', 'gradient',
  'padding', 'scale', 'borderRadius', 'showBorder', 'borderWidth', 'borderColor',
  'shadow', 'canvas', 'bgMode', 'bgColor', 'deviceFrame', 'annotations',
  'redactions', 'spotlight', 'meshGradient', 'tilt3d', 'scene', 'autoLayout'
];

export function snapshotProject() {
  const out = {};
  for (const k of SERIALIZED_FIELDS) out[k] = state[k];
  return JSON.parse(JSON.stringify(out));
}
