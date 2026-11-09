// tests/test-sync-controller.mjs — Comprehensive Unit Tests for SyncManager & Crypto
import { strict as assert } from 'node:assert';
import { webcrypto } from 'node:crypto';

// Provide global webcrypto for Node test runner
if (!global.crypto || !global.crypto.subtle) {
  global.crypto = webcrypto;
}

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; }
};

if (!globalThis.navigator) {
  globalThis.navigator = { onLine: true, userAgent: 'ChronoStudy Test' };
}

const { encryptPayload, decryptPayload, syncManager } = await import('../src/sync.js');
const { store } = await import('../src/store.js');

console.log('Testing ChronoStudy Sync Controller & End-to-End Encryption...\n');

// 1. Unencrypted serialization when passphrase is omitted
const testObj = { hello: 'world', count: 42, timestamp: new Date().toISOString() };
const plainJson = await encryptPayload(testObj, '');
assert.equal(typeof plainJson, 'string');
const decryptedPlain = await decryptPayload(plainJson, '');
assert.deepEqual(decryptedPlain, testObj, 'Plain JSON serialization must match original');
console.log('✔ Plain serialization and parsing verified.');

// 2. AES-GCM Encrypted serialization with secret passphrase
const passphrase = 'itu-secret-study-passphrase-2026';
const encryptedText = await encryptPayload(testObj, passphrase);
assert(encryptedText.includes('"isEncrypted":true'), 'Encrypted output must mark isEncrypted flag');
assert(!encryptedText.includes('world'), 'Ciphertext must never expose plaintext strings');

const decryptedObj = await decryptPayload(encryptedText, passphrase);
assert.deepEqual(decryptedObj, testObj, 'Decrypted object must match original payload exactly');
console.log('✔ AES-GCM 256-bit PBKDF2 encryption & decryption verified.');

// 3. Decryption failure on incorrect passphrase
let threw = false;
try {
  await decryptPayload(encryptedText, 'wrong-password-xyz');
} catch (e) {
  threw = true;
}
assert(threw, 'Decryption must fail with an incorrect passphrase');
console.log('✔ Authentication tag verification & wrong passphrase rejection verified.');

// 4. Device ID & Status Generation
const status = syncManager.getStatus();
assert(status.deviceId && status.deviceId.startsWith('device-'), 'Device ID must be generated with prefix');
assert.equal(status.isOnline, true, 'Online state must be detected');
console.log('✔ Device ID & status reporting verified.');

// 5. Offline snapshot export & import with additive merging
const exported = syncManager.exportSnapshotJSON();
assert(exported.includes('"version"'), 'Exported snapshot must contain version');

const remoteSnapshot = {
  version: 12,
  subjects: [
    { id: 'sub-new-cloud-course', name: 'Microprocessor Systems', group: 'EEF Fall 2026', color: '#10b981', targetHours: 35, updatedAt: new Date().toISOString() }
  ],
  tasks: [
    { id: 'task-cloud-import-1', title: 'Read ARM Architecture Manual', subject: 'Microprocessor Systems', done: false, targetMinutes: 60, updatedAt: new Date().toISOString() }
  ],
  sessions: [
    { id: 'sess-cloud-import-1', subject: 'Microprocessor Systems', topic: 'Registers & ALU', durationSec: 2400, startTime: new Date().toISOString(), endTime: new Date().toISOString() }
  ]
};

const importRes = await syncManager.importSnapshotJSON(JSON.stringify(remoteSnapshot));
assert(importRes.success, 'Snapshot import must succeed');
assert(store.getState().subjects.some(s => s.id === 'sub-new-cloud-course'), 'Imported subject must exist in store');
assert(store.getState().tasks.some(t => t.id === 'task-cloud-import-1'), 'Imported task must exist in store');
assert(store.getState().sessions.some(s => s.id === 'sess-cloud-import-1'), 'Imported session must exist in store');
console.log('✔ Offline snapshot import & additive merge verified.');

// 6. Google Drive Provider Configuration & State
store.updateSyncSettings({
  provider: 'gdrive',
  googleClientId: 'test-client-id-1234.apps.googleusercontent.com',
  googleUserEmail: 'student@itu.edu.tr'
});
const gdriveStatus = syncManager.getStatus();
assert.equal(gdriveStatus.provider, 'gdrive', 'Provider should be gdrive');
assert.equal(gdriveStatus.googleClientId, 'test-client-id-1234.apps.googleusercontent.com');
assert.equal(gdriveStatus.googleUserEmail, 'student@itu.edu.tr');
assert.equal(syncManager.isConfigured(), true, 'Google Drive should be configured when client ID is provided');

syncManager.disconnectGoogleDrive();
const disconnectedStatus = syncManager.getStatus();
assert.equal(disconnectedStatus.googleUserEmail, null, 'Email should be cleared on disconnect');
console.log('✔ Google Drive provider settings & disconnect verified.');

console.log('\nAll Sync Controller unit tests passed successfully! 🚀');
