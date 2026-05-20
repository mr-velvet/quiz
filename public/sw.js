// Service Worker do Flashy. Cache-first pra assets estáticos, network-first pra API.

const VERSION = 'flashy-v1';
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('flashy-') && !k.startsWith(VERSION))
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: nunca cacheia.
  if (url.pathname.startsWith('/api/')) return;

  // Assets estáticos: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/sounds/')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached))
    );
    return;
  }

  // Documento HTML: network-first, fallback cache.
  if (req.mode === 'navigate' || (req.headers.get('Accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put('/', clone)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match('/'))
    );
    return;
  }
});
