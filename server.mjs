// server.mjs — Hardened zero-dependency static server for ChronoStudy (PC & local use)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const BLOCKED_TOP_LEVEL = new Set([
  '_legacy_archive',
  'tests',
  'docs',
  'node_modules',
  'dockerfile',
  'server.mjs',
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'jsconfig.json'
]);

const DEFAULT_PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 3000;
const DEFAULT_HOST = process.env.HOST || '127.0.0.1';

export function resolveSafeStaticPath(urlString, rootDir = ROOT_DIR) {
  const rawPathname = String(urlString || '/').split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return { status: 400, error: 'Bad Request' };
  }

  // Reject Windows backslashes or null bytes in URL paths
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return { status: 403, error: 'Forbidden' };
  }

  const trimmed = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const segments = trimmed.split('/').filter(Boolean);
  if (segments.some((seg) => seg === '..' || seg === '.' || seg.startsWith('.'))) {
    return { status: 403, error: 'Forbidden' };
  }
  if (segments.length > 0 && BLOCKED_TOP_LEVEL.has(segments[0].toLowerCase())) {
    return { status: 403, error: 'Forbidden' };
  }

  const resolved = path.resolve(rootDir, ...segments);
  const normalizedRoot = path.resolve(rootDir);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    return { status: 403, error: 'Forbidden' };
  }

  return { status: 200, filePath: resolved };
}

export function createServer(port = DEFAULT_PORT, host = DEFAULT_HOST, { quiet = false, autoIncrementPort = true } = {}) {
  const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      return res.end('405 Method Not Allowed');
    }

    const resolution = resolveSafeStaticPath(req.url);
    if (resolution.status !== 200) {
      res.writeHead(resolution.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`${resolution.status} ${resolution.error}`);
    }

    let filePath = resolution.filePath;

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        const ext = path.extname(filePath);
        if (ext) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Not Found');
        }
        // Fallback to index.html for extensionless SPA routes
        filePath = path.join(ROOT_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, must-revalidate'
        });
        res.end(req.method === 'HEAD' ? undefined : content);
      });
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && autoIncrementPort && port !== 0) {
      if (!quiet) console.log(`Port ${port} is in use, trying ${port + 1}...`);
      createServer(port + 1, host, { quiet, autoIncrementPort });
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, host, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
    if (!quiet) {
      console.log(`\n======================================================`);
      console.log(`  ChronoStudy — Personal Study Tracker & Planner`);
      console.log(`======================================================`);
      console.log(`  Local URL:      http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}`);
      console.log(`  Bind Address:   ${host}`);
      console.log(`======================================================\n`);
    }
  });

  return server;
}

const isEntryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntryPoint) {
  createServer(Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 3000, DEFAULT_HOST);
}
