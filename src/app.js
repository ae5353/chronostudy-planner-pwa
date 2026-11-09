// src/app.js — Main Application Bootstrap for ChronoStudy
import { ChronoUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI
  window.chronoUI = new ChronoUI();

  // Register PWA service worker if supported
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('ChronoStudy ServiceWorker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.log('ServiceWorker registration skipped or failed:', err);
      });
  }
});
