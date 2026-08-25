// App-shell cache for low-bandwidth environments. Caches static assets only —
// API responses are never cached here (the backend already handles Facebook
// feed caching/fallback), so students always see fresh data when online.
const CACHE_NAME = 'gvs-shell-v1';
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
      const network = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
