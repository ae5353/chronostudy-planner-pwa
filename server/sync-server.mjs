#!/usr/bin/env node
// ChronoStudy v2.0 — Self-Hosted Cloud Sync & Live WebCal (.ics) Server
// Enables cross-device sync (Desktop, Mobile PWA, CLI, iOS/Android Capacitor) and live Calendar subscription feeds.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, createDefaultState } from '../src/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLOUD_STATE_PATH = path.join(__dirname, 'cloud-state.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8'
};

function readCloudState() {
  if (fs.existsSync(CLOUD_STATE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CLOUD_STATE_PATH, 'utf8'));
      const def = createDefaultState();
      return {
        ...def,
        ...parsed,
        stats: { ...def.stats, ...(parsed.stats || {}) },
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    } catch (_) {}
  }
  const initial = { ...createDefaultState(), updatedAt: new Date().toISOString() };
  fs.writeFileSync(CLOUD_STATE_PATH, JSON.stringify(initial, null, 2), 'utf8');
  return initial;
}

function writeCloudState(nextState) {
  const payload = {
    ...createDefaultState(),
    ...nextState,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(CLOUD_STATE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

export function createSyncServer() {
  return http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // 1. Healthcheck endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        version: '2.0.0',
        service: 'ChronoStudy Multi-Platform Sync Server',
        endpoints: ['/api/health', '/api/state', '/api/calendar.ics']
      });
      return;
    }

    // 2. Cloud State Sync GET / POST
    if (pathname === '/api/state') {
      if (req.method === 'GET') {
        const state = readCloudState();
        sendJson(res, 200, state);
        return;
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            const incoming = JSON.parse(body || '{}');
            const saved = writeCloudState(incoming);
            sendJson(res, 200, { ok: true, updatedAt: saved.updatedAt, state: saved });
          } catch (err) {
            sendJson(res, 400, { ok: false, error: 'Invalid JSON payload' });
          }
        });
        return;
      }
    }

    // 3. Live iCalendar (.ics) Subscription Feed for Apple Calendar / Google Calendar / Outlook
    if (pathname === '/api/calendar.ics' && req.method === 'GET') {
      const store = new Store();
      store.state = readCloudState();
      const icsContent = store.exportICS();
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="chronostudy-calendar.ics"',
        'Cache-Control': 'no-cache'
      });
      res.end(icsContent);
      return;
    }

    // 3b. Live External University / Google Calendar .ICS Proxy (bypasses browser CORS)
    if (pathname === '/api/proxy-ics' && req.method === 'GET') {
      const targetUrl = urlObj.searchParams.get('url') || '';
      if (!/^https?:\/\//i.test(targetUrl)) {
        sendJson(res, 400, { ok: false, error: 'Missing or invalid url query parameter' });
        return;
      }
      fetch(targetUrl)
        .then((upstream) => upstream.text())
        .then((icsText) => {
          setCorsHeaders(res);
          res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
          res.end(icsText);
        })
        .catch((err) => {
          sendJson(res, 502, { ok: false, error: err.message || 'Upstream calendar fetch failed' });
        });
      return;
    }

    // 4. Static PWA Asset Serving
    const relPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(ROOT_DIR, safePath);

    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA Fallback to index.html
        const indexHtml = path.join(ROOT_DIR, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(indexHtml).pipe(res);
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

// Start server if invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createSyncServer();
  server.listen(PORT, HOST, () => {
    console.log(`ChronoStudy v2.0 Sync & PWA Server listening on http://${HOST}:${PORT}`);
    console.log(`  • Web / PWA UI:       http://localhost:${PORT}/`);
    console.log(`  • Cloud State API:    http://localhost:${PORT}/api/state`);
    console.log(`  • Live WebCal Feed:   http://localhost:${PORT}/api/calendar.ics`);
  });
}
