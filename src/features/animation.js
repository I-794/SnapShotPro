import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { render } from '../render/render.js';
import { saveStateToHistory } from '../state/history.js';

const ANIMATION_PRESETS = {
  'fade-in':   { from: { opacity: 0 }, to: { opacity: 1 } },
  'slide-up':  { from: { translateY: 40, opacity: 0 }, to: { translateY: 0, opacity: 1 } },
  'slide-left': { from: { translateX: -40, opacity: 0 }, to: { translateX: 0, opacity: 1 } },
  'bounce':    { from: { scale: 0, opacity: 0 }, to: { scale: 1, opacity: 1 }, easing: 'bounce' },
  'scale-pop': { from: { scale: 0.5, opacity: 0 }, to: { scale: 1, opacity: 1 } },
  'rotate-in': { from: { rotate: -90, scale: 0.5, opacity: 0 }, to: { rotate: 0, scale: 1, opacity: 1 } }
};

function lerp(a, b, t) { return a + (b - a) * t; }

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function easeBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
}

function getEasing(name) {
  return name === 'bounce' ? easeBounce : easeInOut;
}

export function interpolateFrame(track, t) {
  const preset = ANIMATION_PRESETS[track.preset];
  if (!preset) return {};
  const ease = getEasing(preset.easing);
  const et = ease(Math.max(0, Math.min(1, t)));
  const result = {};
  for (const key of Object.keys(preset.to)) {
    const from = preset.from[key] ?? preset.to[key];
    result[key] = lerp(from, preset.to[key], et);
  }
  return result;
}

let animationFrameId = null;
let startTime = 0;

function playAnimation() {
  if (!state.animation.enabled || state.animation.tracks.length === 0) {
    showNotification('Add an animation preset first.', 'error');
    return;
  }

  saveStateToHistory();
  state.animation.playing = true;
  startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    state.animation.currentTime = elapsed;

    if (elapsed >= state.animation.duration) {
      state.animation.playing = false;
      state.animation.currentTime = state.animation.duration;
      render();
      updatePlaybackUI();
      return;
    }

    render();
    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
  updatePlaybackUI();
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  state.animation.playing = false;
  state.animation.currentTime = 0;
  render();
  updatePlaybackUI();
}

function addAnimationTrack(preset) {
  saveStateToHistory();
  state.animation.enabled = true;
  state.animation.tracks = [{ preset, startTime: 0 }];

  const toggle = document.getElementById('animation-enabled');
  if (toggle) toggle.checked = true;
  const controls = document.getElementById('animation-controls');
  if (controls) controls.style.display = 'block';

  updateTrackDisplay();
  showNotification(`Animation "${preset}" added.`, 'success');
}

function updateTrackDisplay() {
  const trackList = document.getElementById('animation-track-list');
  if (!trackList) return;

  if (state.animation.tracks.length === 0) {
    trackList.innerHTML = '<p class="info-text">No animation set. Choose a preset below.</p>';
    return;
  }

  trackList.innerHTML = state.animation.tracks.map((track, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">
      <span style="color:var(--text-primary);">${track.preset}</span>
      <button class="btn btn-secondary" data-remove-track="${i}" style="padding:2px 8px;font-size:10px;">Remove</button>
    </div>
  `).join('');

  trackList.querySelectorAll('[data-remove-track]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.animation.tracks.splice(parseInt(btn.dataset.removeTrack), 1);
      if (state.animation.tracks.length === 0) state.animation.enabled = false;
      updateTrackDisplay();
    });
  });
}

function updatePlaybackUI() {
  const playBtn = document.getElementById('animation-play-btn');
  if (playBtn) {
    playBtn.textContent = state.animation.playing ? '⏸ Pause' : '▶ Play';
  }
}

export function getAnimationState() {
  if (!state.animation.enabled || state.animation.tracks.length === 0) return null;
  const t = state.animation.currentTime / state.animation.duration;
  const frames = state.animation.tracks.map(track => interpolateFrame(track, t));
  return frames[0] || null;
}

export function bindAnimation() {
  const toggle = document.getElementById('animation-enabled');
  const controls = document.getElementById('animation-controls');
  const durationSlider = document.getElementById('animation-duration');
  const durationValue = document.getElementById('animation-duration-value');
  const playBtn = document.getElementById('animation-play-btn');

  if (toggle) {
    toggle.addEventListener('change', () => {
      state.animation.enabled = toggle.checked;
      if (controls) controls.style.display = toggle.checked ? 'block' : 'none';
    });
  }

  if (durationSlider) {
    durationSlider.addEventListener('input', () => {
      const secs = parseFloat(durationSlider.value);
      state.animation.duration = secs * 1000;
      if (durationValue) durationValue.textContent = `${secs}s`;
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (state.animation.playing) stopAnimation();
      else playAnimation();
    });
  }

  document.querySelectorAll('[data-anim-preset]').forEach(btn => {
    btn.addEventListener('click', () => addAnimationTrack(btn.dataset.animPreset));
  });

  updateTrackDisplay();
}
