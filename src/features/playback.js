// v29 — Motion Studio playback engine.
//
// The SINGLE playback clock. One requestAnimationFrame loop advances
// state.timeline.currentTime (ms); every motion source derives from it at sample
// time (see state/motion-clock.js). This replaces, for the unified timeline, the
// three independent clocks the editor used to run (the animation RAF, the video
// RAF, and the export-only turntable orbit) — but the legacy per-feature Play
// buttons keep their own paths, so nothing standalone breaks.
//
// Entrance + Ken Burns are PULLED by the render getters straight from the clock,
// so sampleAt() only has to push the two sources that can't be pulled: the async
// video frame (seek) and the turntable orbit cache. Then it renders once.

import { state } from '../state/state.js';
import { render } from '../render/render.js';
import { getVideoContext } from './video.js';

let rafId = null;
let lastNow = 0;

// Total timeline span (ms) = the furthest clip end across all lanes. Holds short
// motions on their final frame past their clip end (entrance stays at t=1, Ken
// Burns at p=1) — which is the correct "freeze" behavior.
export function deriveDuration() {
  const lanes = (state.timeline && state.timeline.lanes) || [];
  let max = 0;
  for (const lane of lanes) {
    for (const clip of (lane.clips || [])) {
      max = Math.max(max, (clip.start || 0) + (clip.duration || 0));
    }
  }
  state.timeline.duration = Math.max(1, max || state.animation.duration || 3000);
  return state.timeline.duration;
}

// Push the not-pullable sources for time `ms`, then render. `awaitVideo` is true
// for export (frame-accurate) and false for preview (fire-and-forget so the RAF
// loop never stutters waiting on a seek — matches the old video.js tick).
async function applyFrame(ms, awaitVideo) {
  const tl = state.timeline;
  // Turntable: drive the orbit for live preview (was export-only before v29).
  const tlane = tl.lanes.find(l => l.kind === 'turntable');
  if (tlane && state.mockup3d && state.mockup3d.enabled) {
    const clip = tlane.clips[0];
    const dur = clip.duration || 1;
    state.mockup3d.orbitProgress = Math.max(0, Math.min(1, (ms - clip.start) / dur));
  }
  // Video: map the unified clock onto the clip's trimmed range.
  const vlane = tl.lanes.find(l => l.kind === 'video');
  if (vlane && state.video.loaded) {
    const clip = vlane.clips[0];
    const vt = Math.max(state.video.in, Math.min(state.video.out,
      state.video.in + (ms - clip.start) / 1000));
    const { seekTo } = getVideoContext();
    if (seekTo) {
      const p = seekTo(vt);                    // resolve() calls drawFrame()
      if (awaitVideo && p && p.then) { await p; }
    }
  }
  render();
}

// Preview sampler — fire-and-forget video, immediate render.
export function sampleAt(ms) {
  state.timeline._driving = true;
  state.timeline.currentTime = ms;
  applyFrame(ms, false);
}

// Export sampler — awaits the video seek so each encoded frame is accurate.
export async function sampleAtForExport(ms) {
  state.timeline._driving = true;
  state.timeline.currentTime = ms;
  await applyFrame(ms, true);
}

export function seek(ms) {
  const dur = deriveDuration();
  sampleAt(Math.max(0, Math.min(dur, ms)));
  updateTransport();
}

function tick(now) {
  const dt = now - lastNow;
  lastNow = now;
  const dur = deriveDuration();
  let t = state.timeline.currentTime + dt;
  if (t >= dur) {
    if (state.timeline.loop) { t = t % dur; }
    else { state.timeline.currentTime = dur; sampleAt(dur); updateTransport(); pause(); return; }
  }
  state.timeline.currentTime = t;
  sampleAt(t);
  updateTransport();
  rafId = requestAnimationFrame(tick);
}

export function play() {
  if (!timelineActive()) return;
  // Hand the preview to the unified clock (the legacy clocks stand down).
  state.timeline._driving = true;
  state.timeline.playing = true;
  // Restart from the top if we're parked at the end.
  if (state.timeline.currentTime >= deriveDuration()) state.timeline.currentTime = 0;
  lastNow = performance.now();
  rafId = requestAnimationFrame(tick);
  updateTransport();
}

export function pause() {
  state.timeline.playing = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  updateTransport();
}

export function togglePlay() { state.timeline.playing ? pause() : play(); }

export function stop() {
  pause();
  state.timeline.currentTime = 0;
  // Release the preview back to the legacy clocks.
  state.timeline._driving = false;
  render();
  updateTransport();
}

export function timelineActive() {
  const tl = state.timeline;
  return !!(tl && tl.enabled && tl.lanes && tl.lanes.length);
}

// Transport UI is owned by motion-studio.js; it registers a callback here so
// playback.js stays unaware of the DOM (one-way, mirrors video.js → timeline.js).
let transportCb = null;
export function setTransportCallback(fn) { transportCb = fn; }
function updateTransport() { if (transportCb) transportCb(state.timeline.currentTime); }

export function bindPlayback() {
  // No DOM of its own — the Motion Studio panel wires the transport buttons to
  // play/pause/seek. This bind exists for symmetry with the feature pattern and
  // as a future home for global motion shortcuts.
}
