// v34 — tiny promise wrapper over IndexedDB for the project store.
//
// localStorage caps near 5MB on phones (some count UTF-16 bytes, so ~2.5M
// chars), which one large photo plus its first auto version overflows.
// IndexedDB has a far larger quota and stores values by structured clone, so
// projects.js keeps its whole store here (with a localStorage fallback).
//
// DB `snapshotpro` v1, object store `kv` with out-of-line keys. Opening is
// memoized; any failure (unsupported, private mode, blocked) rejects so callers
// can fall back.

const DB_NAME = 'snapshotpro';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;

export function idbAvailable() {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null && typeof indexedDB.open === 'function'; }
  catch (e) { return false; }
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) { reject(new Error('IndexedDB unavailable')); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema: let it, and reopen on next use.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  // A failed open stays rejected (memoized) so every caller falls back
  // consistently for this session.
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(STORE, mode); }
    catch (e) { reject(e); return; }
    let result, req;
    try { req = fn(tx.objectStore(STORE)); }   // put() can throw (e.g. DataCloneError)
    catch (e) { reject(e); return; }
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || req.error || new Error('IndexedDB request failed'));
    tx.onabort = () => reject(tx.error || req.error || new Error('IndexedDB transaction aborted'));
  }));
}

export function idbGet(key) { return run('readonly', s => s.get(key)); }
export function idbSet(key, value) { return run('readwrite', s => s.put(value, key)).then(() => undefined); }
export function idbDel(key) { return run('readwrite', s => s.delete(key)).then(() => undefined); }
