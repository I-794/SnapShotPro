// v23 — Service-worker share-target handler.
//
// Imported into the generated Workbox service worker via
// `workbox.importScripts` (see vite.config.js). Keeping generateSW means
// Workbox still owns precaching, runtime caching, skipWaiting and clientsClaim
// untouched — this file adds ONLY the share-target POST interception, so the
// blast radius on existing offline/auto-update behavior is minimal.
//
// The manifest registers share_target.action = '/editor/share-target' (POST,
// multipart/form-data, files[name=image]). We extract the file, stash it in the
// Cache Storage, and 303-redirect the editor to /editor/?shared=1, where
// src/features/share-target.js reads it back.

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!url.pathname.endsWith('/editor/share-target')) return;

  event.respondWith((async () => {
    try {
      const form = await req.formData();
      const file = form.get('image');
      if (file && file.size) {
        const cache = await caches.open('shared-image');
        await cache.put('shared-image', new Response(file, {
          headers: { 'content-type': file.type || 'image/png' }
        }));
      }
    } catch (e) { /* fall through to the redirect regardless */ }
    return Response.redirect('/editor/?shared=1', 303);
  })());
});
