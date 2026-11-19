// src/app.js — Main Application Bootstrap for ChronoStudy
import { store } from './store.js';
import { syncManager } from './sync.js';
import { ChronoUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI synchronously from fast boot cache, deferring cloud sync until IDB hydration
  window.chronoUI = new ChronoUI({ deferSyncInit: true });

  // Asynchronously hydrate full workspace from IndexedDB before launching background cloud sync
  store.hydrateFromIndexedDB()
    .catch((err) => {
      console.warn('IndexedDB hydration skipped:', err);
    })
    .finally(() => {
      syncManager.init();
    });

  // Register PWA service worker with auto-update
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        // Check for updates on load
        reg.update();
      })
      .catch((err) => {
        console.log('ServiceWorker registration skipped or failed:', err);
      });

    // Auto-refresh when a new service worker takes control so code is always up to date
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
});
