import { state } from '../state/state.js';
import { showNotification } from '../ui/notification.js';

let busy = false;
let worker = null;

function setStatus(text) {
  const status = document.getElementById('ocr-status');
  if (status) status.textContent = text || '';
}

function showResult(text) {
  const out = document.getElementById('ocr-result');
  const copyBtn = document.getElementById('ocr-copy-btn');
  if (!out) return;
  if (!text) {
    out.style.display = 'none';
    out.textContent = '';
    if (copyBtn) copyBtn.style.display = 'none';
    return;
  }
  out.style.display = 'block';
  out.textContent = text;
  if (copyBtn) copyBtn.style.display = 'block';
}

async function getWorker() {
  if (worker) return worker;
  const Tesseract = await import('tesseract.js');
  worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status && typeof m.progress === 'number') {
        setStatus(`${m.status} ${Math.round(m.progress * 100)}%`);
      }
    }
  });
  return worker;
}

async function runOcr() {
  if (busy) return;
  if (!state.image) { showNotification('Load an image first.', 'error'); return; }
  busy = true;
  try {
    setStatus('Loading OCR engine (~5MB first time)…');
    showResult(null);
    const w = await getWorker();
    const c = document.createElement('canvas');
    c.width = state.image.naturalWidth || state.image.width;
    c.height = state.image.naturalHeight || state.image.height;
    c.getContext('2d').drawImage(state.image, 0, 0);
    setStatus('Recognizing text…');
    const { data } = await w.recognize(c);
    const text = (data.text || '').trim();
    setStatus(text ? `Done — ${data.confidence ? Math.round(data.confidence) + '% confidence' : ''}` : 'No text found.');
    showResult(text || '(no text detected)');
  } catch (e) {
    console.error(e);
    setStatus('Failed.');
    showNotification('OCR failed: ' + (e.message || e), 'error');
  } finally {
    busy = false;
  }
}

async function copyOcr() {
  const out = document.getElementById('ocr-result');
  if (!out || !out.textContent) return;
  try {
    await navigator.clipboard.writeText(out.textContent);
    showNotification('Text copied to clipboard.', 'success');
  } catch (e) {
    showNotification('Copy failed.', 'error');
  }
}

export function bindOcr() {
  const btn = document.getElementById('ocr-btn');
  const copyBtn = document.getElementById('ocr-copy-btn');
  if (btn) btn.addEventListener('click', runOcr);
  if (copyBtn) copyBtn.addEventListener('click', copyOcr);
}

// v30 — expose per-word bounding boxes (Tesseract returns these in data.words;
// the in-panel OCR path only uses data.text). Used by the AI Screenshot Editor
// to locate text regions for targeted inpainting. Coordinates are in the source
// image's pixel space (bbox: {x0,y0,x1,y1}).
export async function recognizeWords(source) {
  const w = await getWorker();
  const { data } = await w.recognize(source);
  return (data.words || []).map(word => ({
    text: word.text || '',
    bbox: word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
    confidence: word.confidence || 0
  }));
}
