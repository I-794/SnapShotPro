// v9.0 — ZIP export for screenshot sets and batch image processing.
//
// Set export: renders every panel of the active set (via screenshot-set.js).
// Batch export: applies the current design template to each uploaded image
// (via the full render pipeline, renderInto). Both bundle PNGs into a ZIP using
// fflate (tiny, no worker), rendered sequentially to keep memory bounded.

import { state, imageRegistry } from '../state/state.js';
import { render, renderInto } from '../render/render.js';
import { showNotification } from '../ui/notification.js';
import { renderSetPanels } from './screenshot-set.js';

async function blobToU8(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function downloadZip(files, filename) {
  // Lazy-load fflate so it never weighs on the still-image path.
  const { zipSync } = await import('fflate');
  const entries = {};
  for (const [name, u8] of Object.entries(files)) entries[name] = u8;
  // PNGs are already compressed — store them (level 0) so zipping is instant.
  const zipped = zipSync(entries, { level: 0 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setProgress(elId, msg) {
  const node = document.getElementById(elId);
  if (node) node.textContent = msg || '';
}

export async function exportSet() {
  const ss = state.screenshotSet;
  if (!ss.panels.length) { showNotification('Add at least one panel first.', 'error'); return; }
  if (!state.image && !ss.panels.some(p => p.imageId)) {
    showNotification('Load a screenshot first.', 'error');
    return;
  }
  setProgress('set-progress', 'Rendering…');
  try {
    const panels = await renderSetPanels((done, total) => setProgress('set-progress', `Rendering ${done}/${total}…`));
    const files = {};
    for (const p of panels) files[p.name] = await blobToU8(p.blob);
    await downloadZip(files, `appstore-set-${Date.now()}.zip`);
    setProgress('set-progress', `Exported ${panels.length} panel${panels.length === 1 ? '' : 's'}.`);
    showNotification(`Exported ${panels.length} screenshot${panels.length === 1 ? '' : 's'} as ZIP.`, 'success');
  } catch (e) {
    console.error(e);
    setProgress('set-progress', 'Failed.');
    showNotification(`Set export failed: ${e.message || e}`, 'error');
  } finally {
    render();
  }
}

export async function exportBatch() {
  const imgs = state.batch.images;
  if (!imgs.length) { showNotification('Add images to the batch first.', 'error'); return; }
  setProgress('batch-progress', 'Rendering…');
  const off = document.createElement('canvas');
  const savedImg = state.image;
  try {
    const files = {};
    for (let i = 0; i < imgs.length; i++) {
      const entry = imgs[i];
      const img = imageRegistry[entry.id];
      if (!img) continue;
      state.image = img;
      renderInto(off, true);
      const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
      const base = (entry.name || `image-${i + 1}`).replace(/\.[^.]+$/, '');
      files[`${String(i + 1).padStart(2, '0')}-${base}.png`] = await blobToU8(blob);
      setProgress('batch-progress', `Rendering ${i + 1}/${imgs.length}…`);
      await new Promise((r) => setTimeout(r, 0));
    }
    await downloadZip(files, `batch-${Date.now()}.zip`);
    setProgress('batch-progress', `Exported ${imgs.length} image${imgs.length === 1 ? '' : 's'}.`);
    showNotification(`Batch exported ${imgs.length} image${imgs.length === 1 ? '' : 's'} as ZIP.`, 'success');
  } catch (e) {
    console.error(e);
    setProgress('batch-progress', 'Failed.');
    showNotification(`Batch export failed: ${e.message || e}`, 'error');
  } finally {
    state.image = savedImg;
    render();
  }
}
