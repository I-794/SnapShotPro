// v15.2 — Ken Burns pan/zoom on a still image.
//
// Two keyframes (from/to) of a focal point (0..1 of the image) and a scale
// (>=1). The animation clock (state.animation.currentTime / duration) drives
// p = 0..1; drawImageContent (render.js) crops the source by the sampled window
// so the still slowly pans and zooms. Shares the Animation section's Play button
// and Duration slider, and is disabled while a video clip is loaded — auto-zoom
// owns the crop then.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { render } from '../render/render.js';
import { saveStateToHistory } from '../state/history.js';
import { showNotification } from '../ui/notification.js';
import { getEasing } from '../render/easing.js';
import { kenBurnsPresets } from '../state/presets.js';
import { localProgress } from '../state/motion-clock.js';

// v29 — the Ken Burns crop progress (0..1). Decoupled from the shared animation
// clock: when Motion Studio drives the preview, Ken Burns reads its own lane/clip
// so a KB clip and an entrance clip with different durations no longer fight over
// state.animation.{currentTime,duration}. Falls back to the legacy clock (the
// animation playhead) for standalone playback and pre-v29 projects.
export function getKenBurnsProgress() {
  const a = state.animation;
  const legacy = (a && a.duration > 0) ? (a.currentTime || 0) / a.duration : 0;
  return localProgress('kenburns', null, legacy);
}

// Sample the focal point + scale at p in 0..1, eased by kb.easing. scale is
// clamped to >=1 so the crop window never exceeds the source.
export function sampleKenBurns(kb, p) {
  const ease = getEasing(kb.easing);
  const t = ease(Math.max(0, Math.min(1, p)));
  return {
    cx: kb.fromX + (kb.toX - kb.fromX) * t,
    cy: kb.fromY + (kb.toY - kb.fromY) * t,
    scale: Math.max(1, kb.fromScale + (kb.toScale - kb.fromScale) * t)
  };
}

// Reveal the animation controls (Duration + Play) whenever EITHER motion is on,
// so Ken Burns is playable even with entrance animation disabled.
function syncControlsVisible() {
  const controls = document.getElementById('animation-controls');
  if (controls) {
    controls.style.display =
      (state.animation.enabled || state.kenBurns.enabled) ? 'block' : 'none';
  }
}

function updateKenBurnsControls() {
  if (el.kenBurnsControls) {
    el.kenBurnsControls.style.display = state.kenBurns.enabled ? 'block' : 'none';
  }
  syncControlsVisible();
}

// Called from updateUIFromState so a loaded / undone design reflects its state.
export function refreshKenBurnsUI() {
  if (el.kenBurnsEnabled) el.kenBurnsEnabled.checked = !!state.kenBurns.enabled;
  updateKenBurnsControls();
}

export function bindKenBurns() {
  if (el.kenBurnsEnabled) {
    el.kenBurnsEnabled.addEventListener('change', () => {
      saveStateToHistory();
      state.kenBurns.enabled = el.kenBurnsEnabled.checked;
      updateKenBurnsControls();
      render();
      if (window.__motionStudioRefresh) window.__motionStudioRefresh();
    });
  }

  document.querySelectorAll('[data-kb-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = kenBurnsPresets[btn.dataset.kbPreset];
      if (!preset) return;
      saveStateToHistory();
      Object.assign(state.kenBurns, preset);
      state.kenBurns.enabled = true;
      if (el.kenBurnsEnabled) el.kenBurnsEnabled.checked = true;
      updateKenBurnsControls();
      render();
      if (window.__motionStudioRefresh) window.__motionStudioRefresh();
      showNotification(`Ken Burns: ${btn.textContent.trim()} applied.`, 'success');
    });
  });

  refreshKenBurnsUI();
}
