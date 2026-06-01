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
