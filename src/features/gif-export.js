// Still-image animation → GIF. As of v15.1 the gif.js encode loop lives in
// motion-export.js; this steps the animation clock per frame and renders the
// live preview canvas, then restores the clock once frames are captured.

import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { render } from '../render/render.js';
import { encodeGif, download } from './motion-export.js';

export async function exportGif() {
  if (!state.image) { showNotification('Upload an image first.', 'error'); return; }
  if (!state.animation.enabled || state.animation.tracks.length === 0) {
    showNotification('Add an animation first.', 'error');
    return;
  }

  showNotification('Generating GIF...', 'success');

  try {
    const canvas = el.previewCanvas;
    const fps = 20;
    const durationSecs = state.animation.duration / 1000;
    const totalFrames = Math.ceil(fps * durationSecs);

    const originalTime = state.animation.currentTime;
    const originalPlaying = state.animation.playing;
    state.animation.playing = false;

    const blob = await encodeGif(async (i) => {
      state.animation.currentTime = (i / totalFrames) * state.animation.duration;
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

export function bindGifExport() {
  const gifBtn = document.getElementById('gif-export-btn');
  if (gifBtn) {
    gifBtn.addEventListener('click', exportGif);
  }
}
