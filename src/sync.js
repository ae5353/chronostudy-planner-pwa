// src/sync.js — Multi-Device Cloud Synchronization, Offline Outbox & Background Controller
import { store } from './store.js';
import { timer } from './timer.js';

/**
 * Lightweight End-to-End Encryption helper using Web Cryptography API (AES-GCM + PBKDF2)
 */
async function deriveKey(passphrase, salt) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(dataObj, passphrase) {
  if (!passphrase || !passphrase.trim()) {
    return JSON.stringify(dataObj);
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return JSON.stringify(dataObj);
  }
  try {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plaintext = enc.encode(JSON.stringify(dataObj));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    const packed = {
      isEncrypted: true,
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext))
    };
    return JSON.stringify(packed);
  } catch (err) {
    console.warn('Encryption failed, falling back to unencrypted transport:', err);
    return JSON.stringify(dataObj);
  }
}

export async function decryptPayload(serializedText, passphrase) {
  try {
    const parsed = JSON.parse(serializedText);
    if (!parsed || !parsed.isEncrypted) {
      return parsed; // Plain JSON object
    }
    if (!passphrase || !passphrase.trim()) {
      throw new Error('This remote sync payload is encrypted. Please enter your secret passphrase in Cloud Sync settings.');
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Cryptography API is unavailable in this environment.');
    }

    const salt = new Uint8Array(parsed.salt);
    const iv = new Uint8Array(parsed.iv);
    const ciphertext = new Uint8Array(parsed.data);
    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    throw new Error('Decryption error: ' + err.message);
  }
}

/**
 * Main Cloud Sync Controller & Multi-Device Manager
 */
