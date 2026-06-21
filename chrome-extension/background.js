// SnapShotPro Capture — MV3 background service worker.
//
// Owns the capture flow. Visible-area capture is done here with
// chrome.tabs.captureVisibleTab. Full-page and region capture inject
// content/capture.js into the active tab (it scrolls/stitches or draws a region
// overlay, calling back here for each viewport grab), then report the finished
// PNG dataURL. Every result is stashed in chrome.storage.local under a one-time
// nonce and the studio is opened at <editor>/?ext=<nonce>; the bridge content
// script (content/bridge.js) hands the capture to the page from there.

const DEFAULT_EDITOR = 'https://snapshotpro.xyz/editor/';

async function editorBase() {
  try {
    const { editorBase } = await chrome.storage.local.get('editorBase');
    return editorBase || DEFAULT_EDITOR;   // override for local dev via storage
  } catch (e) { return DEFAULT_EDITOR; }
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// captureVisibleTab is rate-limited (~2/sec). Retry once on the rate-limit error.
function captureVisible(windowId) {
  return new Promise((resolve, reject) => {
    const tryOnce = (retries) => {
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
        const err = chrome.runtime.lastError;
        if (!err && dataUrl) return resolve(dataUrl);
        if (retries > 0 && err && /MAX_CAPTURE/i.test(err.message || '')) {
          return setTimeout(() => tryOnce(retries - 1), 600);
        }
        reject(new Error((err && err.message) || 'captureVisibleTab failed'));
      });
    };
    tryOnce(2);
  });
}

async function openEditorWith(dataUrl) {
  const nonce = uid();
  const store = await chrome.storage.local.get('pending');
  const pending = store.pending || {};
  // Prune anything older than a minute so storage can't grow unbounded.
  for (const k of Object.keys(pending)) {
    if (Date.now() - (pending[k].ts || 0) > 60000) delete pending[k];
  }
  pending[nonce] = { dataUrl, ts: Date.now() };
  await chrome.storage.local.set({ pending });

  const base = await editorBase();
  const url = base + (base.includes('?') ? '&' : '?') + 'ext=' + nonce;
  await chrome.tabs.create({ url });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab to capture.');
  return tab;
}

async function startCapture(mode) {
  const tab = await activeTab();
  if (mode === 'visible') {
    await openEditorWith(await captureVisible(tab.windowId));
    return;
  }
  // full-page / region: inject the worker, then tell it to run.
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/capture.js'] });
  await chrome.tabs.sendMessage(tab.id, { cmd: 'run', mode });
  // The finished dataURL comes back as a 'captureResult' message (below).
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // From the popup: kick off a capture.
  if (msg.cmd === 'capture') {
    startCapture(msg.mode).then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;   // async response
  }

  // From content/capture.js during full-page/region: grab the current viewport.
  if (msg.cmd === 'captureVisibleForContent') {
    captureVisible(sender.tab.windowId).then((dataUrl) => sendResponse({ dataUrl }))
      .catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true;
  }

  // From content/capture.js when stitching/region finishes.
  if (msg.cmd === 'captureResult') {
    if (msg.dataUrl) openEditorWith(msg.dataUrl);
    return;
  }

  // From content/bridge.js: fetch + clear the pending capture for a nonce.
  if (msg.cmd === 'consume') {
    chrome.storage.local.get('pending').then(({ pending }) => {
      const rec = pending && pending[msg.nonce];
      if (!rec) return sendResponse({ dataUrl: null });
      delete pending[msg.nonce];
      chrome.storage.local.set({ pending }).then(() => sendResponse({ dataUrl: rec.dataUrl }));
    });
    return true;
  }
});
