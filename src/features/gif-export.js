// Still-image animation → GIF. As of v15.1 the gif.js encode loop lives in
// motion-export.js; this steps the animation clock per frame and renders the
// live preview canvas, then restores the clock once frames are captured.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { render } from '../render/render.js';
import { encodeGif, encodeMp4, mp4Supported, evenDim, download } from './motion-export.js';

// v21 — turntable spin: a 3D mockup with spin enabled exports as an orbiting
// loop, driven by mockup3d.orbitProgress (0..1) instead of the animation clock.
function isSpinExport() {
  return !!(state.mockup3d && state.mockup3d.enabled && state.mockup3d.spin && state.mockup3d.spin.enabled);
}

export async function exportGif() {
  if (!state.image) { showNotification('Upload an image first.', 'error'); return; }
  const spin = isSpinExport();
  if (!spin && (!state.animation.enabled || state.animation.tracks.length === 0)) {
    showNotification('Add an animation first.', 'error');
    return;
  }

  showNotification('Generating GIF...', 'success');

  try {
    const canvas = el.previewCanvas;
    const fps = 20;
    // Spin: ~3s loop per turn-set so the turntable reads smoothly.
    const durationSecs = spin ? 3 : state.animation.duration / 1000;
    const totalFrames = Math.ceil(fps * durationSecs);

    const originalTime = state.animation.currentTime;
    const originalPlaying = state.animation.playing;
    state.animation.playing = false;

    const blob = await encodeGif(async (i) => {
      if (spin) {
        state.mockup3d.orbitProgress = (i % totalFrames) / totalFrames;
      } else {
        state.animation.currentTime = (i / totalFrames) * state.animation.duration;
      }
      render();
      return canvas;
    }, {
      width: canvas.width,
      height: canvas.height,
      fps,
      count: totalFrames + 1,
      // Restore the clock and repaint while the GIF encodes in the worker.
      onCaptured: () => {
        state.animation.currentTime = originalTime;
        state.animation.playing = originalPlaying;
        if (spin) state.mockup3d.orbitProgress = 0;
        render();
      },
      onProgress: (p) => {
        const pct = Math.round(p * 100);
        const progressEl = document.getElementById('gif-progress');
        if (progressEl) {
          progressEl.style.display = 'flex';
          const fill = progressEl.querySelector('.ai-progress-fill');
          const label = progressEl.querySelector('.ai-progress-label');
          if (fill) fill.style.width = `${pct}%`;
          if (label) label.textContent = `${pct}%`;
        }
      }
    });

    download(blob, `snapshot-${Date.now()}.gif`);
    showNotification('GIF exported!', 'success');
  } catch (err) {
    showNotification('GIF export failed: ' + err.message, 'error');
  }
}

// Reflect encode progress into the shared #gif-progress bar (0..1).
function setStillProgress(p) {
  const progressEl = document.getElementById('gif-progress');
  if (!progressEl) return;
  const pct = Math.round(p * 100);
  progressEl.style.display = 'flex';
  const fill = progressEl.querySelector('.ai-progress-fill');
  const label = progressEl.querySelector('.ai-progress-label');
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
}

// v15.2 — first still-image MP4 export. Steps the animation clock per frame and
// renders the live preview, exactly like exportGif, but encodes H.264 via the
// shared WebCodecs path. Honors the v15.1 export controls (resolution + quality).
export async function exportStillMp4() {
  if (!state.image) { showNotification('Upload an image first.', 'error'); return; }
  const spin = isSpinExport();
  const hasAnim = state.animation.enabled && state.animation.tracks.length > 0;
  const hasKenBurns = state.kenBurns && state.kenBurns.enabled && !state.video.loaded;
  if (!hasAnim && !hasKenBurns && !spin) {
    showNotification('Add an animation, enable Ken Burns, or turn on Turntable spin first.', 'error');
    return;
  }
  if (!mp4Supported()) {
    showNotification('MP4 export needs WebCodecs (Chrome/Edge). Try GIF instead.', 'error');
    return;
  }

  const canvas = el.previewCanvas;
  const m = state.exportMotion || {};
  const resolution = m.resolution || 1;
  const quality = m.quality || 'high';
  const fps = 30;
  const durationSecs = spin ? 3 : state.animation.duration / 1000;
  const totalFrames = Math.ceil(fps * durationSecs);
  const width = canvas.width * resolution;
  const height = canvas.height * resolution;

  showNotification('Generating MP4...', 'success');

  const originalTime = state.animation.currentTime;
  const originalPlaying = state.animation.playing;
  state.animation.playing = false;

  try {
    const blob = await encodeMp4(async (i) => {
      if (spin) {
        state.mockup3d.orbitProgress = (i % totalFrames) / totalFrames;
      } else {
        state.animation.currentTime = (i / totalFrames) * state.animation.duration;
      }
      render();
      return canvas;
    }, {
      width, height, fps, count: totalFrames + 1, quality,
      onCaptured: () => {
        state.animation.currentTime = originalTime;
        state.animation.playing = originalPlaying;
        if (spin) state.mockup3d.orbitProgress = 0;
        render();
      },
      onProgress: (n, total) => setStillProgress(n / total)
    });

    download(blob, `snapshot-${Date.now()}.mp4`);
    showNotification('MP4 exported!', 'success');
  } catch (err) {
    // Restore the clock even if encoding threw before onCaptured ran.
    state.animation.currentTime = originalTime;
    state.animation.playing = originalPlaying;
    if (spin) state.mockup3d.orbitProgress = 0;
    render();
    if (String(err && err.message).startsWith('NO_CODEC')) {
      showNotification(`No supported H.264 config for ${evenDim(width)}x${evenDim(height)}. Try GIF, or a smaller canvas.`, 'error');
      return;
    }
    showNotification('MP4 export failed: ' + (err.message || err), 'error');
  }
}

export function bindGifExport() {
  const gifBtn = document.getElementById('gif-export-btn');
  if (gifBtn) {
    gifBtn.addEventListener('click', exportGif);
  }
  const mp4Btn = document.getElementById('mp4-export-btn');
  if (mp4Btn) {
    mp4Btn.addEventListener('click', exportStillMp4);
  }
}
