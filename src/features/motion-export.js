// v15.1 — Shared motion encoder.
//
// One MP4 (WebCodecs + mp4-muxer) and one GIF (gif.js) encode loop, extracted
// from video-export.js / gif-export.js so video export, still-image animation
// GIF, and the v15.2 still-motion exports all encode through the same path.
//
// Each encoder is driven by a `frameProvider(i)` the caller supplies: it seeks /
// steps / renders however it likes and returns a canvas for frame `i`. The
// encoder owns dimensions, codec/quality selection, back-pressure, and muxing,
// and resolves to a Blob. Progress + download stay with the caller (it knows
// which notification surface and filename to use).

import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';

// Encoders need even dimensions; canvases can be odd (App Store sizes).
export function evenDim(n) { return Math.max(2, Math.floor(n / 2) * 2); }

export function mp4Supported() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Quality presets. MP4 scales the bitrate heuristic; GIF maps to gif.js quality
// (lower number = better/slower). 'high' reproduces the pre-v15.1 defaults.
const MP4_BITRATE_FACTOR = { low: 0.5, high: 1, max: 1.8 };
const GIF_QUALITY = { low: 16, high: 10, max: 6 };

// Pick the first H.264 codec string the platform supports for these dimensions.
// Probe from High@5.2 downward so tall App Store canvases (e.g. 1290x2796) get a
// level big enough instead of silently failing on a hardcoded Baseline-3.1.
async function pickAvcCodec(width, height, bitrate, fps) {
  const candidates = [
    'avc1.640034', 'avc1.640033', 'avc1.640032',   // High @ 5.2 / 5.1 / 5.0
    'avc1.4d0034', 'avc1.4d0033',                   // Main @ 5.2 / 5.1
    'avc1.640028', 'avc1.4d4028',                   // High / Main @ 4.0
    'avc1.42e01f', 'avc1.42001f'                    // Baseline @ 3.1
  ];
  for (const codec of candidates) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps });
      if (r && r.supported) return codec;
    } catch (_) { /* try next */ }
  }
  return null;
}

// Encode an MP4 from frameProvider(i) → canvas, for `count` frames at `fps`.
// opts: { width, height, fps, count, quality, onProgress(n,total), onCaptured() }
// Throws 'WEBCODECS_UNSUPPORTED' or 'NO_CODEC:WxH' so the caller can show the
// right message. Returns a video/mp4 Blob.
export async function encodeMp4(frameProvider, { width, height, fps, count, quality = 'high', onProgress, onCaptured } = {}) {
  if (!mp4Supported()) throw new Error('WEBCODECS_UNSUPPORTED');
  const w = evenDim(width), h = evenDim(height);
  const baseBitrate = Math.min(40_000_000, Math.round(w * h * fps * 0.1));
  const bitrate = Math.max(100_000, Math.round(baseBitrate * (MP4_BITRATE_FACTOR[quality] ?? 1)));

  const codec = await pickAvcCodec(w, h, bitrate, fps);
  if (!codec) throw new Error(`NO_CODEC:${w}x${h}`);

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    fastStart: 'in-memory'
  });
  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { console.error(e); encodeError = e; }
  });
  encoder.configure({ codec, width: w, height: h, bitrate, framerate: fps });

  // renderInto may produce an odd-sized canvas; copy onto a fixed even canvas.
  const encodeCanvas = document.createElement('canvas');
  encodeCanvas.width = w; encodeCanvas.height = h;
  const ectx = encodeCanvas.getContext('2d');

  const keyEvery = Math.max(1, Math.round(fps));
  for (let i = 0; i < count; i++) {
    if (encodeError) throw encodeError;
    const src = await frameProvider(i);
    ectx.drawImage(src, 0, 0, w, h);
    const frame = new VideoFrame(encodeCanvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
    frame.close();
    if (onProgress && i % 5 === 0) onProgress(i + 1, count);
    // Yield so the encode queue drains and the UI stays responsive.
    if (encoder.encodeQueueSize > fps) await new Promise((r) => setTimeout(r, 0));
  }
  if (onCaptured) onCaptured();
  await encoder.flush();
  if (encodeError) throw encodeError;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

// Encode a GIF from frameProvider(i) → canvas, for `count` frames at `fps`.
// opts: { width, height, fps, count, quality, loop, onCapture(n,total),
//         onCaptured(), onProgress(p) }. `loop`: -1 once, 0 forever (gif.js
//         `repeat` semantics). Returns an image/gif Blob.
export async function encodeGif(frameProvider, { width, height, fps, count, quality = 'high', loop = 0, onCapture, onCaptured, onProgress } = {}) {
  const GIF = (await import('gif.js')).default;
  const gif = new GIF({
    workers: 2,
    quality: GIF_QUALITY[quality] ?? 10,
    width, height,
    workerScript: gifWorkerUrl,
    repeat: loop
  });
  for (let i = 0; i < count; i++) {
    const src = await frameProvider(i);
    // gif.addFrame samples the canvas async during render, so hand it a copy —
    // the caller reuses its render canvas across frames. Scale src to the target
    // size so a resolution multiplier (src at design size, target larger) fills
    // the frame; for the 1× case this is a straight same-size copy.
    const copy = document.createElement('canvas');
    copy.width = width; copy.height = height;
    copy.getContext('2d').drawImage(src, 0, 0, width, height);
    gif.addFrame(copy, { delay: 1000 / fps, copy: true });
    if (onCapture && i % 5 === 0) onCapture(i + 1, count);
  }
  // Fired after capture, before the (async) worker render — lets the caller
  // restore live preview / animation state while the GIF encodes in the worker.
  if (onCaptured) onCaptured();
  return await new Promise((resolve, reject) => {
    gif.on('progress', (p) => { if (onProgress) onProgress(p); });
    gif.on('finished', (blob) => resolve(blob));
    try { gif.render(); } catch (e) { reject(e); }
  });
}
