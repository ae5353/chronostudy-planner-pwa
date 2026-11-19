// src/ui/sync-view.js — Cloud Sync modal (Google Drive / Supabase / Offline) & Backup modal controller
import { store, toLocalDateStr } from '../store.js';
import { playClickSound } from '../audio.js';
import { syncManager } from '../sync.js';
import { downloadFile, renderGDriveApiErrorHtml } from './dom-utils.js';
import { openModal, closeModal, showInAppConfirm, showInAppAlert } from './modals.js';

export class SyncViewController {
  constructor(ui) {
    this.ui = ui;
  }

  initDOM() {
    this.btnCloudSync = document.getElementById('btn-cloud-sync');
    this.cloudSyncDot = document.getElementById('cloud-sync-dot');
    this.cloudSyncLabel = document.getElementById('cloud-sync-label');

    this.cloudSyncModal = document.getElementById('cloud-sync-modal');
    this.btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
    this.btnDoneSyncModal = document.getElementById('btn-done-sync-modal');

    this.modalSyncDot = document.getElementById('modal-sync-dot');
    this.modalSyncTitle = document.getElementById('modal-sync-title');
    this.modalSyncSubtitle = document.getElementById('modal-sync-subtitle');
    this.btnModalSyncNow = document.getElementById('btn-modal-sync-now');

    this.modalDeviceId = document.getElementById('modal-device-id');
    this.modalLastSynced = document.getElementById('modal-last-synced');
    this.modalUnsyncedCount = document.getElementById('modal-unsynced-count');
    this.modalNetworkStatus = document.getElementById('modal-network-status');

    this.syncTabBtns = document.querySelectorAll('.sync-tab-btn');
    this.syncTabPanels = {
      gdrive: document.getElementById('sync-tab-panel-gdrive'),
      supabase: document.getElementById('sync-tab-panel-supabase'),
      offline: document.getElementById('sync-tab-panel-offline'),
      devices: document.getElementById('sync-tab-panel-devices')
    };

    this.gdriveUserStatus = document.getElementById('gdrive-user-status');
    this.gdriveFileStatus = document.getElementById('gdrive-file-status');
    this.btnGdriveSignin = document.getElementById('btn-gdrive-signin');
    this.btnGdriveDisconnect = document.getElementById('btn-gdrive-disconnect');
    this.gdriveClientId = document.getElementById('gdrive-client-id');
    this.gdrivePassphrase = document.getElementById('gdrive-passphrase');
    this.gdriveAutoToggle = document.getElementById('gdrive-auto-toggle');
    this.btnSaveGdriveConfig = document.getElementById('btn-save-gdrive-config');

    this.syncSupabaseUrl = document.getElementById('sync-supabase-url');
    this.syncSupabaseKey = document.getElementById('sync-supabase-key');
    this.syncSupabaseRoom = document.getElementById('sync-supabase-room');
    this.syncPassphrase = document.getElementById('sync-passphrase');
    this.syncAutoToggle = document.getElementById('sync-auto-toggle');

    this.btnSaveCloudConfig = document.getElementById('btn-save-cloud-config');
    this.btnCopySupabaseSql = document.getElementById('btn-copy-supabase-sql');
    this.btnGenerateRoomCode = document.getElementById('btn-generate-room-code');

    this.btnExportSnapshot = document.getElementById('btn-export-snapshot');
    this.btnDownloadSnapshotFile = document.getElementById('btn-download-snapshot-file');
    this.syncImportTextarea = document.getElementById('sync-import-textarea');
    this.btnImportSnapshot = document.getElementById('btn-import-snapshot');
    this.btnRollbackBackup = document.getElementById('btn-rollback-backup');

    this.btnPwaInstallApp = document.getElementById('btn-pwa-install-app');
    this.btnRequestNotifications = document.getElementById('btn-request-notifications');

    // Backup & Export Modal
    this.backupBtn = document.getElementById('backup-btn');
    this.backupModal = document.getElementById('backup-modal');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnAnalyticsExportCsv = document.getElementById('btn-analytics-export-csv');
    this.btnImportJson = document.getElementById('btn-import-json');
    this.jsonFileInput = document.getElementById('json-file-input');
    this.btnCloseBackup = document.getElementById('btn-close-backup');
  }

