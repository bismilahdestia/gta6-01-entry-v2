// Porto Alba — save.js
// Save / load progress through localStorage. One clear job: persistence.
// Saved: mission index, money, health, player position and heading, wanted
// stars, and the list of completed missions. Loading never throws — a corrupt
// or missing save just starts a fresh game.

import { CONFIG } from './config.js';

/** Snapshot the live game state into a plain object. */
export function collectSave(G) {
  return {
    version: 2,
    savedAt: Date.now(),
    mission: G.mission ? G.mission.index : 0,
    money: G.player.money,
    health: G.player.health,
    wanted: G.wanted ? G.wanted.stars : 0,
    px: G.player.pos.x,
    pz: G.player.pos.z,
    heading: G.player.heading,
    orbit: G.cameraOrbit || 0,
    onFoot: G.player.onFoot,
    completed: G.mission ? G.mission.completed.slice() : [],
  };
}

/** Write the current state to localStorage. Returns true on success. */
export function saveGame(G) {
  try {
    const data = collectSave(G);
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    G.saveNote = 'Progress saved';
    return true;
  } catch (err) {
    G.saveNote = 'Save failed — storage unavailable';
    return false;
  }
}

/** Read the save back, or null when there is none / it is unreadable. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply a loaded save onto the live game state. */
export function applySave(G, data) {
  if (!data) return false;
  G.player.money = typeof data.money === 'number' ? data.money : 0;
  G.player.health = typeof data.health === 'number' ? data.health : CONFIG.PLAYER_HEALTH;
  G.player.pos.x = typeof data.px === 'number' ? data.px : 0;
  G.player.pos.z = typeof data.pz === 'number' ? data.pz : 0;
  G.player.heading = typeof data.heading === 'number' ? data.heading : 0;
  if (typeof data.orbit === 'number') G.cameraOrbit = data.orbit;
  G.player.onFoot = data.onFoot !== false;
  if (G.mission) {
    G.mission.index = Math.min(data.mission || 0, CONFIG.MISSIONS.length - 1);
    G.mission.completed = Array.isArray(data.completed) ? data.completed.slice() : [];
  }
  if (G.wanted) G.wanted.stars = 0; // a fresh load always starts clean
  return true;
}

/** Wipe the save slot. */
export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
