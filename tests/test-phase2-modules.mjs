// tests/test-phase2-modules.mjs — Verification for Phase 2 modular architecture, A11y, CSS layers & SW asset coverage
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) { return storageMap.has(k) ? storageMap.get(k) : null; },
  setItem(k, v) { storageMap.set(k, String(v)); },
  removeItem(k) { storageMap.delete(k); },
  clear() { storageMap.clear(); }
};

// 1. Direct modular domain & UI imports
const dateUtils = await import('../src/domain/date-utils.js');
const presets = await import('../src/domain/presets.js');
const recurrence = await import('../src/domain/recurrence.js');
const reconcile = await import('../src/domain/reconcile.js');
const analytics = await import('../src/domain/analytics.js');
const syncMerge = await import('../src/domain/sync-merge.js');
const exporters = await import('../src/domain/exporters.js');
const stateStoreMod = await import('../src/state/store.js');
const facadeStoreMod = await import('../src/store.js');
const domUtils = await import('../src/ui/dom-utils.js');
const plannerView = await import('../src/ui/planner-view.js');
const { ChronoUI } = await import('../src/ui.js');

assert.equal(facadeStoreMod.store, stateStoreMod.store, 'src/store.js facade must re-export singleton store from src/state/store.js');
assert.equal(typeof dateUtils.toLocalDateStr, 'function');
assert.ok(Array.isArray(presets.DEFAULT_GROUPS));
assert.equal(typeof recurrence.doesWeeklyEventOccurOnDate, 'function');
assert.equal(typeof reconcile.reconcileTasksAndSessions, 'function');
assert.equal(typeof analytics.buildSessionTaskIndex, 'function');
assert.equal(typeof syncMerge.mergeRemoteState, 'function');
assert.equal(typeof exporters.generateICS, 'function');
assert.equal(typeof domUtils.sanitizeCssColor, 'function');
assert.equal(typeof plannerView.renderDayClassLecturesHTML, 'function');

const { store } = facadeStoreMod;

// 2. Indexed getTaskSessionStats accuracy + cache invalidation (deterministic same-day timestamps)
const task = store.addTask({ title: 'Phase 2 Indexed Stats Task', targetMinutes: 90 });
const start1 = new Date();
start1.setHours(9, 0, 0, 0);
const end1 = new Date(start1.getTime() + 1800 * 1000);
const sess1 = store.addSession({
  subject: 'General',
  topic: 'Phase 2 Indexed Stats Task',
  taskId: task.id,
  durationSec: 1800,
  startTime: start1.toISOString(),
  endTime: end1.toISOString()
});
assert.deepEqual(
  { count: store.getTaskSessionStats(task.id).sessionCount, mins: store.getTaskSessionStats(task.id).totalMins },
  { count: 1, mins: 30 }
);

const start2 = new Date();
start2.setHours(14, 0, 0, 0);
const end2 = new Date(start2.getTime() + 1200 * 1000);
const sess2 = store.addSession({
  subject: 'General',
  topic: 'Phase 2 Indexed Stats Task',
  taskId: task.id,
  durationSec: 1200,
  startTime: start2.toISOString(),
  endTime: end2.toISOString()
});
assert.deepEqual(
  { count: store.getTaskSessionStats(task.id).sessionCount, mins: store.getTaskSessionStats(task.id).totalMins },
  { count: 2, mins: 50 },
  'Adding second session must invalidate revision index cache'
);

store.deleteSession(sess2.id);
assert.equal(store.getTaskSessionStats(task.id).totalMins, 30, 'Deleting session must invalidate index cache');

// Direct array replacement invalidation check
store.state.sessions = [];
assert.equal(store.getTaskSessionStats(task.id).sessions.length, 0, 'Replacing store.state.sessions directly must invalidate cached index');
store.deleteTask(task.id);
store.deleteSession(sess1.id);

