// v32 — Seed (URL -> set). A "paste a link, get cards" entry on the board
// toolbar. Fetches /api/scrape-page (SSRF-guarded server scrape), then loads each
// discovered image CORS-clean through the existing loadImageEl (which goes via
// /api/fetch-url) and drops each as a page via pages.addPageWithImage. The board's
// onDocumentChange sync then lays a card per new page. Degrades gracefully when
// the API is unreachable (Vite dev doesn't serve /api) — shows a notification.

import { showNotification } from '../ui/notification.js';
import { loadImageEl } from './url-load.js';
import { addPageWithImage } from './pages.js';

let bar = null;     // .board-seed input row

function ensureBar(toolbar) {
  if (bar || !toolbar) return;
  bar = document.createElement('div');
  bar.className = 'board-seed';
  bar.innerHTML = `
    <input class="board-seed-input" type="url" placeholder="Paste a page URL to drop its images as cards" aria-label="Page URL" />
    <button class="board-seed-go" type="button">Add</button>`;
  const input = bar.querySelector('.board-seed-input');
  const go = () => { const v = input.value.trim(); if (v) seedFromUrl(v); };
  bar.querySelector('.board-seed-go').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  toolbar.appendChild(bar);
}

function url2host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u; } }

export async function seedFromUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return;
  showNotification('Scraping page…', 'success');
  let manifest;
  try {
    const res = await fetch(`/api/scrape-page?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      let msg = `Scrape failed (${res.status})`;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
      showNotification(msg, 'error');
      return;
    }
    manifest = await res.json();
  } catch (e) {
    showNotification('Could not reach the scraper (try again on the deployed site).', 'error');
    return;
  }
  const imgs = (manifest && manifest.images) || [];
  if (!imgs.length) { showNotification('No images found on that page.', 'error'); return; }
  showNotification(`Found ${imgs.length} image${imgs.length === 1 ? '' : 's'}. Adding…`, 'success');

  let added = 0;
  for (let i = 0; i < imgs.length; i++) {
    const m = imgs[i];
    try {
      const img = await loadImageEl(m.url);     // CORS-clean via /api/fetch-url
      if (addPageWithImage(img)) added++;
    } catch (e) { /* skip one bad image, continue */ }
    await new Promise(r => setTimeout(r, 0));     // yield between loads
  }
  if (added) showNotification(`Added ${added} card${added === 1 ? '' : 's'} from ${url2host(url)}.`, 'success');
  else showNotification('Could not load any images from that page.', 'error');
}

export function bindSeed() {
  // The board toolbar is built in board.js ensureSurface(). Append the seed bar
  // once it exists; board.js exposes the toolbar via window.__boardToolbar.
  const attach = (toolbar) => { if (toolbar) ensureBar(toolbar); };
  attach(window.__boardToolbar);
  // If board isn't initialized yet, retry when board mode is entered.
  window.__seedAttach = attach;
}
