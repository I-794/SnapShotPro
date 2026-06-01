// v11.1 — Auto-zoom toward cursor/clicks.
//
// Takes the cursor/click event track captured during screen recording
// (state.recording.events: { t(ms), xFrac, yFrac, type }) and turns it into
// eased zoom keyframes { t(seconds), cx, cy, scale } where cx/cy are normalized
// 0..1 focal points. video.js drawFrame() samples these per frame and draws a
// cropped source sub-rectangle of the clip, so the zoom composites identically
// in live preview and in MP4/GIF export with no change to the render pipeline.
//
// All functions are pure; state ownership lives in state.autoZoom.

const ZOOM_IN = 0.35;   // seconds to ease into a click
const HOLD = 0.9;       // seconds to hold the zoom after a click
const ZOOM_OUT = 0.55;  // seconds to ease back out

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Build zoom keyframes from the recorded click events. Each click produces a
// zoom-in → hold → zoom-out envelope centered on the click location. `intensity`
// is the peak scale (1 = no zoom). Cursor-move events are ignored for focal
// points (clicks are the meaningful beats); moves could be used later.
export function buildKeyframes(events, intensity = 1.6) {
  const clicks = (events || []).filter(e => e.type === 'pointerdown' || e.type === 'click');
  const peak = Math.max(1, intensity);
  const frames = [];
  for (const c of clicks) {
    const tc = c.t / 1000; // seconds
    frames.push({ t: tc - ZOOM_IN, cx: c.xFrac, cy: c.yFrac, scale: 1 });
    frames.push({ t: tc, cx: c.xFrac, cy: c.yFrac, scale: peak });
    frames.push({ t: tc + HOLD, cx: c.xFrac, cy: c.yFrac, scale: peak });
    frames.push({ t: tc + HOLD + ZOOM_OUT, cx: c.xFrac, cy: c.yFrac, scale: 1 });
  }
  frames.sort((a, b) => a.t - b.t);
  return frames;
}

// Sample the interpolated { cx, cy, scale } at time `tSeconds`. Returns a
// neutral { cx:0.5, cy:0.5, scale:1 } when there are no keyframes or we're
// outside their range, so callers can always draw safely.
export function sampleZoom(keyframes, tSeconds) {
  const neutral = { cx: 0.5, cy: 0.5, scale: 1 };
  if (!keyframes || keyframes.length === 0) return neutral;
  if (tSeconds <= keyframes[0].t) return neutral;
  const last = keyframes[keyframes.length - 1];
  if (tSeconds >= last.t) return neutral;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i], b = keyframes[i + 1];
    if (tSeconds >= a.t && tSeconds <= b.t) {
      const span = b.t - a.t;
      const f = span <= 0 ? 1 : easeInOut((tSeconds - a.t) / span);
      return {
        cx: a.cx + (b.cx - a.cx) * f,
        cy: a.cy + (b.cy - a.cy) * f,
        scale: a.scale + (b.scale - a.scale) * f
      };
    }
  }
  return neutral;
}

// Recompute and store keyframes from the current recording + intensity.
export function rebuildAutoZoom(state) {
  state.autoZoom.keyframes = buildKeyframes(state.recording.events, state.autoZoom.intensity);
}
