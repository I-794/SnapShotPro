// v11.0 — CORS media proxy. Fetches a remote image/video URL server-side and
// streams the bytes back with Access-Control-Allow-Origin:* so the client can
// draw it onto a <canvas> without tainting it (keeping export working). Backs
// the "Load from URL" feature, including YouTube poster thumbnails.
//
// Request:  GET /api/fetch-url?url=<encoded absolute http(s) url>
// Response: 200 with the raw bytes + the upstream Content-Type, or a JSON
//           { error } on rejection (missing/invalid url, non-media type, too big).

import { lookup } from 'dns/promises';
import { ApiError, handleApiError } from './_shared.js';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_REDIRECTS = 5;

// Vercel caps responses by default; media can exceed that, so opt out.
export const config = { api: { responseLimit: false } };

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let addr = ip.trim().toLowerCase();
  const pct = addr.indexOf('%');
  if (pct >= 0) addr = addr.slice(0, pct);

  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) addr = mapped[1];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    const parts = addr.split('.').map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (addr === '::' || addr === '::1') return true;
  if (addr.startsWith('fe8') || addr.startsWith('fe9') ||
      addr.startsWith('fea') || addr.startsWith('feb')) return true;
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true;
  if (addr.startsWith('ff')) return true;
  return false;
}

async function assertPublicHost(host) {
  if (!host) throw new ApiError(400, 'Invalid host');
  const literal = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (/^[0-9.]+$/.test(literal) || literal.includes(':')) {
    if (isPrivateIp(literal)) throw new ApiError(422, 'Host not allowed');
    return;
  }

  let records;
  try {
    records = await lookup(host, { all: true });
  } catch (_) {
    throw new ApiError(422, 'Host could not be resolved');
  }
  if (!records || !records.length) throw new ApiError(422, 'Host could not be resolved');
  for (const rec of records) {
    if (isPrivateIp(rec.address)) throw new ApiError(422, 'Host not allowed');
  }
}

function assertHttpUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError(400, 'Only http(s) URLs are allowed');
  }
}

async function fetchPublicMedia(startUrl) {
  let current = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    assertHttpUrl(current);
    await assertPublicHost(current.hostname);

    const upstream = await fetch(current.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 SnapShotPro/11 media-proxy' },
      redirect: 'manual'
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) throw new ApiError(502, 'Redirect missing location');
      current = new URL(location, current);
      continue;
    }

    return upstream;
  }

  throw new ApiError(508, 'Too many redirects');
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

    const upstream = await fetchPublicMedia(parsed);
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
