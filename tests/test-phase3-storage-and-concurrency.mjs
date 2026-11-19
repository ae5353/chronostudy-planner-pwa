// tests/test-phase3-storage-and-concurrency.mjs — Verification for IndexedDB persistence, quota fallback, tombstone compaction, and Drive/Supabase concurrency retries
import { strict as assert } from 'node:assert';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) { return storageMap.has(k) ? storageMap.get(k) : null; },
  setItem(k, v) { storageMap.set(k, String(v)); },
  removeItem(k) { storageMap.delete(k); },
  clear() { storageMap.clear(); }
};

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'Node Test' },
  configurable: true
});

/** Lightweight in-memory IndexedDB fake implementing open, objectStoreNames, transaction, put, get */
function createFakeIndexedDB() {
  const stores = new Map();
  const makeRequest = (fn) => {
    const req = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = fn();
        if (req.onsuccess) req.onsuccess({ target: req });
      } catch (err) {
        if (req.onerror) req.onerror({ target: req });
      }
    });
    return req;
  };

  return {
    _stores: stores,
    open(name, version) {
      const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      const db = {
        name,
        version,
        objectStoreNames: {
          contains(sName) { return stores.has(sName); }
        },
        createObjectStore(sName) {
          if (!stores.has(sName)) stores.set(sName, new Map());
          return {};
        },
        transaction(sName) {
          const tx = {
            oncomplete: null,
            onerror: null,
            objectStore() {
              if (!stores.has(sName)) stores.set(sName, new Map());
              const map = stores.get(sName);
              return {
                put(val) {
                  const r = makeRequest(() => {
                    map.set(val.id, structuredClone(val));
                    queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete({}); });
                    return val.id;
                  });
                  return r;
                },
                get(key) {
                  const r = makeRequest(() => {
                    const found = map.has(key) ? structuredClone(map.get(key)) : undefined;
                    queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete({}); });
                    return found;
                  });
                  return r;
                }
              };
            }
          };
          return tx;
        }
      };
      req.result = db;
      queueMicrotask(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }
  };
}

const { StorageAdapter, STORAGE_KEY } = await import('../src/state/storage.js');
const { compactTombstones } = await import('../src/domain/sync-merge.js');
const { LEGACY_SEED_TASK_IDS } = await import('../src/domain/presets.js');
const { store } = await import('../src/store.js');
const { syncManager } = await import('../src/sync.js');

console.log('Testing Phase 3 IndexedDB, Tombstone Compaction, Concurrency & Types...\n');

// 1. StorageAdapter normal IndexedDB write & QuotaExceededError compact boot pointer fallback + hydration
const fakeIDB = createFakeIndexedDB();
{
  const lsData = new Map();
  let simulateFullOnLargeWrite = false;
  const flakyLS = {
    getItem(k) { return lsData.has(k) ? lsData.get(k) : null; },
    setItem(k, v) {
      if (simulateFullOnLargeWrite && String(v).length > 350) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      lsData.set(k, String(v));
    },
    removeItem(k) { lsData.delete(k); }
  };

  const adapter = new StorageAdapter({ localStorageRef: flakyLS, indexedDBRef: fakeIDB });
  const richWorkspace = {
    version: 12,
    tasks: [{ id: 'task-big-1', title: 'Large Workspace Item ' + 'x'.repeat(400), completed: false, recurrence: 'none' }],
    sessions: [],
    subjects: [],
    weeklyEvents: [],
    groups: ['İTÜ Courses (Fall 2026)'],
    settings: { theme: 'oled', fontStyle: 'mono', timerStyle: 'chronograph', layoutFormat: 'desktop' },
    activeTimer: { isRunning: false, mode: 'stopwatch', targetSec: 1500, elapsedSec: 0 },
    sync: { provider: 'gdrive' }
  };

  simulateFullOnLargeWrite = true;
  adapter.write(richWorkspace);
  await adapter.flush();

  const pointer = JSON.parse(flakyLS.getItem(STORAGE_KEY));
  assert.equal(pointer.idbBacked, true, 'On QuotaExceededError, localStorage must keep compact idbBacked boot pointer');
  assert.equal(pointer.settings.theme, 'oled', 'Boot pointer must preserve theme for instant FOUC prevention');
  assert.equal(pointer.tasks, undefined, 'Compact pointer must omit heavy tasks array');

  const hydrated = await adapter.hydrateFromIndexedDB();
  assert(hydrated && Array.isArray(hydrated.tasks), 'hydrateFromIndexedDB must recover full workspace');
  assert.equal(hydrated.tasks[0].id, 'task-big-1', 'Recovered workspace from IndexedDB must match saved task');
  console.log('✔ StorageAdapter IndexedDB write, QuotaExceededError compact fallback & hydration verified.');
}

