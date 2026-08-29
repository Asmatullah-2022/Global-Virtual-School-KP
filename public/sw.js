// App-shell cache for low-bandwidth environments. Caches static assets only —
// API responses are never cached here (the backend already handles Facebook
// feed caching/fallback), so students always see fresh data when online.
//
// CACHE_NAME must change whenever any file in SHELL_ASSETS (or this
// file's own caching logic) changes -- the browser's service-worker
// update check works by re-fetching this exact file and diffing its
// bytes, and only installs a new worker if something differs. A manually
// typed version string (the previous approach here) is exactly the kind
// of thing that's easy to forget to bump -- it silently happened three
// times in a row after the first fix for this, each shipping a real fix
// that never reached any browser that had already installed the old
// worker. __CACHE_VERSION__ is replaced by server/index.js at request
// time with a hash of this file's own logic plus every SHELL_ASSETS
// file's actual current content, so a cache-busting version is generated
// automatically and can't be forgotten -- this exact literal string must
// stay exactly as-is; do not hardcode a version here again.
const CACHE_NAME = 'gvs-shell-__CACHE_VERSION__';
const SHELL_ASSETS = [
  '/', '/index.html', '/css/styles.css',
  '/js/api.js', '/js/state.js', '/js/views.js', '/js/router.js', '/js/app.js',
  '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhooks/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // 'reload' forces this fetch past the browser's own HTTP cache --
      // without it, this "background revalidation" could itself be
      // satisfied from a stale disk-cached response (e.g. under the 1-day
      // Cache-Control the server sends for these files), silently
      // defeating the whole point of fetching from the network here.
      const network = fetch(request, { cache: 'reload' })
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
