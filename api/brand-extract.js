// v30 — Brand Brain URL extraction. Fetches a page server-side (no CORS limits)
// and returns lightweight brand signals: <title>, a theme-color, an OG image,
// and a best-guess icon URL. Deliberately does NOT call any AI provider — the
// client runs vision on the returned image via the existing runVisionJson path,
// so BYO-key visitors work identically. Mirrors api/fetch-url.js conventions.

import { ApiError, handleApiError, parseBody } from './_shared.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function abs(base, href) {
  if (!href) return null;
  try { return new URL(href, base).href; } catch (_) { return null; }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let url = '';
  try {
    const body = parseBody(req);
    url = (body && body.url) || '';
  } catch (e) {
    return handleApiError(res, e);
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'A valid http(s) url is required.' });
  }

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'SnapShotPro-BrandBrain/1.0' }, redirect: 'follow' });
    if (!r.ok) throw new ApiError(502, `Upstream ${r.status}`);
    const full = await r.text();
    const html = full.slice(0, 200000); // cap parse work

    const pick = (re) => { const m = html.match(re); return m ? m[1] : null; };
    const themeColor = pick(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
    const ogImage = abs(url, pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i));
    const iconHref = pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    const iconUrl = abs(url, iconHref) || abs(url, '/favicon.ico');
    const title = pick(/<title[^>]*>([^<]*)<\/title>/i);

    return res.status(200).json({
      html: html.slice(0, 20000),
      title: title || null,
      themeColor: themeColor || null,
      ogImage: ogImage || null,
      iconUrl: iconUrl || null
    });
  } catch (e) {
    // Fall-through contract: 501 → client degrades to asset/manual entry.
    if (e instanceof ApiError) return handleApiError(res, e);
    return res.status(501).json({ error: 'Brand extraction unavailable', detail: String(e && e.message || e) });
  }
}
