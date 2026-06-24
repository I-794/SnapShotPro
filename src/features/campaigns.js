// v30 — Campaign folder store. Mirrors projects.js: a localStorage map keyed by
// id. Stores each campaign's RECIPE (design payload + target list) plus small
// thumbnails — NOT full-res bytes (quota-safe). Full assets are regenerated from
// `payload` on download (deterministic), and cached in-session by the generator.

import { showNotification } from '../ui/notification.js';

const KEY = 'snapshotpro_campaigns_v1';

export function loadCampaigns() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch (e) { return {}; }
}

function writeAll(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch (e) {
    showNotification('Storage full — could not save the campaign.', 'error');
    return false;
  }
}

export function saveCampaign(record) {
  const store = loadCampaigns();
  store[record.id] = record;
  return writeAll(store);
}

export function getCampaign(id) {
  return loadCampaigns()[id] || null;
}

export function deleteCampaign(id) {
  const store = loadCampaigns();
  delete store[id];
  writeAll(store);
}
