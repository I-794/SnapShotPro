// v9.2 — Video export. Composes each trimmed frame through the full design
// pipeline (renderInto) and encodes it. MP4 via WebCodecs + mp4-muxer (fast, no
// ffmpeg.wasm in the bundle); GIF via the existing gif.js. Falls back with a
// clear message when WebCodecs is unavailable (older Safari) — GIF still works.

import { state } from '../state/state.js';
import { renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { getVideoContext } from './video.js';

const MAX_DURATION = 30;

function evenDim(n) { return Math.max(2, Math.floor(n / 2) * 2); }

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

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export async function exportVideoMp4() {
  if (!state.video.loaded) { showNotification('Load a clip first.', 'error'); return; }
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    showNotification('MP4 export needs WebCodecs (Chrome/Edge). Try GIF instead.', 'error');
    return;
  }
  const { seekTo } = getVideoContext();
  const width = evenDim(state.canvas.width);
  const height = evenDim(state.canvas.height);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width; exportCanvas.height = height;
  const { times, fps } = frameTimes();

  setProgress('Preparing encoder…');
  try {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width, height },
      fastStart: 'in-memory'
    });
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { console.error(e); showNotification('Encoder error: ' + e.message, 'error'); }
    });
    encoder.configure({
      codec: 'avc1.42001f',
      width, height,
      bitrate: Math.round(width * height * fps * 0.12),
      framerate: fps
    });

    const savedCanvasSize = { ...state.canvas };
    for (let i = 0; i < times.length; i++) {
      await seekTo(times[i]);                 // draws the frame into state.image
      state.canvas = savedCanvasSize;         // keep design size stable
      renderInto(exportCanvas, true);
      const frame = new VideoFrame(exportCanvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % Math.round(fps) === 0 });
      frame.close();
      if (i % 5 === 0) setProgress(`Encoding ${i + 1}/${times.length}…`);
      // Yield so the encode queue drains and the UI stays responsive.
      if (encoder.encodeQueueSize > fps) await new Promise((r) => setTimeout(r, 0));
    }
    setProgress('Finalizing…');
    await encoder.flush();
    muxer.finalize();
    download(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `clip-${Date.now()}.mp4`);
    setProgress(`Exported ${times.length} frames.`);
    showNotification('MP4 exported.', 'success');
  } catch (e) {
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
    const GIF = (await import('gif.js')).default;
    const gif = new GIF({ workers: 2, quality: 10, width, height, workerScript: undefined });
    for (let i = 0; i < count; i++) {
      await seekTo(state.video.in + i / fps);
      renderInto(exportCanvas, true);
      const frameCopy = document.createElement('canvas');
      frameCopy.width = width; frameCopy.height = height;
      frameCopy.getContext('2d').drawImage(exportCanvas, 0, 0);
      gif.addFrame(frameCopy, { delay: 1000 / fps, copy: true });
      if (i % 5 === 0) setProgress(`Capturing ${i + 1}/${count}…`);
    }
    gif.on('progress', (p) => setProgress(`Encoding ${Math.round(p * 100)}%…`));
    gif.on('finished', (blob) => {
      download(blob, `clip-${Date.now()}.gif`);
      setProgress('GIF exported.');
      showNotification('GIF exported.', 'success');
    });
    gif.render();
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
