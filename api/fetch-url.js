// v11.0 — CORS media proxy. Fetches a remote image/video URL server-side and
// streams the bytes back with Access-Control-Allow-Origin:* so the client can
// draw it onto a <canvas> without tainting it (keeping export working). Backs
// the "Load from URL" feature, including YouTube poster thumbnails.
//
// Request:  GET /api/fetch-url?url=<encoded absolute http(s) url>
// Response: 200 with the raw bytes + the upstream Content-Type, or a JSON
//           { error } on rejection (missing/invalid url, non-media type, too big).

import { ApiError, handleApiError, assertHttpUrl, fetchPublic } from './_shared.js';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Vercel caps responses by default; media can exceed that, so opt out.
export const config = { api: { responseLimit: false } };

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

    const upstream = await fetchPublic(parsed);
    if (!upstream.ok) throw new ApiError(upstream.status, `Upstream returned ${upstream.status}`);

    const type = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('image/') && !type.startsWith('video/')) {
      throw new ApiError(415, 'URL is not an image or video');
    }

    const declared = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      throw new ApiError(413, 'File is too large (max 25 MB)');
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new ApiError(413, 'File is too large (max 25 MB)');

    res.setHeader('Content-Type', type.split(';')[0]);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch (e) {
    handleApiError(res, e);
  }
}
