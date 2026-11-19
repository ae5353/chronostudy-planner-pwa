// src/store.js — Backward-compatible facade re-exporting modular Store and domain constants
export {
  Store,
  store,
  default,
  toLocalDateStr,
  DEFAULT_GROUPS,
  INITIAL_SUBJECTS,
  INITIAL_WEEKLY_EVENTS,
  LEGACY_SEED_TASK_IDS,
  LEGACY_DEFAULT_SUBJECT
} from './state/store.js';
