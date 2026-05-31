import { state } from '../state/state.js';
import { el } from '../ui/elements.js';
import { saveStateToHistory } from '../state/history.js';
import { render } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { getKey } from './api-keys.js';

function imageToDataUrl(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

function dataUrlToBase64(url) {
  const i = url.indexOf(',');
  return i >= 0 ? url.slice(i + 1) : url;
}

function setAiStatus(msg) {
  const s = document.getElementById('ai-cloud-status');
  if (s) s.textContent = msg || '';
}

function showAiResult(text) {
  const out = document.getElementById('ai-cloud-result');
  if (!out) return;
  if (!text) { out.style.display = 'none'; out.textContent = ''; return; }
  out.style.display = 'block';
  out.textContent = text;
}

function promptForKey() {
  const details = document.getElementById('api-keys-details');
  if (details) {
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inp = document.getElementById('anthropic-key-input');
    if (inp) setTimeout(() => inp.focus(), 300);
  }
}

async function tryHostedJson(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.status === 404 || r.status === 501) return { fellThrough: true };
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Backend error ${r.status}`);
    return data;
  } catch (e) {
    if (e.message && /Backend error/.test(e.message)) throw e;
    return { fellThrough: true };
  }
}

async function chooseProvider(needVision) {
  const oai = getKey('openai');
  const ant = getKey('anthropic');
  // Prefer Anthropic for vision when both present
  if (needVision && ant) return { provider: 'anthropic', key: ant };
  if (oai) return { provider: 'openai', key: oai };
  if (ant) return { provider: 'anthropic', key: ant };
  return null;
}

async function callAnthropicVision(key, prompt, dataUrl) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: dataUrlToBase64(dataUrl) } },
        { type: 'text', text: prompt }
      ]
    }]
  });
  return res.content?.[0]?.text || '';
}

async function callOpenAIVision(key, prompt, dataUrl) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }]
  });
  return res.choices?.[0]?.message?.content || '';
}

async function callHostedVision(prompt, dataUrl) {
  const out = await tryHostedJson('/api/ai-vision', {
    prompt,
    image: dataUrlToBase64(dataUrl),
    mimeType: 'image/png'
  });
  if (out.fellThrough) return null;
  return out;
}

async function callHostedImageGenerate(prompt, size) {
  const out = await tryHostedJson('/api/image-generate', { prompt, size });
  if (out.fellThrough) return null;
  return out.b64;
}

async function runVisionPrompt(prompt) {
  if (!state.image) { showNotification('Load an image first.', 'error'); return null; }
  const dataUrl = imageToDataUrl(state.image);
  setAiStatus('Checking hosted AI...');
  try {
    const hosted = await callHostedVision(prompt, dataUrl);
    if (hosted?.text) {
      setAiStatus(`Done via hosted ${hosted.provider || 'AI'}.`);
      return hosted.text;
    }
  } catch (e) {
    console.warn('Hosted vision failed; falling back to browser key.', e);
  }

  const choice = await chooseProvider(true);
  if (!choice) {
    showNotification('Hosted AI is not configured yet. Paste your Claude or OpenAI key below to use this locally.', 'error');
    promptForKey();
    return null;
  }
  setAiStatus(`Calling ${choice.provider}…`);
  try {
    const out = choice.provider === 'anthropic'
      ? await callAnthropicVision(choice.key, prompt, dataUrl)
      : await callOpenAIVision(choice.key, prompt, dataUrl);
    setAiStatus(`Done via ${choice.provider}.`);
    return out;
  } catch (e) {
    console.error(e);
    setAiStatus('Failed.');
    showNotification(`AI call failed: ${e.message || e}`, 'error');
    return null;
  }
}

export async function aiAltText() {
  const out = await runVisionPrompt(
    'Write concise, accessible alt text for this image (1-2 sentences, no preamble). Describe the most important visible content.'
  );
  if (out) showAiResult(out);
}

const CAPTION_MODES = {
  social: 'Write a short, punchy social-media caption for this image (under 25 words, no hashtags, no preamble).',
  technical: 'Write a technical description of this image suitable for documentation. Focus on UI elements, layout, and technical details. Be precise and concise (2-3 sentences, no preamble).',
  accessibility: 'Write a detailed, accessible alt text for this image following WCAG guidelines. Describe all meaningful visual content, layout, and relationships. Be thorough but concise (2-4 sentences, no preamble).',
  seo: 'Write an SEO-optimized description for this image suitable for a website meta description or image caption. Include relevant keywords naturally. (1-2 sentences, under 160 characters, no preamble).'
};

export async function aiCaption() {
  const modeSelect = document.getElementById('ai-caption-mode');
  const mode = modeSelect ? modeSelect.value : 'social';
  const prompt = CAPTION_MODES[mode] || CAPTION_MODES.social;
  const out = await runVisionPrompt(prompt);
  if (out) showAiResult(out);
}

export async function aiScreenshotToCode() {
  const out = await runVisionPrompt(
    'This is a UI screenshot. Produce a single self-contained HTML file (with inline CSS) that recreates the visible interface as closely as possible. Return ONLY the code, no markdown fences or commentary.'
  );
  if (out) showAiResult(out);
}

export async function aiGenerateBackground() {
  const promptInp = document.getElementById('ai-bg-prompt');
  const promptText = promptInp ? promptInp.value.trim() : '';
  if (!promptText) { showNotification('Enter a prompt for the background.', 'error'); return; }
  setAiStatus('Generating background image…');
  try {
    let b64 = await callHostedImageGenerate(promptText, '1536x1024');
    if (!b64) {
      const key = getKey('openai');
      if (!key) {
        showNotification('Hosted AI is not configured yet. Add an OpenAI key locally or set OPENAI_API_KEY on Vercel.', 'error');
        promptForKey();
        return;
      }
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
      const res = await client.images.generate({
        model: 'dall-e-3',
        prompt: promptText,
        size: '1792x1024',
        response_format: 'b64_json',
        n: 1
      });
      b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned');
    }
    const dataUrl = 'data:image/png;base64,' + b64;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    saveStateToHistory();
    // Apply as a solid background with image overlay via a custom approach:
    // Drop the result into a new ImageBitmap and set as bgImage. The simplest
    // path: replace the image as a backdrop by switching to "solid" mode and
    // painting via mesh — but cleanest is dedicated state.bgImage handled by
    // background renderer. For minimal scope, swap state.image with the generated
    // image as a backdrop and notify the user.
    state.bgImage = img;
    state.bgMode = 'image';
    render();
    setAiStatus('Background applied.');
    showNotification('AI background generated.', 'success');
  } catch (e) {
    console.error(e);
    setAiStatus('Failed.');
    showNotification(`Background gen failed: ${e.message || e}`, 'error');
  }
}

async function copyAiResult() {
  const out = document.getElementById('ai-cloud-result');
  if (!out || !out.textContent) return;
  try {
    await navigator.clipboard.writeText(out.textContent);
    showNotification('Copied.', 'success');
  } catch (e) {}
}

export function bindAiCloud() {
  const alt = document.getElementById('ai-alt-btn');
  const cap = document.getElementById('ai-caption-btn');
  const s2c = document.getElementById('ai-s2c-btn');
  const bg = document.getElementById('ai-bg-btn');
  const cp = document.getElementById('ai-copy-btn');
  if (alt) alt.addEventListener('click', aiAltText);
  if (cap) cap.addEventListener('click', aiCaption);
  if (s2c) s2c.addEventListener('click', aiScreenshotToCode);
  if (bg) bg.addEventListener('click', aiGenerateBackground);
  if (cp) cp.addEventListener('click', copyAiResult);
}
