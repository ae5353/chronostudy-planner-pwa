// src/app.js — Main Application Bootstrap for ChronoStudy
import { ChronoUI } from './ui.js';

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
