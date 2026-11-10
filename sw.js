// sw.js — Service Worker for Offline PWA Capabilities (Network-First with Cache Fallback)
const CACHE_NAME = 'chronostudy-clean-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './src/styles.css',
  './src/app.js',
  './src/store.js',
  './src/timer.js',
  './src/ui.js',
  './src/audio.js',
  './src/sync.js',
  './src/wakelock.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass service worker cache for external APIs (Google Drive, GIS, Supabase)
  if (
    url.origin.includes('googleapis.com') ||
    url.origin.includes('google.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('supabase.co')
  ) {
    return;
  }

  // Network-First strategy: always fetch fresh from network if online; fallback to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return null;
        });
      })
  );
});