// 3. Unconstructed Object.create(ChronoUI.prototype) contracts
const uiProto = Object.create(ChronoUI.prototype);
assert.equal(uiProto.getRecurrenceLabel('triweekly'), 'Tri-weekly');
assert.equal(uiProto.formatRelativeDueDate('2026-11-19', '2026-11-19'), 'Due: Today');
assert.equal(uiProto.sanitizeCssColor('#123456'), '#123456');
assert.equal(uiProto.sanitizeCssColor('javascript:bad'), '#64748b');
assert.equal(uiProto.sanitizeGoogleEnableUrl('https://evil.test/x'), '');
assert.equal(uiProto.escapeHTML('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
const thursHtml = uiProto.renderDayClassLectures(4, '2026-11-19');
assert(thursHtml.includes('Kardeşlik ve İhya'), 'Prototype renderDayClassLectures must work without constructor state');

// 4. HTML Accessibility, unique IDs & trimmed eager Google Fonts
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const modalMatches = [...html.matchAll(/<div\s+id="([^"]+)"\s+class="modal"([^>]*)>/g)];
assert.equal(modalMatches.length, 13, 'Expected all 13 modals to match cleanly');
modalMatches.forEach(([, id, rest]) => {
  assert(rest.includes('role="dialog"'), `Modal #${id} must declare role="dialog"`);
  assert(rest.includes('aria-modal="true"'), `Modal #${id} must declare aria-modal="true"`);
  assert(rest.includes('aria-labelledby="'), `Modal #${id} must declare aria-labelledby`);
});

const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupIds = allIds.filter((id, idx) => allIds.indexOf(id) !== idx);
assert.deepEqual(dupIds, [], `index.html must not have duplicate element IDs (found: ${dupIds.join(', ')})`);

const fontLinks = [...html.matchAll(/fonts\.googleapis\.com\/css2\?([^"]+)/g)].map((m) => m[1]);
assert.equal(fontLinks.length, 1, 'Expected 1 eager Google Fonts link');
assert(fontLinks[0].includes('Plus+Jakarta+Sans') && !fontLinks[0].includes('Cinzel') && !fontLinks[0].includes('Cormorant'),
  'Only Plus Jakarta Sans should load eagerly; decorative fonts load on demand');

// 5. Layered CSS & reduced !important count (< 40)
const entryCss = fs.readFileSync(path.join(rootDir, 'src', 'styles.css'), 'utf8');
assert(entryCss.includes('@layer tokens, base, layout, views, components, responsive, overrides;'),
  'src/styles.css must declare native CSS layers');

let totalImportant = 0;
const walkCss = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkCss(full);
    else if (entry.name.endsWith('.css')) {
      const m = fs.readFileSync(full, 'utf8').match(/!important/g);
      totalImportant += m ? m.length : 0;
    }
  }
};
walkCss(path.join(rootDir, 'src'));
assert(totalImportant < 40, `Expected < 40 !important declarations across CSS layers, found ${totalImportant}`);

// 6. Service Worker ASSETS covers every runtime .js/.css under src/ and has zero missing files
const swSrc = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
const assetsMatch = swSrc.match(/const ASSETS = \[([\s\S]*?)\];/);
assert(assetsMatch, 'sw.js must define ASSETS array');
const swAssets = [...assetsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

swAssets.forEach((asset) => {
  if (asset === './') return;
  const rel = asset.replace(/^\.\//, '');
  assert(fs.existsSync(path.join(rootDir, rel)), `sw.js ASSETS references missing file: ${asset}`);
});

const runtimeSrcFiles = [];
const walkSrc = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSrc(full);
    } else if ((entry.name.endsWith('.js') || entry.name.endsWith('.css')) && entry.name !== 'types.js') {
      const rel = './' + path.relative(rootDir, full).replace(/\\/g, '/');
      runtimeSrcFiles.push(rel);
    }
  }
};
walkSrc(path.join(rootDir, 'src'));

runtimeSrcFiles.forEach((rel) => {
  assert(swAssets.includes(rel), `sw.js ASSETS must include runtime module ${rel}`);
});

console.log('✔ All Phase 2 modular, A11y, CSS layer, and SW coverage tests passed!');
