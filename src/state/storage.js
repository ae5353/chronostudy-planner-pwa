// @ts-check
// src/state/storage.js — Dual IndexedDB + fast-boot localStorage storage adapter

export const DB_NAME = 'chronostudy_db';
export const DB_VERSION = 1;
export const WORKSPACE_STORE = 'workspace';
export const BACKUPS_STORE = 'backups';
export const STORAGE_KEY = 'chronostudy_v3_state';
export const BACKUP_STORAGE_KEY = 'chronostudy_pre_sync_backup';

export class StorageAdapter {
  /**
   * @param {{ localStorageRef?: any, indexedDBRef?: any }} [deps]
   */
  constructor(deps = {}) {
    this._injectedLocalStorage = deps.localStorageRef;
    this._hasInjectedLocalStorage = Object.prototype.hasOwnProperty.call(deps, 'localStorageRef');
    this._injectedIndexedDB = deps.indexedDBRef;
    this._hasInjectedIndexedDB = Object.prototype.hasOwnProperty.call(deps, 'indexedDBRef');
    this._dbPromise = null;
    this._writeChain = Promise.resolve();
  }

  get _localStorage() {
    if (this._hasInjectedLocalStorage) return this._injectedLocalStorage;
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  }

  get _indexedDB() {
    if (this._hasInjectedIndexedDB) return this._injectedIndexedDB;
    return typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined;
  }

  /**
   * Synchronous fast-boot read from localStorage.
   * May return null or a compact `{ idbBacked: true, ... }` boot pointer if quota exceeded.
   * @returns {any | null}
   */
  readSync() {
    try {
      if (!this._localStorage) return null;
      const serialized = this._localStorage.getItem(STORAGE_KEY);
      if (!serialized) return null;
      return JSON.parse(serialized);
    } catch (err) {
      console.warn('Failed to parse localStorage workspace state:', err);
      return null;
    }
  }

  /**
   * Opens or initializes the IndexedDB database.
   * @returns {Promise<any | null>}
   */
  openDB() {
    if (!this._indexedDB) return Promise.resolve(null);
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve) => {
      try {
        const req = this._indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
            db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
            db.createObjectStore(BACKUPS_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this._dbPromise = null;
          resolve(null);
        };
      } catch (err) {
        this._dbPromise = null;
        resolve(null);
      }
    });

    return this._dbPromise;
  }

  /**
   * @param {string} storeName
   * @param {'readonly' | 'readwrite'} mode
   * @param {(store: any) => any} op
   * @returns {Promise<any>}
   */
  async _withStore(storeName, mode, op) {
    const db = await this.openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, mode);
        const objStore = tx.objectStore(storeName);
        const req = op(objStore);
        let reqResult;
        if (req && typeof req === 'object') {
          req.onsuccess = () => { reqResult = req.result; };
          req.onerror = () => resolve(null);
        }
        tx.oncomplete = () => resolve(reqResult !== undefined ? reqResult : null);
        tx.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  /**
   * Mirrors state to localStorage synchronously (falling back to compact boot pointer on QuotaExceededError)
   * and queues an ordered asynchronous write to IndexedDB.
   * @param {any} state
   * @returns {string} ISO timestamp when persisted
   */
  write(state) {
    const savedAt = new Date().toISOString();
    const snapshot = structuredClone(state);
    snapshot.savedAt = savedAt;

    if (this._localStorage) {
      try {
        this._localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (err) {
        // Fallback: store compact boot pointer so theme/timer/sync metadata still boot synchronously
        const compactPointer = {
          idbBacked: true,
          version: snapshot.version || 12,
          savedAt,
          settings: snapshot.settings,
          activeTimer: snapshot.activeTimer,
          sync: snapshot.sync
        };
        try {
          this._localStorage.setItem(STORAGE_KEY, JSON.stringify(compactPointer));
        } catch (_) {}
      }
    }

    if (this._indexedDB) {
      this._writeChain = this._writeChain.then(() =>
        this._withStore(WORKSPACE_STORE, 'readwrite', (objStore) =>
          objStore.put({ id: 'current', savedAt, state: snapshot })
        )
      ).catch(() => {});
    }

    return savedAt;
  }

  /**
   * Awaits any pending asynchronous IndexedDB writes.
   * @returns {Promise<void>}
   */
  flush() {
    return this._writeChain;
  }

  /**
   * Returns fuller/newer workspace state from IndexedDB if available and needed.
   * @returns {Promise<any | null>}
   */
  async hydrateFromIndexedDB() {
    await this.flush();
    const idbRecord = await this._withStore(WORKSPACE_STORE, 'readonly', (objStore) => objStore.get('current'));
    if (!idbRecord || !idbRecord.state) return null;

    const localRecord = this.readSync();
    if (!localRecord || localRecord.idbBacked === true) {
      return idbRecord.state;
    }

    const idbMs = idbRecord.savedAt ? new Date(idbRecord.savedAt).getTime() : 0;
    const localMs = localRecord.savedAt ? new Date(localRecord.savedAt).getTime() : 0;
    if (idbMs > localMs) {
      return idbRecord.state;
    }

    return null;
  }

  /**
   * Stores pre-sync safety backup synchronously to localStorage and async to IndexedDB.
   * @param {any} payload
   */
  saveBackup(payload) {
    const cloned = structuredClone(payload);
    if (this._localStorage) {
      try {
        this._localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(cloned));
      } catch (_) {}
    }
    if (this._indexedDB) {
      this._writeChain = this._writeChain.then(() =>
        this._withStore(BACKUPS_STORE, 'readwrite', (objStore) =>
          objStore.put({ id: 'pre_sync', ...cloned })
        )
      ).catch(() => {});
    }
  }

  /**
   * Synchronous read of safety backup from localStorage.
   * @returns {any | null}
   */
  readBackupSync() {
    try {
      if (!this._localStorage) return null;
      const raw = this._localStorage.getItem(BACKUP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Asynchronous read of safety backup checking localStorage then IndexedDB.
   * @returns {Promise<any | null>}
   */
  async readBackupAsync() {
    const syncBackup = this.readBackupSync();
    if (syncBackup && syncBackup.state) return syncBackup;
    await this.flush();
    return this._withStore(BACKUPS_STORE, 'readonly', (objStore) => objStore.get('pre_sync'));
  }
}
