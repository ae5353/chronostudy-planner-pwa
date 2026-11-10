// src/app.js — Main Application Bootstrap for ChronoStudy
import { ChronoUI } from './ui.js';

// Global cache purge and force-reload utility for mobile PWAs and tablets
if (typeof window !== 'undefined') {
  window.forceUpdateApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Cache purge issue:', e);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('reload', Date.now().toString());
    window.location.href = url.toString();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI
  window.chronoUI = new ChronoUI();

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
