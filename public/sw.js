// App-shell cache for low-bandwidth environments. Caches static assets only —
// API responses are never cached here (the backend already handles Facebook
// feed caching/fallback), so students always see fresh data when online.
//
// CACHE_NAME must change whenever any file in SHELL_ASSETS changes. This
// isn't just an ID: the browser's service-worker update check re-fetches
// this exact file (server/index.js now excludes it from HTTP caching so
// that fetch is never itself stale) and diffs its bytes -- if this file's
// content is byte-identical to what's installed, the browser correctly
// concludes nothing changed and never installs a new worker, so a deploy
// can silently never take effect no matter what shipped. Bump the suffix
// on every deploy that touches an HTML/CSS/JS shell asset.
const CACHE_NAME = 'gvs-shell-v2';
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
