// v32 — Seed (URL -> set). Fetch a page server-side, extract its title and the
// images that best represent it (Open Graph, apple-touch-icon, hero <img>/<picture>,
// favicon), and return a small JSON manifest. The client then loads each image
// CORS-clean through the existing /api/fetch-url media proxy and drops them as
// board cards. Reuses the SSRF guard from _shared.js — never fetches private IPs.

import { ApiError, handleApiError, assertHttpUrl, fetchPublic } from './_shared.js';

const MAX_HTML_BYTES = 5 * 1024 * 1024;   // 5 MB of HTML
const MAX_IMAGES = 12;

// Resolve a possibly-relative URL against the page URL.
function abs(u, base) {
  try { return new URL(u, base).toString(); } catch (_) { return null; }
}

// Only image-looking URLs (skip trackers/scripts by extension).
function looksLikeImage(u) {
  if (!u) return false;
  const path = u.split('?')[0].split('#')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\b|$)/.test(path) ||
    u.startsWith('data:image/');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new ApiError(405, 'Method not allowed');
    const raw = req.query?.url;
    const target = Array.isArray(raw) ? raw[0] : raw;
    if (!target) throw new ApiError(400, 'Missing url parameter');
    let parsed;
    try { parsed = new URL(target); } catch (_) { throw new ApiError(400, 'Invalid URL'); }
    assertHttpUrl(parsed);

    const upstream = await fetchPublic(parsed, { userAgent: 'Mozilla/5.0 SnapShotPro/32 scraper' });
    if (!upstream.ok) throw new ApiError(upstream.status, `Upstream returned ${upstream.status}`);

    const type = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('html') && !type.includes('xml') && !type.includes('text')) {
      throw new ApiError(415, 'URL is not an HTML page');
    }
    const declared = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
      throw new ApiError(413, 'Page is too large');
    }
    const text = await upstream.text();
    if (text.length > MAX_HTML_BYTES) throw new ApiError(413, 'Page is too large');

    const title = (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const base = parsed.toString();
    const seen = new Set();
    const images = [];

    const push = (url, alt) => {
      const a = abs(url, base);
      if (!a || seen.has(a) || !looksLikeImage(a)) return;
      seen.add(a);
      images.push({ url: a, w: null, h: null, alt: alt || '' });
    };

    // Open Graph image(s) — primary signal. og:image can repeat; grab all.
    const og = text.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/ig) || [];
    for (const m of og) {
      const c = (m.match(/content=["']([^"']+)["']/i) || [])[1];
      if (c) push(c, 'Open Graph image');
    }

    // Apple-touch-icon (app icon).
    const ati = text.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    if (ati) push(ati[1], 'App icon');

    // Hero <img> and <picture><source srcset>. srcset first entry only.
    const imgs = text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/ig) || [];
    for (const m of imgs) {
      const src = (m.match(/src=["']([^"']+)["']/i) || [])[1];
      const alt = (m.match(/alt=["']([^"']*)["']/i) || [])[1];
      if (src) push(src, alt);
    }
    const srcsets = text.match(/<source[^>]+srcset=["']([^"'\s]+)/ig) || [];
    for (const m of srcsets) {
      const s = (m.match(/srcset=["']([^"'\s]+)/i) || [])[1];
      if (s) push(s, '');
    }

    // Favicon fallback.
    const fav = text.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (fav) push(fav[1], 'Favicon');

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      title: title.replace(/\s+/g, ' ').trim().slice(0, 200),
      images: images.slice(0, MAX_IMAGES)
    });
  } catch (e) {
    handleApiError(res, e);
  }
}
