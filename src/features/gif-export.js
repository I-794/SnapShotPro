import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { render } from '../render/render.js';
// Serve the gif.js worker as a bundled URL — gif.render() needs a real worker
// script or it never finishes (passing undefined silently hangs in Vite).
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';

export async function exportGif() {
  if (!state.image) { showNotification('Upload an image first.', 'error'); return; }
  if (!state.animation.enabled || state.animation.tracks.length === 0) {
    showNotification('Add an animation first.', 'error');
    return;
  }

  showNotification('Generating GIF...', 'success');

  try {
    const GIF = (await import('gif.js')).default;

    const canvas = el.previewCanvas;
    const fps = 20;
    const durationSecs = state.animation.duration / 1000;
    const totalFrames = Math.ceil(fps * durationSecs);

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: gifWorkerUrl
    });

    const originalTime = state.animation.currentTime;
    const originalPlaying = state.animation.playing;
    state.animation.playing = false;

    for (let i = 0; i <= totalFrames; i++) {
      state.animation.currentTime = (i / totalFrames) * state.animation.duration;
      render();

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = canvas.width;
      frameCanvas.height = canvas.height;
      const ctx = frameCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      gif.addFrame(frameCanvas, { delay: 1000 / fps, copy: true });
    }

    state.animation.currentTime = originalTime;
    state.animation.playing = originalPlaying;
    render();

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('GIF exported!', 'success');
    });

    gif.on('progress', (p) => {
      const pct = Math.round(p * 100);
      const progressEl = document.getElementById('gif-progress');
      if (progressEl) {
        progressEl.style.display = 'flex';
        const fill = progressEl.querySelector('.ai-progress-fill');
        const label = progressEl.querySelector('.ai-progress-label');
        if (fill) fill.style.width = `${pct}%`;
        if (label) label.textContent = `${pct}%`;
      }
    });

    gif.render();
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
