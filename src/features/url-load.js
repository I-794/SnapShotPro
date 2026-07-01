// v11.0 — Load media from a URL. Paste a direct image/video URL or a YouTube
// link; the bytes come back through /api/fetch-url (CORS proxy) so the canvas
// stays untainted and exportable, then plug straight into the existing upload
// pipeline via loadImage() / loadVideoFile().
//
// YouTube note: a YouTube *stream* cannot be drawn to a canvas (embeds taint it,
// hotlinking violates ToS). We resolve the link to the public poster thumbnail
// — a still image — which is ToS-clean and exports fine.

import { el } from '../ui/elements.js';
import { showNotification } from '../ui/notification.js';
import { loadImage } from './upload.js';
import { loadVideoFile } from './video.js';

// Extract a YouTube video id from the common URL shapes (watch, youtu.be,
// embed, shorts, /v/). Returns null when the URL isn't YouTube.
export function parseYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch (_) { /* not a URL */ }
  return null;
}

async function proxyFetch(target) {
  return fetch(`/api/fetch-url?url=${encodeURIComponent(target)}`);
}

// v31 — Merge Studio's per-row image loader. Unlike loadImageFromSrc (which
// mutates state.image, pushes history, and toggles the upload UI), this is a
// pure helper: it just resolves to a decoded <img>. Remote http(s) URLs go
// through the CORS proxy so the export canvas stays untainted; data:/blob:
// sources load directly. Results are cached by src so a CSV that reuses the
// same image URL across rows fetches it once.
const imgElCache = new Map();

export function loadImageEl(src) {
  const key = (src || '').trim();
  if (!key) return Promise.reject(new Error('empty image source'));
  if (imgElCache.has(key)) return imgElCache.get(key);

  const p = (async () => {
    let objectUrl = null;
    let finalSrc = key;
    if (/^https?:/i.test(key)) {
      const res = await proxyFetch(key);
      if (!res.ok) throw new Error(`fetch failed (${res.status})`);
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      finalSrc = objectUrl;
    }
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image decode failed'));
        img.src = finalSrc;
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  })();

  // Don't cache failures permanently — a transient network error shouldn't
  // poison every later row that references the same URL.
  p.catch(() => imgElCache.delete(key));
  imgElCache.set(key, p);
  return p;
}

export async function loadFromUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return;

  const ytId = parseYouTubeId(url);
  // maxresdefault only exists for HD uploads; hqdefault always does — try both.
  const candidates = ytId
    ? [`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
       `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`]
    : [url];

  showNotification('Loading from URL…', 'success');

  let res = null;
  let errMsg = 'Failed to load URL';
  for (const target of candidates) {
    try {
      const r = await proxyFetch(target);
      if (r.ok) { res = r; break; }
      errMsg = `Failed to load URL (${r.status})`;
      try { const j = await r.json(); if (j.error) errMsg = j.error; } catch (_) {}
    } catch (_) {
      errMsg = 'Could not reach the media proxy';
    }
  }

  if (!res) { showNotification(errMsg, 'error'); return; }

  const blob = await res.blob();
  const type = blob.type || res.headers.get('content-type') || '';
  const baseName = ytId
    ? `youtube-${ytId}.jpg`
    : (url.split('/').pop()?.split('?')[0] || 'media');

  if (type.startsWith('image/')) {
    loadImage(new File([blob], baseName, { type }));
  } else if (type.startsWith('video/')) {
    loadVideoFile(new File([blob], baseName, { type }));
  } else {
    showNotification('URL is not a supported image or video', 'error');
  }
}

// Command-palette entry: focus the URL field so the user can paste.
export function focusUrlLoad() {
  if (el.urlLoadInput) { el.urlLoadInput.focus(); el.urlLoadInput.select(); }
}

export function bindUrlLoad() {
  const input = el.urlLoadInput;
  const btn = el.urlLoadBtn;
  if (!input || !btn) return;
  const go = () => loadFromUrl(input.value);
  btn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); go(); }
  });
}
