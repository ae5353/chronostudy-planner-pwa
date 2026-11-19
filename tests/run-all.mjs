// tests/run-all.mjs — Sequential test runner executing each test suite in an isolated Node process
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = fs.readdirSync(__dirname)
  .filter((f) => f.startsWith('test-') && f.endsWith('.mjs'))
  .sort();

if (testFiles.length === 0) {
  console.error('No test files found in tests/.');
  process.exit(1);
}

console.log(`Running ${testFiles.length} ChronoStudy test suite(s)...\n`);

let passed = 0;
for (const file of testFiles) {
  const fullPath = path.join(__dirname, file);
  console.log(`>>> [${file}]`);
  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  if (result.status !== 0) {
    console.error(`\n✖ FAILED: ${file} (exit code ${result.status})`);
    process.exit(result.status || 1);
  }
  passed++;
  console.log('');
}

console.log(`✔ All ${passed}/${testFiles.length} test suites passed.`);
