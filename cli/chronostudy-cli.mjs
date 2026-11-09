#!/usr/bin/env node
// ChronoStudy v2.0 — Multi-Platform Terminal & CLI Companion
// Zero-dependency Node.js ES module sharing the core engine with the Web/PWA/Mobile app.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  Store,
  getTodayISO,
  daysUntil,
  parseSmartTaskInput,
  computeAutoScheduleBlocks,
  calculateRequiredExamScore,
  detectScheduleConflicts
} from '../src/store.js';

const STATE_FILE = process.env.CHRONOSTUDY_STATE_FILE
  ? path.resolve(process.env.CHRONOSTUDY_STATE_FILE)
  : fs.existsSync(path.resolve('./chronostudy-state.json'))
    ? path.resolve('./chronostudy-state.json')
    : path.join(os.homedir(), '.chronostudy-state.json');

// ANSI Styling Helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  terracotta: '\x1b[38;5;166m',
  cobalt: '\x1b[38;5;25m',
  emerald: '\x1b[38;5;29m',
  amber: '\x1b[38;5;178m',
  red: '\x1b[38;5;160m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function loadCliStore() {
  const store = new Store();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      store.state = {
        ...store.state,
        ...raw,
        stats: { ...store.state.stats, ...(raw.stats || {}) }
      };
    } catch (err) {
      console.error(`${c.amber}Warning: Failed to parse ${STATE_FILE}, using default state.${c.reset}`);
    }
  }
  return store;
}

function saveCliStore(store) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(store.state, null, 2), 'utf8');
}

function subjectBadge(subjects, subjectId) {
  const s = subjects.find((x) => x.id === subjectId);
  return s ? `[${s.code}]` : '[GEN]';
}

function printBanner() {
  console.log(
    `${c.terracotta}${c.bold}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`
  );
  console.log(
    `${c.terracotta}${c.bold}║  CHRONOSTUDY v2.0 — Academic Time-Block, Matrix & SM-2 CLI Companion   ║${c.reset}`
  );
  console.log(
    `${c.terracotta}${c.bold}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`
  );
}

