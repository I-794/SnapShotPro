// v9.2 — Video / clip support.
//
// A loaded clip drives the existing render pipeline by funneling the current
// video frame through a single offscreen "frame canvas" that we assign to
// state.image. Because a canvas has .width/.height and is a valid drawImage
// source, every downstream consumer (device mockups, background, shadow,
// export) works unchanged — the screenshot is simply a live frame.
//
// This module owns import, trim (in/out), and playback; video-export.js handles
// MP4/GIF encoding and reads the shared element via getVideoContext().

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { fitZoom } from './zoom-pan.js';

let videoEl = null;
let frameCanvas = null;
let frameCtx = null;
let rafId = null;

const MAX_DURATION = 30; // seconds — warn beyond this

export function getVideoContext() {
  return { videoEl, frameCanvas, drawFrame, seekTo };
}

function ensureFrameCanvas(w, h) {
  if (!frameCanvas) frameCanvas = document.createElement('canvas');
  if (frameCanvas.width !== w) frameCanvas.width = w;
  if (frameCanvas.height !== h) frameCanvas.height = h;
  frameCtx = frameCanvas.getContext('2d');
}

// Copy the video's current frame into the frame canvas (which is state.image).
export function drawFrame() {
  if (!videoEl || !frameCtx) return;
  frameCtx.drawImage(videoEl, 0, 0, frameCanvas.width, frameCanvas.height);
}

export function seekTo(t) {
  return new Promise((resolve) => {
    if (!videoEl) { resolve(); return; }
    const onSeeked = () => { videoEl.removeEventListener('seeked', onSeeked); drawFrame(); resolve(); };
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.currentTime = Math.max(0, Math.min(videoEl.duration || 0, t));
  });
}

export function loadVideoFile(file) {
  if (videoEl) { try { URL.revokeObjectURL(videoEl.src); } catch (_) {} videoEl.remove(); }
  videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = 'auto';
  videoEl.src = URL.createObjectURL(file);

  videoEl.addEventListener('loadedmetadata', () => {
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    ensureFrameCanvas(w, h);
    state.video.loaded = true;
    state.video.duration = videoEl.duration || 0;
    state.video.in = 0;
    state.video.out = videoEl.duration || 0;
    state.video.w = w;
    state.video.h = h;
    state.video.playing = false;
    state.image = frameCanvas;
    state.mode = 'single';

    // Reveal the editor surface (mirrors upload.js).
    if (el.uploadZone) el.uploadZone.style.display = 'none';
    if (el.canvasWrapper) el.canvasWrapper.style.display = 'block';
    if (el.annotationToolbar) el.annotationToolbar.style.display = 'flex';
    if (el.zoomControls) el.zoomControls.style.display = 'flex';

    // Draw the first frame reliably: setting currentTime to 0 when it is
    // already 0 may not fire 'seeked', so paint once on loadeddata too.
    videoEl.addEventListener('loadeddata', () => { drawFrame(); render(); fitZoom(); }, { once: true });
    seekTo(0).then(() => { render(); fitZoom(); });
    showVideoControls(true);
    syncTrimUI();
    if (state.video.duration > MAX_DURATION) {
      showNotification(`Clip is ${Math.round(state.video.duration)}s — exports are capped to ${MAX_DURATION}s for performance.`, 'info');
    } else {
      showNotification('Clip loaded. Trim it, then drop it in a device frame.', 'success');
    }
  });
  videoEl.addEventListener('error', () => showNotification('Could not load that video.', 'error'));
}

export function clearVideo() {
  pause();
  if (videoEl) { try { URL.revokeObjectURL(videoEl.src); } catch (_) {} videoEl.remove(); videoEl = null; }
  state.video.loaded = false;
  state.video.playing = false;
  showVideoControls(false);
}

// ---- playback -------------------------------------------------------------

function tick() {
  if (!videoEl || !state.video.playing) return;
  if (videoEl.currentTime >= state.video.out) videoEl.currentTime = state.video.in;
  drawFrame();
  render();
  rafId = requestAnimationFrame(tick);
}

export function play() {
  if (!videoEl || !state.video.loaded) return;
  if (videoEl.currentTime < state.video.in || videoEl.currentTime >= state.video.out) {
    videoEl.currentTime = state.video.in;
  }
  state.video.playing = true;
  videoEl.play().catch(() => {});
  rafId = requestAnimationFrame(tick);
  updatePlayBtn();
}

export function pause() {
  state.video.playing = false;
  if (videoEl) videoEl.pause();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  updatePlayBtn();
}

export function togglePlay() { state.video.playing ? pause() : play(); }

// ---- UI -------------------------------------------------------------------

function showVideoControls(show) {
  const box = document.getElementById('video-controls');
  if (box) box.style.display = show ? 'block' : 'none';
  const hint = document.getElementById('video-empty-hint');
  if (hint) hint.style.display = show ? 'none' : 'block';
}

function updatePlayBtn() {
  const btn = document.getElementById('video-play-btn');
  if (btn) btn.textContent = state.video.playing ? '⏸ Pause' : '▶ Play';
}

function fmt(t) { return `${t.toFixed(2)}s`; }

function syncTrimUI() {
  const v = state.video;
  const inR = document.getElementById('video-in');
  const outR = document.getElementById('video-out');
  const inL = document.getElementById('video-in-label');
  const outL = document.getElementById('video-out-label');
  const durL = document.getElementById('video-duration-label');
  if (inR) { inR.max = v.duration; inR.value = v.in; }
  if (outR) { outR.max = v.duration; outR.value = v.out; }
  if (inL) inL.textContent = fmt(v.in);
  if (outL) outL.textContent = fmt(v.out);
  if (durL) durL.textContent = `Clip: ${fmt(v.out - v.in)} of ${fmt(v.duration)}`;
}

export function bindVideo() {
  const input = document.getElementById('video-file-input');
  const addBtn = document.getElementById('video-add-btn');
  if (addBtn && input) addBtn.addEventListener('click', () => input.click());
  if (input) input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && file.type.startsWith('video/')) loadVideoFile(file);
    input.value = '';
  });

  const playBtn = document.getElementById('video-play-btn');
  if (playBtn) playBtn.addEventListener('click', togglePlay);

  const inR = document.getElementById('video-in');
  if (inR) inR.addEventListener('input', () => {
    pause();
    state.video.in = Math.min(parseFloat(inR.value), state.video.out - 0.1);
    syncTrimUI();
    seekTo(state.video.in).then(render);
  });
  const outR = document.getElementById('video-out');
  if (outR) outR.addEventListener('input', () => {
    pause();
    state.video.out = Math.max(parseFloat(outR.value), state.video.in + 0.1);
    syncTrimUI();
    seekTo(state.video.out).then(render);
  });

  const fpsSel = document.getElementById('video-fps');
  if (fpsSel) fpsSel.addEventListener('change', () => { state.video.fps = parseInt(fpsSel.value, 10); });

  const removeBtn = document.getElementById('video-remove-btn');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    clearVideo();
    state.image = null;
    if (el.uploadZone) el.uploadZone.style.display = '';
    if (el.canvasWrapper) el.canvasWrapper.style.display = 'none';
    showNotification('Clip removed.', 'success');
  });

  showVideoControls(false);
}
