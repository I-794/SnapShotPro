// v9.2 — Video export. Composes each trimmed frame through the full design
// pipeline (renderInto) and encodes it. As of v15.1 the MP4/GIF encode loops
// live in motion-export.js; the functions here are thin frame providers that
// seek the clip and render each frame. Falls back with a clear message when
// WebCodecs is unavailable (older Safari) — GIF still works.

import { state } from '../state/state.js';
import { renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { getVideoContext } from './video.js';
import { encodeMp4, encodeGif, evenDim, mp4Supported, download } from './motion-export.js';

const MAX_DURATION = 30;

function setProgress(msg) {
  const node = document.getElementById('video-export-progress');
  if (node) node.textContent = msg || '';
}

// Frame timestamps (seconds) across the trimmed range at the chosen fps.
function frameTimes() {
  const v = state.video;
  const span = Math.min(v.out - v.in, MAX_DURATION);
  const fps = v.fps || 30;
  const count = Math.max(1, Math.round(span * fps));
  const times = [];
  for (let i = 0; i < count; i++) times.push(v.in + (i / fps));
  return { times, fps };
}

export async function exportVideoMp4() {
  if (!state.video.loaded) { showNotification('Load a clip first.', 'error'); return; }
  if (!mp4Supported()) {
    showNotification('MP4 export needs WebCodecs (Chrome/Edge). Try GIF instead.', 'error');
    return;
  }
  const { seekTo } = getVideoContext();
  const width = state.canvas.width, height = state.canvas.height;
  const { times, fps } = frameTimes();

  // renderInto resizes its target canvas to state.canvas (which may be odd), so
  // composite there; the encoder copies onto its own fixed even-sized canvas.
  const renderCanvas = document.createElement('canvas');
  const savedCanvasSize = { ...state.canvas };

  setProgress('Preparing encoder…');
  try {
    const blob = await encodeMp4(async (i) => {
      await seekTo(times[i]);            // draws the frame into state.image
      state.canvas = savedCanvasSize;    // keep design size stable
      renderInto(renderCanvas, true);
      return renderCanvas;
    }, {
      width, height, fps, count: times.length,
      onProgress: (n, total) => setProgress(`Encoding ${n}/${total}…`),
      onCaptured: () => setProgress('Finalizing…')
    });
    download(blob, `clip-${Date.now()}.mp4`);
    setProgress(`Exported ${times.length} frames.`);
    showNotification('MP4 exported.', 'success');
  } catch (e) {
    if (String(e && e.message).startsWith('NO_CODEC')) {
      setProgress('Unsupported.');
      showNotification(`No supported H.264 config for ${evenDim(width)}x${evenDim(height)}. Try GIF, or a smaller canvas.`, 'error');
      return;
    }
    console.error(e);
    setProgress('Failed.');
    showNotification('MP4 export failed: ' + (e.message || e), 'error');
  }
}

export async function exportVideoGif() {
  if (!state.video.loaded) { showNotification('Load a clip first.', 'error'); return; }
  const { seekTo } = getVideoContext();
  const width = state.canvas.width, height = state.canvas.height;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width; exportCanvas.height = height;
  // GIFs are heavy — cap fps lower than MP4.
  const fps = Math.min(20, state.video.fps || 20);
  const span = Math.min(state.video.out - state.video.in, MAX_DURATION);
  const count = Math.max(1, Math.round(span * fps));

  setProgress('Building GIF…');
  try {
    const blob = await encodeGif(async (i) => {
      await seekTo(state.video.in + i / fps);
      renderInto(exportCanvas, true);
      return exportCanvas;
    }, {
      width, height, fps, count,
      onCapture: (n, total) => setProgress(`Capturing ${n}/${total}…`),
      onProgress: (p) => setProgress(`Encoding ${Math.round(p * 100)}%…`)
    });
    download(blob, `clip-${Date.now()}.gif`);
    setProgress('GIF exported.');
    showNotification('GIF exported.', 'success');
  } catch (e) {
    console.error(e);
    setProgress('Failed.');
    showNotification('GIF export failed: ' + (e.message || e), 'error');
  }
}

export function bindVideoExport() {
  const mp4 = document.getElementById('video-mp4-btn');
  const gif = document.getElementById('video-gif-btn');
  if (mp4) mp4.addEventListener('click', exportVideoMp4);
  if (gif) gif.addEventListener('click', exportVideoGif);
}