// 2. Tombstone compaction (90-day cutoff + protected legacy IDs)
{
  const nowMs = Date.parse('2026-11-20T12:00:00.000Z');
  const oldIso = new Date(nowMs - 100 * 86400000).toISOString();
  const recentIso = new Date(nowMs - 10 * 86400000).toISOString();

  const testState = {
    deletedTaskIds: {
      [LEGACY_SEED_TASK_IDS[0]]: oldIso,
      'task-old-1': oldIso,
      'task-recent-1': recentIso
    },
    deletedSessionIds: {
      'sess-eef211-1': oldIso,
      'sess-old-1': oldIso,
      'sess-recent-1': recentIso
    },
    deletedSubjectIds: { 'sub-old-1': oldIso },
    deletedWeeklyEventIds: { 'ev-recent-1': recentIso },
    deletedGroups: { 'OldGroup': oldIso }
  };

  const removed = compactTombstones(testState, { maxAgeDays: 90, now: nowMs });
  assert.equal(removed, 4, 'Should prune exactly 4 expired non-protected tombstones');
  assert(testState.deletedTaskIds[LEGACY_SEED_TASK_IDS[0]], 'Protected legacy seed task tombstone must survive compaction');
  assert(testState.deletedSessionIds['sess-eef211-1'], 'Protected legacy session tombstone must survive compaction');
  assert(!testState.deletedTaskIds['task-old-1'], 'Old task tombstone >90d must be pruned');
  assert(testState.deletedTaskIds['task-recent-1'], 'Recent task tombstone <90d must stay');
  assert(!testState.deletedSessionIds['sess-old-1']);
  assert(testState.deletedSessionIds['sess-recent-1']);
  assert(!testState.deletedSubjectIds['sub-old-1']);
  assert(testState.deletedWeeklyEventIds['ev-recent-1']);
  assert(!testState.deletedGroups['OldGroup']);
  console.log('✔ 90-day tombstone compaction & legacy tombstone preservation verified.');
}

