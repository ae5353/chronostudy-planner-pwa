#!/usr/bin/env node
// ChronoStudy Local & Google Drive Folder Scanner (Last 5 Months)
// Usage on PC or Termux:
//   node cli/scan-drive-folder.mjs "/path/to/Google Drive"

import fs from 'node:fs';
import path from 'node:path';
import { createDefaultState, applyBlankSlate } from '../src/store.js';

const targetDir = process.argv[2] || process.cwd();
const fiveMonthsAgoMs = Date.now() - 150 * 86400000;
const folderCounts = new Map();
const topicsByFolder = new Map();
const palette = ['#C85A32', '#2B4C7E', '#2E7D5B', '#7A4988', '#D9822B', '#1F7A8C', '#B8336A'];

function walk(dir, depth = 0) {
  if (depth > 4) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') || /^(node_modules|dist|build|__pycache__)$/i.test(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, depth + 1);
    } else if (ent.isFile()) {
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs >= fiveMonthsAgoMs) {
          const parentName = path.basename(dir);
          folderCounts.set(parentName, (folderCounts.get(parentName) || 0) + 1);
          const cleanTitle = ent.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
          if (cleanTitle.length > 2) {
            if (!topicsByFolder.has(parentName)) topicsByFolder.set(parentName, new Set());
            if (topicsByFolder.get(parentName).size < 6) topicsByFolder.get(parentName).add(cleanTitle);
          }
        }
      } catch (_) {}
    }
  }
}

console.log(`Scanning "${targetDir}" for files modified in the last 5 months...`);
walk(path.resolve(targetDir));

const topFolders = Array.from(folderCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 7);

if (!topFolders.length) {
  console.log('No recently modified files (last 5 months) found in that directory.');
  process.exit(0);
}

const state = applyBlankSlate(createDefaultState());
state.subjects = [];

topFolders.forEach(([folderName, count], idx) => {
  const subjId = `subj-local-${idx + 1}`;
  const code = folderName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || `TRK${idx + 1}`;
  state.subjects.push({
    id: subjId,
    code,
    name: folderName,
    color: palette[idx % palette.length],
    examDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    targetHoursPerWeek: 6,
    loggedMinutes: 0,
    currentGrade: 90,
    examWeight: 30,
    targetCourseGrade: 90
  });
  const topics = topicsByFolder.get(folderName) || new Set();
  topics.forEach((t, tIdx) => {
    state.syllabusTopics.push({
      id: `syl-local-${idx + 1}-${tIdx + 1}`,
      subjectId: subjId,
      title: t,
      status: 'Learning',
      confidence: 60
    });
  });
  console.log(`  ✔ Track: ${folderName} (${count} recent files, ${topics.size} topics)`);
});

const outPath = path.resolve('server/cloud-state.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2), 'utf8');
console.log(`\nSaved discovered tracks & topics to ${outPath}!`);
console.log(`Run "npm start" or import ${outPath} in ChronoStudy (☁️ Sync -> Import JSON Backup).`);
