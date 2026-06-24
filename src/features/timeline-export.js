// v29 — Motion Studio unified export.
//
// ONE export path for the whole timeline, whatever it contains (entrance, Ken
// Burns, video, turntable, or any COMBINATION). Builds a frameProvider that seeks
// the unified clock to each frame's time, renders the full design pipeline
// offscreen, and hands the canvas to the existing encoders (motion-export.js).
// The four legacy export buttons are untouched — this is the timeline's own MP4 /
// GIF, reachable from the Motion Studio panel.

import { state } from '../state/state.js';
import { renderInto, render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { encodeMp4, encodeGif, mp4Supported, evenDim, download } from './motion-export.js';
import { deriveDuration, sampleAtForExport, timelineActive } from './playback.js';

const MAX_DURATION_MS = 30_000;   // mirror the per-clip video cap

function motionOpts() {
  const m = state.exportMotion || {};
  return {
    resolution: m.resolution || 1,
    quality: m.quality || 'high',
    loop: m.loop != null ? m.loop : 0
  };
}

function setProgress(msg) {
  const node = document.getElementById('ms-progress');
  if (node) node.textContent = msg || '';
}

// v30 — render the active timeline to an encoded blob (no download). Extracted
// from exportTimeline so the Campaign Generator can embed a teaser video. Silent:
// no notifications/download — those stay in exportTimeline. An optional `onProgress`
// hook lets a caller surface encode progress without coupling to the UI.
export async function renderTimelineBlob(format /* 'mp4' | 'gif' */, onProgress) {
  if (!timelineActive()) return null;
  if (format === 'mp4' && !mp4Supported()) return null;

  const durationMs = Math.min(deriveDuration(), MAX_DURATION_MS);
  const fps = format === 'gif' ? Math.min(20, state.timeline.fps || 20) : (state.timeline.fps || 30);
  const total = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const { resolution, quality, loop } = motionOpts();
  const width = state.canvas.width * resolution;
  const height = state.canvas.height * resolution;
  const renderCanvas = document.createElement('canvas');

  // Preserve the live preview state so export never leaves the editor mid-frame.
  const saved = {
    currentTime: state.timeline.currentTime,
    playing: state.timeline.playing,
    driving: state.timeline._driving,
    orbitProgress: state.mockup3d ? state.mockup3d.orbitProgress : 0
  };
  state.timeline.playing = false;

  // Turntable warm-up: three.js may still be lazy-loading, so render the first
  // frame once and discard it before the encode loop reads real pixels.
  const hasTurntable = state.timeline.lanes.some(l => l.kind === 'turntable');
  if (hasTurntable) { await sampleAtForExport(0); renderInto(renderCanvas, true); }

  const frameProvider = async (i) => {
    const ms = (i / fps) * 1000;
    await sampleAtForExport(ms);
    renderInto(renderCanvas, true);
    return renderCanvas;
  };

  const restore = () => {
    state.timeline.currentTime = saved.currentTime;
    state.timeline.playing = saved.playing;
    state.timeline._driving = saved.driving;
    if (state.mockup3d) state.mockup3d.orbitProgress = saved.orbitProgress;
    render();
  };

  const p = onProgress || (() => {});
  try {
    return format === 'mp4'
      ? await encodeMp4(frameProvider, {
          width, height, fps, count: total, quality,
          onProgress: (n, t) => p({ phase: 'encode', n, t }),
          onCaptured: restore
        })
      : await encodeGif(frameProvider, {
          width, height, fps, count: total, quality, loop,
          onCapture: (n, t) => p({ phase: 'capture', n, t }),
          onProgress: (frac) => p({ phase: 'encode', frac }),
          onCaptured: restore
        });
  } catch (err) {
    restore();
    err.__exportDims = { width, height };
    throw err;
  }
}

export async function exportTimeline(format /* 'mp4' | 'gif' */) {
  if (!timelineActive()) { showNotification('Add some motion to the timeline first.', 'error'); return; }
  if (format === 'mp4' && !mp4Supported()) {
    showNotification('MP4 export needs WebCodecs (Chrome/Edge). Try GIF instead.', 'error');
    return;
  }

  setProgress('Preparing…');
  showNotification(`Generating ${format.toUpperCase()}…`, 'success');
  let total = 0;
  try {
    const blob = await renderTimelineBlob(format, (info) => {
      if (info.t != null) total = info.t;
      if (info.phase === 'capture') setProgress(`Capturing ${info.n}/${info.t}…`);
      else if (info.frac != null) setProgress(`Encoding ${Math.round(info.frac * 100)}%…`);
      else setProgress(`Encoding ${info.n}/${info.t}…`);
    });
    if (!blob) { showNotification('Nothing to export.', 'error'); return; }
    download(blob, `motion-${Date.now()}.${format}`);
    setProgress(`Exported ${total} frames.`);
    showNotification(`${format.toUpperCase()} exported!`, 'success');
  } catch (err) {
    setProgress('Failed.');
    if (String(err && err.message).startsWith('NO_CODEC')) {
      const dims = err.__exportDims || {};
      showNotification(`No supported H.264 config for ${evenDim(dims.width)}x${evenDim(dims.height)}. Try GIF, or a smaller canvas.`, 'error');
      return;
    }
    showNotification(`${format.toUpperCase()} export failed: ` + (err.message || err), 'error');
  }
}