// 3. Google Drive optimistic concurrency retry on modifiedTime mismatch
const savedFetch = globalThis.fetch;
try {
  let metaCalls = 0;
  let patchCalls = 0;
  let downloadCalls = 0;

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    if (u.includes('userinfo')) {
      return { ok: true, json: async () => ({ email: 'tester@example.com' }) };
    }
    if (u.includes('/drive/v3/files?q=')) {
      return {
        ok: true,
        json: async () => ({
          files: [{ id: 'drive-file-1', name: 'chronostudy_sync.json', modifiedTime: '2026-11-20T00:00:00Z' }]
        })
      };
    }
    if (u.includes('/drive/v3/files/drive-file-1?alt=media')) {
      downloadCalls++;
      const remoteTask = downloadCalls === 1
        ? { id: 't-drive-1', title: 'Initial Remote Task', updatedAt: '2026-11-20T00:00:00Z' }
        : { id: 't-drive-2', title: 'Concurrent Drive Task', updatedAt: '2026-11-20T00:01:00Z' };
      return {
        ok: true,
        text: async () => JSON.stringify({ version: 12, tasks: [remoteTask], sessions: [] })
      };
    }
    if (u.includes('/drive/v3/files/drive-file-1?fields=id,modifiedTime')) {
      metaCalls++;
      // Simulate concurrent remote write detected on first pre-PATCH metadata check
      const mTime = metaCalls === 1 ? '2026-11-20T00:01:00Z' : '2026-11-20T00:01:00Z';
      return { ok: true, json: async () => ({ id: 'drive-file-1', modifiedTime: mTime }) };
    }
    if (u.includes('/upload/drive/v3/files/drive-file-1') && method === 'PATCH') {
      patchCalls++;
      return { ok: true, json: async () => ({ id: 'drive-file-1', modifiedTime: '2026-11-20T00:02:00Z' }) };
    }
    throw new Error(`Unexpected Drive fetch URL: ${method} ${u}`);
  };

  syncManager.gdriveAccessToken = 'mock-gdrive-token';
  syncManager.gdriveTokenExpiry = Date.now() + 3600000;
  await syncManager.syncGoogleDrive({
    provider: 'gdrive',
    googleClientId: '12345.apps.googleusercontent.com',
    googleUserEmail: 'tester@example.com',
    passphrase: ''
  });

  assert.equal(downloadCalls, 2, 'Drive conflict must trigger re-download before retry');
  assert.equal(patchCalls, 1, 'Drive PATCH should execute once modifiedTime stabilized');
  assert(store.getState().tasks.some((t) => t.id === 't-drive-2'), 'Concurrent remote Drive task must be merged before upload');
  console.log('✔ Google Drive modifiedTime optimistic concurrency retry verified.');

  // 4. Supabase conditional PATCH optimistic concurrency retry + x-room-secret header
  let supaGetCalls = 0;
  let supaPatchCalls = 0;
  let capturedSecretHeader = null;

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    capturedSecretHeader = opts.headers?.['x-room-secret'] || null;

    if (method === 'GET' && u.includes('/rest/v1/chronostudy_sync?room_id=eq.')) {
      supaGetCalls++;
      const payloadObj = supaGetCalls === 1
        ? { version: 12, tasks: [], sessions: [] }
        : { version: 12, tasks: [{ id: 't-supa-race', title: 'Concurrent Supa Task', updatedAt: '2026-11-20T00:05:00Z' }], sessions: [] };
      return {
        ok: true,
        json: async () => [{
          room_id: 'itu-room-99',
          updated_at: supaGetCalls === 1 ? '2026-11-20T00:04:00Z' : '2026-11-20T00:05:00Z',
          payload: JSON.stringify(payloadObj)
        }]
      };
    }

    if (method === 'PATCH' && u.includes('updated_at=eq.')) {
      supaPatchCalls++;
      if (supaPatchCalls === 1) {
        // Empty array simulates optimistic lock miss because another device bumped updated_at
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => [{ room_id: 'itu-room-99', updated_at: '2026-11-20T00:06:00Z' }] };
    }

    throw new Error(`Unexpected Supabase fetch URL: ${method} ${u}`);
  };

  await syncManager.syncSupabase({
    provider: 'supabase',
    supabaseUrl: 'https://demo.supabase.co',
    supabaseKey: 'anon-test-key',
    supabaseRoomId: 'itu-room-99',
    passphrase: 'secret-room-passphrase'
  });

  assert.equal(supaGetCalls, 2, 'Supabase optimistic lock miss must trigger re-fetch & re-merge');
  assert.equal(supaPatchCalls, 2, 'Supabase conditional PATCH must retry and succeed on attempt 2');
  assert.match(String(capturedSecretHeader), /^[0-9a-f]{64}$/, 'x-room-secret header must carry SHA-256 hex digest (not raw passphrase)');
  assert(store.getState().tasks.some((t) => t.id === 't-supa-race'), 'Concurrent Supabase task must be merged into local store');
  console.log('✔ Supabase conditional PATCH retry & x-room-secret SHA-256 header verified.');
} finally {
  globalThis.fetch = savedFetch;
}

// 5. Type config, CI workflow & SW v37 checks
assert(fs.existsSync(path.join(rootDir, 'jsconfig.json')), 'jsconfig.json must exist');
assert(fs.existsSync(path.join(rootDir, 'src', 'types.js')), 'src/types.js must exist');
assert(fs.existsSync(path.join(rootDir, '.github', 'workflows', 'ci.yml')), '.github/workflows/ci.yml must exist');
const swSrc = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(swSrc.includes('./src/state/storage.js'), 'sw.js must cache ./src/state/storage.js');

console.log('\n✔ All Phase 3 IndexedDB, concurrency, compaction, and CI tests passed!');
