const CACHE = 'blowupsocials-v8';

// Only cache true static assets — never HTML pages
const STATIC = [
  '/js/supabase.min.js',
  '/img/logo.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Always fetch fresh: HTML pages, API calls, Supabase
  if (
    e.request.mode === 'navigate' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase')
  ) return;

  // Cache-first for static assets only
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
