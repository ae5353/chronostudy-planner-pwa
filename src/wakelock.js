// src/wakelock.js — High-Reliability Screen Wake Lock Engine for ChronoStudy
// Prevents screens from dimming, sleeping, or locking during study sessions & fullscreen

export class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    this.subscribers = new Set();
    this.fallbackVideo = null;
    this.checkCondition = null;

    if (typeof document !== 'undefined') {
      // Re-acquire lock if tab was backgrounded and brought back to foreground
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this.shouldBeActive()) {
          await this.acquire();
        }
      });

      // Fullscreen change listener
      document.addEventListener('fullscreenchange', async () => {
        if (document.fullscreenElement) {
          await this.acquire();
        } else if (!this.shouldBeActive()) {
          await this.release();
        }
      });
      document.addEventListener('webkitfullscreenchange', async () => {
        if (document.webkitFullscreenElement) {
          await this.acquire();
        } else if (!this.shouldBeActive()) {
          await this.release();
        }
      });
    }
  }

  setConditionChecker(fn) {
    this.checkCondition = fn;
  }

  shouldBeActive() {
    if (typeof this.checkCondition === 'function') {
      try {
        return Boolean(this.checkCondition());
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async acquire() {
    if (this.wakeLock) return true;

    if (this.isSupported) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          this.notify(false);
        });
        this.notify(true);
        return true;
      } catch (err) {
        console.warn('Screen WakeLock request failed:', err);
      }
    }

    // Fallback for browsers without native navigator.wakeLock:
    // Create an invisible, silent looping media element to prevent display sleep
    this.startFallback();
    this.notify(true);
    return true;
  }

  async release() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
    this.stopFallback();
    this.notify(false);
  }

  async update() {
    if (this.shouldBeActive()) {
      await this.acquire();
    } else {
      await this.release();
    }
  }

  startFallback() {
    if (this.fallbackVideo || typeof document === 'undefined') return;
    try {
      // Create a 1x1 blank canvas video stream as a standard WakeLock fallback
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillRect(0, 0, 1, 1);
        if (canvas.captureStream) {
          const stream = canvas.captureStream(1);
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          video.style.position = 'fixed';
          video.style.opacity = '0.001';
          video.style.pointerEvents = 'none';
          video.style.width = '1px';
          video.style.height = '1px';
          video.style.top = '-10px';
          document.body.appendChild(video);
          video.play().catch(() => {});
          this.fallbackVideo = video;
        }
      }
    } catch (e) {}
  }

  stopFallback() {
    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        if (this.fallbackVideo.srcObject) {
          const tracks = this.fallbackVideo.srcObject.getTracks();
          tracks.forEach((t) => t.stop());
        }
        if (this.fallbackVideo.parentNode) {
          this.fallbackVideo.parentNode.removeChild(this.fallbackVideo);
        }
      } catch (e) {}
      this.fallbackVideo = null;
    }
  }

  isActive() {
    return Boolean(this.wakeLock || this.fallbackVideo);
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    listener(this.isActive());
    return () => this.subscribers.delete(listener);
  }

  notify(active) {
    for (const listener of this.subscribers) {
      try {
        listener(active);
      } catch (e) {}
    }
  }
}

export const wakeLockManager = new WakeLockManager();
