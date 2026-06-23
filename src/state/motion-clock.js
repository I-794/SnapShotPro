// v29 — Motion Studio clock resolver.
//
// Maps the single unified timeline clock (state.timeline.currentTime) down to
// each motion source's LOCAL progress. The render pipeline stays pull-based: the
// existing getters (animation entrance, Ken Burns crop, turntable orbit) call
// these helpers at sample time instead of reading their own clock.
//
// Pure reads of `state` — imports nothing but state.js, so any render getter can
// use it without an import cycle. When the unified clock is NOT driving (legacy
// single-feature playback, or no Motion Studio lanes), every helper returns the
// caller's `fallback`, so the old behavior is preserved bit-for-bit.

import { state } from './state.js';

// The unified clock is the active driver only while Motion Studio is playing or
// the user is parked on its playhead (`_driving`), AND lanes exist.
export function timelineEngaged() {
  const tl = state.timeline;
  return !!(tl && tl._driving && tl.lanes && tl.lanes.length);
}

// The first clip of the lane matching (kind[, target]), or null.
function clipFor(kind, target) {
  const tl = state.timeline;
  if (!tl || !tl.lanes) return null;
  const lane = tl.lanes.find(l => l.kind === kind && (target == null || l.target === target));
  if (!lane || !lane.clips || !lane.clips.length) return null;
  return lane.clips[0];
}

// Local progress 0..1 within a clip given the unified clock. Returns `fallback`
// when the timeline isn't driving or there's no matching clip.
export function localProgress(kind, target, fallback) {
  if (!timelineEngaged()) return fallback;
  const clip = clipFor(kind, target);
  if (!clip) return fallback;
  const dur = clip.duration || 1;
  const p = (state.timeline.currentTime - clip.start) / dur;
  return Math.max(0, Math.min(1, p));
}
