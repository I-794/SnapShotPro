# SnapShotPro Backend

SnapShotPro uses Vercel serverless functions in `api/`. There is no separate
server process to host: when the site is deployed, the API routes deploy beside
the Vite frontend.

## What It Adds

- Server-side AI keys: visitors can use hosted AI features without pasting their
  own OpenAI key into the browser.
- AI text tools: alt text, captions, SEO descriptions, and screenshot-to-HTML can
  run through `/api/ai-vision`.
- Smart enhancement: auto-enhance can call `/api/ai-enhance` for brightness,
  contrast, and saturation suggestions.
- Generative image tools: background generation, background replacement, canvas
  extension, and magic eraser use the existing image endpoints.
- Graceful fallback: if the backend is not configured, the editor still works
  with the existing bring-your-own-key flow or local analysis.

## Routes

| Route | Purpose |
| --- | --- |
| `POST /api/ai-vision` | Vision prompt against the current image. Returns `{ text }`. |
| `POST /api/ai-enhance` | Suggests CSS filter values. Returns `{ filters }`. |
| `POST /api/image-generate` | Generates a PNG. Returns `{ b64 }`. |
| `POST /api/image-edit` | Inpaints/outpaints a PNG. Returns `{ b64 }`. |

## Environment Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes for hosted AI | Server-side OpenAI key used by `/api/*` AI routes. |
| `OPENAI_VISION_MODEL` | No | Overrides the default vision model for `/api/ai-vision`. |
| `OPENAI_ENHANCE_MODEL` | No | Overrides the model for `/api/ai-enhance`. |

Supabase is still used separately for accounts, cloud projects, templates, and
share links.
