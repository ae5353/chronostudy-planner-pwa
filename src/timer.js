// src/timer.js — High-Precision Study Timer Engine with Background Resilience & Zen Mode
import { store } from './store.js';
import { playCompletionChime } from './audio.js';

class StudyTimer {
  constructor() {
    this.intervalId = null;
    this.listeners = new Set();
    this.sessionStartTime = null;

    // Load active state from store
    const state = store.getState().activeTimer || {};
    this.mode = state.mode || 'stopwatch'; // 'stopwatch' | 'countdown'
    this.targetSec = state.targetSec || 1500;
    this.elapsedSec = state.elapsedSec || 0;
    this.isRunning = false;
    this.subject = state.subject || 'Circuit Analysis';
    this.topic = state.topic || '';
    this.linkedTaskId = state.linkedTaskId || null;
    this.draftNotes = state.draftNotes || '';
    this.isZenMode = state.isZenMode || false;
    this.sessionStartTime = state.startedAt ? new Date(state.startedAt) : null;

    // If it was running before page reload, resume with calculated delta since LAST TICK
    // (Prevents doubling elapsedSec or adding full session duration on Ctrl+R)
    if (state.isRunning) {
      if (state.lastTickAt) {
        const offlineDeltaSec = Math.max(0, Math.floor((Date.now() - new Date(state.lastTickAt).getTime()) / 1000));
        // Add offline seconds if reasonable (e.g. up to 24h)
        if (offlineDeltaSec > 0 && offlineDeltaSec < 86400) {
          this.elapsedSec = (state.elapsedSec || 0) + offlineDeltaSec;
        }
      }
      this.start(false);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const flushState = () => {
        store.updateActiveTimer({
          mode: this.mode,
          targetSec: this.targetSec,
          elapsedSec: this.elapsedSec,
          isRunning: this.isRunning,
          startedAt: this.sessionStartTime ? this.sessionStartTime.toISOString() : null,
          lastTickAt: new Date().toISOString(),
          subject: this.subject,
          topic: this.topic,
          linkedTaskId: this.linkedTaskId,
          draftNotes: this.draftNotes,
          isZenMode: this.isZenMode
        }, { forceSave: true });
      };
      window.addEventListener('beforeunload', flushState);
      window.addEventListener('pagehide', flushState);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify(forceSave = false) {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Timer listener error:', err);
      }
    }
    // Update store periodically
    store.updateActiveTimer({
      mode: this.mode,
      targetSec: this.targetSec,
      elapsedSec: this.elapsedSec,
      isRunning: this.isRunning,
      startedAt: this.sessionStartTime ? this.sessionStartTime.toISOString() : null,
      lastTickAt: new Date().toISOString(),
      subject: this.subject,
      topic: this.topic,
      linkedTaskId: this.linkedTaskId,
      draftNotes: this.draftNotes,
      isZenMode: this.isZenMode
    }, { forceSave });
  }

  getState() {
    const remainingSec = this.mode === 'countdown' ? Math.max(0, this.targetSec - this.elapsedSec) : 0;
    const progress = this.mode === 'countdown'
      ? Math.min(1, this.elapsedSec / (this.targetSec || 1))
      : 0;

    return {
      mode: this.mode,
      isRunning: this.isRunning,
      elapsedSec: this.elapsedSec,
      remainingSec,
      targetSec: this.targetSec,
      progress,
      formattedTime: this.formatTime(),
      subject: this.subject,
      topic: this.topic,
      linkedTaskId: this.linkedTaskId,
      draftNotes: this.draftNotes,
      isZenMode: this.isZenMode,
      hasFinishedCountdown: this.mode === 'countdown' && this.elapsedSec >= this.targetSec
    };
  }

  toggleZenMode(forceState = null) {
    this.isZenMode = forceState !== null ? forceState : !this.isZenMode;
    this.notify();
    return this.isZenMode;
  }

  setMode(mode) {
    if (this.isRunning) return;
    this.mode = mode;
    this.elapsedSec = 0;
    this.notify();
  }

  setTargetMinutes(minutes) {
    if (this.isRunning) return;
    this.targetSec = Math.max(1, minutes) * 60;
    this.elapsedSec = 0;
    this.notify();
  }

  setContext({ subject, topic, linkedTaskId }) {
    if (subject !== undefined) this.subject = subject;
    if (topic !== undefined) this.topic = topic;
    if (linkedTaskId !== undefined) this.linkedTaskId = linkedTaskId;
    this.notify();
  }

  setDraftNotes(notes) {
    this.draftNotes = notes;
    store.updateActiveTimer({ draftNotes: notes });
  }

  start(isNewStart = true) {
    if (this.isRunning) return;

    if (isNewStart || !this.sessionStartTime) {
      this.sessionStartTime = new Date();
    }

    this.isRunning = true;
    let lastTick = Date.now();

    this.intervalId = setInterval(() => {
      const now = Date.now();
      const stepSec = Math.floor((now - lastTick) / 1000);
      if (stepSec >= 1) {
        this.elapsedSec += stepSec;
        lastTick = now;

        // Check countdown completion
        if (this.mode === 'countdown' && this.elapsedSec >= this.targetSec) {
          this.pause();
          const settings = store.getState().settings;
          if (settings.soundEnabled) {
            playCompletionChime();
          }
        }

        this.notify(false);
      }
    }, 250);

    this.notify(true);
  }

  pause() {
    if (!this.isRunning) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.notify(true);
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    this.pause();
    this.elapsedSec = 0;
    this.sessionStartTime = null;
    this.notify(true);
  }

  finishSession() {
    this.pause();
    const durationSec = this.elapsedSec;
    const now = new Date();
    const start = this.sessionStartTime || new Date(now.getTime() - durationSec * 1000);

    const sessionData = {
      subject: this.subject,
      topic: this.topic || 'Focused Study Session',
      taskId: this.linkedTaskId,
      durationSec,
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      notes: this.draftNotes
    };

    // Reset active session state
    this.elapsedSec = 0;
    this.sessionStartTime = null;
    this.draftNotes = '';
    this.isZenMode = false;
    this.notify(true);

    return sessionData;
  }

  formatTime() {
    const totalSec = this.mode === 'countdown'
      ? Math.max(0, this.targetSec - this.elapsedSec)
      : this.elapsedSec;

    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }
}

export const timer = new StudyTimer();
