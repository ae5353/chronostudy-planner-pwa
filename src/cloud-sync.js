// ChronoStudy v2.1 — Cross-Device Cloud Sync Engine (PC <-> Mobile)
// Supports 3 Synchronization Modes:
// 1. GitHub Gist / Repo Serverless Cloud Sync (works anywhere over 4G/5G/Wi-Fi using GitHub REST API)
// 2. Self-Hosted / LAN Sync Server (works via server/sync-server.mjs at /api/state)
// 3. Instant URL Snapshot Link (#sync=...) for zero-account device handoff

const SYNC_CONFIG_KEY = 'chronostudy_sync_config_v2';

export function loadSyncConfig() {
  if (typeof localStorage === 'undefined') {
    return { provider: 'none', githubToken: '', gistId: '', serverUrl: '', autoSync: true, lastSyncedAt: null };
  }
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) {
      return { provider: 'none', githubToken: '', gistId: '', serverUrl: '', autoSync: true, lastSyncedAt: null };
    }
    return {
      provider: 'none',
      githubToken: '',
      gistId: '',
      serverUrl: '',
      autoSync: true,
      lastSyncedAt: null,
      ...JSON.parse(raw)
    };
  } catch (_) {
    return { provider: 'none', githubToken: '', gistId: '', serverUrl: '', autoSync: true, lastSyncedAt: null };
  }
}

export function saveSyncConfig(cfg) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
  } catch (_) {}
}

/**
 * Push state to GitHub Gist (creates a new private Gist if gistId is empty)
 */
export async function pushToGitHubGist(state, config) {
  const token = String(config.githubToken || '').trim();
  if (!token) throw new Error('Missing GitHub Personal Access Token');

  const payload = {
    description: 'ChronoStudy Cross-Device Sync State (PC & Mobile)',
    public: false,
    files: {
      'chronostudy-state.json': {
        content: JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
      }
    }
  };

  const gistId = String(config.gistId || '').trim();
  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`GitHub Sync failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  return {
    gistId: data.id,
    htmlUrl: data.html_url,
    syncedAt: new Date().toISOString()
  };
}

/**
 * Pull state from GitHub Gist
 */
export async function pullFromGitHubGist(config) {
  const token = String(config.githubToken || '').trim();
  const gistId = String(config.gistId || '').trim();
  if (!gistId) throw new Error('Enter your Sync Gist ID first');

  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub Pull failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const file = data.files && data.files['chronostudy-state.json'];
  if (!file || !file.content) {
    throw new Error('No chronostudy-state.json found in Gist');
  }

  return JSON.parse(file.content);
}

/**
 * Push state to Self-Hosted / PC Sync Server (server/sync-server.mjs)
 */
export async function pushToSyncServer(state, config) {
  const base = String(config.serverUrl || window.location.origin).replace(/\/$/, '');
  const res = await fetch(`${base}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  });
  if (!res.ok) throw new Error(`Sync Server returned HTTP ${res.status}`);
  return { syncedAt: new Date().toISOString() };
}

/**
 * Pull state from Self-Hosted / PC Sync Server
 */
export async function pullFromSyncServer(config) {
  const base = String(config.serverUrl || window.location.origin).replace(/\/$/, '');
  const res = await fetch(`${base}/api/state`);
  if (!res.ok) throw new Error(`Sync Server returned HTTP ${res.status}`);
  return await res.json();
}

/**
 * Encode compact snapshot into a shareable URL hash (#sync=...) for instant PC <-> Mobile handoff
 */
export function createShareableSyncLink(state) {
  const minimal = {
    tasks: state.tasks,
    scheduleBlocks: state.scheduleBlocks,
    habits: state.habits,
    stats: state.stats
  };
  const json = JSON.stringify(minimal);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.href.split('#')[0]
      : 'https://raw.githack.com/ae5353/chronostudy-planner-pwa/main/index.html';
  return `${baseUrl}#sync=${encoded}`;
}

export function checkUrlSyncSnapshot() {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#sync=')) return null;
  try {
    const encoded = window.location.hash.slice('#sync='.length);
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return parsed;
  } catch (_) {
    return null;
  }
}
