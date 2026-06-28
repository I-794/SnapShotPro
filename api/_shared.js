// v30 model policy: gpt-5.5 for all non-image OpenAI calls (vision/text/enhance).
// Overridable per-route via OPENAI_VISION_MODEL / OPENAI_ENHANCE_MODEL env vars.
export const DEFAULT_VISION_MODEL = 'gpt-5.5';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      throw new ApiError(400, 'Invalid JSON body');
    }
  }
  return req.body;
}

export function serverOpenAIKey() {
  return process.env.OPENAI_API_KEY || '';
}

export function cleanBase64Image(value) {
  if (!value || typeof value !== 'string') return '';
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export function dataUrlFromBase64(image, mimeType = 'image/png') {
  return `data:${mimeType};base64,${cleanBase64Image(image)}`;
}

export async function openAIChat(payload) {
  const key = serverOpenAIKey();
  if (!key) throw new ApiError(501, 'No server key configured');

  // v30 — gpt-5.x / reasoning models reject `max_tokens` and require
  // `max_completion_tokens`. Normalize here so every route (which still passes
  // the familiar `max_tokens`) works without per-route changes.
  const body = { ...payload };
  if (body.max_tokens != null && body.max_completion_tokens == null) {
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error?.message || 'OpenAI request failed');
  }
  return data;
}

export function textFromChat(data) {
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function handleApiError(res, error) {
  const status = error instanceof ApiError ? error.status : 500;
  res.status(status).json({ error: error.message || String(error) });
}