export class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.lastError = null;
    this.listeners = new Set();
    this.debounceTimer = null;
    this.backgroundPollTimer = null;
    this.networkOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
      ? navigator.onLine
      : true;
    this.silentAudioElement = null;
    this.pwaInstallPrompt = null;
    this.gdriveAccessToken = null;
    this.gdriveTokenExpiry = null;

    // Generate or restore a unique client device ID
    this.deviceId = this.getOrCreateDeviceId();
  }

  getOrCreateDeviceId() {
    try {
      if (typeof localStorage !== 'undefined') {
        let id = localStorage.getItem('chronostudy_device_id');
        if (!id) {
          const type = (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent))
            ? 'mobile'
            : 'desktop';
          id = `device-${type}-${Math.random().toString(36).slice(2, 9)}`;
          localStorage.setItem('chronostudy_device_id', id);
        }
        return id;
      }
    } catch (e) {}
    return 'device-unknown-' + Math.random().toString(36).slice(2, 7);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Sync listener error:', err);
      }
    }
  }

  getStatus() {
    const syncState = store.getState().sync || {};
    const unsynced = store.getUnsyncedChanges();
    return {
      provider: syncState.provider || 'gdrive',
      status: this.isSyncing ? 'syncing' : (syncState.status || 'idle'),
      isOnline: this.networkOnline,
      lastSyncedAt: syncState.lastSyncedAt || null,
      deviceId: this.deviceId,
      unsyncedCount: unsynced.count,
      hasChanges: unsynced.hasChanges,
      lastError: this.lastError,
      autoSync: syncState.autoSync !== false,
      roomId: syncState.supabaseRoomId || '',
      googleUserEmail: syncState.googleUserEmail || null,
      googleClientId: syncState.googleClientId || '',
      isGoogleConnected: Boolean(this.gdriveAccessToken || syncState.googleUserEmail),
      isConfigured: this.isConfigured()
    };
  }

  isConfigured() {
    const syncState = store.getState().sync || {};
    if (syncState.provider === 'gdrive') {
      return Boolean(syncState.googleClientId);
    }
    if (syncState.provider === 'supabase') {
      return Boolean(syncState.supabaseUrl && syncState.supabaseKey && syncState.supabaseRoomId);
    }
    return false;
  }

  /**
   * Initializes event listeners, background timers, MediaSession and PWA installation
   */
  init() {
    if (typeof window === 'undefined') return;

    // Network connectivity detection
    window.addEventListener('online', () => {
      this.networkOnline = true;
      this.notify();
      if (store.getState().sync.autoSync) {
        this.performSync({ silent: true });
      }
    });

    window.addEventListener('offline', () => {
      this.networkOnline = false;
      this.notify();
    });

    // Reactive auto-sync when local store changes (debounced by 4 seconds)
    window.addEventListener('chronostudy:state-changed', () => {
      if (store.getState().sync.autoSync && this.isConfigured() && this.networkOnline) {
        this.scheduleDebouncedSync();
      }
    });

    // Immediate sync check when user switches back to ChronoStudy app/tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.networkOnline && this.isConfigured()) {
        this.performSync({ silent: true });
      }
    });

    // Periodic background sync every 60 seconds when online
    if (this.backgroundPollTimer) clearInterval(this.backgroundPollTimer);
    this.backgroundPollTimer = setInterval(() => {
      if (this.networkOnline && this.isConfigured() && store.getState().sync.autoSync && !this.isSyncing) {
        this.performSync({ silent: true });
      }
    }, 60000);

    // Setup Android lock-screen and notification bar MediaSession controls
    this.initMediaSession();

    // Setup PWA install prompt handler
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.pwaInstallPrompt = e;
      this.notify();
    });

    // Initial sync check on launch if configured
    if (this.networkOnline && this.isConfigured()) {
      setTimeout(() => this.performSync({ silent: true }), 1500);
    }
  }

  scheduleDebouncedSync() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSync({ silent: true });
    }, 4000);
  }

  /**
   * High-Level Sync Orchestrator
   */
  async performSync({ force = false, silent = false } = {}) {
    if (this.isSyncing) return { success: false, reason: 'Already syncing' };

    if (!this.networkOnline) {
      this.lastError = 'Device is currently offline';
      this.notify();
      return { success: false, reason: 'offline' };
    }

    const syncState = store.getState().sync || {};
    if (syncState.provider === 'none' || !this.isConfigured()) {
      if (!silent) {
        this.lastError = 'Cloud sync is not configured yet. Sign in with Google Drive or enter your Client ID in Cloud Sync Settings.';
      }
      this.notify();
      return { success: false, reason: 'unconfigured' };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      if (syncState.provider === 'gdrive') {
        await this.syncGoogleDrive(syncState, { interactive: force });
      } else if (syncState.provider === 'supabase') {
        await this.syncSupabase(syncState);
      } else {
        throw new Error(`Unsupported sync provider: ${syncState.provider}`);
      }

      this.lastError = null;
      this.isSyncing = false;
      this.notify();
      return { success: true };
    } catch (err) {
      console.error('ChronoStudy Cloud Sync Failed:', err);
      this.lastError = err.message || 'Sync failed';
      this.isSyncing = false;
      store.updateSyncSettings({ status: 'error' });
      this.notify();
      return { success: false, error: this.lastError };
    }
  }

  /**
   * Google Identity Services OAuth 2.0 Token Handler
   */
  async requestGoogleAccessToken({ clientId, interactive = false } = {}) {
    if (typeof window === 'undefined') return null;

    // Return cached token if still valid
    if (this.gdriveAccessToken && this.gdriveTokenExpiry && Date.now() < this.gdriveTokenExpiry - 60000) {
      return this.gdriveAccessToken;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      throw new Error('Google Identity Services SDK is loading. Please check your internet connection.');
    }

    if (!clientId) {
      throw new Error('Please enter your Google OAuth Client ID first.');
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error('Google sign-in timed out or popup was closed. If your browser blocked the popup, click the popup blocker icon in your address bar to allow it.'));
        }
      }, 60000);

      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
          callback: (resp) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timeout);
            if (resp.error) {
              reject(new Error(resp.error_description || resp.error));
              return;
            }
            this.gdriveAccessToken = resp.access_token;
            const expiresIn = parseInt(resp.expires_in, 10) || 3500;
            this.gdriveTokenExpiry = Date.now() + expiresIn * 1000;
            resolve(resp.access_token);
          },
          error_callback: (err) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timeout);
            reject(new Error(err.message || 'Google sign-in popup was closed or blocked by the browser.'));
          }
        });

        tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          reject(err);
        }
      }
    });
  }

  /**
   * Google Drive Provider Sync Engine
   * Zero database setup needed — uses Google Drive REST API v3
   */
  async syncGoogleDrive(syncState, { interactive = false } = {}) {
    const clientId = syncState.googleClientId ? syncState.googleClientId.trim() : '';
    if (!clientId) {
      throw new Error('Please enter your Google OAuth Client ID in Cloud Sync settings.');
    }

    let token = this.gdriveAccessToken;
    if (!token || !this.gdriveTokenExpiry || Date.now() >= this.gdriveTokenExpiry - 60000) {
      token = await this.requestGoogleAccessToken({ clientId, interactive });
    }

    if (!token) {
      throw new Error('Google Drive authorization needed. Click "Sign in with Google Drive".');
    }

    // 1. Fetch user email if not cached
    if (!syncState.googleUserEmail) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json();
          if (userinfo.email) {
            store.updateSyncSettings({ googleUserEmail: userinfo.email });
          }
        }
      } catch (e) {
        // Non-fatal
      }
    }

    // 2. Query for existing chronostudy_sync.json on Google Drive
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='chronostudy_sync.json' and trashed=false&fields=files(id,name,modifiedTime)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!searchRes.ok) {
      const errTxt = await searchRes.text();
      if (searchRes.status === 401) {
        this.gdriveAccessToken = null;
        throw new Error('Google authorization expired. Please click "Sign in with Google Drive" again.');
      }
      throw new Error(`Google Drive search failed (${searchRes.status}): ${errTxt}`);
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // 3. Download and merge if file exists
    if (existingFile) {
      store.updateSyncSettings({ googleDriveFileId: existingFile.id });
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`;
      const dlRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (dlRes.ok) {
        const rawContent = await dlRes.text();
        if (rawContent && rawContent.trim()) {
          try {
            const remotePayload = await decryptPayload(rawContent, syncState.passphrase);
            if (remotePayload && remotePayload.version) {
              store.mergeRemoteState(remotePayload);
            }
          } catch (decryptErr) {
            throw new Error(`Failed to decrypt remote Google Drive data: ${decryptErr.message}`);
          }
        }
      }
    }

    // 4. Prepare updated local payload and upload to Drive
    const localPayload = store.getSyncPayload();
    const serializedForCloud = await encryptPayload(localPayload, syncState.passphrase);

    if (existingFile) {
      // Update existing file (PATCH)
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: serializedForCloud
      });

      if (!patchRes.ok) {
        const patchErr = await patchRes.text();
        throw new Error(`Failed to update file in Google Drive: ${patchErr}`);
      }
    } else {
      // Create new file via multipart upload
      const boundary = '-------ChronoStudyBoundary' + Math.random().toString(36).slice(2);
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: 'chronostudy_sync.json',
        mimeType: 'application/json'
      };

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        serializedForCloud +
        closeDelimiter;

      const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!createRes.ok) {
        const createErr = await createRes.text();
        throw new Error(`Failed to create file in Google Drive: ${createErr}`);
      }

      const createData = await createRes.json();
      if (createData.id) {
        store.updateSyncSettings({ googleDriveFileId: createData.id });
      }
    }

    // 5. Mark records synced locally
    const nowIso = new Date().toISOString();
    store.markRecordsSynced(nowIso);
  }

  disconnectGoogleDrive() {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2?.revoke && this.gdriveAccessToken) {
      try {
        window.google.accounts.oauth2.revoke(this.gdriveAccessToken, () => {});
      } catch (e) {}
    }
    this.gdriveAccessToken = null;
    this.gdriveTokenExpiry = null;
    store.updateSyncSettings({
      googleUserEmail: null,
      googleDriveFileId: null,
      status: 'idle'
    });
    this.notify();
  }

  /**
   * Supabase Provider Sync Engine
   * Zero backend code needed — uses Supabase REST API with user's room code
   */
  async syncSupabase(syncState) {
    const { supabaseUrl, supabaseKey, supabaseRoomId, passphrase } = syncState;
    if (!supabaseUrl || !supabaseKey || !supabaseRoomId) {
      throw new Error('Supabase URL, Anon Key, and Room ID are required.');
    }

    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/rest/v1/chronostudy_sync`;
    const roomId = supabaseRoomId.trim().toLowerCase();

    // 1. Fetch remote room data from Supabase
    const fetchUrl = `${endpoint}?room_id=eq.${encodeURIComponent(roomId)}&select=*`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 404 || errText.includes('relation "chronostudy_sync" does not exist')) {
        throw new Error('The "chronostudy_sync" table was not found in your Supabase database. Click "Copy Supabase SQL Setup" in Cloud Sync settings to create it in 5 seconds.');
      }
      throw new Error(`Supabase request failed (${response.status}): ${errText}`);
    }

    const rows = await response.json();
    let remotePayload = null;
    let remoteDeviceId = null;
    let remoteUpdatedAt = null;

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      remoteDeviceId = row.device_id || null;
      remoteUpdatedAt = row.updated_at || null;

      if (row.payload) {
        try {
          remotePayload = await decryptPayload(row.payload, passphrase);
        } catch (decryptErr) {
          throw new Error(`Failed to decrypt remote data: ${decryptErr.message}`);
        }
      }
    }

    // 2. If remote data exists, merge remote changes additively and safely into local store
    if (remotePayload) {
      store.mergeRemoteState(remotePayload);
    }

    // 3. Prepare our updated local payload to upload to Supabase
    const nowIso = new Date().toISOString();
    const localPayload = store.getSyncPayload();
    const serializedForCloud = await encryptPayload(localPayload, passphrase);

    const upsertBody = {
      room_id: roomId,
      payload: serializedForCloud,
      updated_at: nowIso,
      device_id: this.deviceId
    };

    // Use Postgres Upsert (Prefer: resolution=merge-duplicates)
    const pushResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(upsertBody)
    });

    if (!pushResponse.ok) {
      const pushErrText = await pushResponse.text();
      throw new Error(`Failed to save data to Supabase (${pushResponse.status}): ${pushErrText}`);
    }

    // 4. Mark all local records as safely synced
    store.markRecordsSynced(nowIso);
  }

  /**
   * Offline Direct Device-to-Device Snapshot Transfer
   */
  exportSnapshotJSON(passphrase = null) {
    const payload = store.getSyncPayload();
    return JSON.stringify(payload, null, 2);
  }

  async importSnapshotJSON(jsonString, passphrase = null) {
    try {
      const parsed = await decryptPayload(jsonString, passphrase);
      if (!parsed || !parsed.version) {
        throw new Error('Invalid ChronoStudy snapshot structure.');
      }
      // Create safety snapshot before merging
      store.createSafetyBackup();
      const mergeSummary = store.mergeRemoteState(parsed);
      store.markRecordsSynced(new Date().toISOString());
      this.notify();
      return { success: true, summary: mergeSummary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Android Notification Shade & Lock Screen MediaSession Timer Integration
   */
  initMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    // Setup action handlers for Android lock screen controls
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        timer.start();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        timer.pause();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        timer.finishSession();
      });
    } catch (e) {
      console.warn('MediaSession action handler setup issue:', e);
    }

    // Subscribe to study timer ticks to update the Android lock screen notification in real time
    timer.subscribe((timerState) => {
      this.updateMediaSession(timerState);
    });
  }

  updateMediaSession(timerState) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    try {
      if (timerState.isRunning) {
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${timerState.subject} • ${timerState.formattedTime}`,
          artist: timerState.topic ? `${timerState.topic} (ChronoStudy)` : 'ChronoStudy Focus Timer',
          album: 'ChronoStudy Study Tracker & Planner',
          artwork: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      } else if (timerState.elapsedSec > 0) {
        navigator.mediaSession.playbackState = 'paused';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Paused: ${timerState.subject} • ${timerState.formattedTime}`,
          artist: 'ChronoStudy Focus Timer',
          album: 'ChronoStudy Study Tracker & Planner',
          artwork: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch (err) {
      // Graceful fallback on browsers with partial MediaSession support
    }
  }

  /**
   * PWA Install Prompt Trigger
   */
  async promptPWAInstall() {
    if (this.pwaInstallPrompt) {
      this.pwaInstallPrompt.prompt();
      const choice = await this.pwaInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.pwaInstallPrompt = null;
        this.notify();
      }
      return choice;
    }
    return null;
  }
}

export const syncManager = new SyncManager();
