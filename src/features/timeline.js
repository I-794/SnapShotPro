// v15.1 — Timeline scrubber with frame-accurate trim.
//
// Replaces the two #video-in / #video-out range sliders with a filmstrip, drag
// in/out handles, and a playhead. The data model is unchanged — it still writes
// state.video.{in,out} in seconds — so video.js playback and video-export.js
// frameTimes() need no changes. video.js drives the playhead via a one-way hook
// (setVideoHooks), so this module imports video.js but not the reverse.

import { state } from '../state/state.js';
import { render } from '../render/render.js';
import { getVideoContext, pause, setVideoHooks } from './video.js';

const THUMBS = 12;
let stripToken = 0;   // cancels stale filmstrip generation across reloads

function fps() { return state.video.fps || 30; }
// Snap a time to the nearest whole frame at the current fps.
function quant(t) { return Math.round(t * fps()) / fps(); }
function frameOf(t) { return Math.round(t * fps()); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pct(t) { const d = state.video.duration || 1; return (t / d) * 100; }
function label(t) { return `${t.toFixed(2)}s · f${frameOf(t)}`; }

const $ = (id) => document.getElementById(id);

// Reflect state.video.{in,out} into the handles, the highlighted trim region,
// and the labels. Cheap; safe to call on every interaction frame.
export function syncTimeline() {
  const v = state.video;
  const inH = $('video-handle-in'), outH = $('video-handle-out'), region = $('video-trim-region');
  if (inH) inH.style.left = pct(v.in) + '%';
  if (outH) outH.style.left = pct(v.out) + '%';
  if (region) { region.style.left = pct(v.in) + '%'; region.style.width = (pct(v.out) - pct(v.in)) + '%'; }
  const inL = $('video-in-label'), outL = $('video-out-label'), durL = $('video-duration-label');
  if (inL) inL.textContent = label(v.in);
  if (outL) outL.textContent = label(v.out);
  if (durL) durL.textContent = `Clip: ${(v.out - v.in).toFixed(2)}s of ${(v.duration || 0).toFixed(2)}s`;
}

// Position the playhead at time t (called from video.js tick during playback,
// and locally after a scrub/step).
export function updatePlayhead(t) {
  const ph = $('video-playhead');
  if (ph) ph.style.left = pct(t) + '%';
}

// Capture ~12 evenly-spaced frames into the filmstrip. Runs once per load via
// the existing seekTo(); a reload bumps stripToken so an in-flight run aborts.
async function buildFilmstrip() {
  const strip = $('video-filmstrip');
  const { seekTo, videoEl } = getVideoContext();
  if (!strip || !videoEl) return;
  const token = ++stripToken;
  const dur = state.video.duration || 0;
  const aspect = (state.video.w && state.video.h) ? state.video.w / state.video.h : 16 / 9;
  const thumbH = 48, thumbW = Math.max(16, Math.round(thumbH * aspect));

  strip.innerHTML = '';
  const thumbs = [];
  for (let i = 0; i < THUMBS; i++) {
    const c = document.createElement('canvas');
    c.width = thumbW; c.height = thumbH;
    c.className = 'vts-thumb';
    strip.appendChild(c);
    thumbs.push(c);
  }

  pause();
  for (let i = 0; i < THUMBS; i++) {
    if (token !== stripToken) return;          // a newer clip loaded; abort
    await seekTo(dur * ((i + 0.5) / THUMBS));
    if (token !== stripToken) return;
    thumbs[i].getContext('2d').drawImage(videoEl, 0, 0, thumbW, thumbH);
  }
  // Return to the trim start and repaint the preview.
  await seekTo(state.video.in);
  if (token === stripToken) render();
}

// Called by video.js when a clip's metadata is ready.
function onVideoLoaded() {
  syncTimeline();
  updatePlayhead(state.video.in);
  buildFilmstrip();
}

function timeFromEvent(e, track) {
  const r = track.getBoundingClientRect();
  const x = clamp(e.clientX - r.left, 0, r.width);
  return (x / r.width) * (state.video.duration || 0);
}

function bindTrackInteractions() {
  const track = $('video-timeline');
  if (!track) return;
  let mode = null;   // 'in' | 'out' | 'scrub'

  const applyIn = (t) => {
    state.video.in = clamp(quant(t), 0, state.video.out - 1 / fps());
    syncTimeline();
    if (window.__motionStudioRefresh) window.__motionStudioRefresh();   // v29 — video clip width follows the trim
    const { seekTo } = getVideoContext();
    seekTo(state.video.in).then(() => { updatePlayhead(state.video.in); render(); });
  };
  const applyOut = (t) => {
    state.video.out = clamp(quant(t), state.video.in + 1 / fps(), state.video.duration || 0);
    syncTimeline();
    if (window.__motionStudioRefresh) window.__motionStudioRefresh();   // v29
    const { seekTo } = getVideoContext();
    seekTo(state.video.out).then(() => { updatePlayhead(state.video.out); render(); });
  };
  const applyScrub = (t) => {
    const tt = clamp(quant(t), 0, state.video.duration || 0);
    const { seekTo } = getVideoContext();
    seekTo(tt).then(() => { updatePlayhead(tt); render(); });
  };

  track.addEventListener('pointerdown', (e) => {
    if (!state.video.loaded) return;
    pause();
    const hit = e.target.closest('.vts-handle');
    mode = hit ? (hit.id === 'video-handle-in' ? 'in' : 'out') : 'scrub';
    track.setPointerCapture(e.pointerId);
    const t = timeFromEvent(e, track);
    if (mode === 'in') applyIn(t);
    else if (mode === 'out') applyOut(t);
    else applyScrub(t);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (!mode) return;
    const t = timeFromEvent(e, track);
    if (mode === 'in') applyIn(t);
    else if (mode === 'out') applyOut(t);
    else applyScrub(t);
  });
  const end = (e) => { if (mode) { try { track.releasePointerCapture(e.pointerId); } catch (_) {} mode = null; } };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
}

// ── keyboard hooks (called from keyboard.js) ──────────────────────────────────
export function timelineActive() { return !!state.video.loaded; }

// Step the playhead by ±1 frame and seek there.
export function timelineStepFrame(dir) {
  const { videoEl, seekTo } = getVideoContext();
  if (!videoEl) return;
  pause();
  const t = clamp(quant(videoEl.currentTime) + dir / fps(), 0, state.video.duration || 0);
  seekTo(t).then(() => { updatePlayhead(t); render(); });
}

// Set in/out to the current playhead frame.
export function timelineSetIn() {
  const { videoEl } = getVideoContext();
  if (!videoEl) return;
  state.video.in = clamp(quant(videoEl.currentTime), 0, state.video.out - 1 / fps());
  syncTimeline();
}
export function timelineSetOut() {
  const { videoEl } = getVideoContext();
  if (!videoEl) return;
  state.video.out = clamp(quant(videoEl.currentTime), state.video.in + 1 / fps(), state.video.duration || 0);
  syncTimeline();
}

export function bindTimeline() {
  bindTrackInteractions();
  // Drive the playhead from playback, and rebuild on load — one-way from video.js.
  setVideoHooks({ loaded: onVideoLoaded, time: updatePlayhead });
}
