// ChronoStudy v3.0 — Universal Life, Self-Learning, Projects & Time Architect Store
// Includes: Universal Life & Learning Tracks (Self-Study, Projects, Fitness, Life Admin, Courses),
// SM-2 Active Recall, Natural Language Task Parser, Smart Auto-Scheduler, Conflict Detector,
// Goal Pace & Milestone Calculator, Quick Time-Shift, and Two-Way Google Calendar / .ICS Integration

const STORAGE_KEY = 'chronostudy_state_v3';

const hasLocalStorage = typeof localStorage !== 'undefined';

export function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function addDaysISO(baseIso, days) {
  const d = new Date(baseIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(targetIso) {
  const today = new Date(getTodayISO() + 'T00:00:00');
  const target = new Date(targetIso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

export function timeToMinutes(hhmm = '00:00') {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMin) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Natural-Language Smart Task Parser
 * Supports tokens like:
 *   #AI-DEV or #CS-301 (matches track/subject code or name)
 *   !Q1 / !Q2 / !Q3 / !Q4 (sets Eisenhower quadrant)
 *   ~3p or ~3 (sets estimated Pomodoros)
 *   @today / @tomorrow / @+3d / @2026-11-15 (sets due date)
 */
export function parseSmartTaskInput(rawText, subjects = [], defaultDate = getTodayISO()) {
  let title = String(rawText || '').trim();
  let quadrant = null;
  let subjectId = null;
  let estimatedPomodoros = null;
  let dueDate = null;

  const qMatch = title.match(/(?:^|\s)!(Q[1-4])\b/i);
  if (qMatch) {
    quadrant = qMatch[1].toUpperCase();
    title = title.replace(qMatch[0], ' ').trim();
  }

  const pMatch = title.match(/(?:^|\s)~(\d{1,2})p?(?:omos?)?\b/i);
  if (pMatch) {
    estimatedPomodoros = Math.max(1, Math.min(20, Number(pMatch[1])));
    title = title.replace(pMatch[0], ' ').trim();
  }

  const dMatch = title.match(/(?:^|\s)@(today|tomorrow|\+\d+d|\d{4}-\d{2}-\d{2})\b/i);
  if (dMatch) {
    const tok = dMatch[1].toLowerCase();
    if (tok === 'today') dueDate = getTodayISO();
    else if (tok === 'tomorrow') dueDate = addDaysISO(getTodayISO(), 1);
    else if (tok.startsWith('+')) {
      const n = parseInt(tok.slice(1), 10) || 1;
      dueDate = addDaysISO(getTodayISO(), n);
    } else {
      dueDate = tok;
    }
    title = title.replace(dMatch[0], ' ').trim();
  }

  const sMatch = title.match(/(?:^|\s)#([A-Za-z0-9_-]+)\b/);
  if (sMatch) {
    const query = sMatch[1].toLowerCase();
    const found = subjects.find(
      (s) =>
        s.code.toLowerCase() === query ||
        s.code.toLowerCase().replace('-', '') === query.replace('-', '') ||
        s.name.toLowerCase().includes(query)
    );
    if (found) {
      subjectId = found.id;
      title = title.replace(sMatch[0], ' ').trim();
    }
  }

  return {
    title: title.replace(/\s+/g, ' ').trim() || String(rawText).trim(),
    quadrant,
    subjectId,
    estimatedPomodoros,
    dueDate: dueDate || defaultDate
  };
}

/**
 * Detect overlapping time blocks on a given date
 */
export function detectScheduleConflicts(blocks = []) {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const conflictIds = new Set();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = timeToMinutes(a.endTime);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bStart = timeToMinutes(b.startTime);
      if (bStart < aEnd) {
        conflictIds.add(a.id);
        conflictIds.add(b.id);
      } else {
        break;
      }
    }
  }
  return conflictIds;
}

/**
 * Smart Auto-Scheduler: Finds free gaps between 08:00 and 21:30 on targetDate
 * and schedules top uncompleted Q1/Q2 tasks into available gaps.
 */
export function computeAutoScheduleBlocks(existingBlocksForDate = [], openTasks = [], targetDate = getTodayISO()) {
  const dayStart = 8 * 60;
  const dayEnd = 21 * 60 + 30;
  const occupied = existingBlocksForDate
    .map((b) => [timeToMinutes(b.startTime), timeToMinutes(b.endTime)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const [s, e] of occupied) {
    if (!merged.length || s > merged[merged.length - 1][1]) {
      merged.push([s, e]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    }
  }

  const gaps = [];
  let cursor = dayStart;
  for (const [s, e] of merged) {
    if (s - cursor >= 45) {
      gaps.push([cursor, s]);
    }
    cursor = Math.max(cursor, e + 15);
  }
  if (dayEnd - cursor >= 45) {
    gaps.push([cursor, dayEnd]);
  }

  const rankMap = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
  const existingTitles = new Set(existingBlocksForDate.map((b) => b.title.toLowerCase()));
  const candidates = openTasks
    .filter((t) => !t.completed && !existingTitles.has(`deep focus: ${t.title}`.toLowerCase()))
    .sort((a, b) => {
      const rDiff = (rankMap[a.quadrant] || 9) - (rankMap[b.quadrant] || 9);
      if (rDiff !== 0) return rDiff;
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });

  const generated = [];
  let taskIdx = 0;

  for (const [gapStart, gapEnd] of gaps) {
    let slotStart = gapStart;
    while (slotStart + 45 <= gapEnd && taskIdx < candidates.length && generated.length < 4) {
      const task = candidates[taskIdx++];
      const remainingPomos = Math.max(1, (task.estimatedPomodoros || 2) - (task.completedPomodoros || 0));
      const desiredMin = Math.min(90, Math.max(45, remainingPomos * 25));
      const actualEnd = Math.min(gapEnd, slotStart + desiredMin);
      generated.push({
        id: `blk-auto-${Date.now()}-${taskIdx}`,
        date: targetDate,
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(actualEnd),
        title: `Deep Focus: ${task.title}`,
        subjectId: task.subjectId,
        category: 'deep_work',
        done: false,
        autoScheduled: true
      });
      slotStart = actualEnd + 15;
    }
  }

  return generated;
}

/**
 * Universal Milestone Pace Calculator
 * Calculates daily minutes required to reach a weekly/milestone hour target
 */
export function calculateGoalPace(loggedMinutes = 0, targetHoursPerWeek = 6, daysRemainingInWeek = 4) {
  const targetMins = Math.max(30, Number(targetHoursPerWeek) * 60);
  const remainingMins = Math.max(0, targetMins - Number(loggedMinutes));
  const days = Math.max(1, Number(daysRemainingInWeek));
  const dailyNeeded = Math.round(remainingMins / days);
  const completionPct = Math.min(100, Math.round((Number(loggedMinutes) / targetMins) * 100));
  return {
    remainingMinutes: remainingMins,
    dailyMinutesNeeded: dailyNeeded,
    completionPct,
    status: completionPct >= 80 ? 'Ahead / On Track' : dailyNeeded <= 60 ? 'Steady Pace' : 'High Focus Needed'
  };
}

/**
 * Required Assessment / Certification / Exam Score Calculator
 */
export function calculateRequiredExamScore(currentGrade, examWeightPercent, targetGrade = 90) {
  const w = Math.max(1, Math.min(100, Number(examWeightPercent))) / 100;
  const curr = Number(currentGrade) || 0;
  const target = Number(targetGrade) || 90;
  if (w >= 1) return target;
  const required = (target - curr * (1 - w)) / w;
  return Number(required.toFixed(1));
}

export function createDefaultState() {
  const today = getTodayISO();
  return {
    theme: 'light',
    profileMode: 'universal', // 'universal' | 'academic' | 'blank'
    activeTab: 'today', // 'today' | 'tasks' | 'program' | 'study' | 'focus' | 'analytics'
    selectedDate: today,
    selectedProgramDay: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1,
    taskViewMode: 'list', // 'list' | 'matrix' | 'kanban'
    taskSubjectFilter: 'all',
    studySubTab: 'cards',

    stats: {
      totalFocusMinutes: 420,
      todayFocusMinutes: 75,
      completedPomodoros: 17,
      currentStreakDays: 6,
      lastActiveDate: today,
      weeklyDailyMinutes: [65, 95, 80, 110, 50, 90, 75]
    },

    // Universal Tracks / Focus Areas (Supports Self-Study, Personal Projects, Skills, Fitness, Life & Courses)
    subjects: [
      {
        id: 'subj-algo',
        name: 'AI, Coding & Technical Mastery',
        code: 'CS-301',
        category: 'Self-Study & Tech',
        color: '#C85A32',
        examDate: addDaysISO(today, 12),
        milestoneLabel: 'Portfolio Launch',
        targetHoursPerWeek: 8,
        loggedMinutes: 195,
        currentGrade: 91.5,
        examWeight: 35,
        targetCourseGrade: 90
      },
      {
        id: 'subj-linalg',
        name: 'Quantitative & Analytical Foundations',
        code: 'MATH-204',
        category: 'Deep Skill Study',
        color: '#2B4C7E',
        examDate: addDaysISO(today, 19),
        milestoneLabel: 'Module Mastery',
        targetHoursPerWeek: 6,
        loggedMinutes: 140,
        currentGrade: 88.0,
        examWeight: 40,
        targetCourseGrade: 90
      },
      {
        id: 'subj-cogpsy',
        name: 'Language, Reading & Synthesis',
        code: 'PSYC-210',
        category: 'Language & Books',
        color: '#2E7D5B',
        examDate: addDaysISO(today, 8),
        milestoneLabel: 'Book & Fluency Goal',
        targetHoursPerWeek: 5,
        loggedMinutes: 110,
        currentGrade: 94.0,
        examWeight: 30,
        targetCourseGrade: 92
      },
      {
        id: 'subj-sys',
        name: 'Personal Projects & Career Build',
        code: 'CS-412',
        category: 'Work & Projects',
        color: '#C6841D',
        examDate: addDaysISO(today, 5),
        milestoneLabel: 'v1.0 Release',
        targetHoursPerWeek: 7,
        loggedMinutes: 165,
        currentGrade: 89.5,
        examWeight: 35,
        targetCourseGrade: 90
      },
      {
        id: 'subj-life',
        name: 'Fitness, Training & Life Admin',
        code: 'LIFE',
        category: 'Health & Lifestyle',
        color: '#7A5C43',
        examDate: addDaysISO(today, 30),
        milestoneLabel: '10K & Conditioning',
        targetHoursPerWeek: 4,
        loggedMinutes: 60,
        currentGrade: 100,
        examWeight: 10,
        targetCourseGrade: 95
      }
    ],

    tasks: [
      {
        id: 'task-1',
        title: 'Build & benchmark graph search / AI agent workflow module',
        subjectId: 'subj-algo',
        quadrant: 'Q1',
        status: 'in_progress',
        completed: false,
        dueDate: today,
        estimatedPomodoros: 3,
        completedPomodoros: 1,
        notes: 'Compare heuristic performance and document architecture.',
        subtasks: [
          { id: 'st-1', text: 'Set up core data structures & test harness', done: true },
          { id: 'st-2', text: 'Run benchmark suite & profile bottlenecks', done: true },
          { id: 'st-3', text: 'Write summary notes & commit clean build', done: false }
        ]
      },
      {
        id: 'task-2',
        title: 'Complete matrix transformations & PCA practice exercises',
        subjectId: 'subj-linalg',
        quadrant: 'Q1',
        status: 'todo',
        completed: false,
        dueDate: today,
        estimatedPomodoros: 2,
        completedPomodoros: 0,
        notes: 'Focus on intuition behind orthogonal projections and dimensionality reduction.',
        subtasks: [
          { id: 'st-4', text: 'Work through 4 core practice problems', done: true },
          { id: 'st-5', text: 'Create 2 SM-2 recall flashcards for key takeaways', done: false }
        ]
      },
      {
        id: 'task-3',
        title: 'Read 25 pages & synthesize notes on cognitive focus & memory',
        subjectId: 'subj-cogpsy',
        quadrant: 'Q2',
        status: 'todo',
        completed: false,
        dueDate: addDaysISO(today, 2),
        estimatedPomodoros: 3,
        completedPomodoros: 1,
        notes: 'Capture key insights in Cornell Notes and convert top cues to flashcards.',
        subtasks: [
          { id: 'st-6', text: 'Highlight primary chapters & concepts', done: true },
          { id: 'st-7', text: 'Write 1-paragraph synthesis summary', done: false }
        ]
      },
      {
        id: 'task-4',
        title: 'Ship Personal Project milestone & deploy live mobile build',
        subjectId: 'subj-sys',
        quadrant: 'Q1',
        status: 'in_progress',
        completed: false,
        dueDate: addDaysISO(today, 1),
        estimatedPomodoros: 3,
        completedPomodoros: 2,
        notes: 'Verify mobile responsiveness and Google Calendar sync.',
        subtasks: []
      },
      {
        id: 'task-5',
        title: 'Organize weekly calendar, bills & appointments',
        subjectId: 'subj-life',
        quadrant: 'Q3',
        status: 'todo',
        completed: false,
        dueDate: today,
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        notes: 'Quick life-admin batch block.',
        subtasks: []
      },
      {
        id: 'task-6',
        title: '40-minute strength & zone-2 cardio conditioning session',
        subjectId: 'subj-life',
        quadrant: 'Q2',
        status: 'done',
        completed: true,
        dueDate: today,
        estimatedPomodoros: 1,
        completedPomodoros: 1,
        notes: 'Outdoor run + mobility work.',
        subtasks: []
      }
    ],

    scheduleBlocks: [
      {
        id: 'blk-1',
        date: today,
        startTime: '08:30',
        endTime: '10:00',
        title: 'Deep Focus: AI & Technical Skill Mastery',
        subjectId: 'subj-algo',
        category: 'deep_work',
        done: true
      },
      {
        id: 'blk-2',
        date: today,
        startTime: '10:30',
        endTime: '12:00',
        title: 'Structured Study: Analytical Foundations & Practice',
        subjectId: 'subj-linalg',
        category: 'lecture',
        done: true
      },
      {
        id: 'blk-3',
        date: today,
        startTime: '13:30',
        endTime: '15:00',
        title: 'Project Build: Feature Implementation & Testing',
        subjectId: 'subj-sys',
        category: 'deep_work',
        done: false
      },
      {
        id: 'blk-4',
        date: today,
        startTime: '15:30',
        endTime: '16:30',
        title: 'SM-2 Spaced Repetition Recall & Flashcard Deck',
        subjectId: 'subj-cogpsy',
        category: 'review',
        done: false
      },
      {
        id: 'blk-5',
        date: today,
        startTime: '17:30',
        endTime: '18:15',
        title: 'Fitness: Zone-2 Run & Mobility Reset',
        subjectId: 'subj-life',
        category: 'wellness',
        done: false
      },
      {
        id: 'blk-6',
        date: today,
        startTime: '19:30',
        endTime: '21:00',
        title: 'Evening Reading, Language Practice & Synthesis',
        subjectId: 'subj-cogpsy',
        category: 'deep_work',
        done: false
      }
    ],

    weeklyProgram: {
      0: [
        { id: 'wp-m1', startTime: '08:30', endTime: '10:00', title: 'Morning Deep Focus: Technical Skill Study', subjectId: 'subj-algo', type: 'Deep Focus' },
        { id: 'wp-m2', startTime: '10:30', endTime: '12:00', title: 'Analytical Foundations & Problem Solving', subjectId: 'subj-linalg', type: 'Structured Study' },
        { id: 'wp-m3', startTime: '14:00', endTime: '16:00', title: 'Personal Project Build Session', subjectId: 'subj-sys', type: 'Project Work' },
        { id: 'wp-m4', startTime: '17:30', endTime: '18:30', title: 'Strength & Mobility Conditioning', subjectId: 'subj-life', type: 'Fitness & Health' }
      ],
      1: [
        { id: 'wp-tu1', startTime: '09:00', endTime: '10:30', title: 'Language Immersion & Reading Block', subjectId: 'subj-cogpsy', type: 'Self-Study' },
        { id: 'wp-tu2', startTime: '11:00', endTime: '12:30', title: 'SM-2 Active Recall & Concept Practice', subjectId: 'subj-linalg', type: 'Review' },
        { id: 'wp-tu3', startTime: '15:00', endTime: '17:00', title: 'Hands-On Coding & System Design', subjectId: 'subj-algo', type: 'Deep Focus' }
      ],
      2: [
        { id: 'wp-w1', startTime: '08:30', endTime: '10:00', title: 'Core Skill Deep Dive & Exercises', subjectId: 'subj-algo', type: 'Deep Focus' },
        { id: 'wp-w2', startTime: '10:30', endTime: '12:00', title: 'Quantitative Study Session', subjectId: 'subj-linalg', type: 'Structured Study' },
        { id: 'wp-w3', startTime: '14:00', endTime: '16:30', title: 'Project Architecture & Execution', subjectId: 'subj-sys', type: 'Project Work' }
      ],
      3: [
        { id: 'wp-th1', startTime: '09:00', endTime: '10:30', title: 'Reading, Synthesis & Note-Taking', subjectId: 'subj-cogpsy', type: 'Self-Study' },
        { id: 'wp-th2', startTime: '11:00', endTime: '13:00', title: 'Applied Problem Solving Workshop', subjectId: 'subj-linalg', type: 'Deep Focus' },
        { id: 'wp-th3', startTime: '17:30', endTime: '18:30', title: 'Cardio Conditioning & Recovery', subjectId: 'subj-life', type: 'Fitness & Health' }
      ],
      4: [
        { id: 'wp-f1', startTime: '09:00', endTime: '11:00', title: 'Weekly Skill Challenge & Timed Practice', subjectId: 'subj-algo', type: 'Review' },
        { id: 'wp-f2', startTime: '11:30', endTime: '13:00', title: 'Project Ship & Code Polish', subjectId: 'subj-sys', type: 'Project Work' },
        { id: 'wp-f3', startTime: '15:00', endTime: '16:00', title: 'Weekly Retrospective & Life Admin Batch', subjectId: 'subj-life', type: 'Planning' }
      ],
      5: [
        { id: 'wp-sa1', startTime: '10:00', endTime: '12:00', title: 'Saturday Creative Build & Exploration', subjectId: 'subj-sys', type: 'Project Work' },
        { id: 'wp-sa2', startTime: '14:00', endTime: '15:00', title: 'Full Deck SM-2 Spaced Repetition Catch-up', subjectId: 'subj-cogpsy', type: 'Review' }
      ],
      6: [
        { id: 'wp-su1', startTime: '10:30', endTime: '12:00', title: 'Long-Form Reading & Reflection', subjectId: 'subj-cogpsy', type: 'Self-Study' },
        { id: 'wp-su2', startTime: '16:30', endTime: '17:30', title: 'Weekly Time-Block Blueprint & Reset', subjectId: 'subj-life', type: 'Planning' }
      ]
    },

    flashcards: [
      {
        id: 'fc-1',
        subjectId: 'subj-algo',
        prompt: 'What is the time complexity of Dijkstra’s algorithm using a Fibonacci Heap vs. a Binary Heap?',
        answer: 'Fibonacci Heap: O(E + V log V) because Decrease-Key is O(1) amortized. Binary Heap: O((V + E) log V).',
        interval: 1,
        repetitions: 1,
        efactor: 2.5,
        dueDate: today
      },
      {
        id: 'fc-2',
        subjectId: 'subj-linalg',
        prompt: 'State the Fundamental Theorem of Linear Algebra for the four subspaces of an m × n matrix A of rank r.',
        answer: 'Col(A) has dim r in R^m (orth. complement Null(A^T), dim m-r). Row(A) has dim r in R^n (orth. complement Null(A), dim n-r).',
        interval: 1,
        repetitions: 2,
        efactor: 2.6,
        dueDate: today
      },
      {
        id: 'fc-3',
        subjectId: 'subj-sys',
        prompt: 'In distributed systems (Raft), what guarantees the Leader Completeness Property?',
        answer: 'RequestVote RPC restriction: a voter denies its vote if the candidate’s log is less up-to-date than its own (compared by lastLogTerm, then lastLogIndex).',
        interval: 2,
        repetitions: 1,
        efactor: 2.4,
        dueDate: today
      },
      {
        id: 'fc-4',
        subjectId: 'subj-cogpsy',
        prompt: 'How does spaced repetition (SM-2) counteract the Ebbinghaus Forgetting Curve?',
        answer: 'By scheduling active recall right before memory decay crosses the forgetting threshold, flattening the decay curve and multiplying retention intervals.',
        interval: 3,
        repetitions: 2,
        efactor: 2.5,
        dueDate: today
      },
      {
        id: 'fc-5',
        subjectId: 'subj-linalg',
        prompt: 'Why does the Singular Value Decomposition A = U Σ V^T exist for EVERY matrix, unlike eigendecomposition?',
        answer: 'Because A^T A is always symmetric and positive semi-definite, guaranteeing orthonormal eigenvectors V and non-negative real singular values σ_i = √λ_i.',
        interval: 4,
        repetitions: 3,
        efactor: 2.7,
        dueDate: addDaysISO(today, 1)
      }
    ],

    cornellNotes: [
      {
        id: 'cn-1',
        subjectId: 'subj-algo',
        title: 'A* Search Admissibility & Consistency Conditions',
        date: today,
        cue: 'When is an A* heuristic h(n) admissible vs. consistent (monotonic)?',
        notes: '1. Admissible: h(n) <= h*(n) (never overestimates true cost to goal). Guarantees optimality in tree search.\n2. Consistent: h(n) <= c(n, a, n\') + h(n\') (triangle inequality). Guarantees optimality in graph search without re-opening closed nodes.',
        summary: 'Consistency implies admissibility; consistent heuristics ensure non-decreasing f(n) = g(n) + h(n) along any path.'
      },
      {
        id: 'cn-2',
        subjectId: 'subj-cogpsy',
        title: 'Deliberate Practice vs. Passive Review',
        date: today,
        cue: 'Why does active recall + immediate feedback outperform re-reading by 3x?',
        notes: 'Retrieval practice strengthens neural pathways and exposes illusion-of-competence gaps immediately, allowing targeted correction.',
        summary: 'Always convert passive reading notes into testable cues and active problem-solving blocks.'
      }
    ],

    syllabusTopics: [
      { id: 'syl-1', subjectId: 'subj-algo', title: 'Graph Search & Heuristic Optimization', status: 'Reviewing', confidence: 85 },
      { id: 'syl-2', subjectId: 'subj-algo', title: 'Dynamic Programming & State Transitions', status: 'Learning', confidence: 65 },
      { id: 'syl-3', subjectId: 'subj-sys', title: 'End-to-End Architecture & Cloud Deployment', status: 'Reviewing', confidence: 88 },
      { id: 'syl-4', subjectId: 'subj-linalg', title: 'Orthogonal Projections & Least Squares', status: 'Mastered', confidence: 95 },
      { id: 'syl-5', subjectId: 'subj-linalg', title: 'Singular Value Decomposition (SVD) & PCA', status: 'Learning', confidence: 70 },
      { id: 'syl-6', subjectId: 'subj-cogpsy', title: 'Active Recall & Spaced Repetition Systems', status: 'Mastered', confidence: 92 },
      { id: 'syl-7', subjectId: 'subj-life', title: 'Aerobic Base & Progressive Overload Routine', status: 'Reviewing', confidence: 84 }
    ],

    habits: [
      { id: 'hab-1', name: '90m+ Deep Focus Block', streak: 6, completedToday: true },
      { id: 'hab-2', name: 'Clear Daily SM-2 Recall Queue', streak: 4, completedToday: false },
      { id: 'hab-3', name: 'Time-Block Tomorrow’s Plan', streak: 9, completedToday: true },
      { id: 'hab-4', name: '30m+ Training / Movement', streak: 5, completedToday: true }
    ],

    focusSession: {
      mode: 'pomodoro',
      durationSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      isRunning: false,
      linkedTaskId: 'task-1',
      linkedSubjectId: 'subj-algo',
      soundscape: 'off'
    }
  };
}

export class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    if (!hasLocalStorage) return createDefaultState();
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('chronostudy_state_v2') ||
        localStorage.getItem('chronostudy_state_v1');
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      const def = createDefaultState();
      return {
        ...def,
        ...parsed,
        stats: { ...def.stats, ...(parsed.stats || {}) },
        cornellNotes: parsed.cornellNotes || def.cornellNotes
      };
    } catch (_) {
      return createDefaultState();
    }
  }

  save() {
    if (!hasLocalStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
  }

  update(updater) {
    updater(this.state);
    this.notify();
  }

  resetToDemo() {
    this.state = createDefaultState();
    this.notify();
  }

  // Start a clean blank slate for users who want to build from zero
  startBlankSlate() {
    const today = getTodayISO();
    this.update((s) => {
      s.profileMode = 'blank';
      s.subjects = [
        {
          id: 'subj-main',
          name: 'Primary Study / Skill Goal',
          code: 'STUDY',
          category: 'Self-Study',
          color: '#C85A32',
          examDate: addDaysISO(today, 30),
          milestoneLabel: 'Target Milestone',
          targetHoursPerWeek: 7,
          loggedMinutes: 0,
          currentGrade: 90,
          examWeight: 30,
          targetCourseGrade: 90
        },
        {
          id: 'subj-proj',
          name: 'Work & Personal Projects',
          code: 'WORK',
          category: 'Projects',
          color: '#2B4C7E',
          examDate: addDaysISO(today, 14),
          milestoneLabel: 'Project Deadline',
          targetHoursPerWeek: 10,
          loggedMinutes: 0,
          currentGrade: 90,
          examWeight: 30,
          targetCourseGrade: 90
        },
        {
          id: 'subj-health',
          name: 'Health, Fitness & Life',
          code: 'LIFE',
          category: 'Lifestyle',
          color: '#2E7D5B',
          examDate: addDaysISO(today, 30),
          milestoneLabel: 'Monthly Routine',
          targetHoursPerWeek: 5,
          loggedMinutes: 0,
          currentGrade: 100,
          examWeight: 10,
          targetCourseGrade: 95
        }
      ];
      s.tasks = [];
      s.scheduleBlocks = [];
      s.weeklyProgram = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      s.flashcards = [];
      s.cornellNotes = [];
      s.syllabusTopics = [];
      s.stats = {
        totalFocusMinutes: 0,
        todayFocusMinutes: 0,
        completedPomodoros: 0,
        currentStreakDays: 1,
        lastActiveDate: today,
        weeklyDailyMinutes: [0, 0, 0, 0, 0, 0, 0]
      };
    });
  }

  // Shift a time block earlier or later by deltaMinutes (e.g., -15 or +15)
  shiftBlockTime(blockId, deltaMinutes = 15) {
    this.update((s) => {
      const blk = s.scheduleBlocks.find((b) => b.id === blockId);
      if (!blk) return;
      const newStart = Math.max(0, Math.min(23 * 60, timeToMinutes(blk.startTime) + deltaMinutes));
      const duration = Math.max(15, timeToMinutes(blk.endTime) - timeToMinutes(blk.startTime));
      const newEnd = Math.min(23 * 60 + 59, newStart + duration);
      blk.startTime = minutesToTime(newStart);
      blk.endTime = minutesToTime(newEnd);
      s.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }

  // Import parsed .ICS or plain-text schedule blocks and recurring weekly slots
  importCalendarEvents({ scheduleBlocks = [], weeklySlots = [] }) {
    let addedBlocks = 0;
    let addedWeekly = 0;
    this.update((s) => {
      const existingBlockKeys = new Set(
        s.scheduleBlocks.map((b) => `${b.date}-${b.startTime}-${b.title.toLowerCase()}`)
      );
      scheduleBlocks.forEach((blk) => {
        const key = `${blk.date}-${blk.startTime}-${blk.title.toLowerCase()}`;
        if (!existingBlockKeys.has(key)) {
          s.scheduleBlocks.push(blk);
          existingBlockKeys.add(key);
          addedBlocks++;
        }
      });
      s.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

      weeklySlots.forEach((slot) => {
        const day = slot.dayIndex ?? 0;
        if (!s.weeklyProgram[day]) s.weeklyProgram[day] = [];
        const exists = s.weeklyProgram[day].some(
          (w) => w.startTime === slot.startTime && w.title.toLowerCase() === slot.title.toLowerCase()
        );
        if (!exists) {
          s.weeklyProgram[day].push({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            title: slot.title,
            subjectId: slot.subjectId || s.subjects[0]?.id || 'subj-algo',
            type: slot.type || 'Deep Focus'
          });
          addedWeekly++;
        }
      });
    });
    return { addedBlocks, addedWeekly };
  }

  // SuperMemo-2 (SM-2) Algorithm Implementation
  reviewFlashcard(cardId, quality) {
    this.update((s) => {
      const card = s.flashcards.find((c) => c.id === cardId);
      if (!card) return;

      let { repetitions, interval, efactor } = card;
      if (quality < 3) {
        repetitions = 0;
        interval = 1;
      } else {
        if (repetitions === 0) {
          interval = 1;
        } else if (repetitions === 1) {
          interval = 3;
        } else {
          interval = Math.max(1, Math.round(interval * efactor));
        }
        repetitions += 1;
      }

      efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (efactor < 1.3) efactor = 1.3;

      card.repetitions = repetitions;
      card.interval = interval;
      card.efactor = Number(efactor.toFixed(2));
      card.dueDate = addDaysISO(getTodayISO(), interval);
    });
  }

  convertCornellNoteToFlashcard(noteId) {
    let created = null;
    this.update((s) => {
      const note = s.cornellNotes.find((n) => n.id === noteId);
      if (!note) return;
      created = {
        id: 'fc-cn-' + Date.now(),
        subjectId: note.subjectId,
        prompt: note.cue || note.title,
        answer: `${note.summary ? note.summary + ' — ' : ''}${note.notes}`,
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
        dueDate: getTodayISO()
      };
      s.flashcards.unshift(created);
    });
    return created;
  }

  autoScheduleDate(targetDateIso = this.state.selectedDate) {
    let added = [];
    this.update((s) => {
      const existing = s.scheduleBlocks.filter((b) => b.date === targetDateIso);
      added = computeAutoScheduleBlocks(existing, s.tasks, targetDateIso);
      s.scheduleBlocks.push(...added);
      s.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return added.length;
  }

  applyProgramToDate(weekdayIndex, targetDateIso) {
    let addedCount = 0;
    this.update((s) => {
      const templateBlocks = s.weeklyProgram[weekdayIndex] || [];
      const existingKeys = new Set(
        s.scheduleBlocks
          .filter((b) => b.date === targetDateIso)
          .map((b) => `${b.startTime}-${b.title}`)
      );

      templateBlocks.forEach((tpl) => {
        const key = `${tpl.startTime}-${tpl.title}`;
        if (!existingKeys.has(key)) {
          s.scheduleBlocks.push({
            id: 'blk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            date: targetDateIso,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            title: tpl.title,
            subjectId: tpl.subjectId,
            category: tpl.type.toLowerCase().includes('lecture') ? 'lecture' : 'deep_work',
            done: false
          });
          addedCount++;
        }
      });

      s.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return addedCount;
  }

  exportICS() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ChronoStudy Planner v3.0//EN',
      'CALSCALE:GREGORIAN'
    ];

    this.state.scheduleBlocks.forEach((blk) => {
      const dateCompact = blk.date.replace(/-/g, '');
      const startCompact = blk.startTime.replace(':', '') + '00';
      const endCompact = blk.endTime.replace(':', '') + '00';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${blk.id}@chronostudy.app`,
        `DTSTART:${dateCompact}T${startCompact}`,
        `DTEND:${dateCompact}T${endCompact}`,
        `SUMMARY:${blk.title}`,
        `DESCRIPTION:ChronoStudy Scheduled Block (${blk.category})`,
        'END:VEVENT'
      );
    });

    this.state.subjects.forEach((subj) => {
      if (subj.examDate) {
        const d = subj.examDate.replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          `UID:milestone-${subj.id}@chronostudy.app`,
          `DTSTART;VALUE=DATE:${d}`,
          `SUMMARY:MILESTONE: ${subj.name} (${subj.code})`,
          'END:VEVENT'
        );
      }
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

export const store = new Store();
