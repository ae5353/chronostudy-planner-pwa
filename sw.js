// sw.js — Service Worker for Offline PWA Capabilities (Network-First with Cache Fallback)
const CACHE_NAME = 'chronostudy-clean-v40';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './src/styles.css',
  './src/styles/tokens.css',
  './src/styles/base.css',
  './src/styles/layout.css',
  './src/styles/timer.css',
  './src/styles/tasks.css',
  './src/styles/planner.css',
  './src/styles/courses-analytics.css',
  './src/styles/modals-sync.css',
  './src/styles/responsive.css',
  './src/styles/overrides.css',
  './src/app.js',
  './src/audio.js',
  './src/store.js',
  './src/timer.js',
  './src/sync.js',
  './src/wakelock.js',
  './src/ui.js',
  './src/domain/date-utils.js',
  './src/domain/presets.js',
  './src/domain/recurrence.js',
  './src/domain/reconcile.js',
  './src/domain/analytics.js',
  './src/domain/sync-merge.js',
  './src/domain/exporters.js',
  './src/state/storage.js',
  './src/state/store.js',
  './src/ui/dom-utils.js',
  './src/ui/modals.js',
  './src/ui/timer-view.js',
  './src/ui/tasks-view.js',
  './src/ui/planner-view.js',
  './src/ui/courses-view.js',
  './src/ui/analytics-view.js',
  './src/ui/sync-view.js',
  './src/ui/theme-view.js'
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

  // Bypass service worker cache for cross-origin APIs (Google Drive, GIS, Supabase, Fonts)
  if (url.origin !== self.location.origin) {
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
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