function cmdDashboard(store) {
  printBanner();
  const s = store.state;
  const today = getTodayISO();
  const dueCards = s.flashcards.filter((f) => f.dueDate <= today);
  const openTasks = s.tasks.filter((t) => !t.completed);
  const todayBlocks = s.scheduleBlocks
    .filter((b) => b.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const conflicts = detectScheduleConflicts(todayBlocks);

  console.log(
    `\n${c.bold}📅 Date:${c.reset} ${today}   ` +
      `${c.bold}🔥 Streak:${c.reset} ${c.terracotta}${s.stats.currentStreakDays}d${c.reset}   ` +
      `${c.bold}⏱ Today Focus:${c.reset} ${c.emerald}${s.stats.todayFocusMinutes}m${c.reset} (${s.stats.completedPomodoros} 🍅)   ` +
      `${c.bold}🧠 Due SM-2 Cards:${c.reset} ${c.cobalt}${dueCards.length}${c.reset}`
  );

  // Exam Countdowns
  console.log(`\n${c.bold}🎓 UPCOMING EXAM HORIZON${c.reset}`);
  const sortedSubjs = [...s.subjects].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
  for (const subj of sortedSubjs) {
    const dLeft = daysUntil(subj.examDate);
    const urgencyColor = dLeft <= 7 ? c.red : dLeft <= 14 ? c.amber : c.emerald;
    const reqScore = calculateRequiredExamScore(subj.currentGrade, subj.examWeight, subj.targetCourseGrade);
    console.log(
      `  • ${c.bold}${subj.code.padEnd(9)}${c.reset} ${subj.name.padEnd(32)} ` +
        `Exam in ${urgencyColor}${String(dLeft).padStart(2)}d${c.reset} (${subj.examDate}) | ` +
        `Need ${c.bold}${reqScore}%${c.reset} on Final for ${subj.targetCourseGrade}%`
    );
  }

  // Today's Time-Block Schedule
  console.log(
    `\n${c.bold}🕒 TODAY'S TIME-BLOCK SCHEDULE (${todayBlocks.length} blocks${
      conflicts.size > 0 ? `, ${c.red}⚠ ${conflicts.size} overlapping!${c.reset}${c.bold}` : ''
    })${c.reset}`
  );
  if (todayBlocks.length === 0) {
    console.log(`  ${c.dim}No blocks scheduled for today. Run 'auto-schedule' to populate gaps.${c.reset}`);
  } else {
    for (const blk of todayBlocks) {
      const status = blk.done ? `${c.emerald}✓${c.reset}` : `○`;
      const isConflict = conflicts.has(blk.id);
      const conflictTag = isConflict ? ` ${c.red}[⚠ CONFLICT]${c.reset}` : '';
      const autoTag = blk.autoScheduled ? ` ${c.cyan}[AUTO]${c.reset}` : '';
      console.log(
        `  ${status} ${c.bold}${blk.startTime}–${blk.endTime}${c.reset}  ` +
          `${subjectBadge(s.subjects, blk.subjectId).padEnd(10)} ${blk.title}${autoTag}${conflictTag}`
      );
    }
  }

  // Priority Q1 / Q2 Tasks
  console.log(`\n${c.bold}🎯 PRIORITY EISENHOWER TASKS (${openTasks.length} open)${c.reset}`);
  const topTasks = [...openTasks].sort((a, b) => a.quadrant.localeCompare(b.quadrant)).slice(0, 6);
  for (const t of topTasks) {
    const qColor = t.quadrant === 'Q1' ? c.red : t.quadrant === 'Q2' ? c.cobalt : c.amber;
    console.log(
      `  [${qColor}${t.quadrant}${c.reset}] ${subjectBadge(s.subjects, t.subjectId).padEnd(10)} ` +
        `${t.title} ${c.dim}(${t.completedPomodoros || 0}/${t.estimatedPomodoros || 1}🍅, due ${t.dueDate})${c.reset}`
    );
  }

  // Due SM-2 Flashcards
  console.log(`\n${c.bold}🃏 DUE SM-2 FLASHCARDS (${dueCards.length} ready for active recall)${c.reset}`);
  for (const fc of dueCards.slice(0, 4)) {
    console.log(
      `  • ${subjectBadge(s.subjects, fc.subjectId).padEnd(10)} ${fc.prompt} ` +
        `${c.dim}[EF ${fc.efactor} | Int ${fc.interval}d]${c.reset}`
    );
  }
  console.log(`\n${c.dim}State file: ${STATE_FILE}${c.reset}\n`);
}

function cmdAddTask(store, rawArgs) {
  const input = rawArgs.join(' ').trim();
  if (!input) {
    console.error(`${c.red}Usage: chronostudy-cli add "<smart task string>"${c.reset}`);
    process.exit(1);
  }
  const parsed = parseSmartTaskInput(input, store.state.subjects, getTodayISO());
  const newTask = {
    id: `task-cli-${Date.now()}`,
    title: parsed.title,
    subjectId: parsed.subjectId || store.state.subjects[0]?.id || 'subj-algo',
    quadrant: parsed.quadrant || 'Q1',
    status: 'todo',
    completed: false,
    dueDate: parsed.dueDate,
    estimatedPomodoros: parsed.estimatedPomodoros || 2,
    completedPomodoros: 0,
    notes: 'Added via ChronoStudy CLI smart parser.',
    subtasks: []
  };
  store.state.tasks.unshift(newTask);
  saveCliStore(store);

  const subj = store.state.subjects.find((s) => s.id === newTask.subjectId);
  console.log(`${c.emerald}${c.bold}✓ Added Smart Task:${c.reset} ${newTask.title}`);
  console.log(`  • Course:    ${subj ? `${subj.code} (${subj.name})` : newTask.subjectId}`);
  console.log(`  • Quadrant:  ${newTask.quadrant}`);
  console.log(`  • Estimate:  ${newTask.estimatedPomodoros} Pomodoros (${newTask.estimatedPomodoros * 25} mins)`);
  console.log(`  • Due Date:  ${newTask.dueDate}`);
}

function cmdAutoSchedule(store) {
  const today = getTodayISO();
  const existing = store.state.scheduleBlocks.filter((b) => b.date === today);
  const generated = computeAutoScheduleBlocks(existing, store.state.tasks, today);

  if (generated.length === 0) {
    console.log(`${c.amber}No additional free gaps (>=45m) or unscheduled tasks found for ${today}.${c.reset}`);
    return;
  }

  store.state.scheduleBlocks.push(...generated);
  store.state.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  saveCliStore(store);

  console.log(`${c.emerald}${c.bold}⚡ Auto-Scheduled ${generated.length} Deep Focus Block(s) for ${today}:${c.reset}`);
  for (const blk of generated) {
    console.log(
      `  • ${c.bold}${blk.startTime}–${blk.endTime}${c.reset}  ${subjectBadge(store.state.subjects, blk.subjectId).padEnd(10)} ${blk.title}`
    );
  }
}

function cmdGrades(store) {
  printBanner();
  console.log(`\n${c.bold}📊 COURSE GRADE & FINAL EXAM TARGET CALCULATOR${c.reset}\n`);
  console.log(
    `  ${'Code'.padEnd(10)} ${'Course Name'.padEnd(32)} ${'Current'.padEnd(9)} ${'Weight'.padEnd(8)} ${'Target'.padEnd(8)} ${'Required Final'}`
  );
  console.log(`  ${'─'.repeat(84)}`);

  for (const subj of store.state.subjects) {
    const req = calculateRequiredExamScore(subj.currentGrade, subj.examWeight, subj.targetCourseGrade);
    const reqColor = req > 100 ? c.red : req >= 90 ? c.amber : c.emerald;
    console.log(
      `  ${c.bold}${subj.code.padEnd(10)}${c.reset} ` +
        `${subj.name.slice(0, 30).padEnd(32)} ` +
        `${(subj.currentGrade + '%').padEnd(9)} ` +
        `${(subj.examWeight + '%').padEnd(8)} ` +
        `${(subj.targetCourseGrade + '%').padEnd(8)} ` +
        `${reqColor}${c.bold}${req}%${c.reset}`
    );
  }
  console.log('');
}

function cmdExportIcs(store, outPathArg) {
  const ics = store.exportICS();
  const outPath = path.resolve(outPathArg || './chronostudy-calendar.ics');
  fs.writeFileSync(outPath, ics, 'utf8');
  console.log(`${c.emerald}${c.bold}✓ Exported RFC-5545 iCalendar (.ics):${c.reset} ${outPath}`);
}

function printHelp() {
  printBanner();
  console.log(`
${c.bold}USAGE:${c.reset}
  node cli/chronostudy-cli.mjs <command> [arguments]

${c.bold}COMMANDS:${c.reset}
  ${c.bold}dashboard | status${c.reset}          Display terminal overview of focus stats, exams, blocks & Q1 tasks
  ${c.bold}add "<smart string>"${c.reset}        Parse natural-language tokens (#CS-412 !Q1 ~3p @tomorrow) and add task
  ${c.bold}auto-schedule${c.reset}               Fill today's open schedule gaps with top Q1/Q2 tasks
  ${c.bold}grades${c.reset}                      Calculate required final exam scores across all courses
  ${c.bold}export-ics [filepath]${c.reset}       Export schedule blocks & exam milestones to an RFC-5545 .ics file
`);
}

// Entrypoint Dispatch
const [, , rawCmd = 'dashboard', ...restArgs] = process.argv;
const store = loadCliStore();

switch (rawCmd.toLowerCase()) {
  case 'dashboard':
  case 'status':
    cmdDashboard(store);
    break;
  case 'add':
    cmdAddTask(store, restArgs);
    break;
  case 'auto-schedule':
  case 'autoschedule':
    cmdAutoSchedule(store);
    break;
  case 'grades':
    cmdGrades(store);
    break;
  case 'export-ics':
  case 'ics':
    cmdExportIcs(store, restArgs[0]);
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    console.error(`${c.red}Unknown command: ${rawCmd}${c.reset}`);
    printHelp();
    process.exit(1);
}
