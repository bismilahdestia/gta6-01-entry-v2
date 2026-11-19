// The save: cash earned and jobs finished, kept in localStorage.
// Everything is validated on load — a hand-edited or half-written save is
// treated as empty rather than crashing the game.

import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 1;

function blankSave() {
  return { version: SAVE_VERSION, cash: 0, jobs: 0 };
}

/** Validate raw parsed JSON; anything off-shape falls back to a blank save. */
export function sanitizeSave(raw) {
  const save = blankSave();
  if (!raw || typeof raw !== 'object') return save;
  if (raw.version !== SAVE_VERSION) return save;
  if (typeof raw.cash === 'number' && Number.isFinite(raw.cash)) {
    save.cash = Math.max(0, Math.min(1000000, Math.floor(raw.cash)));
  }
  if (typeof raw.jobs === 'number' && Number.isFinite(raw.jobs)) {
    save.jobs = Math.max(0, Math.min(10000, Math.floor(raw.jobs)));
  }
  return save;
}

export function loadSave() {
  try {
    const text = window.localStorage.getItem(SAVE_KEY);
    if (!text) return blankSave();
    return sanitizeSave(JSON.parse(text));
  } catch {
    return blankSave();
  }
}

export function storeSave(save) {
  try {
    const clean = sanitizeSave({ ...save, version: SAVE_VERSION });
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
    return false;
  }
}

/** Build the save object after a finished job: one place owns the shape. */
export function recordJob(cash, jobs) {
  return { version: SAVE_VERSION, cash, jobs };
}
