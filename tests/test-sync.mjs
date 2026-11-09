// tests/test-sync.mjs — Comprehensive Unit Tests for ChronoStudy Sync Engine & Conflict Resolution
import { strict as assert } from 'node:assert';

// Mock localStorage for Node test environment
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; }
};

const { store } = await import('../src/store.js');

console.log('Testing ChronoStudy Cloud Synchronization & Conflict Resolution Engine...\n');

// 1. Outbox & Unsynced Entity Tracking
const task1 = store.addTask({
  title: 'Local Phone Task (Offline)',
  subject: 'Circuit Analysis',
  targetMinutes: 45
});
assert(task1 && task1.id, 'Task must be created');
assert.equal(task1.synced, false, 'New local task must start as unsynced');
assert(task1.updatedAt, 'Task must carry an updatedAt timestamp');

const unsynced = store.getUnsyncedChanges();
assert(unsynced.hasChanges, 'Store must report unsynced changes');
assert(unsynced.tasks.some(t => t.id === task1.id), 'Task1 must be in unsynced tasks queue');
console.log('✔ Local-first outbox tracking verified.');

// 2. Mark Synced Acknowledgment
const syncTime = new Date().toISOString();
store.markRecordsSynced(syncTime);
const postSync = store.getUnsyncedChanges();
assert.equal(postSync.hasChanges, false, 'Unsynced changes must be cleared after acknowledgment');
assert.equal(store.getState().sync.status, 'synced', 'Sync status should be marked as synced');
assert.equal(store.getState().sync.lastSyncedAt, syncTime, 'lastSyncedAt must match sync timestamp');
console.log('✔ Sync acknowledgment & status tracking verified.');

// 3. Safety Backup Snapshots (Zero Data Loss Protection)
store.createSafetyBackup();
const savedSnapshot = global.localStorage.getItem('chronostudy_pre_sync_backup');
assert(savedSnapshot, 'Pre-sync safety backup snapshot must be stored in localStorage');
const parsedSnapshot = JSON.parse(savedSnapshot);
assert(parsedSnapshot.state && parsedSnapshot.backupAt, 'Snapshot must contain valid state & timestamp');

// Modify state and test restore
store.addTask({ title: 'Temporary Corrupt Task' });
const restoreRes = store.restoreSafetyBackup();
assert(restoreRes.success, 'Restore safety backup must succeed');
assert(!store.getState().tasks.some(t => t.title === 'Temporary Corrupt Task'), 'Restored state must not contain corrupt task');
console.log('✔ Pre-sync safety snapshot creation and rollback verified.');

// 4. Additive Study Session Merging (Zero loss across multiple devices)
const initialSessionCount = store.getState().sessions.length;
const remoteSessionId = 'sess-device-laptop-' + Date.now();
const remotePayload = {
  version: 12,
  sessions: [
    {
      id: remoteSessionId,
      subject: 'Data Structures',
      topic: 'Binary Search Tree Balancing on Laptop',
      durationSec: 3600,
      startTime: '2026-11-10T14:00:00.000Z',
      endTime: '2026-11-10T15:00:00.000Z',
      notes: 'Completed AVL rotations',
      createdAt: '2026-11-10T15:00:00.000Z',
      updatedAt: '2026-11-10T15:00:00.000Z'
    }
  ],
  tasks: []
};

const mergeResult = store.mergeRemoteState(remotePayload);
assert(mergeResult.success, 'Remote merge must succeed');
const mergedSessions = store.getState().sessions;
assert.equal(mergedSessions.length, initialSessionCount + 1, 'Remote session must be appended');
assert(mergedSessions.some(s => s.id === remoteSessionId), 'Remote session must exist in store');

// Test idempotency: syncing the same remote session again must NOT create duplicates
store.mergeRemoteState(remotePayload);
assert.equal(store.getState().sessions.length, initialSessionCount + 1, 'Duplicate session must not be created on second sync');
console.log('✔ Additive & idempotent session merging verified (zero session loss).');

// 5. Deterministic Task Conflict Resolution (Last-Write-Wins per record)
// Scenario: Device A has an existing task
const conflictTask = store.addTask({
  title: 'Circuit Analysis Problem Set 4',
  subject: 'Circuit Analysis',
  targetMinutes: 60
});
const localTimestamp = conflictTask.updatedAt;

// Simulate Remote Device B having modified the same task 10 minutes later with completion
const futureTime = new Date(new Date(localTimestamp).getTime() + 600000).toISOString();
const remoteTaskPayload = {
  version: 12,
  tasks: [
    {
      ...conflictTask,
      completed: true,
      completedAt: futureTime,
      updatedAt: futureTime
    }
  ]
};

store.mergeRemoteState(remoteTaskPayload);
const resolvedTask = store.getState().tasks.find(t => t.id === conflictTask.id);
assert.equal(resolvedTask.completed, true, 'Remote newer update must win conflict');
assert.equal(resolvedTask.updatedAt, futureTime, 'Task timestamp must be updated to remote');

// Simulate Remote Device having older update — Local must be preserved
const olderTime = new Date(new Date(localTimestamp).getTime() - 600000).toISOString();
const staleRemotePayload = {
  version: 12,
  tasks: [
    {
      ...conflictTask,
      title: 'Stale Overwrite Attempt',
      completed: false,
      updatedAt: olderTime
    }
  ]
};
store.mergeRemoteState(staleRemotePayload);
const keptTask = store.getState().tasks.find(t => t.id === conflictTask.id);
assert.equal(keptTask.title, 'Circuit Analysis Problem Set 4', 'Local newer state must NOT be overwritten by stale remote update');
console.log('✔ Deterministic Last-Write-Wins task conflict resolution verified.');

// 6. Schema Sanitization & Migration Safety
const legacyV10State = {
  version: 10,
  subjects: [
    { id: 'sub-legacy', name: 'Legacy Subject', color: '#ff0000' }
  ],
  tasks: [
    { id: 'task-legacy', title: 'Legacy Task' }
  ]
};

const migratedState = store.sanitizeState(legacyV10State);
assert.equal(migratedState.version, 12, 'Version must be migrated to 12');
assert(migratedState.sync, 'Sync configuration must be initialized');
assert(migratedState.tasks.find(t => t.id === 'task-legacy').updatedAt, 'Legacy task must receive updatedAt timestamp');
assert(migratedState.subjects.some(s => s.name.includes('Circuit Analysis')), 'Authentic subjects must be preserved');
console.log('✔ Forward schema migration safety verified.');

console.log('\nAll Cloud Synchronization & Conflict Resolution tests passed successfully! 🚀');
