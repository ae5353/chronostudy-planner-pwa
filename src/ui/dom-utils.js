// src/ui/dom-utils.js — Shared HTML escaping, CSS/URL sanitization, and download utilities

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeCssColor(color, fallback = '#64748b') {
  const val = String(color || '').trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(val) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(val) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(val) ||
    /^[a-zA-Z]{3,20}$/.test(val)
  ) {
    return val;
  }
  return fallback;
}

export function sanitizeGoogleEnableUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(String(rawUrl));
    const allowedHosts = ['console.developers.google.com', 'console.cloud.google.com'];
    if (parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname)) {
      return parsed.toString();
    }
  } catch (e) {}
  return '';
}

export function renderGDriveApiErrorHtml(message, { compact = false, projectId = '' } = {}) {
  const urlMatch = String(message || '').match(/https:\/\/console\.(?:developers|cloud)\.google\.com[^\s'"\\]+/);
  const safeUrl = sanitizeGoogleEnableUrl(urlMatch ? urlMatch[0] : '') ||
    (projectId
      ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${encodeURIComponent(projectId)}`
      : 'https://console.developers.google.com/apis/api/drive.googleapis.com/overview');

  if (compact) {
    const safeProj = escapeHTML(projectId);
    return `
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 0.65rem 0.85rem; margin-top: 0.35rem; text-align: left; font-family: system-ui, -apple-system, sans-serif; text-transform: none; letter-spacing: normal;">
        <div style="color: #fca5a5; font-weight: 600; font-size: 0.82rem; margin-bottom: 0.25rem;">
          ⚠ Google Drive API Disabled${safeProj ? ` in Project ${safeProj}` : ''}
        </div>
        <div style="font-size: 0.74rem; color: #fecaca; line-height: 1.45;">
          Google blocked the sync because the Google Drive API library is not yet enabled in your Google Cloud Console project.
        </div>
        <div style="margin-top: 0.55rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.85rem; font-size: 0.76rem; text-decoration: none; font-weight: 600; background: #eab308; color: #000; border: none; border-radius: 4px;">
            ↗ Enable Google Drive API (1 Click)
          </a>
          <span style="font-size: 0.72rem; color: #94a3b8;">
            Click the blue "ENABLE" button, then return and click "Sync Now".
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div style="line-height: 1.45;">Google Drive API is not yet enabled in your Google Cloud project.</div>
    <div style="margin-top: 0.85rem; text-align: center;">
      <a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-block; padding: 0.5rem 1rem; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
        → Enable Google Drive API in Google Cloud
      </a>
    </div>
    <div style="margin-top: 0.75rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.4;">
      Click the blue <strong>"ENABLE"</strong> button on the Google Cloud page, then return here and click "Sync Now".
    </div>
  `;
}

export function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