  bindEvents() {
    if (this.btnCloudSync) {
      this.btnCloudSync.addEventListener('click', () => {
        this.openSyncModal();
        playClickSound();
      });
    }
    if (this.btnCloseSyncModal) {
      this.btnCloseSyncModal.addEventListener('click', () => {
        this.closeSyncModal();
        playClickSound();
      });
    }
    if (this.btnDoneSyncModal) {
      this.btnDoneSyncModal.addEventListener('click', () => {
        this.closeSyncModal();
        playClickSound();
      });
    }
    if (this.cloudSyncModal) {
      this.cloudSyncModal.addEventListener('click', (e) => {
        if (e.target === this.cloudSyncModal) this.closeSyncModal();
      });
    }

    if (this.syncTabBtns) {
      this.syncTabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchSyncTab(btn.dataset.syncTab);
          playClickSound();
        });
      });
    }

    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.addEventListener('click', () => {
        this.triggerSyncNow();
        playClickSound();
      });
    }
    if (this.btnGdriveSignin) {
      this.btnGdriveSignin.addEventListener('click', () => {
        this.handleGoogleDriveSignIn();
        playClickSound();
      });
    }
    if (this.btnGdriveDisconnect) {
      this.btnGdriveDisconnect.addEventListener('click', () => {
        this.handleGoogleDriveDisconnect();
        playClickSound();
      });
    }
    if (this.btnSaveGdriveConfig) {
      this.btnSaveGdriveConfig.addEventListener('click', () => {
        this.handleGoogleDriveSave();
        playClickSound();
      });
    }
    if (this.btnSaveCloudConfig) {
      this.btnSaveCloudConfig.addEventListener('click', () => {
        this.saveCloudConfig();
        playClickSound();
      });
    }
    if (this.btnCopySupabaseSql) {
      this.btnCopySupabaseSql.addEventListener('click', () => {
        this.copySupabaseSql();
        playClickSound();
      });
    }
    if (this.btnGenerateRoomCode) {
      this.btnGenerateRoomCode.addEventListener('click', () => {
        this.generateRoomCode();
        playClickSound();
      });
    }
    if (this.btnExportSnapshot) {
      this.btnExportSnapshot.addEventListener('click', () => {
        this.exportSnapshotClipboard();
        playClickSound();
      });
    }
    if (this.btnDownloadSnapshotFile) {
      this.btnDownloadSnapshotFile.addEventListener('click', () => {
        this.downloadSnapshotFile();
        playClickSound();
      });
    }
    if (this.btnImportSnapshot) {
      this.btnImportSnapshot.addEventListener('click', () => {
        this.importSnapshotFromUI();
        playClickSound();
      });
    }
    if (this.btnRollbackBackup) {
      this.btnRollbackBackup.addEventListener('click', () => {
        this.rollbackPreSyncBackup();
        playClickSound();
      });
    }
    if (this.btnPwaInstallApp) {
      this.btnPwaInstallApp.addEventListener('click', () => {
        syncManager.promptPWAInstall();
        playClickSound();
      });
    }
    if (this.btnRequestNotifications) {
      this.btnRequestNotifications.addEventListener('click', () => {
        this.requestNotifications();
        playClickSound();
      });
    }

    // Backup & Export Modal
    if (this.backupBtn) {
      this.backupBtn.addEventListener('click', () => {
        if (this.backupModal) openModal(this.backupModal);
        playClickSound();
      });
    }
    if (this.btnCloseBackup) {
      this.btnCloseBackup.addEventListener('click', () => {
        if (this.backupModal) closeModal(this.backupModal);
      });
    }
    if (this.backupModal) {
      this.backupModal.addEventListener('click', (e) => {
        if (e.target === this.backupModal) closeModal(this.backupModal);
      });
    }
    if (this.btnExportJson) {
      this.btnExportJson.addEventListener('click', () => {
        downloadFile(store.exportJSON(), `chronostudy-backup-${toLocalDateStr(new Date())}.json`, 'application/json');
      });
    }
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        this.downloadCSV();
        playClickSound();
      });
    }
    if (this.btnAnalyticsExportCsv) {
      this.btnAnalyticsExportCsv.addEventListener('click', () => {
        this.downloadCSV();
        playClickSound();
      });
    }
    if (this.btnImportJson && this.jsonFileInput) {
      this.btnImportJson.addEventListener('click', () => {
        this.jsonFileInput.click();
      });
      this.jsonFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = store.importJSON(event.target.result);
          e.target.value = '';
          if (result.success) {
            if (this.backupModal) closeModal(this.backupModal);
            await showInAppAlert({
              title: 'Backup Restored',
              message: `Successfully imported backup with ${result.count} study sessions!`
            });
          } else {
            await showInAppAlert({
              title: 'Import Failed',
              message: 'Failed to import backup: ' + result.error
            });
          }
        };
        reader.readAsText(file);
      });
    }
  }

  downloadCSV() {
    const csvContent = store.generateCSV();
    const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;
    downloadFile(contentWithBom, `ChronoStudy_Sessions_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8;');
  }

  openSyncModal() {
    if (!this.cloudSyncModal) return;
    const syncState = store.getState().sync || {};
    if (this.gdriveClientId) this.gdriveClientId.value = syncState.googleClientId || '';
    if (this.gdrivePassphrase) this.gdrivePassphrase.value = syncState.passphrase || '';
    if (this.gdriveAutoToggle) this.gdriveAutoToggle.checked = syncState.autoSync !== false;

    if (this.syncSupabaseUrl) this.syncSupabaseUrl.value = syncState.supabaseUrl || '';
    if (this.syncSupabaseKey) this.syncSupabaseKey.value = syncState.supabaseKey || '';
    if (this.syncSupabaseRoom) this.syncSupabaseRoom.value = syncState.supabaseRoomId || '';
    if (this.syncPassphrase) this.syncPassphrase.value = syncState.passphrase || '';
    if (this.syncAutoToggle) this.syncAutoToggle.checked = syncState.autoSync !== false;

    this.renderSyncStatus(syncManager.getStatus());
    openModal(this.cloudSyncModal);
  }

  closeSyncModal() {
    if (this.cloudSyncModal) closeModal(this.cloudSyncModal);
  }

  switchSyncTab(tabName) {
    if (this.syncTabBtns) {
      this.syncTabBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.syncTab === tabName);
      });
    }
    if (this.syncTabPanels) {
      Object.entries(this.syncTabPanels).forEach(([key, panel]) => {
        if (panel) panel.style.display = key === tabName ? 'block' : 'none';
      });
    }
  }

  renderSyncStatus(status) {
    if (this.cloudSyncDot && this.cloudSyncLabel) {
      this.cloudSyncDot.className = 'sync-dot';
      if (!status.isOnline) {
        this.cloudSyncDot.classList.add('sync-dot-offline');
        this.cloudSyncLabel.textContent = 'Offline';
      } else if (status.status === 'syncing') {
        this.cloudSyncDot.classList.add('sync-dot-syncing');
        this.cloudSyncLabel.textContent = 'Syncing...';
      } else if (status.status === 'synced') {
        this.cloudSyncDot.classList.add('sync-dot-synced');
        this.cloudSyncLabel.textContent = 'Synced';
      } else if (status.status === 'error') {
        this.cloudSyncDot.classList.add('sync-dot-error');
        this.cloudSyncLabel.textContent = 'Sync Error';
      } else {
        this.cloudSyncDot.classList.add('sync-dot-idle');
        this.cloudSyncLabel.textContent = 'Sync';
      }
    }

    if (this.modalSyncDot) {
      this.modalSyncDot.className = 'sync-dot';
      if (!status.isOnline) this.modalSyncDot.classList.add('sync-dot-offline');
      else if (status.status === 'syncing') this.modalSyncDot.classList.add('sync-dot-syncing');
      else if (status.status === 'synced') this.modalSyncDot.classList.add('sync-dot-synced');
      else if (status.status === 'error') this.modalSyncDot.classList.add('sync-dot-error');
      else this.modalSyncDot.classList.add('sync-dot-idle');
    }

    if (this.modalDeviceId) this.modalDeviceId.textContent = status.deviceId || 'device-local';

    if (this.modalLastSynced) {
      if (status.lastSyncedAt) {
        const d = new Date(status.lastSyncedAt);
        this.modalLastSynced.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        this.modalLastSynced.textContent = 'Never';
      }
    }

    if (this.modalUnsyncedCount) {
      this.modalUnsyncedCount.textContent = status.hasChanges
        ? `${status.unsyncedCount} change${status.unsyncedCount === 1 ? '' : 's'} pending`
        : 'All changes synced';
    }

    if (this.modalNetworkStatus) {
      this.modalNetworkStatus.textContent = status.isOnline ? 'Online' : 'Offline';
      this.modalNetworkStatus.className = 'sync-meta-val ' + (status.isOnline ? 'text-green' : 'text-rose');
    }

    if (this.modalSyncTitle) {
      if (!status.isOnline) this.modalSyncTitle.textContent = 'Device Offline';
      else if (status.status === 'syncing') this.modalSyncTitle.textContent = 'Syncing with Cloud...';
      else if (status.status === 'synced') this.modalSyncTitle.textContent = 'Cloud Synchronized';
      else if (status.status === 'error') this.modalSyncTitle.textContent = 'Sync Attention Needed';
      else if (status.isConfigured) this.modalSyncTitle.textContent = 'Ready to Sync';
      else this.modalSyncTitle.textContent = 'Local Mode (No Cloud Account)';
    }

    if (this.modalSyncSubtitle) {
      if (!status.isOnline) {
        this.modalSyncSubtitle.textContent = 'Changes queued locally; will auto-sync upon reconnection';
      } else if (status.lastError) {
        const err = String(status.lastError);
        const errLower = err.toLowerCase();
        const isDriveDisabled = (errLower.includes('google drive api') || errLower.includes('drive.googleapis.com')) &&
          (errLower.includes('disabled') || errLower.includes('has not been used') || errLower.includes('403') || errLower.includes('service_disabled') || errLower.includes('accessnotconfigured'));

        if (isDriveDisabled) {
          const projectIdMatch = err.match(/project[=\s](\d+)/i) || (status.googleClientId ? status.googleClientId.match(/^(\d+)-/) : null);
          const projectId = projectIdMatch ? projectIdMatch[1] : '';
          this.modalSyncSubtitle.innerHTML = renderGDriveApiErrorHtml(err, { compact: true, projectId });
        } else {
          this.modalSyncSubtitle.textContent = status.lastError;
        }
      } else if (status.provider === 'gdrive' && status.googleUserEmail) {
        this.modalSyncSubtitle.textContent = `Google Drive: ${status.googleUserEmail} • chronostudy_sync.json`;
      } else if (status.provider === 'supabase' && status.roomId) {
        this.modalSyncSubtitle.textContent = `Supabase Room: ${status.roomId} • Encrypted End-to-End`;
      } else {
        this.modalSyncSubtitle.textContent = 'Connect Google Drive or Supabase to sync automatically across devices';
      }
    }

    if (this.gdriveUserStatus && this.gdriveFileStatus) {
      if (status.googleUserEmail) {
        this.gdriveUserStatus.textContent = `Connected: ${status.googleUserEmail}`;
        this.gdriveFileStatus.textContent = 'Active • Syncing automatically to chronostudy_sync.json';
        if (this.btnGdriveSignin) this.btnGdriveSignin.style.display = 'none';
        if (this.btnGdriveDisconnect) this.btnGdriveDisconnect.style.display = 'inline-block';
      } else {
        this.gdriveUserStatus.textContent = 'Not Connected';
        this.gdriveFileStatus.textContent = 'Sign in to sync your study logs to Google Drive';
        if (this.btnGdriveSignin) {
          this.btnGdriveSignin.style.display = 'flex';
          this.btnGdriveSignin.disabled = false;
          this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
        }
        if (this.btnGdriveDisconnect) this.btnGdriveDisconnect.style.display = 'none';
      }
    }
  }

  async handleGoogleDriveSignIn() {
    const clientId = this.gdriveClientId ? this.gdriveClientId.value.trim() : '';
    const pass = this.gdrivePassphrase ? this.gdrivePassphrase.value.trim() : '';
    const auto = this.gdriveAutoToggle ? this.gdriveAutoToggle.checked : true;

    if (!clientId) {
      await showInAppAlert({
        title: 'Google Client ID Required',
        message: 'Please paste your Google OAuth Client ID into the field below. Click "How to get your free Google Client ID" for simple 2-minute steps.'
      });
      if (this.gdriveClientId) this.gdriveClientId.focus();
      return;
    }

    store.updateSyncSettings({
      provider: 'gdrive',
      googleClientId: clientId,
      passphrase: pass,
      autoSync: auto
    });

    try {
      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = true;
        this.btnGdriveSignin.textContent = 'Connecting with Google...';
      }

      await syncManager.requestGoogleAccessToken({ clientId, interactive: true });
      await this.triggerSyncNow();

      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = false;
        this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
      }
    } catch (err) {
      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = false;
        this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
      }
      await showInAppAlert({
        title: 'Google Sign-In Alert',
        message: err.message || 'Failed to authenticate with Google.'
      });
    }
  }

  async handleGoogleDriveDisconnect() {
    const confirmed = await showInAppConfirm({
      title: 'Disconnect Google Drive',
      message: 'Are you sure you want to disconnect Google Drive synchronization? Your local study data will remain completely intact.'
    });
    if (!confirmed) return;

    syncManager.disconnectGoogleDrive();
    await showInAppAlert({
      title: 'Disconnected',
      message: 'Google Drive has been disconnected. You are now in local offline mode.'
    });
  }

  async handleGoogleDriveSave() {
    const clientId = this.gdriveClientId ? this.gdriveClientId.value.trim() : '';
    const pass = this.gdrivePassphrase ? this.gdrivePassphrase.value.trim() : '';
    const auto = this.gdriveAutoToggle ? this.gdriveAutoToggle.checked : true;

    if (!clientId) {
      await showInAppAlert({
        title: 'Missing Client ID',
        message: 'Please enter your Google OAuth Client ID to connect with Google Drive.'
      });
      return;
    }

    store.updateSyncSettings({
      provider: 'gdrive',
      googleClientId: clientId,
      passphrase: pass,
      autoSync: auto
    });

    await this.triggerSyncNow();
  }

  async saveCloudConfig() {
    const url = this.syncSupabaseUrl ? this.syncSupabaseUrl.value.trim() : '';
    const key = this.syncSupabaseKey ? this.syncSupabaseKey.value.trim() : '';
    let room = this.syncSupabaseRoom ? this.syncSupabaseRoom.value.trim().toLowerCase() : '';
    const pass = this.syncPassphrase ? this.syncPassphrase.value.trim() : '';
    const auto = this.syncAutoToggle ? this.syncAutoToggle.checked : true;

    if (!url || !key) {
      await showInAppAlert({
        title: 'Missing Credentials',
        message: 'Please provide both your Supabase Project URL and Anon API key.'
      });
      return;
    }

    if (!room) {
      room = `chronostudy-room-${Math.random().toString(36).slice(2, 8)}`;
      if (this.syncSupabaseRoom) this.syncSupabaseRoom.value = room;
    }

    store.updateSyncSettings({
      provider: 'supabase',
      supabaseUrl: url,
      supabaseKey: key,
      supabaseRoomId: room,
      passphrase: pass,
      autoSync: auto
    });

    await this.triggerSyncNow();
  }

  async triggerSyncNow() {
    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.disabled = true;
      this.btnModalSyncNow.textContent = 'Syncing...';
    }

    const res = await syncManager.performSync({ force: true });

    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.disabled = false;
      this.btnModalSyncNow.innerHTML = '<span>⟳</span> Sync Now';
    }

    if (res.success) {
      await showInAppAlert({
        title: 'Sync Complete',
        message: 'Your study tasks, courses, and sessions are now fully synchronized with the cloud!'
      });
    } else if (res.reason !== 'unconfigured') {
      await showInAppAlert({
        title: 'Sync Alert',
        message: res.error || 'Failed to sync. Please check your network connection and Supabase settings.'
      });
    }
  }

  async copySupabaseSql() {
    const sql = `-- Run this once in your Supabase SQL Editor
create table if not exists chronostudy_sync (
  room_id text primary key,
  payload text not null,
  room_secret_hash text default '',
  updated_at timestamptz default now(),
  device_id text
);

alter table chronostudy_sync enable row level security;

-- Hardened policy: verifies room_id + optional x-room-secret request header when configured
drop policy if exists "Allow room sync access" on chronostudy_sync;
drop policy if exists "Hardened room sync read" on chronostudy_sync;
drop policy if exists "Hardened room sync insert" on chronostudy_sync;
drop policy if exists "Hardened room sync update" on chronostudy_sync;

create policy "Hardened room sync read" on chronostudy_sync
  for select using (
    room_id is not null and (
      coalesce(room_secret_hash, '') = '' or
      room_secret_hash = coalesce((current_setting('request.headers', true)::json->>'x-room-secret'), '')
    )
  );

create policy "Hardened room sync insert" on chronostudy_sync
  for insert with check (length(room_id) >= 6);

create policy "Hardened room sync update" on chronostudy_sync
  for update using (
    coalesce(room_secret_hash, '') = '' or
    room_secret_hash = coalesce((current_setting('request.headers', true)::json->>'x-room-secret'), '')
  )
  with check (length(room_id) >= 6);`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(sql);
        await showInAppAlert({
          title: 'SQL Setup Copied',
          message: 'The hardened Supabase SQL query was copied to your clipboard! Paste it into your Supabase Dashboard -> SQL Editor and click "Run".'
        });
      } else {
        await showInAppAlert({ title: 'Supabase SQL Setup', message: sql });
      }
    } catch (e) {
      await showInAppAlert({ title: 'Supabase SQL Setup', message: sql });
    }
  }

  generateRoomCode() {
    const code = `chronostudy-itu-${Math.random().toString(36).slice(2, 8)}`;
    if (this.syncSupabaseRoom) this.syncSupabaseRoom.value = code;
  }

  async exportSnapshotClipboard() {
    const json = syncManager.exportSnapshotJSON();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        await showInAppAlert({
          title: 'Snapshot Copied',
          message: 'Full study workspace snapshot JSON copied to clipboard. You can paste it on another device to import!'
        });
      } else {
        if (this.syncImportTextarea) this.syncImportTextarea.value = json;
        await showInAppAlert({
          title: 'Snapshot Generated',
          message: 'Snapshot JSON has been placed in the text box below for you to copy.'
        });
      }
    } catch (e) {
      if (this.syncImportTextarea) this.syncImportTextarea.value = json;
    }
  }

  downloadSnapshotFile() {
    const json = syncManager.exportSnapshotJSON();
    downloadFile(json, `chronostudy-backup-${toLocalDateStr(new Date())}.json`, 'application/json');
  }

  async importSnapshotFromUI() {
    const text = this.syncImportTextarea ? this.syncImportTextarea.value.trim() : '';
    if (!text) {
      await showInAppAlert({
        title: 'Empty Input',
        message: 'Please paste the snapshot JSON text into the text area before importing.'
      });
      return;
    }

    const confirmed = await showInAppConfirm({
      title: 'Import Snapshot',
      message: 'This will additively merge all courses, tasks, and study sessions from the snapshot into your current workspace. Your existing data will not be lost. Continue?'
    });
    if (!confirmed) return;

    const res = await syncManager.importSnapshotJSON(text);
    if (res.success) {
      if (this.syncImportTextarea) this.syncImportTextarea.value = '';
      const addedTasks = res.summary?.addedTasks ?? 0;
      const addedSessions = res.summary?.addedSessions ?? 0;
      await showInAppAlert({
        title: 'Import Successful',
        message: `Successfully merged workspace snapshot! Added ${addedTasks} new tasks and ${addedSessions} study sessions without data loss.`
      });
    } else {
      await showInAppAlert({
        title: 'Import Failed',
        message: res.error || 'Failed to parse and merge snapshot.'
      });
    }
  }

  async rollbackPreSyncBackup() {
    const confirmed = await showInAppConfirm({
      title: 'Rollback to Pre-Sync Backup',
      message: 'Are you sure you want to revert your workspace to the automatic safety snapshot created before the last sync operation?',
      danger: true
    });
    if (!confirmed) return;

    const res = store.restoreSafetyBackup();
    if (res.success) {
      await showInAppAlert({
        title: 'Rollback Complete',
        message: `Workspace successfully restored to backup from ${new Date(res.backupAt).toLocaleTimeString()}.`
      });
    } else {
      await showInAppAlert({
        title: 'Rollback Failed',
        message: res.error || 'No safety backup snapshot found.'
      });
    }
  }

  async requestNotifications() {
    if (typeof Notification === 'undefined') {
      await showInAppAlert({
        title: 'Notifications Unsupported',
        message: 'Web notifications are not supported on this browser.'
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('ChronoStudy Planner', {
        body: 'Notifications enabled! You will receive study timer and lecture alerts.',
        icon: './icon.svg'
      });
      await showInAppAlert({
        title: 'Notifications Active',
        message: 'Notification permission granted! ChronoStudy can now remind you of upcoming lectures and study milestones.'
      });
    } else {
      await showInAppAlert({
        title: 'Permission Denied',
        message: 'Notification permission was denied. You can re-enable notifications in your browser site settings.'
      });
    }
  }
}
