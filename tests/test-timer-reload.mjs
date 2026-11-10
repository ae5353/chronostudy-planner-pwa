// tests/test-timer-reload.mjs — Test timer persistence across Ctrl+R reloads
import assert from 'node:assert';

// Mock localStorage and Audio
const storage = {};
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

console.log('Testing StudyTimer persistence across page reloads (Ctrl+R)...');

// Set up activeTimer state as if user was studying for 120 seconds, and page refreshed 1 second ago
const sessionStartTime = new Date(Date.now() - 120000).toISOString();
const lastTickAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago

storage['chronostudy_v3_state'] = JSON.stringify({
  courses: [],
  subjects: [],
  tasks: [],
  history: [],
  settings: {},
  activeTimer: {
    mode: 'stopwatch',
    targetSec: 1500,
    elapsedSec: 120, // 2 minutes already elapsed
    isRunning: true,
    startedAt: sessionStartTime,
    lastTickAt: lastTickAt,
    subject: 'Circuit Analysis',
    topic: 'Midterm 1',
    linkedTaskId: null,
    draftNotes: '',
    isZenMode: false
  }
});

// Import store & timer
const { store } = await import('../src/store.js');
const { timer } = await import('../src/timer.js');

const state = timer.getState();
console.log(`Initial resumed elapsedSec: ${state.elapsedSec}s (expected ~121s, NOT 240s!)`);

// With the old bug, elapsedSec would be 120 + 120 = 240s!
// With our fix, elapsedSec should be 120 + 1 = 121s (within +/- 1s of 121)
assert(state.elapsedSec >= 120 && state.elapsedSec <= 122,
  `Expected elapsedSec to be ~121s on reload, got ${state.elapsedSec}s!`);

timer.pause();

console.log('✔ StudyTimer Ctrl+R reload accuracy test passed! Zero drift, no 2-minute jumps.\n');
